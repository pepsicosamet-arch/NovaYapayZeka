/* NOVA Yapay Zeka — arayüz ve sahne */
(() => {
  'use strict';
  const { AGENTS, route } = window.NovaAgents;
  const { PRESETS, KEY_PROVIDERS, LOCAL_PROVIDERS, STT_PROVIDERS, detectProvider, chat, transcribe, speech } = window.NovaAI;
  const Voice = window.NovaVoice;
  const $ = (id) => document.getElementById(id);
  const isElectron = !!window.nova;
  const STATE_LABEL = { idle: 'BEKLEMEDE', listen: 'SENİ DİNLİYORUM', hear: 'DUYUYORUM…', stt: 'ANLIYORUM', think: 'DÜŞÜNÜYORUM', speak: 'KONUŞUYORUM', error: 'HATA' };
  const MODES = ['GENEL BAKIŞ', 'AJANLAR', 'NASIL ÇALIŞIR'];

  // ---------- Yerleşim (açı derece, saat yönü; yarıçap çekirdeğe oranla) ----------
  const LAYOUT = {
    asistan: [192, 1.45], hafiza: [2, 1.24], strateji: [262, 1.4], arastirma: [222, 1.52],
    finans: [302, 1.42], editor: [334, 1.95], satis: [162, 1.62], pazarlama: [148, 1.48],
    operasyon: [131, 1.38], sosyal: [92, 1.3], muhendis: [55, 1.42], tasarim: [24, 1.62],
    notlar: [156, 2.2], gerisayim: [111, 1.56], alarm: [72, 1.6], takvim: [17, 2.12],
    hatirlatma: [6, 2.5], hava: [314, 2.2]
  };

  // ---------- Durum ----------
  let settings = { v: 3, mode: 'auto', keys: {}, local: {}, model: '', city: '', name: '', tts: true, listen: true };
  let listening = false, voiceTurn = false, hearing = false;
  let history = load('nova.history', []);
  let memory = load('nova.memory', []);
  let state = 'idle';
  let activeAgent = null;
  let mode = 0;
  let busy = false;

  function load(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (_) { return d; } }
  function save(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} }

  // ---------- Ajan düğümleri ----------
  const agentsEl = $('agents');
  const nodes = {};
  for (const a of AGENTS) {
    const b = document.createElement('button');
    b.className = 'agent ' + a.group;
    b.innerHTML = `<span class="node"></span><span class="name">${a.name}</span>`;
    b.title = `${a.name} — ${a.role}`;
    b.addEventListener('click', (e) => { e.stopPropagation(); if (a.group === 'tool') { closeCard(); window.NovaTools.open(a.id); } else openCard(a, b); });
    agentsEl.appendChild(b);
    nodes[a.id] = { el: b, x: 0, y: 0, a };
  }

  // ---------- Sahne ----------
  const cv = $('scene'), cx2 = cv.getContext('2d');
  let W = 0, H = 0, DPR = 1, CX = 0, CY = 0, R = 100;
  let traces = [], sphere = [];
  // Zayıf bilgisayar algılanırsa sahne otomatik sadeleşir
  let lite = false, slowFrames = 0, frameCount = 0;

  function layout() {
    DPR = lite ? 1 : Math.min(window.devicePixelRatio || 1, 1.25);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * DPR; cv.height = H * DPR;
    CX = W / 2; CY = Math.max(H * 0.47, 260) - 20;
    const portrait = H > W * 1.25;
    R = Math.max(70, Math.min(W * (portrait ? 0.24 : W < 760 ? 0.24 : 0.16), (H - 330) * 0.42, 170));
    const hit = $('coreHit');
    Object.assign(hit.style, { left: CX - R + 'px', top: CY - R + 'px', width: R * 2 + 'px', height: R * 2 + 'px' });

    for (const id in nodes) {
      const n = nodes[id], [deg, f] = LAYOUT[id] || [0, 1.5];
      const ang = deg * Math.PI / 180;
      let x = CX + Math.cos(ang) * R * f * (portrait ? 0.82 : W < 760 ? 0.95 : 1.08);
      let y = CY + Math.sin(ang) * R * f * (portrait ? 1.3 : 0.92);
      x = Math.max(24, Math.min(W - 24, x)); y = Math.max(W < 760 ? 196 : 150, Math.min(H - 230, y));
      n.x = x; n.y = y;
      const el = n.el;
      el.style.left = x + 'px'; el.style.top = y + 'px';
      el.classList.remove('left', 'below', 'above');
      const c = Math.cos(ang), s = Math.sin(ang);
      if (Math.abs(c) < 0.35) el.classList.add(s > 0 ? 'below' : 'above');
      else if (c < 0) el.classList.add('left');
    }
    buildTraces(); buildSphere(); buildStatic();
  }

  function rnd(a, b) { return a + Math.random() * (b - a); }

  function buildTraces() {
    traces = [];
    const n = Math.round(Math.min(18, Math.max(8, H / 55)));
    for (let i = 0; i < n; i++) {
      const left = i % 2 === 0;
      const y0 = CY + rnd(-R * 1.9, R * 1.6);
      const x0 = left ? 0 : W;
      const dir = left ? 1 : -1;
      const pts = [[x0, y0]];
      let x = x0 + dir * rnd(W * 0.05, W * 0.16), y = y0;
      pts.push([x, y]);
      const dy = rnd(-40, 40);
      x += dir * Math.abs(dy) ; y += dy; pts.push([x, y]);
      const endX = CX - dir * R * rnd(1.15, 1.9);
      if ((endX - x) * dir > 20) pts.push([endX, y]);
      let len = 0; for (let k = 1; k < pts.length; k++) len += Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]);
      traces.push({ pts, len, t: Math.random(), sp: rnd(0.04, 0.12) });
    }
  }

  function buildSphere() {
    sphere = [];
    const N = lite ? 320 : W < 760 ? 450 : 650, g = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < N; i++) {
      const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = g * i;
      const jitter = rnd(0.55, 1);
      sphere.push({ x: Math.cos(th) * r, y, z: Math.sin(th) * r, j: jitter, n: Math.random() * 6.28 });
    }
  }

  function pointAt(tr, t) {
    let d = t * tr.len;
    for (let k = 1; k < tr.pts.length; k++) {
      const [ax, ay] = tr.pts[k - 1], [bx, by] = tr.pts[k];
      const l = Math.hypot(bx - ax, by - ay);
      if (d <= l) return [ax + (bx - ax) * d / l, ay + (by - ay) * d / l];
      d -= l;
    }
    return tr.pts[tr.pts.length - 1];
  }

  // ---- Sabit katman ve parıltı görselleri bir kez çizilir (hızlı çalışma için) ----
  let staticLayer = null, ringSprite = null, dotCyan = null, dotGold = null;
  function sprite(size, draw) {
    const o = document.createElement('canvas'); o.width = o.height = Math.ceil(size * DPR);
    const g = o.getContext('2d'); g.scale(DPR, DPR); draw(g, size); return o;
  }
  function glowDot(color, size) {
    return sprite(size, (g, sz) => {
      const gr = g.createRadialGradient(sz / 2, sz / 2, 0, sz / 2, sz / 2, sz / 2);
      gr.addColorStop(0, color); gr.addColorStop(0.25, color.replace(/[\d.]+\)$/, '0.55)')); gr.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
      g.fillStyle = gr; g.fillRect(0, 0, sz, sz);
    });
  }
  function buildStatic() {
    staticLayer = $('bgStatic'); staticLayer.width = W * DPR; staticLayer.height = H * DPR;
    const c = staticLayer.getContext('2d'); c.scale(DPR, DPR);
    const bg = c.createRadialGradient(CX, CY, 0, CX, CY, Math.max(W, H) * 0.75);
    bg.addColorStop(0, '#0b2436'); bg.addColorStop(0.55, '#06131f'); bg.addColorStop(1, '#030a12');
    c.fillStyle = bg; c.fillRect(0, 0, W, H);
    c.strokeStyle = 'rgba(47,211,245,0.05)'; c.lineWidth = 1;
    for (let i = 0; i < 7; i++) {
      const a = i * 0.9;
      c.beginPath(); c.moveTo(CX + Math.cos(a) * R * 0.2, CY + Math.sin(a) * R * 0.2);
      c.lineTo(CX + Math.cos(a) * Math.max(W, H), CY + Math.sin(a) * Math.max(W, H) * 0.6); c.stroke();
    }
    for (const tr of traces) {
      c.strokeStyle = 'rgba(47,211,245,0.22)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(tr.pts[0][0], tr.pts[0][1]);
      for (let k = 1; k < tr.pts.length; k++) c.lineTo(tr.pts[k][0], tr.pts[k][1]);
      c.stroke();
      const e = tr.pts[tr.pts.length - 1];
      c.fillStyle = 'rgba(47,211,245,0.55)'; c.beginPath(); c.arc(tr.pts[0][0] + (tr.pts[0][0] === 0 ? 14 : -14), tr.pts[0][1], 2.6, 0, 7); c.fill();
      c.beginPath(); c.arc(e[0], e[1], 2, 0, 7); c.fill();
    }
    c.strokeStyle = 'rgba(47,211,245,0.35)';
    c.beginPath(); c.moveTo(CX, CY - R * 1.72); c.lineTo(CX, CY - R * 1.62); c.moveTo(CX, CY + R * 1.62); c.lineTo(CX, CY + R * 1.72); c.stroke();
    // altın halka parıltısı (tek sefer)
    ringSprite = sprite(R * 2 + 120, (g, sz) => {
      g.translate(sz / 2, sz / 2);
      g.strokeStyle = '#f8b43a'; g.lineWidth = 3.5; g.shadowColor = '#f5a524'; g.shadowBlur = 30;
      g.beginPath(); g.arc(0, 0, R, 0, 7); g.stroke(); g.stroke();
      g.shadowBlur = 0; g.strokeStyle = 'rgba(255,220,140,0.35)'; g.lineWidth = 1;
      g.beginPath(); g.arc(0, 0, R - 7, 0, 7); g.stroke();
    });
    dotCyan = glowDot('rgba(170,240,255,1)', 18);
    dotGold = glowDot('rgba(255,210,120,1)', 22);
  }

  const SHADES = Array.from({ length: 8 }, (_, k) => { const d = (k + 0.5) / 8; return `rgba(${90 + d * 120 | 0},${210 + d * 40 | 0},255,${(0.25 + d * 0.7).toFixed(2)})`; });
  const buckets = Array.from({ length: 8 }, () => []);
  let energy = 0, rot = 0, last = performance.now(), lastDraw = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    // sakin durumda 30 kare/sn yeterli — işlemci mikrofona ve yapay zekâya kalsın
    // her zaman en fazla 30 kare/sn (zayıf bilgisayarda 20) — işlemci mikrofona ve yapay zekâya kalsın
    if (now - lastDraw < (lite ? 48 : 32)) return;
    if (document.hidden) return;
    lastDraw = now;
    const tStart = performance.now();
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    const target = state === 'think' || state === 'stt' ? 1 : state === 'hear' ? 0.5 + Math.min(0.5, Voice.level * 14) : state === 'speak' ? 0.65 : state === 'listen' ? 0.12 + Math.min(0.7, Voice.level * 14) : 0;
    energy += (target - energy) * Math.min(1, dt * 3);
    rot += dt * (0.18 + energy * 1.1);
    const c = cx2;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, cv.width, cv.height);
    c.setTransform(DPR, 0, 0, DPR, 0, 0);

    // devre izlerindeki ışıklar
    if (!lite) for (const tr of traces) {
      tr.t = (tr.t + dt * tr.sp * (1 + energy * 3)) % 1;
      const [px, py] = pointAt(tr, tr.t);
      c.drawImage(dotCyan, px - 6, py - 6, 12, 12);
    }

    // dönen halkalar
    if (!lite) {
    c.save(); c.translate(CX, CY);
    c.strokeStyle = 'rgba(47,211,245,0.10)'; c.lineWidth = 1;
    for (const [rr, dash, sp] of [[1.22, [2, 7], 1], [1.55, [14, 10], -0.6], [1.9, [1, 12], 0.4]]) {
      c.save(); c.rotate(rot * sp * 0.3); c.setLineDash(dash);
      c.beginPath(); c.arc(0, 0, R * rr, 0, 7); c.stroke(); c.restore();
    }
    c.setLineDash([]); c.restore();
    }

    // ajan bağlantıları
    for (const id in nodes) {
      const n = nodes[id];
      const ang = Math.atan2(n.y - CY, n.x - CX);
      const sx = CX + Math.cos(ang) * R, sy = CY + Math.sin(ang) * R;
      const on = activeAgent === id;
      c.strokeStyle = on ? 'rgba(255,200,90,0.9)' : n.a.group === 'tool' ? 'rgba(94,230,176,0.22)' : 'rgba(47,211,245,0.26)';
      c.lineWidth = on ? 2 : 1;
      const mx = (sx + n.x) / 2 + Math.sin(ang) * 18, my = (sy + n.y) / 2 - Math.cos(ang) * 18;
      c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(mx, my, n.x, n.y); c.stroke();
      if (on) {
        for (let k = 0; k < 3; k++) {
          const t = ((now / 900) + k / 3) % 1;
          const qx = (1 - t) * (1 - t) * sx + 2 * (1 - t) * t * mx + t * t * n.x;
          const qy = (1 - t) * (1 - t) * sy + 2 * (1 - t) * t * my + t * t * n.y;
          c.drawImage(dotGold, qx - 11, qy - 11, 22, 22);
        }
      }
    }

    // çekirdek parıltısı
    const glow = c.createRadialGradient(CX, CY, R * 0.2, CX, CY, R * 1.05);
    glow.addColorStop(0, `rgba(47,211,245,${(0.10 + energy * 0.12).toFixed(3)})`);
    glow.addColorStop(1, 'rgba(47,211,245,0)');
    c.fillStyle = glow; c.beginPath(); c.arc(CX, CY, R * 1.05, 0, 7); c.fill();

    // parçacık küresi (renklere göre gruplanmış — hızlı)
    for (const b of buckets) b.length = 0;
    const spread = 0.5 + energy * 0.42;
    const cr = Math.cos(rot), sr = Math.sin(rot), ct = Math.cos(0.35), st = Math.sin(0.35);
    const wobA = energy * 0.18, tw = now / 260, live = energy > 0.05;
    for (const p of sphere) {
      let x = p.x * cr - p.z * sr, z = p.x * sr + p.z * cr, y = p.y;
      const y2 = y * ct - z * st; z = y * st + z * ct; y = y2;
      const rad = R * spread * (live ? (0.7 + p.j * 0.3) : p.j) * (1 + wobA * Math.sin(tw + p.n));
      const k = Math.min(7, ((z + 1) / 2 * 8) | 0);
      buckets[k].push(CX + x * rad, CY + y * rad);
    }
    for (let k = 0; k < 8; k++) {
      const b = buckets[k], sz = 0.8 + (k + 0.5) / 8 * 1.4, h = sz / 2;
      c.fillStyle = SHADES[k];
      for (let i = 0; i < b.length; i += 2) c.fillRect(b[i] - h, b[i + 1] - h, sz, sz);
    }
    c.drawImage(dotCyan, CX - 12, CY - 12, 24, 24);

    // altın halka
    const pul = 1 + Math.sin(now / 380) * 0.02 * (0.3 + energy);
    const rs = ringSprite.width / DPR * pul;
    c.globalAlpha = 0.85 + energy * 0.15;
    c.drawImage(ringSprite, CX - rs / 2, CY - rs / 2, rs, rs);
    c.globalAlpha = 1;
    if (live) {
      c.save(); c.translate(CX, CY); c.rotate(rot * 2.2);
      c.strokeStyle = `rgba(255,214,120,${energy.toFixed(2)})`; c.lineWidth = 2;
      for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(0, 0, R * 1.08, k * 2.09, k * 2.09 + 0.6); c.stroke(); }
      c.restore();
    }

    drawWave(now);
    // ilk 90 karede çizim süresini ölç; yavaşsa sade moda geç
    if (!lite && ++frameCount < 90) {
      if (performance.now() - tStart > 14) slowFrames++;
      if (slowFrames > 25) { lite = true; layout(); }
    }
  }

  // ---------- Ses dalgası ----------
  const wv = $('wave'), wc = wv.getContext('2d');
  function drawWave(now) {
    const w = wv.width, h = wv.height, mid = h / 2;
    wc.clearRect(0, 0, w, h);
    wc.strokeStyle = 'rgba(245,165,36,0.35)'; wc.setLineDash([3, 4]); wc.lineWidth = 1;
    wc.beginPath(); wc.moveTo(0, mid); wc.lineTo(w * 0.36, mid); wc.moveTo(w * 0.64, mid); wc.lineTo(w, mid); wc.stroke();
    wc.setLineDash([]);
    const bars = 20;
    for (let side = -1; side <= 1; side += 2) {
      for (let i = 0; i < bars; i++) {
        const x = w / 2 + side * (52 + i * 6.2);
        const base = 2 + 3 * (1 - i / bars);
        const amp = energy * 24 * (1 - i / bars) * (0.5 + 0.5 * Math.abs(Math.sin(now / 120 + i * 1.7)));
        const bh = base + amp;
        wc.fillStyle = `rgba(245,170,50,${0.85 - i / bars * 0.6})`;
        wc.fillRect(x - 1.5, mid - bh / 2, 3, bh);
      }
    }
  }

  // ---------- Saat ----------
  function tick() {
    const d = new Date();
    $('clock').textContent = d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });
    $('date').textContent = d.toLocaleDateString('tr-TR', { weekday: 'short', day: 'numeric', month: 'short' }).toLocaleUpperCase('tr-TR');
  }

  // ---------- Durum ----------
  function setState(s) {
    state = s;
    const el = $('status');
    el.textContent = STATE_LABEL[s] || s;
    el.classList.toggle('err', s === 'error');
    $('dockCore').classList.toggle('live', s !== 'idle' && s !== 'error');
  }
  const diagParts = [];
  function diag(reset, part) {
    if (reset) diagParts.length = 0;
    if (part) diagParts.push(part);
    $('diag').textContent = diagParts.join(' · ');
  }
  const secs = (t0) => ((performance.now() - t0) / 1000).toFixed(1).replace('.', ',') + ' sn';

  function setActive(id) {
    activeAgent = id;
    for (const k in nodes) nodes[k].el.classList.toggle('active', k === id);
  }

  // ---------- Ajan kartı ----------
  let cardFor = null;
  function openCard(a, anchor) {
    cardFor = a.id;
    const card = $('card');
    $('cardOrb').className = 'card-orb ' + a.group;
    $('cardTitle').className = 'card-title ' + a.group;
    $('cardTitle').textContent = a.name;
    $('cardSub').textContent = a.role;
    $('cardHandles').innerHTML = a.handles.map(h => `<li>${esc(h)}</li>`).join('');
    const ex = $('cardExamples'); ex.innerHTML = '';
    for (const e of a.examples) {
      const ch = document.createElement('button');
      ch.className = 'chip'; ch.textContent = e;
      ch.onclick = () => { closeCard(); ask(e, a); };
      ex.appendChild(ch);
    }
    const foot = $('cardFoot');
    const offline = false;
    foot.classList.toggle('off', offline);
    $('cardStatus').textContent = offline ? 'BAĞLANTI — YAPAY ZEKÂ ÜZERİNDEN ÇALIŞIR' : 'ÇEVRİMİÇİ — NOVA İŞİ OTOMATİK YÖNLENDİRİR';
    card.classList.remove('hidden');
    const r = anchor ? anchor.getBoundingClientRect() : { left: CX, top: CY, width: 0, height: 0 };
    const cw = card.offsetWidth, ch = card.offsetHeight;
    let x = r.left + r.width / 2 - cw / 2, y = r.top - ch - 12;
    if (y < 70) y = r.top + r.height + 12;
    x = Math.max(12, Math.min(W - cw - 12, x)); y = Math.max(12, Math.min(H - ch - 12, y));
    card.style.left = x + 'px'; card.style.top = y + 'px';
    $('cardClose').focus({ preventScroll: true });
  }
  function closeCard() { $('card').classList.add('hidden'); cardFor = null; }
  $('cardClose').onclick = closeCard;

  // ---------- Hikâye modları ----------
  function setMode(m) {
    mode = (m + MODES.length) % MODES.length;
    $('modeLabel').textContent = MODES[mode];
    $('progressBar').style.width = ((mode + 1) / MODES.length * 100) + '%';
    [...$('dots').children].forEach((d, i) => d.classList.toggle('on', i === mode));
    $('storyAgents').classList.toggle('hidden', mode !== 1);
    $('storyHow').classList.toggle('hidden', mode !== 2);
  }
  [...$('dots').children].forEach((d, i) => d.onclick = () => setMode(i));
  let wheelLock = 0;
  window.addEventListener('wheel', (e) => {
    if (e.target.closest && e.target.closest('.scrollable, .card')) return;
    const t = Date.now(); if (t < wheelLock || Math.abs(e.deltaY) < 8) return;
    wheelLock = t + 650; setMode(mode + (e.deltaY > 0 ? 1 : -1));
  }, { passive: true });

  function buildStoryList() {
    const groups = [['core', 'DÜŞÜNEN AJANLAR'], ['work', 'ÜRETEN AJANLAR'], ['tool', 'ARAÇLAR']];
    const box = $('storyList'); box.innerHTML = '';
    for (const [g, title] of groups) {
      const h = document.createElement('div'); h.className = 'grp ' + g; h.textContent = title; box.appendChild(h);
      for (const a of AGENTS.filter(x => x.group === g)) {
        const it = document.createElement('div'); it.className = 'it';
        it.innerHTML = `<b>${esc(a.name)}</b><span>${esc(a.role)}</span>`;
        it.onclick = () => a.group === 'tool' ? window.NovaTools.open(a.id) : openCard(a, nodes[a.id].el);
        box.appendChild(it);
      }
    }
  }

  // ---------- Metin biçimlendirme ----------
  function esc(s) { return String(s).replace(/[&<>"']/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch])); }
  function md(src) {
    const blocks = []; let s = esc(src || '');
    s = s.replace(/```[\w-]*\n?([\s\S]*?)```/g, (_, code) => { blocks.push(code); return `\u0000${blocks.length - 1}\u0000`; });
    s = s.replace(/`([^`\n]+)`/g, '<code>$1</code>').replace(/\*\*([^*\n]+)\*\*/g, '<b>$1</b>');
    const out = []; let list = null;
    for (const line of s.split('\n')) {
      const ul = line.match(/^\s*[-*•]\s+(.*)/), ol = line.match(/^\s*\d+[.)]\s+(.*)/), hd = line.match(/^#{1,4}\s+(.*)/);
      if (ul || ol) {
        const type = ul ? 'ul' : 'ol';
        if (!list || list.type !== type) { if (list) out.push(`</${list.type}>`); out.push(`<${type}>`); list = { type }; }
        out.push(`<li>${(ul || ol)[1]}</li>`); continue;
      }
      if (list) { out.push(`</${list.type}>`); list = null; }
      if (hd) out.push(`<h3>${hd[1]}</h3>`);
      else if (line.trim()) out.push(`<p>${line}</p>`);
    }
    if (list) out.push(`</${list.type}>`);
    return out.join('').replace(/\u0000(\d+)\u0000/g, (_, i) => `<pre><code>${blocks[i]}</code></pre>`);
  }

  // ---------- Yerel (çevrimdışı) yanıtlar ----------
  function localAnswer(text, agent) {
    const t = text.toLocaleLowerCase('tr-TR');
    const m = text.match(/^\s*(hatırla|unutma)(?![a-zçğıöşü])\s*[:\-,]?\s*(.+)$/i);
    if (m) {
      memory.push({ t: m[2].trim(), d: Date.now() }); save('nova.memory', memory); renderMem();
      return { agent: AGENTS.find(a => a.id === 'hafiza'), text: `Not aldım: **${m[2].trim()}**\n\nBundan sonraki yanıtlarda bunu bağlam olarak kullanacağım. Hafızada şu an ${memory.length} not var.` };
    }
    if (/neleri? hatırlıyorsun|hafızanda ne var|hafızayı göster/.test(t)) {
      const hm = AGENTS.find(a => a.id === 'hafiza');
      if (!memory.length) return { agent: hm, text: 'Hafızam şimdilik boş. “Hatırla: …” diye yazarak bir şey kaydedebilirsin.' };
      return { agent: hm, text: 'Hatırladıklarım:\n' + memory.map(x => '- ' + x.t).join('\n') };
    }
    if (agent.id === 'takvim' && /(bugün|tarih|saat|günlerden)/.test(t)) {
      const d = new Date();
      return { agent, text: `Bugün **${d.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}**, saat **${d.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}**.` };
    }
    return null;
  }

  function demoAnswer(text, agent) {
    return `**${agent.name}** bu isteği üstlendi.\n\nŞu an **demo modundayım** — henüz bir anahtar girilmedi.\n\n**Bağlamak için:** sağ üstten **AYARLAR**’a gir ve elindeki anahtarı yapıştır: ChatGPT, Gemini, Claude, Grok, DeepSeek, Mistral, Groq ya da OpenRouter. İnternetsiz kullanmak istersen **Yerel yapay zekâ** bölümünden Ollama ya da LM Studio’yu aç. Gemini ve Groq ücretsiz; ikisi de seni sesli dinleyebilir.`;
  }

  function systemPrompt(agent) {
    const now = new Date();
    const mem = memory.slice(-30).map(x => '- ' + x.t).join('\n');
    return [
      'Sen NOVA Yapay Zeka’sın: Türkçe konuşan, uzman ajanlardan oluşan kişisel bir asistan.',
      `Şu an "${agent.name}" ajanı olarak yanıt veriyorsun (${agent.role}). Uzmanlık alanların: ${agent.handles.join('; ')}.`,
      'Her zaman Türkçe yanıt ver. Net, sıcak ve uygulanabilir ol. Kısa paragraflar, gerektiğinde madde işaretleri ve kod blokları kullan. Uzun giriş cümleleri kurma.',
      voiceTurn ? 'Kullanıcı seninle SESLİ konuşuyor ve yanıtın sesli okunacak: konuşur gibi yaz, 2-5 cümleyi geçme, markdown, emoji, tablo ve kod kullanma. Kullanıcı ayrıntı isterse daha uzun anlat.' : '',
      `Bugün: ${now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, saat ${now.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}.`,
      settings.name ? `Kullanıcının adı: ${settings.name}.` : '',
      settings.city ? `Kullanıcının şehri: ${settings.city}.` : '',
      mem ? `Kullanıcının sana hatırlattığı notlar:\n${mem}` : ''
    ].filter(Boolean).join('\n');
  }

  // Sırayla denenecek sağlayıcılar (yalnızca Gemini ve ChatGPT)
  function providerOrder(st = settings) {
    const keys = st.keys || {}, loc = st.local || {};
    const avail = [
      ...KEY_PROVIDERS.map(k => k.id).filter(id => (keys[id] || '').trim()),
      ...LOCAL_PROVIDERS.filter(id => loc[id] && loc[id].on)
    ];
    if (!avail.length) return ['demo'];
    const first = st.mode && st.mode !== 'auto' && avail.includes(st.mode) ? st.mode : null;
    return first ? [first, ...avail.filter(x => x !== first)] : avail;
  }
  const hasKeys = (st = settings) => providerOrder(st)[0] !== 'demo';
  const sttList = (st = settings) => STT_PROVIDERS.filter(p => ((st.keys || {})[p] || '').trim());

  function cfgFor(p, st = settings) {
    const loc = (st.local || {})[p];
    if (loc) return { provider: p, apiKey: '', baseUrl: loc.url || '', model: loc.model || '', maxTokens: voiceTurn ? 350 : 0 };
    return { provider: p, apiKey: (st.keys || {})[p] || '', model: (st.mode === p ? st.model : '') || '', maxTokens: voiceTurn ? 350 : 0 };
  }

  async function callOne(p, agent, msgs, st = settings) {
    const cfg = cfgFor(p, st);
    if (isElectron) return window.nova.chat(cfg, systemPrompt(agent), msgs);
    return chat(fetch.bind(window), cfg, systemPrompt(agent), msgs);
  }

  async function callAI(agent, text) {
    const msgs = [];
    for (const h of history.slice(-6)) { msgs.push({ role: 'user', content: h.q }); msgs.push({ role: 'assistant', content: h.r }); }
    msgs.push({ role: 'user', content: text });
    const errors = [];
    for (const p of providerOrder()) {
      try { const text = await callOne(p, agent, msgs); return { text, provider: p }; }
      catch (err) { errors.push(`${(PRESETS[p] || {}).label || p}: ${String(err && err.message || err)}`); }
    }
    throw new Error(errors.join('\n'));
  }

  // ---------- Soru akışı ----------
  async function ask(text, forced, opts = {}) {
    text = (text || '').trim();
    if (!text || busy) return;
    busy = true; closeCard(); stopSpeaking();
    voiceTurn = !!opts.voice;
    if (listening) Voice.pause();
    let local = /^\s*(hatırla|unutma)(?![a-zçğıöşü])/i.test(text) ? localAnswer(text, AGENTS[0]) : null;
    if (!local) {
      try {
        const r = await window.NovaTools.command(text);
        if (r) { local = { agent: AGENTS.find(a => a.id === r.agent) || AGENTS[0], text: r.text }; if (r.tab && window.NovaTools.isOpen()) window.NovaTools.open(r.tab); }
      } catch (_) {}
    }
    if (!local) local = localAnswer(text, forced || route(text));
    const agent = local ? local.agent : (forced || route(text));
    setActive(agent.id); setState('think');
    showReply(agent, text, '', true);
    let answer = '', failed = false, usedBy = '';
    try {
      await sleep(local ? 500 : 250);
      if (local) answer = local.text;
      else if (providerOrder()[0] === 'demo') { await sleep(900); answer = demoAnswer(text, agent); }
      else { const t0 = performance.now(); const r = await callAI(agent, text); answer = r.text || '(Boş yanıt geldi.)'; usedBy = (PRESETS[r.provider] || {}).label || ''; diag(!voiceTurn, `cevap (${usedBy}): ${secs(t0)}`); }
    } catch (err) {
      failed = true;
      answer = `Yapay zekâya ulaşamadım.\n\n${String(err && err.message || err).split('\n').map(l => '- ' + l).join('\n')}\n\nAYARLAR’dan anahtarlarını kontrol et (ANAHTARLARI TEST ET).`;
    }
    setState(failed ? 'error' : 'speak');
    if (usedBy) $('replyAgent').textContent = 'NOVA · ' + agent.name + ' · ' + usedBy;
    // ses, yazı ekrana dökülürken aynı anda hazırlanıp çalınır
    const spoken = (!failed && settings.tts) ? speakOut(answer) : null;
    await typeOut(agent, text, answer);
    if (!failed) {
      history.push({ a: agent.id, q: text, r: answer, d: Date.now() });
      history = history.slice(-100); save('nova.history', history); renderHistory();
    }
    busy = false;
    if (spoken) await spoken;
    else await sleep(failed ? 2500 : 800);
    if (!busy) afterTurn();
  }

  function afterTurn() {
    setActive(null);
    if (listening) { Voice.resume(); setState('listen'); } else setState('idle');
  }

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

  function showReply(agent, q, body, typing) {
    $('reply').classList.remove('hidden');
    $('replyAgent').textContent = 'NOVA · ' + agent.name;
    $('replyQ').textContent = q;
    $('reportBox').classList.add('hidden');
    $('replyBody').innerHTML = body ? md(body) : '<p class="typing">Düşünüyorum</p>';
    $('replyBody').classList.toggle('typing', !!typing && !!body);
  }

  async function typeOut(agent, q, full) {
    const body = $('replyBody'), box = $('reply');
    const step = Math.max(4, Math.round(full.length / 40));
    for (let i = step; i < full.length; i += step) {
      body.innerHTML = md(full.slice(0, i)); body.classList.add('typing');
      box.scrollTop = box.scrollHeight;
      await sleep(12);
    }
    body.innerHTML = md(full); body.classList.remove('typing');
  }

  // ---------- Sesli yanıt ----------
  let player = null, stopCurrent = null;
  function cleanForSpeech(t) {
    return t.replace(/```[\s\S]*?```/g, ' ').replace(/`([^`]+)`/g, '$1').replace(/\*\*|__|[#>*_~]/g, '')
      .replace(/^\s*[-•]\s+/gm, '').replace(/\[(.*?)\]\(.*?\)/g, '$1').replace(/https?:\/\/\S+/g, 'bağlantı').replace(/\n{2,}/g, '. ').replace(/\s+/g, ' ').trim().slice(0, 1500);
  }
  function stopSpeaking() { if (stopCurrent) stopCurrent(); }
  async function speakOut(text) {
    const clean = cleanForSpeech(text); if (!clean) return;
    setState('speak');
    const key = (settings.keys || {}).openai;
    if (key) {
      try {
        const t0 = performance.now();
        const bytes = isElectron ? await window.nova.speech({ provider: 'openai', apiKey: key }, clean) : await speech(fetch.bind(window), { provider: 'openai', apiKey: key }, clean);
        diag(false, `ses: ${secs(t0)}`);
        const url = URL.createObjectURL(new Blob([bytes], { type: 'audio/mpeg' }));
        await new Promise((res) => {
          player = new Audio(url);
          stopCurrent = () => { try { player.pause(); } catch (_) {} res(); };
          player.onended = player.onerror = () => res();
          player.play().catch(() => res());
        });
        URL.revokeObjectURL(url); player = null; stopCurrent = null;
        return;
      } catch (e) { diag(false, 'doğal ses alınamadı, Windows sesi kullanılıyor'); }
    }
    await systemSpeak(clean);
  }
  function systemSpeak(text) {
    if (!('speechSynthesis' in window)) return Promise.resolve();
    return new Promise((res) => {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'tr-TR'; u.rate = 1.03;
      const v = speechSynthesis.getVoices().find(v => /^tr/i.test(v.lang));
      if (v) u.voice = v;
      let done = false; const fin = () => { if (!done) { done = true; stopCurrent = null; res(); } };
      u.onend = u.onerror = fin;
      stopCurrent = () => { speechSynthesis.cancel(); fin(); };
      speechSynthesis.cancel(); speechSynthesis.speak(u);
      // Windows bazen "bitti" haberini vermiyor: konuşmanın bittiğini kendimiz kontrol ediyoruz
      let started = false, idle = 0;
      const poll = setInterval(() => {
        if (done) return clearInterval(poll);
        if (speechSynthesis.speaking) { started = true; idle = 0; } else if (++idle > (started ? 2 : 12)) { clearInterval(poll); fin(); }
      }, 250);
    });
  }
  if ('speechSynthesis' in window) { speechSynthesis.getVoices(); speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices(); }

  // ---------- Sürekli dinleme ----------
  const JUNK = /altyaz|abone ol|izlediğiniz için|m\.?\s?k\.|amara\.org|^\W*$/i;
  async function onUtterance(wav) {
    if (!wav) { if (state === 'hear') setState('listen'); return; }
    if (busy || hearing || !listening) return;
    hearing = true; Voice.pause(); setState('stt');
    const t0 = performance.now(); diag(true, '');
    let text = '', err = null;
    for (const p of sttList()) {
      try {
        const cfg = cfgFor(p);
        text = isElectron ? await window.nova.transcribe(cfg, wav) : await transcribe(fetch.bind(window), cfg, wav);
        err = null; break;
      } catch (e) { err = e; }
    }
    hearing = false;
    text = (text || '').trim();
    diag(false, `yazıya çevirme: ${secs(t0)}`);
    if (err) { showNotice('Sesini yazıya çeviremedim: ' + (err.message || err)); }
    if (!text || text.length < 2 || JUNK.test(text)) { afterTurn(); return; }
    ask(text, null, { voice: true });
  }

  async function startListening(silent) {
    if (listening) return;
    if (!sttList().length) { if (!silent) showNotice(hasKeys() ? 'Sesli dinleme için **ChatGPT**, **Gemini** ya da **Groq** anahtarı gerekir (sesi yazıya bunlar çevirir). Groq ve Gemini ücretsiz. Diğer yapay zekâlarla yazarak konuşabilirsin.' : 'Başlamak için AYARLAR’dan bir yapay zekâ anahtarı gir ya da yerel yapay zekâyı (Ollama / LM Studio) aç.'); return; }
    try {
      await Voice.start(onUtterance, () => { if (!busy && !hearing && state === 'listen') setState('hear'); });
      listening = true; $('dockCore').classList.add('mic');
      if (!busy) setState('listen');
    } catch (e) {
      showNotice('Mikrofona erişemedim. Windows Ayarlar → Gizlilik ve güvenlik → Mikrofon bölümünden masaüstü uygulamalarına izin ver.\n\n`' + (e.message || e.name || e) + '`');
    }
  }
  function stopListening() {
    Voice.stop(); listening = false; $('dockCore').classList.remove('mic');
    if (!busy) setState('idle');
  }
  function showNotice(msg) {
    $('reply').classList.remove('hidden');
    $('replyAgent').textContent = 'NOVA';
    $('replyQ').textContent = '';
    $('replyBody').innerHTML = md(msg);
  }

  $('replyClose').onclick = () => { $('reply').classList.add('hidden'); stopSpeaking(); };

  // ---------- Yapay zekâ cevabını bildir (Google Play yapay zekâ içeriği kuralı) ----------
  const REPORT_EMAIL = ''; // istersen geliştirici e-postanı yaz: bildirimler sana e-postayla gelir
  $('replyFlag').onclick = () => { $('reportBox').classList.toggle('hidden'); $('reply').scrollTop = 0; };
  $('reportCancel').onclick = () => $('reportBox').classList.add('hidden');
  $('reportBox').addEventListener('submit', (e) => {
    e.preventDefault();
    const reason = (document.querySelector('#reportBox input[name=rr]:checked') || {}).value || 'Diğer';
    const rep = { d: Date.now(), reason, note: $('reportNote').value.trim(), q: $('replyQ').textContent, r: $('replyBody').innerText.slice(0, 2000), by: $('replyAgent').textContent };
    const all = load('nova.reports', []); all.push(rep); save('nova.reports', all.slice(-50));
    $('reportBox').classList.add('hidden'); $('reportNote').value = '';
    $('replyBody').innerHTML = '<p class="muted">Bildirimin için teşekkürler. Bu cevap işaretlendi ve gizlendi.</p>';
    if (REPORT_EMAIL) {
      const body = `Sebep: ${rep.reason}\nNot: ${rep.note}\nYapay zekâ: ${rep.by}\nSoru: ${rep.q}\nCevap: ${rep.r}`;
      const url = `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent('NOVA cevap bildirimi')}&body=${encodeURIComponent(body)}`;
      if (window.NovaAndroid) window.NovaAndroid.openUrl(url); else window.open(url);
    }
  });

  // ---------- Giriş ----------
  $('ask').addEventListener('submit', (e) => { e.preventDefault(); const v = $('askInput').value; $('askInput').value = ''; ask(v); });

  function coreTap() {
    const v = $('askInput').value.trim();
    if (v) { $('askInput').value = ''; return ask(v); }
    if (stopCurrent) return stopSpeaking();         // konuşurken dokun: sustur
    if (busy || hearing) return;
    if (listening) stopListening(); else startListening();
  }
  $('coreHit').onclick = coreTap;
  $('dockCore').onclick = coreTap;

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); $('askInput').focus(); }
    if (e.key === 'Escape') {
      if (window.NovaTools.ringing) return window.NovaTools.stopRing();
      if (!$('about').classList.contains('hidden')) return $('about').classList.add('hidden');
      if (!$('settings').classList.contains('hidden')) return closeSettings();
      if (window.NovaTools.isOpen()) return window.NovaTools.close();
      if (!$('drawer').classList.contains('hidden')) return $('drawer').classList.add('hidden');
      if (cardFor) return closeCard();
      if (mode) return setMode(0);
      $('reply').classList.add('hidden');
    }
  });
  document.addEventListener('click', (e) => {
    if (cardFor && !e.target.closest('.card, .agent, .story')) closeCard();
    if (window.NovaTools.isOpen() && !e.target.closest('.tools, .rail, .agent, .story, .wx-widget, #ring, .reply, .dock')) window.NovaTools.close();
  });

  // ---------- Geçmiş ----------
  function renderHistory() {
    const list = $('historyList'); list.innerHTML = '';
    if (!history.length) { list.innerHTML = '<p class="muted">Henüz konuşma yok.</p>'; return; }
    for (const h of [...history].reverse()) {
      const a = AGENTS.find(x => x.id === h.a) || AGENTS[0];
      const d = document.createElement('div'); d.className = 'h-item';
      d.innerHTML = `<div class="a">${esc(a.name)} · ${new Date(h.d).toLocaleString('tr-TR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</div><div class="q">${esc(h.q)}</div><div class="r">${esc(h.r.slice(0, 220))}</div>`;
      d.onclick = () => { showReply(a, h.q, h.r, false); $('drawer').classList.add('hidden'); };
      list.appendChild(d);
    }
  }
  $('historyBtn').onclick = () => { renderHistory(); $('drawer').classList.toggle('hidden'); };
  $('drawerClose').onclick = () => $('drawer').classList.add('hidden');
  $('clearHistory').onclick = () => { if (confirm('Tüm konuşma geçmişi silinsin mi?')) { history = []; save('nova.history', history); renderHistory(); } };

  // ---------- Ayarlar ----------
  const sel = $('sProvider');
  const MODE_OPTS = [['auto', 'Otomatik (sırayla dene)'], ...KEY_PROVIDERS.map(k => [k.id, 'Önce ' + k.name]), ['ollama', 'Önce Ollama (yerel)'], ['lmstudio', 'Önce LM Studio (yerel)']];
  for (const [v, l] of MODE_OPTS) { const o = document.createElement('option'); o.value = v; o.textContent = l; sel.appendChild(o); }
  function placeholders() { $('sModel').placeholder = 'otomatik'; }
  sel.onchange = () => { $('sModel').value = ''; placeholders(); };

  // Anahtar kutuları
  const keyBox = $('keyList');
  for (const k of KEY_PROVIDERS) {
    const row = document.createElement('div'); row.className = 'key-row';
    row.innerHTML = `<div class="key-top"><span class="key-name">${esc(k.name)}${k.note ? `<small>${esc(k.note)}</small>` : ''}</span><span class="key-st" id="st_${k.id}"></span><a href="${k.link}" target="_blank" rel="noopener">Anahtar al ↗</a></div>
      <div class="key-in"><input id="k_${k.id}" type="password" spellcheck="false" autocomplete="off" placeholder="${esc(k.hint)}"><button type="button" class="eye" data-for="k_${k.id}" title="Göster/gizle">👁</button></div>`;
    keyBox.appendChild(row);
  }
  keyBox.addEventListener('click', (e) => {
    const b = e.target.closest('.eye'); if (!b) return;
    const inp = $(b.dataset.for); inp.type = inp.type === 'password' ? 'text' : 'password';
  });
  keyBox.addEventListener('input', (e) => {
    const inp = e.target; if (!inp.id || !inp.id.startsWith('k_')) return;
    const v = inp.value.trim(); inp.value = v;
    const here = inp.id.slice(2), det = detectProvider(v);
    $('st_' + here).textContent = '';
    if (det && det !== here) {
      const target = $('k_' + det);
      if (!target.value.trim()) { target.value = v; inp.value = ''; $('st_' + det).textContent = '↪ doğru kutuya taşındı'; $('st_' + det).className = 'key-st ok'; }
    }
  });

  function fillSettings() {
    sel.value = MODE_OPTS.some(o => o[0] === settings.mode) ? settings.mode : 'auto'; placeholders();
    for (const id of LOCAL_PROVIDERS) { const l = (settings.local || {})[id] || {}; $('l_' + id).checked = !!l.on; $('lu_' + id).value = l.url || ''; $('lm_' + id).value = l.model || ''; $('st_' + id).textContent = ''; }
    $('sModel').value = settings.model || '';
    for (const k of KEY_PROVIDERS) { $('k_' + k.id).value = (settings.keys || {})[k.id] || ''; $('k_' + k.id).type = 'password'; $('st_' + k.id).textContent = ''; }
    $('sName').value = settings.name || ''; $('sCity').value = settings.city || '';
    $('sTts').checked = !!settings.tts; $('sListen').checked = settings.listen !== false; $('testOut').textContent = '';
    $('sTray').checked = settings.tray !== false; $('sAuto').checked = !!settings.autostart;
    renderMem();
  }
  function readForm() {
    const keys = {};
    for (const k of KEY_PROVIDERS) { const v = $('k_' + k.id).value.trim(); if (v) keys[k.id] = v; }
    const local = {};
    for (const id of LOCAL_PROVIDERS) local[id] = { on: $('l_' + id).checked, url: $('lu_' + id).value.trim(), model: $('lm_' + id).value.trim() };
    return { v: 3, mode: sel.value, keys, local, model: $('sModel').value.trim(),
      name: $('sName').value.trim(), city: $('sCity').value.trim(), tts: $('sTts').checked, listen: $('sListen').checked, tray: $('sTray').checked, autostart: $('sAuto').checked };
  }
  function applySettings() {
    $('cityName').textContent = (settings.city || 'Şehrin').toLocaleUpperCase('tr-TR');
    if (isElectron && window.nova.setAutostart) window.nova.setAutostart(!!settings.autostart);
    if (settings.city && window.NovaTools) window.NovaTools.getWeather(settings.city).catch(() => {});
  }
  function openSettings() { fillSettings(); $('settings').classList.remove('hidden'); }
  function closeSettings() { $('settings').classList.add('hidden'); }
  $('settingsBtn').onclick = openSettings;
  $('settingsClose').onclick = closeSettings;
  $('settings').addEventListener('mousedown', (e) => { if (e.target.id === 'settings') closeSettings(); });
  $('settingsForm').addEventListener('submit', async (e) => {
    e.preventDefault(); settings = readForm(); await persistSettings(); applySettings(); closeSettings();
    if (settings.listen && !listening) startListening(); else if (!settings.listen && listening) stopListening();
  });
  $('testBtn').onclick = async () => {
    const st = readForm(), out = $('testOut');
    const list = providerOrder(st);
    if (list[0] === 'demo') { out.textContent = 'Henüz anahtar girilmedi ya da yerel yapay zekâ açılmadı.'; return; }
    out.textContent = 'Deneniyor…';
    let okCount = 0;
    for (const p of list) {
      const stEl = $('st_' + p);
      if (stEl) { stEl.textContent = '… deneniyor'; stEl.className = 'key-st'; }
      try {
        await callOne(p, AGENTS[0], [{ role: 'user', content: 'Sadece "tamam" yaz.' }], st);
        okCount++; if (stEl) { stEl.textContent = '✓ çalışıyor'; stEl.className = 'key-st ok'; }
      } catch (err) {
        if (stEl) { stEl.textContent = '✗ ' + String(err.message || err).slice(0, 60); stEl.className = 'key-st bad'; }
        else out.textContent = '✗ ' + (err.message || err);
      }
    }
    out.textContent = okCount ? `${okCount} bağlantı çalışıyor. KAYDET’e bas.` + (sttList(st).length ? '' : ' (Sesli dinleme için ChatGPT, Gemini ya da Groq anahtarı da ekle.)') : 'Hiçbir bağlantı çalışmadı. Anahtarı yeniden kopyalayıp dene.';
  };

  function renderMem() {
    const box = $('memList'); box.innerHTML = '';
    if (!memory.length) { box.innerHTML = '<span class="muted">Boş. Sohbette “Hatırla: …” yaz.</span>'; return; }
    memory.forEach((m, i) => {
      const d = document.createElement('div');
      d.innerHTML = `<span>${esc(m.t)}</span>`;
      const b = document.createElement('button'); b.type = 'button'; b.textContent = 'Sil';
      b.onclick = () => { memory.splice(i, 1); save('nova.memory', memory); renderMem(); };
      d.appendChild(b); box.appendChild(d);
    });
  }

  async function persistSettings() {
    if (isElectron) await window.nova.saveSettings(settings);
    else save('nova.settings', settings);
  }
  async function loadSettings() {
    try { settings = Object.assign(settings, isElectron ? await window.nova.getSettings() : load('nova.settings', {})); } catch (_) {}
    // eski sürüm ayarlarını taşı
    const k = settings.keys || {};
    if (settings.apiKey && PRESETS[settings.provider] && !PRESETS[settings.provider].local) k[settings.provider] = settings.apiKey;
    settings.keys = {};
    for (const p of KEY_PROVIDERS) if (k[p.id]) settings.keys[p.id] = k[p.id];
    settings.local = settings.local || {};
    if (!(settings.v >= 2)) { settings.tts = true; settings.listen = true; }
    if (settings.v !== 3) { settings.mode = 'auto'; settings.v = 3; }
    delete settings.provider; delete settings.apiKey; delete settings.baseUrl;
    applySettings();
    if (isElectron) { try { $('ver').textContent = 'Sürüm ' + await window.nova.version(); } catch (_) {} }
    else if (window.NovaAndroid) { try { $('ver').textContent = 'Sürüm ' + window.NovaAndroid.version() + ' · Android'; } catch (_) {} }
  }

  // ---------- Araçlar ----------
  function notify(title, body) {
    try { if ('Notification' in window) { const n = new Notification(title, { body, icon: 'assets/logo.svg', silent: true }); n.onclick = () => { if (isElectron) window.nova.show(); }; } } catch (_) {}
  }
  window.NovaTools.init({
    canRing: () => !(window.NovaAndroidState && window.NovaAndroidState.background),
    city: () => settings.city || '',
    speak: async (t) => { if (!settings.tts || busy) return; if (listening) Voice.pause(); await speakOut(t); afterTurn(); },
    notify,
    show: () => { if (isElectron) window.nova.show(); },
    ringStart: () => { stopSpeaking(); if (listening) Voice.pause(); },
    ringEnd: () => { if (!busy) afterTurn(); },
    onWeather: (w) => {
      const x = window.NovaTools.widgetHTML(); if (!x) return;
      $('wxIcon').innerHTML = x.icon; $('wxTemp').textContent = x.temp;
      $('cityName').textContent = x.city.toLocaleUpperCase('tr-TR');
    }
  });
  $('wxWidget').onclick = () => window.NovaTools.open('hava');

  // ---------- Hakkında + güncelleme ----------
  $('aboutBtn').onclick = () => { $('about').classList.remove('hidden'); };
  $('aboutClose').onclick = () => $('about').classList.add('hidden');
  $('about').addEventListener('mousedown', (e) => { if (e.target.id === 'about') $('about').classList.add('hidden'); });
  function toast(msg, btnText, onBtn) {
    const t = $('toast'); t.innerHTML = `<span>${msg}</span>`;
    if (btnText) { const b = document.createElement('button'); b.className = 'pill gold small'; b.textContent = btnText; b.onclick = onBtn; t.appendChild(b); }
    const x = document.createElement('button'); x.className = 'x'; x.textContent = '✕'; x.onclick = () => t.classList.add('hidden'); t.appendChild(x);
    t.classList.remove('hidden');
  }
  const UPD = { checking: 'Güncellemeler denetleniyor…', none: 'NOVA güncel. 👍', available: 'Yeni sürüm bulundu, indiriliyor…', progress: 'İndiriliyor', ready: 'Yeni sürüm hazır.', error: 'Güncelleme denetlenemedi', dev: 'Geliştirme modunda güncelleme yapılmaz (kurulum dosyasıyla kurulan sürümde çalışır).', apk: 'Yeni sürüm var' };
  function onUpdate(u) {
    let msg = UPD[u.state] || u.state;
    if (u.state === 'progress') msg += ` %${Math.round(u.percent || 0)}`;
    if (u.version && (u.state === 'available' || u.state === 'ready')) msg += ` (v${u.version})`;
    if (u.state === 'error' && u.error) msg += ': ' + u.error;
    $('updStatus').textContent = msg;
    $('updInstall').classList.toggle('hidden', u.state !== 'ready' && u.state !== 'apk');
    if (u.state === 'ready') toast(`NOVA v${u.version} hazır.`, 'Yeniden başlat', () => window.nova.installUpdate());
    if (u.state === 'apk') {
      apkUrl = u.url; $('updInstall').textContent = 'YENİ SÜRÜMÜ İNDİR';
      toast(`NOVA v${u.version} çıktı.`, 'İndir', () => window.NovaUpdate.open(u.url));
    }
  }
  let apkUrl = '';
  if (isElectron && window.nova.onUpdate) window.nova.onUpdate(onUpdate);
  $('updCheck').onclick = () => {
    if (isElectron) { onUpdate({ state: 'checking' }); window.nova.checkUpdate(); }
    else if (window.NovaUpdate) window.NovaUpdate.check(onUpdate);
    else onUpdate({ state: 'dev' });
  };
  $('updInstall').onclick = () => { if (apkUrl && window.NovaUpdate) window.NovaUpdate.open(apkUrl); else if (isElectron) window.nova.installUpdate(); };
  if (window.NovaUpdate) setTimeout(() => window.NovaUpdate.check((u) => { if (u.state === 'apk') onUpdate(u); }), 8000);

  // pencere gizlenince (tepsiye inince) mikrofon durur, açılınca devam eder
  let pausedByHide = false;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && listening) { pausedByHide = true; stopListening(); }
    else if (!document.hidden && pausedByHide) { pausedByHide = false; startListening(true); }
  });
  if ('Notification' in window && Notification.permission === 'default') { try { Notification.requestPermission(); } catch (_) {} }

  // ---------- Başlat ----------
  window.addEventListener('resize', layout);
  layout(); buildStoryList(); setMode(0); tick(); setInterval(tick, 1000 * 5);
  renderHistory();
  loadSettings().then(() => {
    if (!hasKeys()) { openSettings(); $('testOut').textContent = 'Başlamak için Gemini ya da ChatGPT anahtarını yapıştırıp KAYDET’e bas.'; }
    else if (settings.listen !== false) { if (document.hidden) pausedByHide = true; else startListening(true); }
  });
  requestAnimationFrame(frame);
  // Dışarıdan tetikleme (tanıtım/kayıt için): window.NOVA.ask('...')
  window.NOVA = { ask, setState, setActive, startListening, stopListening, toast, openCard: (id) => openCard(AGENTS.find(a => a.id === id), nodes[id].el), setMode };
})();
