// NOVA Yapay Zeka — Android köprüsü (yalnızca APK içinde yüklenir, diğer betiklerden ÖNCE)
(function () {
  'use strict';
  const A = window.NovaAndroid;
  if (!A) return;
  document.documentElement.classList.add('android');

  const safeGet = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const rawSet = Storage.prototype.setItem;

  // ---------- 1) Telefonda çalmış alarmları "çaldı" olarak işaretle (araçlar yüklenmeden önce) ----------
  function applyFired(ids) {
    if (!ids || !ids.length) return false;
    const rem = safeGet('nova.reminders', []), cd = safeGet('nova.countdowns', []), al = safeGet('nova.alarms', []);
    let ch = false;
    for (const full of ids) {
      const [t, id] = [full.slice(0, 1), full.slice(2)];
      if (t === 'r') rem.forEach(r => { if (r.id === id && !r.fired) { r.fired = true; ch = true; } });
      if (t === 'c') cd.forEach(c => { if (c.id === id && !c.fired) { c.fired = true; ch = true; } });
      if (t === 'a') al.forEach(a => { if (a.id === id && (!a.days || !a.days.length) && a.on) { a.on = false; ch = true; } });
    }
    if (ch) {
      rawSet.call(localStorage, 'nova.reminders', JSON.stringify(rem));
      rawSet.call(localStorage, 'nova.countdowns', JSON.stringify(cd));
      rawSet.call(localStorage, 'nova.alarms', JSON.stringify(al));
    }
    return ch;
  }
  const takeFired = () => { try { return JSON.parse(A.takeFired() || '[]'); } catch (_) { return []; } };
  applyFired(takeFired());

  // ---------- 2) Alarm / hatırlatma / geri sayımları telefona kur ----------
  function nextAlarm(a, now) {
    if (!a.on) return 0;
    const d = new Date(now); d.setHours(a.h, a.m, 0, 0);
    if (a.days && a.days.length) {
      for (let k = 0; k < 8; k++) { if (d.getTime() > now && a.days.includes(d.getDay())) return d.getTime(); d.setDate(d.getDate() + 1); d.setHours(a.h, a.m, 0, 0); }
      return 0;
    }
    if (a.date) { const x = new Date(a.date); x.setHours(a.h, a.m, 0, 0); return x.getTime() > now ? x.getTime() : 0; }
    if (d.getTime() <= now) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  const pad = (n) => String(n).padStart(2, '0');
  function collect() {
    const now = Date.now(), ev = [];
    for (const r of safeGet('nova.reminders', [])) if (!r.fired && r.at > now) ev.push({ id: 'r:' + r.id, at: r.at, kind: 'reminder', title: r.t, sub: new Date(r.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' }) });
    for (const c of safeGet('nova.countdowns', [])) if (!c.fired && c.at > now) ev.push({ id: 'c:' + c.id, at: c.at, kind: c.timer ? 'timer' : 'reminder', title: c.timer ? c.t : c.t + ' — bugün!', sub: c.timer ? 'Zamanlayıcı bitti' : 'Geri sayım tamamlandı' });
    for (const a of safeGet('nova.alarms', [])) {
      const at = nextAlarm(a, now);
      if (at) ev.push({ id: 'a:' + a.id, at, kind: 'alarm', title: `${pad(a.h)}:${pad(a.m)}${a.label ? ' · ' + a.label : ''}`, sub: a.label ? '' : 'Günaydın!', days: a.days || [], h: a.h, m: a.m });
    }
    return ev.sort((x, y) => x.at - y.at).slice(0, 60);
  }
  let syncTimer = null;
  let askedExact = false;
  function sync() {
    clearTimeout(syncTimer);
    syncTimer = setTimeout(() => {
      try {
        const ev = collect();
        A.schedule(JSON.stringify(ev));
        // Android 14+: tam zamanlı alarm izni yoksa bir kez sor (yoksa alarm birkaç dakika gecikebilir)
        if (ev.length && !askedExact && A.canExactAlarm && !A.canExactAlarm() && window.NOVA && NOVA.toast) {
          askedExact = true;
          NOVA.toast('Alarmların tam vaktinde çalması için izin gerekiyor.', 'İzin ver', () => { A.requestExactAlarm(); document.getElementById('toast').classList.add('hidden'); });
        }
      } catch (_) {}
    }, 300);
  }
  Storage.prototype.setItem = function (k, v) {
    rawSet.call(this, k, v);
    if (k === 'nova.reminders' || k === 'nova.countdowns' || k === 'nova.alarms') sync();
  };
  sync();

  // ---------- 3) Türkçe seslendirme (Android'in kendi sesi) ----------
  let seq = 0, current = null;
  const synth = {
    speaking: false, pending: false, paused: false, onvoiceschanged: null,
    getVoices() { return [{ name: 'Android Türkçe', lang: A.ttsLanguage() || 'tr-TR', localService: true, default: true, voiceURI: 'android-tts' }]; },
    speak(u) {
      if (current) { const c = current; current = null; c.onend && c.onend({}); }
      const id = 'u' + (++seq);
      current = u; u._id = id; synth.speaking = true;
      A.speak(id, String(u.text || ''), u.rate || 1);
    },
    cancel() { A.stopSpeak(); synth.speaking = false; if (current) { const c = current; current = null; c.onend && c.onend({}); } },
    pause() {}, resume() {}
  };
  function Utter(text) { this.text = text || ''; this.lang = 'tr-TR'; this.rate = 1; this.pitch = 1; this.volume = 1; this.voice = null; this.onend = null; this.onerror = null; this.onstart = null; }
  try { Object.defineProperty(window, 'speechSynthesis', { value: synth, configurable: true }); } catch (_) { window.speechSynthesis = synth; }
  window.SpeechSynthesisUtterance = Utter;

  // ---------- 4) Telefondan gelen olaylar ----------
  let background = false, wasListening = false;
  window.NovaAndroidState = { get background() { return background; } };
  window.NovaAndroidEvents = {
    ttsState() { if (synth.onvoiceschanged) try { synth.onvoiceschanged(); } catch (_) {} },
    ttsStart(id) { if (current && current._id === id) { synth.speaking = true; current.onstart && current.onstart({}); } },
    ttsDone(id) { if (current && current._id === id) { const c = current; current = null; synth.speaking = false; c.onend && c.onend({}); } },
    micGranted() {
      const s = safeGet('nova.settings', {});
      if (s.listen !== false && window.NOVA && NOVA.startListening) NOVA.startListening(true);
    },
    pause() {
      background = true;
      const dock = document.getElementById('dockCore');
      wasListening = !!(dock && dock.classList.contains('mic'));
      if (wasListening && window.NOVA) NOVA.stopListening();
      synth.cancel();
    },
    resume() {
      const fired = takeFired();
      if (fired.length && window.NovaTools && NovaTools.markFired) NovaTools.markFired(fired);
      background = false;
      if (wasListening && window.NOVA) { wasListening = false; setTimeout(() => NOVA.startListening(true), 300); }
      sync();
    },
    ring(json) { try { const ev = JSON.parse(json); if (window.NovaTools && NovaTools.externalRing) NovaTools.externalRing(ev); } catch (_) {} }
  };

  // ---------- 5) Geri tuşu: açık paneli kapat, yoksa uygulamayı arka plana al ----------
  const vis = (id) => { const e = document.getElementById(id); return !!(e && !e.classList.contains('hidden') && getComputedStyle(e).display !== 'none'); };
  window.NovaBack = function () {
    const anyOpen = (window.NovaTools && (NovaTools.ringing || NovaTools.isOpen())) ||
      ['about', 'settings', 'drawer', 'card', 'storyAgents', 'storyHow', 'reply'].some(vis);
    if (!anyOpen) return false;
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    return true;
  };

  // ---------- 6) Güncelleme: GitHub'daki en son APK ----------
  const newer = (a, b) => { const x = a.split('.').map(Number), y = b.split('.').map(Number); for (let i = 0; i < 3; i++) { if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0); } return false; };
  const fromPlay = (() => { try { return !!(A.fromPlayStore && A.fromPlayStore()); } catch (_) { return false; } })();
  if (!fromPlay) window.NovaUpdate = {
    async check(cb) {
      cb({ state: 'checking' });
      try {
        const r = await fetch('https://api.github.com/repos/pepsicosamet-arch/NovaYapayZeka/releases/latest', { headers: { Accept: 'application/vnd.github+json' } });
        if (!r.ok) throw new Error('sunucu ' + r.status);
        const d = await r.json();
        const v = String(d.tag_name || '').replace(/^v/i, '');
        const apk = (d.assets || []).find(x => /\.apk$/i.test(x.name));
        if (apk && v && newer(v, A.version())) cb({ state: 'apk', version: v, url: apk.browser_download_url });
        else cb({ state: 'none' });
      } catch (e) { cb({ state: 'error', error: e.message }); }
    },
    open(url) { A.openUrl(url); }
  };

  // Telefona özel küçük ayarlar
  document.addEventListener('DOMContentLoaded', () => {
    const inp = document.getElementById('askInput'); if (inp) inp.placeholder = 'Konuş ya da yaz…';
    if (fromPlay) { const u = document.getElementById('updCheck'); if (u) u.style.display = 'none'; const st = document.getElementById('updStatus'); if (st) st.textContent = 'Güncellemeler Google Play üzerinden gelir.'; }
    for (const id of ['sTray', 'sAuto']) { const e = document.getElementById(id); if (e && e.closest('label')) e.closest('label').style.display = 'none'; }
    document.querySelectorAll('#about .muted').forEach(m => { m.innerHTML = m.innerHTML.replace('Türkçe bir masaüstü asistanı', 'Türkçe bir asistan'); });
    document.querySelectorAll('#settings .muted').forEach(m => { m.innerHTML = m.innerHTML.replace('bilgisayarında şifreli saklanır', 'yalnızca bu telefonda, uygulamanın içinde saklanır'); });
  });

  // Bildirimden açıldıysa alarmı göster
  window.addEventListener('load', () => {
    setTimeout(() => {
      const r = A.takeLaunchRing();
      if (r) window.NovaAndroidEvents.ring(r);
    }, 600);
  });
})();
