# NOVA Yapay Zeka — Google Play'e yükleme rehberi

Bu klasörde mağaza sayfası için her şey hazır: ikon, öne çıkan görsel, 6 ekran görüntüsü ve aşağıdaki metinler.
Uygulama Play kurallarına göre ayarlandı:
- Android 16 (API 36) hedefleniyor.
- Play'in kısıtladığı izinler çıkarıldı.
- Play'den kurulunca kendi kendine güncelleme kapanıyor.
- Yapay zekâ cevapları uygulama içinden bildirilebiliyor.
- Gizlilik politikası `docs/gizlilik.html` dosyasında.

---

## 0. Önce bilmen gerekenler
- **Geliştirici hesabı:** play.google.com/console adresinden açılır. Tek seferlik 25 $ ücret alınır ve kimlik doğrulaması istenir.
- **Kişisel hesaplarda 12 test kullanıcısı kuralı:** Kasım 2023'ten sonra açılan kişisel hesaplarda uygulamayı herkese açmadan önce kapalı test zorunludur. En az **12 kişi** testi kabul etmeli ve **14 gün kesintisiz** katılmalı. Ancak bundan sonra "Üretime erişim" başvurusu yapılabilir. Bu 12 kişi arkadaşların ya da ailen olabilir; her biri için bir Gmail adresi yeterli.
- **Yüklenecek dosya:** `.aab` (Android App Bundle). APK kabul edilmez.

## 1. AAB dosyasını üret
Bu dosya mutlaka **senin imza anahtarınla** imzalanmalı. Geçici anahtarla imzalanan paketi Play kabul etmez.

**Yol A — GitHub (önerilen)**
1. Deponda **Settings → Secrets and variables → Actions → New repository secret** ile iki sır ekle:
   - `NOVA_KEYSTORE_BASE64` → `android/imza/github-secret-NOVA_KEYSTORE_BASE64.txt` dosyasının içeriği
   - `NOVA_KEYSTORE_PASSWORD` → `android/imza/github-secret-NOVA_KEYSTORE_PASSWORD.txt` dosyasının içeriği
2. Projeyi depoya yükle. `android/imza/` klasörü kendiliğinden yüklenmez, öyle de kalmalı.
3. **Actions → "Android APK ve Play paketi (AAB) derle" → Run workflow**.
4. Bitince çalışmanın altındaki **NOVA-Yapay-Zeka-Google-Play-AAB** dosyasını indir ve zip'ten çıkar.

**Yol B — Kendi bilgisayarın**
Android Studio kuruluysa **APK-DERLE.bat** dosyasına çift tıkla. AAB şu konuma çıkar: `android\app\build\outputs\bundle\release\app-release.aab`

## 2. Gizlilik politikasını herkese açık yap
Play herkese açık bir bağlantı ister. En kolayı GitHub Pages:
1. Depoda **Settings → Pages**.
2. **Source:** "Deploy from a branch". **Branch:** `main`, klasör olarak `/docs` seç → Save.
3. Bağlantın: `https://pepsicosamet-arch.github.io/NovaYapayZeka/gizlilik.html`

İstersen dosyanın sonundaki yorum satırına iletişim e-postanı ekleyebilirsin.

## 3. Play Console'da uygulamayı oluştur
**Tüm uygulamalar → Uygulama oluştur**
- Uygulama adı: `NOVA Yapay Zeka`
- Varsayılan dil: Türkçe – tr-TR
- Tür: Uygulama · Ücretsiz
- Beyanları işaretle → Oluştur

## 4. Mağaza girişi (Büyüme → Mağazada görünme → Ana mağaza girişi)
**Uygulama adı (en fazla 30):**
```
NOVA Yapay Zeka
```
**Kısa açıklama (en fazla 80):**
```
Sesli Türkçe asistan: tüm yapay zekâlar, alarm, hatırlatma ve hava durumu
```
**Tam açıklama:**
```
NOVA Yapay Zeka, seni dinleyen ve sesli cevap veren Türkçe kişisel asistandır. Ortadaki canlı çekirdeğin etrafında her biri bir işte uzman ajanlar çalışır: sen konuşursun, NOVA isteğinin hangi uzmana ait olduğunu anlar ve cevaplar.

🎙️ SESLİ ASİSTAN
• Açıldığı gibi seni dinler, sustuğunda anlar ve cevabı sesli okur
• Tamamen Türkçe arayüz ve cevaplar

🤖 TÜM YAPAY ZEKÂLAR TEK YERDE
• ChatGPT, Gemini, Claude, Grok, DeepSeek, Mistral, Groq ve OpenRouter
• Kendi anahtarını girersin; model seçimini NOVA yapar
• Biri çalışmazsa otomatik olarak diğerine geçer
• İstersen Ollama ya da LM Studio ile kendi bilgisayarındaki yerel yapay zekâyı kullan

🧠 UZMAN AJANLAR
Asistan Şefi, Hafıza, Stratejist, Araştırmacı, Finans, Editör, Satış, Pazarlama, Operasyon, Sosyal Medya, Mühendislik ve Tasarım

⏰ GÜNLÜK ARAÇLAR
• Alarm: tek seferlik ya da hafta içi / her gün, 5 dakika erteleme
• Hatırlatmalar: “Yarın 9’da toplantıyı hatırlat” demen yeterli
• Geri sayım ve zamanlayıcı
• Takvim, notlar ve 6 günlük hava durumu
• Alarm ve hatırlatmalar uygulama kapalıyken de çalar

🔒 GİZLİLİK
NOVA’nın kendi sunucusu yoktur; hesap açtırmaz, reklam göstermez. Notların, alarmların ve geçmişin telefonunda kalır. Mesajların yalnızca senin seçtiğin yapay zekâ servisine gönderilir.

Not: Yapay zekâ servislerini kullanmak için ilgili servisin API anahtarı gerekir (Gemini ve Groq’un ücretsiz kotası vardır). Yapay zekâ cevapları hatalı olabilir; uygunsuz bir cevabı “Bildir” düğmesiyle işaretleyebilirsin.

Geliştirici: Samet Şahin — @xsametsahinx
```
**Grafikler**
- Uygulama simgesi: `uygulama-ikonu-512.png`
- Öne çıkan grafik: `one-cikan-gorsel-1024x500.png`
- Telefon ekran görüntüleri: `ekran-goruntuleri/` klasöründeki 6 dosya, sırayla

**Kategori:** Üretkenlik · **Etiketler:** Yapay zekâ, Asistan, Üretkenlik

## 5. Uygulama içeriği (Politika → Uygulama içeriği)
| Bölüm | Cevap |
|---|---|
| Gizlilik politikası | `https://pepsicosamet-arch.github.io/NovaYapayZeka/gizlilik.html` |
| Reklamlar | Hayır, reklam içermiyor |
| Uygulama erişimi | "Tüm işlevler özel erişim gerektirmeden kullanılabilir". Not olarak şunu yaz: *"Yapay zekâ özellikleri kullanıcının kendi API anahtarıyla çalışır; anahtarsız demo modu ve alarm/takvim/notlar/hava durumu anahtarsız çalışır."* |
| İçerik derecelendirmesi | Kategori: Yardımcı program / Üretkenlik. Şiddet, cinsellik, kumar, uyuşturucu: Hayır. Kullanıcılar arası iletişim: Hayır. Konum paylaşımı: Hayır. **Yapay zekâ ile içerik üretiyor mu: Evet** |
| Hedef kitle | 13 yaş ve üzeri (13–15, 16–17, 18+). Çocuklara yönelik değil |
| Haber uygulaması | Hayır |
| Devlet uygulaması / finans / sağlık | Hayır |
| Tam zamanlı alarm izni beyanı (sorulursa) | "Kullanıcının kurduğu alarm ve hatırlatmaların tam vaktinde çalması için" |

**Veri güvenliği formu**
- Veri topluyor ya da paylaşıyor mu? **Evet**
- Aktarımda şifreleniyor mu? **Evet**
- Kullanıcı veri silinmesini isteyebilir mi? **Evet** (uygulama içinden geçmiş, hafıza ve not silme; uygulama verisini temizleme)

| Veri türü | Toplanıyor | Paylaşılıyor | İsteğe bağlı mı | Amaç |
|---|---|---|---|---|
| Ses → Ses kayıtları | Evet (yalnızca işlenir, saklanmaz) | Hayır* | İsteğe bağlı | Uygulama işlevleri |
| Uygulama etkinliği → Kullanıcı tarafından oluşturulan diğer içerikler (mesajlar) | Evet | Hayır* | Gerekli | Uygulama işlevleri |
| Kişisel bilgiler → Ad | Evet | Hayır* | İsteğe bağlı | Kişiselleştirme |

\* Veriler yalnızca kullanıcının seçip anahtarını girdiği yapay zekâ servisine, kullanıcının kendi isteğiyle gönderilir. Google bunu "paylaşım" saymaz.

## 6. Kapalı test (12 kişi, 14 gün)
1. **Test → Kapalı test → Yeni kanal oluştur** (adı örneğin "Test").
2. **Test kullanıcıları:** bir e-posta listesi oluştur ve 12'den fazla Gmail adresi ekle. 1-2 yedek koymak iyi olur.
3. **Yeni sürüm oluştur:**
   - "Play Uygulama İmzalama"yı kabul et; Google senin anahtarını yükleme anahtarı olarak kullanır.
   - AAB dosyasını sürükle.
   - Sürüm adı: `1.1.0`. Sürüm notu: `İlk sürüm`.
4. Ülke olarak Türkiye'yi seç → **İncelemeye gönder**.
5. Onay gelince "Test kullanıcıları" sayfasındaki katılım bağlantısını 12 kişiye gönder. Her biri bağlantıdan katılıp uygulamayı Play'den kurmalı ve 14 gün boyunca testten çıkmamalı.
6. 14 gün dolunca **Kontrol paneli → Üretime erişim başvurusu yap**. Gelen soruları kısaca cevapla: testçiler kimdi, ne geri bildirim verdiler, neyi düzelttin.
7. Onay gelince **Üretim → Yeni sürüm** ile aynı AAB'yi yayınla.

## 7. Sonraki güncellemeler
1. `package.json` içindeki `version` değerini artır, örneğin 1.1.1.
2. Yeni AAB'yi derle.
3. Play Console'da **Üretim → Yeni sürüm** ile yükle.

Sürüm kodu, sürüm numarasından kendiliğinden hesaplanır. Her yüklemede yeni sürüm numarası kullanmalısın.

> ⚠️ `android/imza/` klasörünü yedekle (USB, Google Drive). Bu anahtarı kaybedersen Play'e yükleme anahtarı sıfırlama başvurusu yapman gerekir.
