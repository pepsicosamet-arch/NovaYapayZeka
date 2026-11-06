// NOVA Yapay Zeka — ajan tanımları
// group: "core" (düşünen, camgöbeği), "work" (üreten, altın), "link" (bağlantı, gri)
(function (root) {
  const AGENTS = [
    { id: 'asistan', name: 'Asistan Şefi', role: 'Sağ kolun — günü yönetir', group: 'core',
      handles: ['Günün planını çıkarır ve önceliklendirir', 'İşi doğru ajana yönlendirir', 'Toplantı ve görev özetleri hazırlar'],
      examples: ['Bugün neye odaklanayım?', 'Bu haftanın planını çıkar'],
      keys: ['plan', 'bugün', 'gün', 'öncelik', 'özet', 'hafta', 'yapılacak'] },
    { id: 'hafiza', name: 'Hafıza', role: 'Uzun süreli hafıza', group: 'core',
      handles: ['Söylediğin her şeyi not eder', 'Bağlamı her göreve otomatik ekler', 'Zamanla tercihlerini öğrenir'],
      examples: ['Hatırla: müşteri toplantısı cuma 14:00', 'Neleri hatırlıyorsun?'],
      keys: ['hatırla', 'hafıza', 'unutma', 'not al', 'kaydet', 'hatırlıyor'] },
    { id: 'strateji', name: 'Stratejist', role: 'Büyük resmi görür', group: 'core',
      handles: ['Hedefleri adımlara böler', 'Riskleri ve fırsatları tartar', 'Uzun vadeli yol haritası çizer'],
      examples: ['6 aylık büyüme planı yap', 'Bu fikrin riskleri neler?'],
      keys: ['strateji', 'yol haritası', 'hedef', 'vizyon', 'risk', 'fırsat', 'büyüme planı'] },
    { id: 'arastirma', name: 'Araştırmacı', role: 'Derin araştırma', group: 'core',
      handles: ['Bir konuyu baştan sona inceler', 'Karşılaştırma tabloları çıkarır', 'Kaynakları özetler'],
      examples: ['Rakiplerimi karşılaştır', 'Bu konuyu bana anlat'],
      keys: ['araştır', 'incele', 'karşılaştır', 'nedir', 'anlat', 'bilgi', 'rakip'] },
    { id: 'finans', name: 'Finans', role: 'Para takibi', group: 'core',
      handles: ['Gelir-gider hesabı yapar', 'Bütçe ve maliyet çıkarır', 'Fiyatlandırma önerir'],
      examples: ['Aylık bütçe tablosu hazırla', 'Bu ürünü kaça satmalıyım?'],
      keys: ['bütçe', 'para', 'maliyet', 'fiyat', 'gelir', 'gider', 'kâr', 'kar ', 'hesap', 'tl'] },
    { id: 'editor', name: 'Editör', role: 'Kalite kapısı', group: 'core',
      handles: ['Metinleri düzeltir ve sadeleştirir', 'Yazım ve anlatım hatalarını yakalar', 'Tonu hedef kitleye göre ayarlar'],
      examples: ['Bu metni düzelt', 'Daha profesyonel yaz'],
      keys: ['düzelt', 'yazım', 'imla', 'metin', 'sadeleştir', 'yeniden yaz', 'çevir'] },
    { id: 'satis', name: 'Satış', role: 'Anlaşma kapatıcı', group: 'work',
      handles: ['Teklif ve satış metni yazar', 'İtirazlara cevap hazırlar', 'Takip mesajları kurgular'],
      examples: ['Müşteriye teklif yaz', 'Fiyat itirazına cevap ver'],
      keys: ['satış', 'teklif', 'müşteri', 'sat', 'anlaşma', 'pazarlık'] },
    { id: 'pazarlama', name: 'Pazarlama', role: 'Büyüme motoru', group: 'work',
      handles: ['Kampanya fikirleri üretir', 'Reklam metni ve slogan yazar', 'Hedef kitle analizi yapar'],
      examples: ['Uygulamam için slogan bul', 'Reklam kampanyası planla'],
      keys: ['pazarlama', 'reklam', 'kampanya', 'slogan', 'marka', 'tanıtım'] },
    { id: 'operasyon', name: 'Operasyon', role: 'İşi yürüten', group: 'work',
      handles: ['Süreçleri adım adım yazar', 'Vardiya ve iş planı kurar', 'Kontrol listeleri çıkarır'],
      examples: ['Depo için kontrol listesi yap', 'Vardiya planı oluştur'],
      keys: ['süreç', 'operasyon', 'vardiya', 'kontrol listesi', 'depo', 'lojistik', 'iş akışı'] },
    { id: 'sosyal', name: 'Sosyal Medya', role: 'Markanın sesi', group: 'work',
      handles: ['Gönderi ve açıklama yazar', 'Hashtag ve paylaşım takvimi önerir', 'Video fikirleri üretir'],
      examples: ['Instagram gönderisi yaz', 'YouTube video başlığı öner'],
      keys: ['instagram', 'tiktok', 'youtube', 'gönderi', 'paylaşım', 'hashtag', 'sosyal', 'post', 'başlık'] },
    { id: 'muhendis', name: 'Mühendislik', role: 'Teknik beyin', group: 'work',
      handles: ['Kod yazar ve hata ayıklar', 'Mimari ve teknoloji seçer', 'Kurulum adımlarını anlatır'],
      examples: ['Bu hatayı çöz', 'Python ile dosya düzenleyici yaz'],
      keys: ['kod', 'hata', 'program', 'python', 'javascript', 'yazılım', 'uygulama', 'bug', 'api', 'script'] },
    { id: 'tasarim', name: 'Tasarım', role: 'Görsel atölye', group: 'work',
      handles: ['Logo ve renk paleti önerir', 'Arayüz düzeni kurgular', 'Görsel konsept yazar'],
      examples: ['Logom için renk paleti öner', 'Afiş tasarım fikri ver'],
      keys: ['tasarım', 'logo', 'renk', 'afiş', 'görsel', 'arayüz', 'font'] },
    { id: 'takvim', name: 'Takvim', role: 'Ay görünümü ve etkinlikler', group: 'tool',
      handles: ['Aylık takvimi gösterir', 'Günlere etkinlik ekler', '“Bugün ne var?” sorusunu cevaplar'],
      examples: ['Bugün takvimimde ne var?', 'Bu hafta neler var?'], keys: ['takvim', 'etkinlik', 'program'] },
    { id: 'hava', name: 'Hava Durumu', role: 'Anlık ve 6 günlük tahmin', group: 'tool',
      handles: ['Şehrindeki havayı söyler', 'Yarın için tahmin verir', 'Şemsiye gerekip gerekmediğini söyler'],
      examples: ['Hava nasıl?', 'Yarın yağmur yağacak mı?'], keys: ['hava', 'derece', 'yağmur', 'sıcaklık'] },
    { id: 'gerisayim', name: 'Geri Sayım', role: 'Zamanlayıcı ve tarihe sayaç', group: 'tool',
      handles: ['Zamanlayıcı kurar', 'Önemli günlere geri sayar', 'Süre dolunca haber verir'],
      examples: ['10 dakikalık geri sayım başlat', 'Yılbaşına geri sayım'], keys: ['geri sayım', 'zamanlayıcı', 'kaç gün kaldı'] },
    { id: 'notlar', name: 'Notlar', role: 'Hızlı not defteri', group: 'tool',
      handles: ['Söylediğini not alır', 'Notlarını okur', 'Notları saklar'],
      examples: ['Not al: süt ve ekmek al', 'Notlarımı oku'], keys: ['not al', 'notlar', 'not et'] },
    { id: 'hatirlatma', name: 'Hatırlatmalar', role: 'Zamanı gelince haber verir', group: 'tool',
      handles: ['Belirli bir saatte hatırlatır', 'Bildirim gösterir ve sesli söyler', 'Yaklaşanları listeler'],
      examples: ['Yarın 9’da toplantıyı hatırlat', '20 dakika sonra ilacımı hatırlat'], keys: ['hatırlat'] },
    { id: 'alarm', name: 'Alarm', role: 'Uyandırır, ertelenebilir', group: 'tool',
      handles: ['Tek seferlik ya da tekrarlı alarm kurar', '5 dakika erteleme', 'Hafta içi / her gün seçenekleri'],
      examples: ['Sabah 7.30’a alarm kur', 'Hafta içi her gün 7’de alarm kur'], keys: ['alarm', 'uyandır'] }
  ];

  function route(text) {
    const t = ' ' + text.toLocaleLowerCase('tr-TR') + ' ';
    let best = null, score = 0;
    for (const a of AGENTS) {
      let s = 0;
      for (const k of a.keys) if (t.includes(k)) s += k.length > 5 ? 2 : 1;
      if (a.id === 'asistan') s *= 0.5; // genel ajan: yalnızca başka uzman yoksa
      if (s > score) { score = s; best = a; }
    }
    return best || AGENTS[0];
  }

  const api = { AGENTS, route };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.NovaAgents = api;
})(typeof window !== 'undefined' ? window : globalThis);
