// NOVA Yapay Zeka — Araçlar: takvim, hava durumu, geri sayım, notlar, hatırlatmalar, alarm
(function (root) {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const lower = (s) => String(s).toLocaleLowerCase('tr-TR');
  const pad = (n) => String(n).padStart(2, '0');
  const load = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } };
  const save = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

  const MONTHS = ['ocak', 'şubat', 'mart', 'nisan', 'mayıs', 'haziran', 'temmuz', 'ağustos', 'eylül', 'ekim', 'kasım', 'aralık'];
  const DAYS = ['pazar', 'pazartesi', 'salı', 'çarşamba', 'perşembe', 'cuma', 'cumartesi'];
  const DAYS_SHORT = ['Pz', 'Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct'];

  const TABS = [
    { id: 'takvim', name: 'Takvim' }, { id: 'hava', name: 'Hava' }, { id: 'gerisayim', name: 'Geri sayım' },
    { id: 'notlar', name: 'Notlar' }, { id: 'hatirlatma', name: 'Hatırlatma' }, { id: 'alarm', name: 'Alarm' }
  ];
  const ICONS = {
    takvim: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5" width="17" height="15" rx="2.5"/><path d="M3.5 10h17M8 3v4M16 3v4"/></svg>',
    hava: '<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3.4"/><path d="M9 2.5v1.6M9 13.9v1.6M2.5 9h1.6M3.9 3.9l1.1 1.1M13 5l1.1-1.1"/><path d="M10 19.5h8a3.2 3.2 0 0 0 .3-6.4 4.5 4.5 0 0 0-8.6.9A2.8 2.8 0 0 0 10 19.5z"/></svg>',
    gerisayim: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13.5" r="7.5"/><path d="M12 9.5v4l2.5 2M9.5 2.5h5M12 2.5V6"/></svg>',
    notlar: '<svg viewBox="0 0 24 24"><path d="M6 3.5h9l4 4v13H6z"/><path d="M14.5 3.5V8H19M9 12h7M9 15.5h7"/></svg>',
    hatirlatma: '<svg viewBox="0 0 24 24"><path d="M6 16.5V11a6 6 0 0 1 12 0v5.5l1.5 2h-15z"/><path d="M10 20.5a2 2 0 0 0 4 0"/></svg>',
    alarm: '<svg viewBox="0 0 24 24"><circle cx="12" cy="13" r="7"/><path d="M12 9v4h3M4 5.5 6.5 3M20 5.5 17.5 3M7 19.5 5.5 21M17 19.5l1.5 1.5"/></svg>'
  };

  // ---------- Veri ----------
  let notes = load('nova.notes', []);           // {id, t, d}
  let reminders = load('nova.reminders', []);   // {id, t, at, fired}
  let countdowns = load('nova.countdowns', []); // {id, t, at, timer, fired}
  let alarms = load('nova.alarms', []);         // {id, h, m, label, days:[], on, last}
  let wx = load('nova.weather', null);          // {city, lat, lon, data, at}
  const persist = () => { save('nova.notes', notes); save('nova.reminders', reminders); save('nova.countdowns', countdowns); save('nova.alarms', alarms); };

  let hooks = { canRing: () => true, speak: async () => {}, notify: () => {}, show: () => {}, city: () => '', ringStart: () => {}, ringEnd: () => {}, onWeather: () => {} };
  let current = 'takvim', calMonth = new Date(), calSel = new Date();

  // ---------- Zaman ifadelerini çözme ----------
  const NUMW = { 'yarım': 0.5, 'bir': 1, 'iki': 2, 'üç': 3, 'dört': 4, 'beş': 5, 'altı': 6, 'yedi': 7, 'sekiz': 8, 'dokuz': 9, 'on': 10, 'on beş': 15, 'yirmi': 20, 'otuz': 30, 'kırk': 40, 'kırk beş': 45, 'elli': 50 };
  const UNIT = { saniye: 1e3, sn: 1e3, dakika: 6e4, dk: 6e4, saat: 36e5, gün: 864e5, hafta: 6048e5 };
  const num = (s) => NUMW[s] != null ? NUMW[s] : parseFloat(String(s).replace(',', '.'));

  function parseWhen(raw, opts = {}) {
    let t = ' ' + lower(raw) + ' ';
    const now = new Date();
    const kill = (re) => { t = t.replace(re, ' '); };
    // göreli süre: "10 dakika sonra", "yarım saat", "2 saat 30 dakika"
    const relRe = /(\d+(?:[.,]\d+)?|kırk beş|on beş|yarım|bir|iki|üç|dört|beş|altı|yedi|sekiz|dokuz|on|yirmi|otuz|kırk|elli)\s*(saniye|sn|dakika|dk|saat|gün|hafta)(?:lık|lik|luk|lük)?/g;
    let rel = 0, m;
    while ((m = relRe.exec(t))) {
      // "saat 9" gibi saat ifadesini süre sanma
      if (m[2] === 'saat' && /^\s*\d/.test(t.slice(m.index + m[0].length)) && !/sonra|içinde|boyunca/.test(t)) continue;
      rel += num(m[1]) * UNIT[m[2]];
    }
    if (rel > 0) {
      kill(relRe); kill(/\b(sonra|içinde|boyunca)\b/g);
      return { date: new Date(now.getTime() + rel), rel: true, rest: t };
    }
    let day = null, hasTime = false, h = 9, mi = 0, sameWeekday = false;
    if (/\bbugün\b/.test(t)) { day = new Date(now); kill(/\bbugün\b/g); }
    else if (/(?<![a-zçğıöşü])(öbür gün|ertesi gün)/.test(t)) { day = new Date(now); day.setDate(day.getDate() + 2); kill(/(?<![a-zçğıöşü])(öbür gün|ertesi gün)/g); }
    else if (/\byarın/.test(t)) { day = new Date(now); day.setDate(day.getDate() + 1); kill(/\byarın\w*/g); }
    // tarih: "29 ekim", "29/10", "29.10.2026"
    let dm = t.match(new RegExp('\\b(\\d{1,2})\\s+(' + MONTHS.join('|') + ')\\w*(?:\\s+(\\d{4}))?'));
    if (dm) {
      day = new Date(dm[3] ? +dm[3] : now.getFullYear(), MONTHS.indexOf(dm[2]), +dm[1]);
      if (!dm[3] && day < new Date(now.getFullYear(), now.getMonth(), now.getDate())) day.setFullYear(day.getFullYear() + 1);
      kill(dm[0]);
    } else if ((dm = t.match(/\b(\d{1,2})[./](\d{1,2})(?:[./](\d{2,4}))?\b(?!\s*(?:'|’)?(?:de|da|te|ta))/)) && +dm[2] <= 12 && !/[:]/.test(dm[0])) {
      const y = dm[3] ? (+dm[3] < 100 ? 2000 + +dm[3] : +dm[3]) : now.getFullYear();
      if (+dm[1] > 12 || dm[3]) { day = new Date(y, +dm[2] - 1, +dm[1]); kill(dm[0]); }
    }
    let label = '';
    if (/\byılbaşı/.test(t)) { day = new Date(now.getFullYear() + 1, 0, 1); kill(/\byılbaşı[a-zçğıöşü]*/g); label = 'Yılbaşı'; }
    if (!day) {
      const wd = DAYS.slice().sort((a, b) => b.length - a.length).find(d => new RegExp('(?<![a-zçğıöşü])' + d).test(t));
      if (wd) {
        const idx = DAYS.indexOf(wd); day = new Date(now);
        const add = (idx - now.getDay() + 7) % 7; if (add === 0) sameWeekday = true;
        day.setDate(day.getDate() + add); kill(new RegExp('(?<![a-zçğıöşü])' + wd + '[a-zçğıöşü]*', 'g'));
      }
    }
    // saat
    let period = null;
    const pm = t.match(/(?<![a-zçğıöşü])(sabah|öğleden sonra|öğlen|öğle|akşam|gece)[a-zçğıöşü]*/);
    if (pm) { period = pm[1]; kill(pm[0]); }
    const tm = t.match(/(?:\bsaat\s*)(\d{1,2})(?:[:.](\d{2}))?(?:\s*(?:'|’)?\s*(?:de|da|te|ta|ye|ya|e|a))?(?![a-zçğıöşü])|\b(\d{1,2})[:.](\d{2})(?:\s*(?:'|’)?\s*(?:de|da|te|ta|ye|ya|e|a))?(?![a-zçğıöşü\d])|\b(\d{1,2})\s*(?:'|’)?\s*(?:de|da|te|ta|ye|ya|e|a)(?![a-zçğıöşü])/);
    if (tm) {
      h = +(tm[1] || tm[3] || tm[5]); mi = +(tm[2] || tm[4] || 0);
      if (h <= 23 && mi <= 59) { hasTime = true; kill(tm[0]); }
    } else if (period) {
      const pn = t.match(/\b(\d{1,2})\b/);
      if (pn) { h = +pn[1]; hasTime = true; kill(pn[0]); }
      else { h = { sabah: 8, öğle: 12, öğlen: 12, 'öğleden sonra': 15, akşam: 19, gece: 22 }[period]; hasTime = true; }
    }
    if (hasTime && period) {
      if ((period === 'akşam' || period === 'öğleden sonra') && h < 12) h += 12;
      if ((period === 'öğle' || period === 'öğlen') && h < 6) h += 12;
      if (period === 'gece' && h >= 7 && h < 12) h += 12;
    } else if (hasTime && !period && h >= 1 && h <= 6 && !opts.alarm) {
      // "3'te" büyük ihtimalle öğleden sonradır (alarmlar hariç)
      h += 12;
    }
    if (!day && !hasTime) return null;
    if (day && !hasTime && label) { h = 0; mi = 0; }
    let date = day ? new Date(day) : new Date(now);
    date.setHours(h, mi, 0, 0);
    if ((!day || sameWeekday) && date <= now) date.setDate(date.getDate() + (sameWeekday ? 7 : 1));
    kill(/\bsaat\b/g);
    return { date, rel: false, hasTime, hasDay: !!day, rest: t, h, m: mi, label };
  }

  function cleanText(t, extra) {
    let s = ' ' + t + ' ';
    s = s.replace(extra || /$^/, ' ')
      .replace(/\b(bana|lütfen|benim için|bir|diye|için|ver|kur|ayarla|başlat|oluştur|ekle|yap|koy)\b/g, ' ')
      .replace(/[?!.,;:]+/g, ' ').replace(/\s+/g, ' ').trim();
    return s ? s.charAt(0).toLocaleUpperCase('tr-TR') + s.slice(1) : '';
  }

  // ---------- Biçimleme ----------
  function fmtWhen(d) {
    d = new Date(d); const now = new Date();
    const day0 = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
    const diff = Math.round((day0(d) - day0(now)) / 864e5);
    const tm = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    if (diff === 0) return 'bugün ' + tm;
    if (diff === 1) return 'yarın ' + tm;
    if (diff > 1 && diff < 7) return DAYS[d.getDay()] + ' ' + tm;
    return d.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }) + ' ' + tm;
  }
  function fmtLeft(ms, spoken) {
    if (ms <= 0) return spoken ? 'süre doldu' : 'Doldu';
    const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60;
    if (spoken) return [d && d + ' gün', h && h + ' saat', m && m + ' dakika', !d && !h && sec && sec + ' saniye'].filter(Boolean).join(' ');
    if (d) return `${d} g ${h} sa ${m} dk`;
    if (h) return `${h}:${pad(m)}:${pad(sec)}`;
    return `${pad(m)}:${pad(sec)}`;
  }

  // ---------- Hava durumu (Open-Meteo, anahtar gerekmez) ----------
  const WMO = (c) => c === 0 ? ['Açık', 'sun'] : c <= 2 ? ['Parçalı bulutlu', 'partly'] : c === 3 ? ['Kapalı', 'cloud'] : c <= 48 ? ['Sisli', 'fog']
    : c <= 57 ? ['Çisenti', 'rain'] : c <= 67 ? ['Yağmurlu', 'rain'] : c <= 77 ? ['Karlı', 'snow'] : c <= 82 ? ['Sağanak', 'rain'] : c <= 86 ? ['Kar sağanağı', 'snow'] : ['Gök gürültülü', 'storm'];
  const WICON = {
    sun: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M18.7 5.3l-1.6 1.6M6.9 17.1l-1.6 1.6"/></svg>',
    partly: '<svg viewBox="0 0 24 24"><circle cx="9" cy="9" r="3.4"/><path d="M9 2.5v1.6M2.5 9h1.6M3.9 3.9l1.1 1.1M13 5l1.1-1.1"/><path d="M10 19.5h8a3.2 3.2 0 0 0 .3-6.4 4.5 4.5 0 0 0-8.6.9A2.8 2.8 0 0 0 10 19.5z"/></svg>',
    cloud: '<svg viewBox="0 0 24 24"><path d="M7 18.5h10.5a3.8 3.8 0 0 0 .4-7.6 5.5 5.5 0 0 0-10.6 1.2A3.3 3.3 0 0 0 7 18.5z"/></svg>',
    fog: '<svg viewBox="0 0 24 24"><path d="M4 9h16M3 13h18M5 17h14"/></svg>',
    rain: '<svg viewBox="0 0 24 24"><path d="M7 15h10.5a3.8 3.8 0 0 0 .4-7.6 5.5 5.5 0 0 0-10.6 1.2A3.3 3.3 0 0 0 7 15z"/><path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5"/></svg>',
    snow: '<svg viewBox="0 0 24 24"><path d="M7 14h10.5a3.8 3.8 0 0 0 .4-7.6 5.5 5.5 0 0 0-10.6 1.2A3.3 3.3 0 0 0 7 14z"/><path d="M8 18h.01M12 20h.01M16 18h.01M10 21.5h.01M14 21.5h.01" stroke-width="2.6"/></svg>',
    storm: '<svg viewBox="0 0 24 24"><path d="M7 14h10.5a3.8 3.8 0 0 0 .4-7.6 5.5 5.5 0 0 0-10.6 1.2A3.3 3.3 0 0 0 7 14z"/><path d="M12.5 14l-2 3.5h3l-2 3.5"/></svg>'
  };

  async function getWeather(city, force) {
    city = (city || '').trim();
    if (!city) throw new Error('Şehir belirtilmedi');
    const same = wx && lower(wx.city) === lower(city);
    if (same && !force && Date.now() - wx.at < 20 * 6e4) return wx;
    let lat, lon, name = city;
    if (same) { lat = wx.lat; lon = wx.lon; name = wx.city; }
    else {
      const g = await fetch('https://geocoding-api.open-meteo.com/v1/search?count=1&language=tr&name=' + encodeURIComponent(city)).then(r => r.json());
      const p = g.results && g.results[0];
      if (!p) throw new Error(`"${city}" adında bir yer bulamadım`);
      lat = p.latitude; lon = p.longitude; name = p.name;
    }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=auto&forecast_days=6`;
    const data = await fetch(url).then(r => { if (!r.ok) throw new Error('Hava durumu servisine ulaşılamadı'); return r.json(); });
    wx = { city: name, lat, lon, data, at: Date.now() };
    save('nova.weather', wx);
    hooks.onWeather(wx);
    return wx;
  }

  function weatherSentence(w, when) {
    const c = w.data.current, d = w.data.daily;
    const i = when === 'yarın' ? 1 : 0;
    if (i === 1) {
      const [desc] = WMO(d.weather_code[1]);
      return `${w.city} için yarın hava ${lower(desc)}; en yüksek ${Math.round(d.temperature_2m_max[1])}, en düşük ${Math.round(d.temperature_2m_min[1])} derece. Yağış ihtimali yüzde ${d.precipitation_probability_max[1] ?? 0}.`;
    }
    const [desc] = WMO(c.weather_code);
    return `${w.city}'da şu an ${Math.round(c.temperature_2m)} derece, hava ${lower(desc)}. Hissedilen ${Math.round(c.apparent_temperature)} derece. Bugün en yüksek ${Math.round(d.temperature_2m_max[0])}, en düşük ${Math.round(d.temperature_2m_min[0])} derece; yağış ihtimali yüzde ${d.precipitation_probability_max[0] ?? 0}.`;
  }

  function widgetHTML() {
    if (!wx || !wx.data) return null;
    const [, ic] = WMO(wx.data.current.weather_code);
    return { icon: WICON[ic], temp: Math.round(wx.data.current.temperature_2m) + '°', city: wx.city };
  }

  // ---------- Sesli / yazılı komutlar ----------
  async function command(text) {
    const t = lower(text).trim();

    // NOT
    let m = t.match(/^(?:bir\s+)?(?:not al|not et|notlara ekle|not ekle|not)\s*[:\-,]?\s+(.+)/);
    if (m) {
      const body = text.trim().slice(text.trim().length - m[1].length);
      notes.unshift({ id: uid(), t: body, d: Date.now() }); persist(); refresh();
      return { agent: 'notlar', text: `Not aldım: **${body}**`, tab: 'notlar' };
    }
    if (/notlar(ım)?(ı)?\s*(oku|göster|neler|listele)|notlarım(da)? ne var/.test(t)) {
      if (!notes.length) return { agent: 'notlar', text: 'Henüz notun yok. "Not al: …" diyerek ekleyebilirsin.' };
      return { agent: 'notlar', text: 'Son notların:\n' + notes.slice(0, 6).map(n => '- ' + n.t).join('\n'), tab: 'notlar' };
    }

    // ALARM
    if (/\balarm/.test(t) && /(kur|ayarla|koy|ekle|oluştur|aç|alarm\s*$|alarmı|\d)/.test(t) && !/(kapat|iptal|sil|listele|göster|neler)/.test(t)) {
      const w = parseWhen(t, { alarm: true });
      if (!w) return { agent: 'alarm', text: 'Alarmı kaç için kurayım? Örneğin "sabah 7.30\'a alarm kur" diyebilirsin.', tab: 'alarm' };
      let days = [];
      if (/hafta içi/.test(t)) days = [1, 2, 3, 4, 5];
      else if (/hafta sonu/.test(t)) days = [0, 6];
      else if (/her gün|hergün|her sabah/.test(t)) days = [0, 1, 2, 3, 4, 5, 6];
      const d = w.date;
      const a = { id: uid(), h: d.getHours(), m: d.getMinutes(), label: '', days, on: true, last: '' };
      if (!days.length && w.hasDay) a.date = d.toDateString();
      if (w.rel) a.date = d.toDateString();
      alarms.push(a); persist(); refresh();
      const when = days.length ? (days.length === 7 ? 'her gün' : days.length === 5 ? 'hafta içi her gün' : 'hafta sonları') + ` ${pad(a.h)}:${pad(a.m)}` : fmtWhen(d);
      return { agent: 'alarm', text: `Alarm kuruldu: **${when}**.`, tab: 'alarm' };
    }
    if (/alarm/.test(t) && /(kapat|iptal|sil)/.test(t)) {
      const n = alarms.filter(a => a.on).length; alarms.forEach(a => a.on = false); persist(); refresh();
      return { agent: 'alarm', text: n ? `${n} alarmı kapattım.` : 'Açık alarm yok.', tab: 'alarm' };
    }
    if (/alarm(lar)?(ım)?(ı)?\s*(göster|listele|neler)|alarmlarım/.test(t)) {
      const on = alarms.filter(a => a.on);
      return { agent: 'alarm', text: on.length ? 'Açık alarmların:\n' + on.map(a => `- ${pad(a.h)}:${pad(a.m)} ${a.label || ''}`).join('\n') : 'Açık alarmın yok.', tab: 'alarm' };
    }

    // GERİ SAYIM / ZAMANLAYICI
    if (/(geri sayım|zamanlayıcı|sayaç|kronometre)/.test(t) || (/(dakika|saniye|saat)\s*(kur|say|başlat)/.test(t) && !/hatırlat/.test(t))) {
      const w = parseWhen(t);
      if (!w) return { agent: 'gerisayim', text: 'Ne kadar sayayım? Örneğin "10 dakikalık geri sayım başlat" ya da "29 ekime geri sayım".', tab: 'gerisayim' };
      const title = cleanText(w.rest, /(geri sayım[a-zçğıöşü]*|zamanlayıcı[a-zçğıöşü]*|sayaç[a-zçğıöşü]*|kronometre[a-zçğıöşü]*|\bkadar|başlat|\bsay\b)/g) || w.label || (w.rel ? 'Zamanlayıcı' : w.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' }));
      const c = { id: uid(), t: title, at: w.date.getTime(), timer: !!w.rel, fired: false };
      countdowns.push(c); persist(); refresh();
      return { agent: 'gerisayim', text: w.rel ? `Zamanlayıcı başladı: **${fmtLeft(c.at - Date.now(), true)}**. Bitince haber veririm.` : `Geri sayım eklendi: **${title}** — ${fmtWhen(c.at)}, ${fmtLeft(c.at - Date.now(), true)} kaldı.`, tab: 'gerisayim' };
    }
    if (/ne kadar kaldı|kaç gün kaldı/.test(t) && countdowns.length) {
      const up = countdowns.filter(c => c.at > Date.now()).sort((a, b) => a.at - b.at);
      if (up.length) return { agent: 'gerisayim', text: up.slice(0, 4).map(c => `- **${c.t}**: ${fmtLeft(c.at - Date.now(), true)}`).join('\n'), tab: 'gerisayim' };
    }

    // HATIRLATMA
    if (/hatırlat/.test(t) && !/^\s*hatırla\b(?!t)/.test(t)) {
      const w = parseWhen(t);
      if (!w) return { agent: 'hatirlatma', text: 'Ne zaman hatırlatayım? Örneğin "yarın 9\'da toplantıyı hatırlat" ya da "20 dakika sonra ilacımı hatırlat".', tab: 'hatirlatma' };
      const title = cleanText(w.rest, /\bhatırlat\w*\b/g) || 'Hatırlatma';
      reminders.push({ id: uid(), t: title, at: w.date.getTime(), fired: false }); persist(); refresh();
      return { agent: 'hatirlatma', text: `Tamam, ${lower(title)} hatırlatacağım — **${fmtWhen(w.date)}**.`, tab: 'hatirlatma' };
    }
    if (/hatırlatma(lar)?(ım)?(ı)?\s*(göster|listele|neler)|hatırlatmalarım/.test(t)) {
      const up = reminders.filter(r => !r.fired).sort((a, b) => a.at - b.at);
      return { agent: 'hatirlatma', text: up.length ? 'Yaklaşan hatırlatmalar:\n' + up.slice(0, 6).map(r => `- ${fmtWhen(r.at)} — ${r.t}`).join('\n') : 'Yaklaşan hatırlatman yok.', tab: 'hatirlatma' };
    }

    // TAKVİM: "bugün ne var", "yarın programım"
    if (/(ne var|programım|planım|etkinlik|takvim)/.test(t) && /(bugün|yarın|hafta|takvim)/.test(t)) {
      const now = new Date(); let from = new Date(now.getFullYear(), now.getMonth(), now.getDate()), days = 1, label = 'Bugün';
      if (/yarın/.test(t)) { from.setDate(from.getDate() + 1); label = 'Yarın'; }
      else if (/hafta/.test(t)) { days = 7; label = 'Önümüzdeki 7 gün'; }
      const to = from.getTime() + days * 864e5;
      const items = reminders.filter(r => r.at >= from.getTime() && r.at < to).sort((a, b) => a.at - b.at);
      const al = alarms.filter(a => a.on);
      return { agent: 'takvim', text: items.length ? `${label} takviminde:\n` + items.map(r => `- ${fmtWhen(r.at)} — ${r.t}`).join('\n') + (al.length ? `\n\nAyrıca ${al.length} açık alarmın var.` : '') : `${label} için takviminde bir şey yok.`, tab: 'takvim' };
    }

    // HAVA
    if (/\bhava\b|hava durumu|kaç derece|yağmur yağacak|şemsiye/.test(t)) {
      let city = '';
      const cm = text.match(/([A-Za-zÇĞİÖŞÜçğıöşü]+)\s*(?:'|’)?\s*(?:de|da|te|ta)\s+(?:hava|yarın|bugün|kaç)/);
      if (cm && !/^(bugün|yarın|burada|şehrimde|bizde)$/i.test(cm[1])) city = cm[1];
      city = city || hooks.city();
      if (!city) return { agent: 'hava', text: 'Hangi şehir için bakayım? "Manisa\'da hava nasıl" gibi söyleyebilir ya da AYARLAR\'dan şehrini girebilirsin.', tab: 'hava' };
      try {
        const w = await getWeather(city);
        refresh();
        let s = weatherSentence(w, /yarın/.test(t) ? 'yarın' : 'bugün');
        if (/şemsiye|yağmur/.test(t)) s += (w.data.daily.precipitation_probability_max[/yarın/.test(t) ? 1 : 0] || 0) >= 40 ? ' Şemsiyeni al.' : ' Şemsiyeye gerek yok gibi.';
        return { agent: 'hava', text: s, tab: 'hava' };
      } catch (e) { return { agent: 'hava', text: 'Hava durumuna bakamadım: ' + e.message }; }
    }
    return null;
  }

  // ---------- Zamanlayıcı (her saniye) ----------
  let ringing = null, audioCtx = null, beepTimer = null;
  function beep(kind) {
    try {
      audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const notesHz = kind === 'chime' ? [880, 1175, 1568] : [988, 784, 988, 784];
      notesHz.forEach((f, i) => {
        const o = audioCtx.createOscillator(), g = audioCtx.createGain(), t0 = audioCtx.currentTime + i * (kind === 'chime' ? 0.18 : 0.16);
        o.type = 'sine'; o.frequency.value = f; o.connect(g); g.connect(audioCtx.destination);
        g.gain.setValueAtTime(0, t0); g.gain.linearRampToValueAtTime(kind === 'chime' ? 0.25 : 0.35, t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.001, t0 + 0.5);
        o.start(t0); o.stop(t0 + 0.55);
      });
    } catch (_) {}
  }

  function ring(kind, title, sub, snoozeFn) {
    if (!hooks.canRing()) return; // telefon arka plandaysa bildirimi Android verir
    if (ringing) stopRing();
    ringing = { snoozeFn };
    hooks.show(); hooks.ringStart();
    $('ringKind').textContent = kind === 'alarm' ? 'ALARM' : kind === 'timer' ? 'SÜRE DOLDU' : 'HATIRLATMA';
    $('ringTitle').textContent = title; $('ringSub').textContent = sub || '';
    $('ringSnooze').classList.toggle('hidden', !snoozeFn);
    $('ring').classList.remove('hidden');
    hooks.notify((kind === 'alarm' ? '⏰ ' : '🔔 ') + title, sub || 'NOVA Yapay Zeka');
    if (kind === 'reminder') {
      beep('chime');
      setTimeout(() => hooks.speak('Hatırlatma: ' + title), 700);
    } else {
      beep('alarm'); let n = 0;
      beepTimer = setInterval(() => { beep('alarm'); if (++n > 300) stopRing(); }, 1100);
    }
  }
  function stopRing() {
    clearInterval(beepTimer); beepTimer = null;
    $('ring').classList.add('hidden');
    if (ringing) { ringing = null; hooks.ringEnd(); }
  }

  function tick() {
    const now = new Date(), ts = now.getTime();
    let changed = false;
    for (const r of reminders) {
      if (!r.fired && r.at <= ts) {
        r.fired = true; changed = true;
        if (ts - r.at < 12 * 36e5) ring('reminder', r.t, fmtWhen(r.at));
      }
    }
    for (const c of countdowns) {
      if (!c.fired && c.at <= ts) {
        c.fired = true; changed = true;
        if (ts - c.at < 36e5) {
          if (c.timer) ring('timer', c.t, 'Zamanlayıcı bitti', () => { countdowns.push({ id: uid(), t: c.t, at: Date.now() + 5 * 6e4, timer: true, fired: false }); persist(); });
          else ring('reminder', c.t + ' — bugün!', 'Geri sayım tamamlandı');
        }
      }
    }
    const key = now.toDateString() + ` ${now.getHours()}:${now.getMinutes()}`;
    for (const a of alarms) {
      if (!a.on || a.last === key || a.h !== now.getHours() || a.m !== now.getMinutes()) continue;
      if (a.days && a.days.length && !a.days.includes(now.getDay())) continue;
      if ((!a.days || !a.days.length) && a.date && a.date !== now.toDateString()) continue;
      a.last = key; changed = true;
      if (!a.days || !a.days.length) a.on = false;
      ring('alarm', `${pad(a.h)}:${pad(a.m)}${a.label ? ' · ' + a.label : ''}`, a.label ? '' : 'Günaydın!', () => {
        const d = new Date(Date.now() + 5 * 6e4);
        alarms.push({ id: uid(), h: d.getHours(), m: d.getMinutes(), label: (a.label || 'Alarm') + ' (ertelendi)', days: [], on: true, last: '', date: d.toDateString(), temp: true });
        persist();
      });
    }
    // eski tek seferlik ertelenmiş alarmları temizle
    const before = alarms.length; alarms = alarms.filter(a => !(a.temp && !a.on)); if (alarms.length !== before) changed = true;
    if (changed) { persist(); refresh(); }
    if (!$('tools').classList.contains('hidden') && current === 'gerisayim') renderCountdownTimes();
  }

  // ---------- Panel ----------
  function open(tab) {
    current = tab || current;
    $('tools').classList.remove('hidden');
    [...document.querySelectorAll('.tool-tab')].forEach(b => b.classList.toggle('on', b.dataset.tab === current));
    [...document.querySelectorAll('.rail button')].forEach(b => b.classList.toggle('on', b.dataset.tab === current));
    render();
    if (current === 'hava' && hooks.city() && (!wx || Date.now() - wx.at > 20 * 6e4)) getWeather(wx ? wx.city : hooks.city()).then(render).catch(() => {});
  }
  function close() { $('tools').classList.add('hidden'); [...document.querySelectorAll('.rail button')].forEach(b => b.classList.remove('on')); }
  function isOpen() { return !$('tools').classList.contains('hidden'); }
  function refresh() { if (isOpen()) render(); }

  function render() {
    const body = $('toolBody');
    const fn = { takvim: rCal, hava: rWx, gerisayim: rCount, notlar: rNotes, hatirlatma: rRem, alarm: rAlarm }[current];
    body.innerHTML = ''; fn(body);
  }
  const h = (html) => { const d = document.createElement('div'); d.innerHTML = html.trim(); return d.firstChild; };
  const dtLocal = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

  // Takvim
  function rCal(b) {
    const y = calMonth.getFullYear(), mo = calMonth.getMonth();
    const first = new Date(y, mo, 1), start = (first.getDay() + 6) % 7, nDays = new Date(y, mo + 1, 0).getDate();
    const today = new Date().toDateString();
    const evDays = new Set(reminders.map(r => new Date(r.at).toDateString()));
    countdowns.forEach(c => evDays.add(new Date(c.at).toDateString()));
    let cells = '';
    for (let i = 0; i < start; i++) cells += '<span></span>';
    for (let d = 1; d <= nDays; d++) {
      const ds = new Date(y, mo, d).toDateString();
      cells += `<button data-d="${d}" class="${ds === today ? 'today' : ''} ${ds === calSel.toDateString() ? 'sel' : ''}">${d}${evDays.has(ds) ? '<i></i>' : ''}</button>`;
    }
    b.appendChild(h(`<div class="cal">
      <div class="cal-head"><button class="tbtn" id="calPrev">‹</button><b>${calMonth.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' })}</b><button class="tbtn" id="calNext">›</button></div>
      <div class="cal-grid wk">${['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'].map(x => `<span>${x}</span>`).join('')}</div>
      <div class="cal-grid days">${cells}</div></div>`));
    $('calPrev').onclick = () => { calMonth = new Date(y, mo - 1, 1); render(); };
    $('calNext').onclick = () => { calMonth = new Date(y, mo + 1, 1); render(); };
    b.querySelectorAll('.days button').forEach(x => x.onclick = () => { calSel = new Date(y, mo, +x.dataset.d); render(); });
    const s0 = new Date(calSel.getFullYear(), calSel.getMonth(), calSel.getDate()).getTime();
    const items = reminders.filter(r => r.at >= s0 && r.at < s0 + 864e5).sort((a, b) => a.at - b.at);
    b.appendChild(h(`<div class="tsec"><div class="tlabel">${calSel.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long' }).toLocaleUpperCase('tr-TR')}</div>
      ${items.length ? items.map(r => `<div class="titem ${r.fired ? 'done' : ''}"><span class="tm">${pad(new Date(r.at).getHours())}:${pad(new Date(r.at).getMinutes())}</span><span class="tx">${esc(r.t)}</span><button class="del" data-id="${r.id}">✕</button></div>`).join('') : '<div class="tempty">Bu gün için kayıt yok.</div>'}
      <form class="tform" id="calForm"><input type="time" id="calTime" value="09:00" required><input id="calText" placeholder="Etkinlik ekle…" required><button class="tbtn gold">Ekle</button></form></div>`));
    b.querySelectorAll('.del').forEach(x => x.onclick = () => { reminders = reminders.filter(r => r.id !== x.dataset.id); persist(); render(); });
    $('calForm').onsubmit = (e) => {
      e.preventDefault(); const [hh, mm] = $('calTime').value.split(':').map(Number);
      const d = new Date(calSel); d.setHours(hh, mm, 0, 0);
      reminders.push({ id: uid(), t: $('calText').value.trim(), at: d.getTime(), fired: d.getTime() <= Date.now() }); persist(); render();
    };
  }

  // Hava
  function rWx(b) {
    const city = (wx && wx.city) || hooks.city() || '';
    b.appendChild(h(`<form class="tform" id="wxForm"><input id="wxCity" placeholder="Şehir (ör. Manisa)" value="${esc(city)}" required><button class="tbtn gold">Getir</button></form>`));
    $('wxForm').onsubmit = (e) => { e.preventDefault(); const c = $('wxCity').value.trim(); $('wxOut').innerHTML = '<div class="tempty">Yükleniyor…</div>'; getWeather(c, true).then(render).catch(err => { $('wxOut').innerHTML = `<div class="tempty">${esc(err.message)}</div>`; }); };
    const out = h('<div id="wxOut"></div>'); b.appendChild(out);
    if (!wx || !wx.data) { out.innerHTML = '<div class="tempty">Şehrini yaz ve Getir’e bas. Ya da “Manisa’da hava nasıl?” diye sor.</div>'; return; }
    const c = wx.data.current, d = wx.data.daily, [desc, ic] = WMO(c.weather_code);
    out.innerHTML = `<div class="wx-now"><div class="wx-ic">${WICON[ic]}</div><div><div class="wx-t">${Math.round(c.temperature_2m)}°</div><div class="wx-d">${esc(wx.city)} · ${desc}</div></div></div>
      <div class="wx-meta"><span>Hissedilen <b>${Math.round(c.apparent_temperature)}°</b></span><span>Nem <b>%${c.relative_humidity_2m}</b></span><span>Rüzgâr <b>${Math.round(c.wind_speed_10m)} km/s</b></span></div>
      <div class="wx-days">${d.time.map((ds, i) => { const [dd, ii] = WMO(d.weather_code[i]); const day = i === 0 ? 'Bugün' : i === 1 ? 'Yarın' : DAYS[new Date(ds + 'T12:00').getDay()].replace(/^./, x => x.toLocaleUpperCase('tr-TR')); return `<div><span class="wd">${day}</span><span class="wi" title="${dd}">${WICON[ii]}</span><span class="wp">%${d.precipitation_probability_max[i] ?? 0}</span><span class="wr"><b>${Math.round(d.temperature_2m_max[i])}°</b> ${Math.round(d.temperature_2m_min[i])}°</span></div>`; }).join('')}</div>
      <div class="tempty">Güncellendi: ${new Date(wx.at).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })} · Kaynak: Open-Meteo</div>`;
  }

  // Geri sayım
  function rCount(b) {
    b.appendChild(h(`<div class="tsec"><div class="tlabel">HIZLI ZAMANLAYICI</div><div class="quick">${[[1, '1 dk'], [5, '5 dk'], [10, '10 dk'], [15, '15 dk'], [25, '25 dk'], [60, '1 saat']].map(([m, l]) => `<button class="tbtn" data-m="${m}">${l}</button>`).join('')}</div></div>`));
    b.querySelectorAll('.quick button').forEach(x => x.onclick = () => { countdowns.push({ id: uid(), t: x.textContent + ' zamanlayıcı', at: Date.now() + x.dataset.m * 6e4, timer: true, fired: false }); persist(); render(); });
    const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(0, 0, 0, 0);
    b.appendChild(h(`<form class="tform col" id="cdForm"><div class="tlabel">TARİHE GERİ SAYIM</div><input id="cdText" placeholder="Ne için? (ör. Doğum günüm)" required><div class="tform"><input type="datetime-local" id="cdAt" value="${dtLocal(d)}" required><button class="tbtn gold">Ekle</button></div></form>`));
    $('cdForm').onsubmit = (e) => { e.preventDefault(); countdowns.push({ id: uid(), t: $('cdText').value.trim(), at: new Date($('cdAt').value).getTime(), timer: false, fired: false }); persist(); render(); };
    const list = countdowns.slice().sort((a, b) => (a.fired - b.fired) || a.at - b.at);
    b.appendChild(h(`<div class="tsec">${list.length ? list.map(c => `<div class="titem cd ${c.at <= Date.now() ? 'done' : ''}"><span class="tx">${esc(c.t)}<small>${c.timer ? 'zamanlayıcı' : fmtWhen(c.at)}</small></span><span class="left" data-at="${c.at}">${fmtLeft(c.at - Date.now())}</span><button class="del" data-id="${c.id}">✕</button></div>`).join('') : '<div class="tempty">Henüz geri sayım yok.</div>'}</div>`));
    b.querySelectorAll('.del').forEach(x => x.onclick = () => { countdowns = countdowns.filter(c => c.id !== x.dataset.id); persist(); render(); });
  }
  function renderCountdownTimes() { document.querySelectorAll('#toolBody .left').forEach(el => el.textContent = fmtLeft(+el.dataset.at - Date.now())); }

  // Notlar
  function rNotes(b) {
    b.appendChild(h(`<form class="tform col" id="noteForm"><textarea id="noteText" rows="3" placeholder="Not yaz… (ya da “Not al: …” de)" required></textarea><div class="tform end"><button class="tbtn gold">Notu kaydet</button></div></form>`));
    $('noteForm').onsubmit = (e) => { e.preventDefault(); notes.unshift({ id: uid(), t: $('noteText').value.trim(), d: Date.now() }); persist(); render(); };
    b.appendChild(h(`<div class="tsec">${notes.length ? notes.map(n => `<div class="titem note"><span class="tx">${esc(n.t).replace(/\n/g, '<br>')}<small>${new Date(n.d).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</small></span><button class="del" data-id="${n.id}">✕</button></div>`).join('') : '<div class="tempty">Henüz not yok.</div>'}</div>`));
    b.querySelectorAll('.del').forEach(x => x.onclick = () => { notes = notes.filter(n => n.id !== x.dataset.id); persist(); render(); });
  }

  // Hatırlatmalar
  function rRem(b) {
    const d = new Date(Date.now() + 36e5); d.setMinutes(0, 0, 0);
    b.appendChild(h(`<form class="tform col" id="remForm"><input id="remText" placeholder="Neyi hatırlatayım?" required><div class="tform"><input type="datetime-local" id="remAt" value="${dtLocal(d)}" required><button class="tbtn gold">Ekle</button></div><div class="tempty">İpucu: “Yarın 9’da toplantıyı hatırlat” diye söyleyebilirsin.</div></form>`));
    $('remForm').onsubmit = (e) => { e.preventDefault(); reminders.push({ id: uid(), t: $('remText').value.trim(), at: new Date($('remAt').value).getTime(), fired: false }); persist(); render(); };
    const up = reminders.filter(r => !r.fired).sort((a, b) => a.at - b.at), past = reminders.filter(r => r.fired).sort((a, b) => b.at - a.at).slice(0, 5);
    const row = (r) => `<div class="titem ${r.fired ? 'done' : ''}"><span class="tm">${fmtWhen(r.at)}</span><span class="tx">${esc(r.t)}</span><button class="del" data-id="${r.id}">✕</button></div>`;
    b.appendChild(h(`<div class="tsec"><div class="tlabel">YAKLAŞAN</div>${up.length ? up.map(row).join('') : '<div class="tempty">Yaklaşan hatırlatma yok.</div>'}${past.length ? '<div class="tlabel">GEÇMİŞ</div>' + past.map(row).join('') : ''}</div>`));
    b.querySelectorAll('.del').forEach(x => x.onclick = () => { reminders = reminders.filter(r => r.id !== x.dataset.id); persist(); render(); });
  }

  // Alarm
  function rAlarm(b) {
    b.appendChild(h(`<form class="tform col" id="alForm"><div class="tform"><input type="time" id="alTime" value="07:30" required class="big"><input id="alLabel" placeholder="Etiket (isteğe bağlı)"></div>
      <div class="dayset">${[1, 2, 3, 4, 5, 6, 0].map(i => `<label><input type="checkbox" value="${i}"><span>${DAYS_SHORT[i]}</span></label>`).join('')}</div>
      <div class="tform end"><button type="button" class="tbtn" id="alTest">Sesi dene</button><button class="tbtn gold">Alarm kur</button></div></form>`));
    $('alTest').onclick = () => beep('alarm');
    $('alForm').onsubmit = (e) => {
      e.preventDefault(); const [hh, mm] = $('alTime').value.split(':').map(Number);
      const days = [...b.querySelectorAll('.dayset input:checked')].map(x => +x.value);
      const a = { id: uid(), h: hh, m: mm, label: $('alLabel').value.trim(), days, on: true, last: '' };
      if (!days.length) { const d = new Date(); d.setHours(hh, mm, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1); a.date = d.toDateString(); }
      alarms.push(a); persist(); render();
    };
    const list = alarms.filter(a => !a.temp).sort((a, b) => a.h * 60 + a.m - (b.h * 60 + b.m));
    const daysTxt = (a) => !a.days || !a.days.length ? 'Bir kez' : a.days.length === 7 ? 'Her gün' : a.days.join() === '1,2,3,4,5' ? 'Hafta içi' : a.days.slice().sort((x, y) => ((x + 6) % 7) - ((y + 6) % 7)).map(i => DAYS_SHORT[i]).join(' ');
    b.appendChild(h(`<div class="tsec">${list.length ? list.map(a => `<div class="titem al ${a.on ? '' : 'off'}"><span class="tbig">${pad(a.h)}:${pad(a.m)}</span><span class="tx">${esc(a.label || 'Alarm')}<small>${daysTxt(a)}</small></span><label class="sw"><input type="checkbox" data-id="${a.id}" ${a.on ? 'checked' : ''}><i></i></label><button class="del" data-id="${a.id}">✕</button></div>`).join('') : '<div class="tempty">Alarm yok. “Sabah 7’ye alarm kur” diyebilirsin.</div>'}</div>`));
    b.querySelectorAll('.sw input').forEach(x => x.onchange = () => {
      const a = alarms.find(z => z.id === x.dataset.id); a.on = x.checked;
      if (a.on && (!a.days || !a.days.length)) { const d = new Date(); d.setHours(a.h, a.m, 0, 0); if (d <= new Date()) d.setDate(d.getDate() + 1); a.date = d.toDateString(); }
      persist(); render();
    });
    b.querySelectorAll('.del').forEach(x => x.onclick = () => { alarms = alarms.filter(a => a.id !== x.dataset.id); persist(); render(); });
  }

  // ---------- Başlat ----------
  function init(h0) {
    hooks = Object.assign(hooks, h0 || {});
    const rail = $('rail'), tabs = $('toolTabs');
    for (const tb of TABS) {
      const r = document.createElement('button'); r.dataset.tab = tb.id; r.title = tb.name; r.innerHTML = ICONS[tb.id];
      r.onclick = () => (isOpen() && current === tb.id) ? close() : open(tb.id);
      rail.appendChild(r);
      const t = document.createElement('button'); t.className = 'tool-tab'; t.dataset.tab = tb.id; t.innerHTML = ICONS[tb.id] + `<span>${tb.name}</span>`;
      t.onclick = () => open(tb.id); tabs.appendChild(t);
    }
    $('toolsClose').onclick = close;
    $('ringStop').onclick = () => stopRing();
    $('ringSnooze').onclick = () => { if (ringing && ringing.snoozeFn) ringing.snoozeFn(); stopRing(); refresh(); };
    setInterval(tick, 1000); tick();
    // hava durumu: açılışta ve 30 dakikada bir
    const upd = () => { const c = (wx && wx.city) || hooks.city(); if (c) getWeather(c).catch(() => {}); };
    if (wx) hooks.onWeather(wx);
    setTimeout(upd, 1500); setInterval(upd, 30 * 6e4);
  }

  // Telefonda (uygulama kapalıyken) çalmış olanları işaretle: "r:id", "c:id", "a:id"
  function markFired(ids) {
    let ch = false;
    for (const full of ids || []) {
      const t = full.slice(0, 1), id = full.slice(2);
      if (t === 'r') reminders.forEach(r => { if (r.id === id && !r.fired) { r.fired = true; ch = true; } });
      if (t === 'c') countdowns.forEach(c => { if (c.id === id && !c.fired) { c.fired = true; ch = true; } });
      if (t === 'a') alarms.forEach(a => { if (a.id === id && (!a.days || !a.days.length) && a.on) { a.on = false; ch = true; } });
    }
    if (ch) { persist(); refresh(); }
  }
  // Bildirime dokunarak açılınca alarm ekranını göster
  function externalRing(ev) {
    const kind = ev.kind === 'alarm' ? 'alarm' : ev.kind === 'timer' ? 'timer' : 'reminder';
    const snooze = kind === 'reminder' ? null : () => {
      const d = new Date(Date.now() + 5 * 6e4);
      alarms.push({ id: uid(), h: d.getHours(), m: d.getMinutes(), label: (ev.title || 'Alarm') + ' (ertelendi)', days: [], on: true, last: '', date: d.toDateString(), temp: true });
      persist();
    };
    ring(kind, ev.title || 'NOVA', ev.sub || '', snooze);
  }

  root.NovaTools = { init, open, close, isOpen, command, getWeather, widgetHTML, parseWhen, stopRing, markFired, externalRing, get ringing() { return !!ringing; } };
})(window);
