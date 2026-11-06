// NOVA Yapay Zeka — Electron ana süreç
const { app, BrowserWindow, ipcMain, safeStorage, shell, Menu, session, Tray, nativeImage, Notification } = require('electron');
const path = require('path');
const fs = require('fs');
const { chat, transcribe, speech } = require('./src/ai-core.js');

let autoUpdater = null;
try { ({ autoUpdater } = require('electron-updater')); } catch (_) { /* geliştirme ortamında olmayabilir */ }

// Açılışta sesin ve mikrofonun kullanıcı tıklaması beklemeden çalışması için
app.commandLine.appendSwitch('autoplay-policy', 'no-user-gesture-required');
app.setAppUserModelId('com.nova.yapayzeka');

let win, tray = null, quitting = false, trayHintShown = false;
const startHidden = process.argv.includes('--gizli');
const settingsFile = () => path.join(app.getPath('userData'), 'ayarlar.json');

function readSettings() {
  try {
    const s = JSON.parse(fs.readFileSync(settingsFile(), 'utf8'));
    if (s.apiKeyEnc && safeStorage.isEncryptionAvailable()) {
      try { s.apiKey = safeStorage.decryptString(Buffer.from(s.apiKeyEnc, 'base64')); } catch (_) { s.apiKey = ''; }
    }
    delete s.apiKeyEnc;
    if (s.keysEnc && safeStorage.isEncryptionAvailable()) {
      try { s.keys = JSON.parse(safeStorage.decryptString(Buffer.from(s.keysEnc, 'base64'))); } catch (_) { s.keys = {}; }
    }
    delete s.keysEnc;
    return s;
  } catch (_) { return {}; }
}

function writeSettings(s) {
  const copy = { ...s };
  if (copy.apiKey && safeStorage.isEncryptionAvailable()) {
    copy.apiKeyEnc = safeStorage.encryptString(copy.apiKey).toString('base64');
    delete copy.apiKey;
  }
  if (copy.keys && safeStorage.isEncryptionAvailable()) {
    copy.keysEnc = safeStorage.encryptString(JSON.stringify(copy.keys)).toString('base64');
    delete copy.keys;
  }
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(copy, null, 2), 'utf8');
  return true;
}

function showWindow() {
  if (!win) return;
  if (win.isMinimized()) win.restore();
  win.show(); win.focus();
}

function createTray() {
  if (tray) return;
  const img = nativeImage.createFromPath(path.join(__dirname, 'build', 'icon.png')).resize({ width: 16, height: 16 });
  tray = new Tray(img);
  tray.setToolTip('NOVA Yapay Zeka');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'NOVA’yı aç', click: showWindow },
    { label: 'Güncellemeleri denetle', click: () => checkUpdates(true) },
    { type: 'separator' },
    { label: 'Çıkış', click: () => { quitting = true; app.quit(); } }
  ]));
  tray.on('click', showWindow);
}

function createWindow() {
  win = new BrowserWindow({
    width: 1280, height: 860, minWidth: 820, minHeight: 680,
    backgroundColor: '#030b14', title: 'NOVA Yapay Zeka', show: false,
    icon: path.join(__dirname, 'build', 'icon.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true,
      backgroundThrottling: false // alarm ve hatırlatmalar pencere gizliyken de zamanında çalsın
    }
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => { if (!startHidden) win.show(); });
  // Kapatınca tepside çalışmaya devam et (ayarlardan kapatılabilir)
  win.on('close', (e) => {
    if (quitting || readSettings().tray === false) return;
    e.preventDefault(); win.hide();
    if (!trayHintShown && Notification.isSupported()) {
      trayHintShown = true;
      new Notification({ title: 'NOVA arka planda çalışıyor', body: 'Alarmlar ve hatırlatmalar için saatin yanındaki simgede bekliyorum. Tamamen kapatmak için simgeye sağ tıkla → Çıkış.' }).show();
    }
  });
  // Dış bağlantılar varsayılan tarayıcıda açılsın
  win.webContents.setWindowOpenHandler(({ url }) => { if (/^https?:/.test(url)) shell.openExternal(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (e, url) => { if (!url.startsWith('file:')) { e.preventDefault(); if (/^https?:/.test(url)) shell.openExternal(url); } });
  // F11 tam ekran, F12 geliştirici araçları
  win.webContents.on('before-input-event', (e, input) => {
    if (input.type !== 'keyDown') return;
    if (input.key === 'F11') { win.setFullScreen(!win.isFullScreen()); e.preventDefault(); }
    if (input.key === 'F12') { win.webContents.toggleDevTools(); e.preventDefault(); }
  });
}

// ---------- Otomatik güncelleme (GitHub Releases) ----------
function sendUpdate(state, extra = {}) { if (win && !win.isDestroyed()) win.webContents.send('update:status', { state, ...extra }); }
function setupUpdater() {
  if (!autoUpdater) return;
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => sendUpdate('checking'));
  autoUpdater.on('update-available', (i) => sendUpdate('available', { version: i.version }));
  autoUpdater.on('update-not-available', () => sendUpdate('none'));
  autoUpdater.on('download-progress', (p) => sendUpdate('progress', { percent: p.percent }));
  autoUpdater.on('update-downloaded', (i) => {
    sendUpdate('ready', { version: i.version });
    if (Notification.isSupported()) new Notification({ title: 'NOVA güncellemesi hazır', body: `v${i.version} indirildi. Uygulama kapanınca kurulacak.` }).show();
  });
  autoUpdater.on('error', (e) => sendUpdate('error', { error: String(e && e.message || e).slice(0, 160) }));
}
function checkUpdates() {
  if (!autoUpdater || !app.isPackaged) { sendUpdate('dev'); return; }
  autoUpdater.checkForUpdates().catch((e) => sendUpdate('error', { error: String(e && e.message || e).slice(0, 160) }));
}

// ---------- IPC ----------
ipcMain.handle('ai:stt', async (_e, cfg, wav) => transcribe(fetch, cfg || {}, new Uint8Array(wav)));
ipcMain.handle('ai:tts', async (_e, cfg, text) => speech(fetch, cfg || {}, String(text || '')));
ipcMain.handle('ai:chat', async (_e, cfg, system, messages) => chat(fetch, cfg || {}, String(system || ''), Array.isArray(messages) ? messages : []));
ipcMain.handle('settings:get', () => readSettings());
ipcMain.handle('settings:save', (_e, s) => writeSettings(s || {}));
ipcMain.handle('app:version', () => app.getVersion());
ipcMain.handle('app:show', () => { showWindow(); return true; });
ipcMain.handle('app:autostart', (_e, on) => {
  if (!app.isPackaged) return false;
  app.setLoginItemSettings({ openAtLogin: !!on, args: ['--gizli'] });
  return true;
});
ipcMain.handle('update:check', () => { checkUpdates(); return true; });
ipcMain.handle('update:install', () => { quitting = true; if (autoUpdater) autoUpdater.quitAndInstall(false, true); return true; });

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on('second-instance', showWindow);
  app.whenReady().then(() => {
    // Mikrofon ve bildirim izni (yalnızca uygulamanın kendi sayfası için)
    session.defaultSession.setPermissionRequestHandler((wc, perm, cb, details) => {
      cb((perm === 'media' || perm === 'notifications') && (details.requestingUrl || '').startsWith('file:'));
    });
    session.defaultSession.setPermissionCheckHandler((wc, perm) => perm === 'media' || perm === 'notifications');
    createWindow();
    createTray();
    setupUpdater();
    setTimeout(checkUpdates, 8000);
    setInterval(checkUpdates, 6 * 60 * 60 * 1000);
  });
  app.on('before-quit', () => { quitting = true; });
  app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
}
