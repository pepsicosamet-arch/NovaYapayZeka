const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('nova', {
  getSettings: () => ipcRenderer.invoke('settings:get'),
  saveSettings: (s) => ipcRenderer.invoke('settings:save', s),
  version: () => ipcRenderer.invoke('app:version'),
  show: () => ipcRenderer.invoke('app:show'),
  setAutostart: (on) => ipcRenderer.invoke('app:autostart', on),
  chat: (cfg, system, messages) => ipcRenderer.invoke('ai:chat', cfg, system, messages),
  transcribe: (cfg, wav) => ipcRenderer.invoke('ai:stt', cfg, wav),
  speech: (cfg, text) => ipcRenderer.invoke('ai:tts', cfg, text),
  checkUpdate: () => ipcRenderer.invoke('update:check'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  onUpdate: (cb) => ipcRenderer.on('update:status', (_e, u) => cb(u))
});
