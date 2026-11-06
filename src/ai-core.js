// NOVA Yapay Zeka — tüm yapay zekâ bağlantıları (bulut + yerel)
// Sohbet, ses→yazı, yazı→ses. Hem Electron ana sürecinde (Node) hem tarayıcıda çalışır.
(function (root) {
  const PRESETS = {
    demo:       { label: 'Demo', kind: 'demo' },
    openai:     { label: 'ChatGPT', kind: 'openai', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini' },
    gemini:     { label: 'Gemini', kind: 'openai', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.5-flash-lite' },
    anthropic:  { label: 'Claude', kind: 'anthropic', baseUrl: 'https://api.anthropic.com', model: 'claude-haiku-4-5' },
    xai:        { label: 'Grok', kind: 'openai', baseUrl: 'https://api.x.ai/v1', model: 'grok-3-mini' },
    deepseek:   { label: 'DeepSeek', kind: 'openai', baseUrl: 'https://api.deepseek.com/v1', model: 'deepseek-chat' },
    mistral:    { label: 'Mistral', kind: 'openai', baseUrl: 'https://api.mistral.ai/v1', model: 'mistral-small-latest' },
    groq:       { label: 'Groq', kind: 'openai', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile' },
    openrouter: { label: 'OpenRouter', kind: 'openai', baseUrl: 'https://openrouter.ai/api/v1', model: 'openrouter/auto' },
    ollama:     { label: 'Ollama (yerel)', kind: 'ollama', baseUrl: 'http://localhost:11434', model: '', local: true },
    lmstudio:   { label: 'LM Studio (yerel)', kind: 'openai', baseUrl: 'http://localhost:1234/v1', model: '', local: true }
  };
  const GEMINI_NATIVE = 'https://generativelanguage.googleapis.com/v1beta';

  // Anahtarla çalışan bulut yapay zekâları (otomatik modda bu sırayla denenir)
  const KEY_PROVIDERS = [
    { id: 'gemini', name: 'Gemini (Google)', note: 'ücretsiz kotası var · sesli dinleme', link: 'https://aistudio.google.com/apikey', hint: 'AIza…' },
    { id: 'openai', name: 'ChatGPT (OpenAI)', note: 'sesli dinleme + doğal ses', link: 'https://platform.openai.com/api-keys', hint: 'sk-…' },
    { id: 'anthropic', name: 'Claude (Anthropic)', note: '', link: 'https://console.anthropic.com/settings/keys', hint: 'sk-ant-…' },
    { id: 'xai', name: 'Grok (xAI)', note: '', link: 'https://console.x.ai', hint: 'xai-…' },
    { id: 'deepseek', name: 'DeepSeek', note: 'çok uygun fiyatlı', link: 'https://platform.deepseek.com/api_keys', hint: 'sk-…' },
    { id: 'mistral', name: 'Mistral', note: '', link: 'https://console.mistral.ai/api-keys', hint: 'anahtar' },
    { id: 'groq', name: 'Groq', note: 'ücretsiz kotası var · çok hızlı · sesli dinleme', link: 'https://console.groq.com/keys', hint: 'gsk_…' },
    { id: 'openrouter', name: 'OpenRouter', note: 'yüzlerce model tek anahtarla', link: 'https://openrouter.ai/keys', hint: 'sk-or-…' }
  ];
  const LOCAL_PROVIDERS = ['ollama', 'lmstudio'];
  const STT_PROVIDERS = ['openai', 'groq', 'gemini']; // sesi yazıya çevirebilenler (hız sırasıyla)

  function detectProvider(key) {
    const k = (key || '').trim();
    if (/^sk-ant-/.test(k)) return 'anthropic';
    if (/^sk-or-/.test(k)) return 'openrouter';
    if (/^gsk_/.test(k)) return 'groq';
    if (/^xai-/.test(k)) return 'xai';
    if (/^AIza/.test(k)) return 'gemini';
    if (/^sk-[a-f0-9]{32}$/.test(k)) return 'deepseek';
    if (/^sk-/.test(k)) return 'openai';
    return null;
  }

  function b64(bytes) {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64');
    let s = '';
    for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(s);
  }

  async function readError(res) {
    let body = '';
    try { body = await res.text(); } catch (_) {}
    try { const j = JSON.parse(body); const e = Array.isArray(j) ? j[0] && j[0].error : j.error; body = (e && (e.message || e)) || j.message || body; } catch (_) {}
    if (res.status === 401 || res.status === 403) return `Anahtar geçersiz ya da yetkisiz (${res.status}).`;
    if (res.status === 402) return 'Hesapta bakiye yok (402).';
    if (res.status === 429) return 'Kota ya da hız sınırı doldu (429). Biraz bekle veya bakiyeni kontrol et.';
    return `Sunucu hatası ${res.status}: ${String(body).slice(0, 300)}`;
  }

  function safeFetch(rawFetch, ms = 30000, local = false) {
    return async (url, opts = {}) => {
      const ac = typeof AbortController !== 'undefined' ? new AbortController() : null;
      const timer = ac && setTimeout(() => ac.abort(), ms);
      try { return await rawFetch(url, ac ? Object.assign({}, opts, { signal: ac.signal }) : opts); }
      catch (e) {
        if (e && e.name === 'AbortError') throw new Error(`Sunucu ${Math.round(ms / 1000)} saniyede cevap vermedi.`);
        if (local) throw new Error(`Yerel yapay zekâya bağlanılamadı (${url.split('/').slice(0, 3).join('/')}). Program açık mı?`);
        throw new Error(`Sunucuya bağlanılamadı (${url.split('/').slice(0, 3).join('/')}). İnternet bağlantını kontrol et.`);
      }
      finally { if (timer) clearTimeout(timer); }
    };
  }

  // ---- Otomatik model seçimi (sesli asistan için HIZLI modeller tercih edilir) ----
  const modelCache = {};
  const ver = (s) => { const m = String(s).match(/(\d+(?:\.\d+)?)/); return m ? parseFloat(m[1]) : 0; };
  const firstOf = (ids, list) => list.find(m => ids.includes(m));
  const PICK = {
    openai: (ids) => firstOf(ids, ['gpt-4.1-mini', 'gpt-4o-mini', 'gpt-4.1-nano']),
    gemini: (ids) => {
      ids = ids.map(i => i.replace(/^models\//, ''));
      if (ids.includes('gemini-2.5-flash-lite')) return 'gemini-2.5-flash-lite';
      const lite = ids.filter(i => /^gemini-\d+(\.\d+)?-flash-lite$/.test(i)).sort((a, b) => ver(b) - ver(a));
      return lite[0] || firstOf(ids, ['gemini-2.0-flash', 'gemini-2.5-flash']);
    },
    anthropic: (ids) => ids.find(i => /haiku/.test(i)) || ids.find(i => /sonnet/.test(i)) || ids[0],
    xai: (ids) => ids.find(i => /^grok-[\d.]+-(mini|fast)/.test(i) && !/image|vision/.test(i)) || ids.find(i => /^grok/.test(i) && !/image|vision/.test(i)),
    mistral: (ids) => firstOf(ids, ['mistral-small-latest', 'mistral-medium-latest', 'mistral-large-latest']),
    groq: (ids) => {
      for (const re of [/llama-3\.3-70b/, /gpt-oss-120b/, /llama.*70b/, /qwen/, /llama/]) { const f = ids.find(i => re.test(i)); if (f) return f; }
      return ids.find(i => !/whisper|guard|tts|embed/.test(i));
    },
    // yerel: yüklü ilk sohbet modeli
    lmstudio: (ids) => ids.find(i => !/embed/i.test(i)),
    ollama: (ids) => ids.find(i => !/embed/i.test(i))
  };

  async function listModels(fetchFn, p, base, key) {
    if (p === 'ollama') {
      const r = await fetchFn(base + '/api/tags', {});
      if (!r.ok) return [];
      const d = await r.json(); return (d.models || []).map(m => m.name);
    }
    const headers = p === 'anthropic'
      ? { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' }
      : (key ? { Authorization: 'Bearer ' + key } : {});
    const r = await fetchFn(base + (p === 'anthropic' ? '/v1/models?limit=50' : '/models'), { headers });
    if (!r.ok) return [];
    const d = await r.json();
    return (d.data || d.models || []).map(m => m.id || m.name).filter(Boolean);
  }

  async function resolveModel(fetchFn, p, base, key) {
    const ck = p + ':' + base + ':' + String(key || '').slice(-6);
    if (modelCache[ck]) return modelCache[ck];
    let model = PRESETS[p].model;
    if (PICK[p]) {
      try { const ids = await listModels(fetchFn, p, base, key); model = PICK[p](ids) || model; } catch (e) { if (PRESETS[p].local) throw e; }
    }
    if (!model && p === 'ollama') throw new Error('Ollama’da yüklü model yok. Komut istemine “ollama pull llama3.2” yaz.');
    if (!model && p === 'lmstudio') throw new Error('LM Studio’da yüklü model yok. LM Studio’dan bir model indirip yükle.');
    modelCache[ck] = model;
    return model;
  }

  // ---- Sohbet ----
  // cfg: { provider, apiKey, model, baseUrl, maxTokens }
  async function chat(rawFetch, cfg, system, messages) {
    const p = cfg.provider; const pr = PRESETS[p];
    if (!pr || p === 'demo') return null;
    const fetchFn = safeFetch(rawFetch, pr.local ? 90000 : 30000, pr.local);
    const base = (cfg.baseUrl || pr.baseUrl).replace(/\/+$/, '');
    const model = cfg.model || await resolveModel(fetchFn, p, base, cfg.apiKey);

    if (pr.kind === 'ollama') {
      const res = await fetchFn(base + '/api/chat', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, stream: false, messages: [{ role: 'system', content: system }, ...messages], options: cfg.maxTokens ? { num_predict: cfg.maxTokens } : {} })
      });
      if (!res.ok) throw new Error(await readError(res));
      const d = await res.json();
      return (d.message && d.message.content) || '';
    }

    if (pr.kind === 'anthropic') {
      const res = await fetchFn(base + '/v1/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': cfg.apiKey || '', 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
        body: JSON.stringify({ model, max_tokens: cfg.maxTokens || 1500, system, messages })
      });
      if (!res.ok) throw new Error(await readError(res));
      const d = await res.json();
      return (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
    }

    // OpenAI uyumlu: ChatGPT, Gemini, Grok, DeepSeek, Mistral, Groq, OpenRouter, LM Studio
    const headers = { 'Content-Type': 'application/json' };
    if (cfg.apiKey) headers.Authorization = 'Bearer ' + cfg.apiKey;
    if (p === 'openrouter') { headers['HTTP-Referer'] = 'https://nova-yapay-zeka.app'; headers['X-Title'] = 'NOVA Yapay Zeka'; }
    const body = { model, messages: [{ role: 'system', content: system }, ...messages] };
    if (cfg.maxTokens) body.max_tokens = cfg.maxTokens;
    const res = await fetchFn(base + '/chat/completions', { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) throw new Error(await readError(res));
    const d = await res.json();
    return (d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '';
  }

  // ---- Ses → yazı (wav: Uint8Array, 16 kHz mono WAV) ----
  async function transcribe(rawFetch, cfg, wav) {
    const fetchFn = safeFetch(rawFetch, 15000);
    const p = cfg.provider;
    if (p === 'openai' || p === 'groq') {
      const models = p === 'openai' ? ['gpt-4o-mini-transcribe', 'whisper-1'] : ['whisper-large-v3-turbo', 'whisper-large-v3'];
      let lastErr;
      for (const model of models) {
        const fd = new FormData();
        fd.append('file', new Blob([wav], { type: 'audio/wav' }), 'ses.wav');
        fd.append('model', model);
        fd.append('language', 'tr');
        const res = await fetchFn(PRESETS[p].baseUrl + '/audio/transcriptions', { method: 'POST', headers: { Authorization: 'Bearer ' + cfg.apiKey }, body: fd });
        if (res.ok) { const d = await res.json(); return (d.text || '').trim(); }
        lastErr = await readError(res);
        if (res.status === 401 || res.status === 429) break;
      }
      throw new Error(lastErr);
    }
    if (p === 'gemini') {
      const model = await resolveModel(fetchFn, 'gemini', PRESETS.gemini.baseUrl, cfg.apiKey);
      const res = await fetchFn(`${GEMINI_NATIVE}/models/${model.replace(/^models\//, '')}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': cfg.apiKey },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [
            { text: 'Bu ses kaydında konuşulanları Türkçe olarak kelimesi kelimesine yazıya dök. Sadece söyleneni yaz, açıklama ekleme. Anlaşılır bir konuşma yoksa hiçbir şey yazma.' },
            { inline_data: { mime_type: 'audio/wav', data: b64(wav) } }
          ] }],
          generationConfig: { temperature: 0 }
        })
      });
      if (!res.ok) throw new Error(await readError(res));
      const d = await res.json();
      const parts = (d.candidates && d.candidates[0] && d.candidates[0].content && d.candidates[0].content.parts) || [];
      return parts.map(x => x.text || '').join(' ').trim();
    }
    throw new Error('Bu yapay zekâ sesi yazıya çeviremiyor');
  }

  // ---- Yazı → ses (ChatGPT; mp3 döner) ----
  async function speech(rawFetch, cfg, text) {
    const fetchFn = safeFetch(rawFetch, 12000);
    let lastErr;
    for (const body of [
      { model: 'gpt-4o-mini-tts', voice: 'nova', input: text, response_format: 'mp3', instructions: 'Türkçe, sıcak, samimi ve doğal bir tonla konuş.' },
      { model: 'tts-1', voice: 'nova', input: text, response_format: 'mp3' }
    ]) {
      const res = await fetchFn(PRESETS.openai.baseUrl + '/audio/speech', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + cfg.apiKey }, body: JSON.stringify(body)
      });
      if (res.ok) return new Uint8Array(await res.arrayBuffer());
      lastErr = await readError(res);
      if (res.status === 401 || res.status === 429) break;
    }
    throw new Error(lastErr);
  }

  const api = { PRESETS, KEY_PROVIDERS, LOCAL_PROVIDERS, STT_PROVIDERS, detectProvider, chat, transcribe, speech };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NovaAI = api;
})(typeof window !== 'undefined' ? window : globalThis);
