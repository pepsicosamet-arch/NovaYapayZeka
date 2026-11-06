// NOVA Yapay Zeka — sürekli dinleme (mikrofon + konuşma algılama + WAV)
(function (root) {
  const TARGET_RATE = 16000;
  let ctx = null, stream = null, proc = null, src = null;
  let running = false, paused = false;
  let speaking = false, speechMs = 0, silenceMs = 0;
  let chunks = [], preroll = [];
  let noise = 0.008, level = 0;
  let onUtterance = () => {}, onStart = () => {};
  let peak = 0;

  function rms(buf) { let s = 0; for (let i = 0; i < buf.length; i++) s += buf[i] * buf[i]; return Math.sqrt(s / buf.length); }

  function reset() { speaking = false; speechMs = 0; silenceMs = 0; chunks = []; }

  function process(e) {
    const data = new Float32Array(e.inputBuffer.getChannelData(0));
    const r = rms(data);
    level = level * 0.7 + r * 0.3;
    if (paused) { reset(); preroll = []; return; }
    const ms = data.length / ctx.sampleRate * 1000;
    const threshold = Math.max(0.018, noise * 3.2);
    if (!speaking) {
      noise = noise * 0.96 + r * 0.04;
      preroll.push(data); if (preroll.length > 3) preroll.shift();
      if (r > threshold) { speaking = true; chunks = preroll.slice(); preroll = []; speechMs = ms; silenceMs = 0; peak = r; try { onStart(); } catch (_) {} }
      return;
    }
    chunks.push(data);
    peak = Math.max(peak * 0.995, r);
    // gürültülü ortamda da susmayı yakala: konuşma tepesine göre göreli eşik
    const quiet = Math.max(threshold * 0.6, Math.min(threshold * 1.6, peak * 0.22));
    if (r > quiet) { speechMs += ms; silenceMs = 0; } else silenceMs += ms;
    const total = chunks.length * ms;
    if (silenceMs > 750 || total > 15000) {
      const enough = speechMs > 450;
      const pcm = chunks; reset();
      onUtterance(enough ? toWav(pcm, ctx.sampleRate) : null);
    }
  }

  function toWav(parts, rate) {
    let len = 0; for (const p of parts) len += p.length;
    const all = new Float32Array(len); let o = 0; for (const p of parts) { all.set(p, o); o += p.length; }
    const ratio = rate / TARGET_RATE, outLen = Math.floor(all.length / ratio);
    const pcm = new Int16Array(outLen);
    for (let i = 0; i < outLen; i++) {
      const start = Math.floor(i * ratio), end = Math.min(all.length, Math.floor((i + 1) * ratio));
      let s = 0; for (let j = start; j < end; j++) s += all[j];
      const v = Math.max(-1, Math.min(1, s / Math.max(1, end - start)));
      pcm[i] = v < 0 ? v * 0x8000 : v * 0x7fff;
    }
    const buf = new ArrayBuffer(44 + pcm.length * 2), dv = new DataView(buf);
    const w = (off, str) => { for (let i = 0; i < str.length; i++) dv.setUint8(off + i, str.charCodeAt(i)); };
    w(0, 'RIFF'); dv.setUint32(4, 36 + pcm.length * 2, true); w(8, 'WAVE'); w(12, 'fmt ');
    dv.setUint32(16, 16, true); dv.setUint16(20, 1, true); dv.setUint16(22, 1, true);
    dv.setUint32(24, TARGET_RATE, true); dv.setUint32(28, TARGET_RATE * 2, true);
    dv.setUint16(32, 2, true); dv.setUint16(34, 16, true); w(36, 'data'); dv.setUint32(40, pcm.length * 2, true);
    new Int16Array(buf, 44).set(pcm);
    return new Uint8Array(buf);
  }

  async function start(cb, startCb) {
    if (running) return;
    if (cb) onUtterance = cb;
    if (startCb) onStart = startCb;
    stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true, channelCount: 1 } });
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    if (ctx.state === 'suspended') await ctx.resume();
    src = ctx.createMediaStreamSource(stream);
    proc = ctx.createScriptProcessor(4096, 1, 1);
    proc.onaudioprocess = process;
    src.connect(proc); proc.connect(ctx.destination);
    running = true; paused = false; reset();
  }

  function stop() {
    running = false; reset();
    try { proc && proc.disconnect(); src && src.disconnect(); } catch (_) {}
    try { stream && stream.getTracks().forEach(t => t.stop()); } catch (_) {}
    try { ctx && ctx.close(); } catch (_) {}
    ctx = stream = proc = src = null; level = 0;
  }

  root.NovaVoice = {
    start, stop,
    pause() { paused = true; reset(); },
    resume() { paused = false; reset(); },
    get running() { return running; },
    get paused() { return paused; },
    get level() { return running && !paused ? level : 0; }
  };
})(window);
