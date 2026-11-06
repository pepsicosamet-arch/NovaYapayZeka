# NOVA Yapay Zeka

18 uzman ajandan oluşan, tamamen Türkçe kişisel yapay zekâ masaüstü uygulaması (Windows).
Ortada canlı bir çekirdek, etrafında Asistan Şefi, Hafıza, Stratejist, Araştırmacı, Finans, Editör, Satış, Pazarlama, Operasyon, Sosyal Medya, Mühendislik, Tasarım ve bağlantı ajanları. İsteğini yazarsın; NOVA hangi uzmana ait olduğunu anlar, o ajanın hattı altın renge döner ve yanıt gelir.

## Kurulum dosyası (Setup.exe) oluşturma

**Yol 1 — Kendi bilgisayarında (en kolay)**
1. [Node.js LTS](https://nodejs.org/tr) kur (bir kere).
2. Bu klasörde **KUR-VE-DERLE.bat** dosyasına çift tıkla.
3. Bitince `dist` klasörü açılır:
   - `NOVA-Yapay-Zeka-Setup-1.1.0.exe` — Türkçe kurulum sihirbazı (masaüstü + başlat menüsü kısayolu, kurulum yeri seçimi, kaldırıcı)
   - `NOVA-Yapay-Zeka-Tasinabilir-1.1.0.exe` — kurulum gerektirmeden çalışır

**Yol 2 — GitHub otomatik derlesin**
Projeyi `github.com/pepsicosamet-arch/NovaYapayZeka` deposuna yükle, sonra bir sürüm etiketi gönder:
```
git tag v1.1.0
git push origin v1.1.0
```
`.github/workflows/derle.yml` Windows sunucusunda Setup.exe’yi derler ve **Releases** sayfasına ekler. (Actions sekmesinden “Run workflow” ile elle de çalıştırılabilir.)

**Geliştirirken denemek:** `BASLAT.bat` (ya da `npm install` → `npm start`).

## Yapay zekâ ve ses
İlk açılışta AYARLAR kendiliğinden açılır. Elindeki anahtar(lar)ı yapıştır → **ANAHTARLARI TEST ET** → **KAYDET**.

| Bulut yapay zekâları | Not |
|---|---|
| ChatGPT (OpenAI) | sesli dinleme + doğal "nova" sesi |
| Gemini (Google) | ücretsiz kotası var · sesli dinleme |
| Claude (Anthropic) | |
| Grok (xAI) | |
| DeepSeek | çok uygun fiyatlı |
| Mistral | |
| Groq | ücretsiz kotası var · çok hızlı · sesli dinleme |
| OpenRouter | yüzlerce model tek anahtarla |

**Yerel yapay zekâ (internetsiz, ücretsiz):** AYARLAR → *Yerel yapay zekâ* bölümünden **Ollama** ya da **LM Studio**'yu aç. Model boş bırakılırsa yüklü ilk model kullanılır (Ollama için: `ollama pull llama3.2`).

- Model seçimini NOVA yapar; sesli asistan için hızlı modeller tercih edilir. Gelişmiş bölümünden öncelikli yapay zekâ ve model seçilebilir.
- Birden fazla bağlantı varsa biri çalışmazsa (kota, bakiye, kapalı program) sıradakine geçer; cevabın hangisinden geldiği yanıt kutusunda yazar.
- Anahtarı yanlış kutuya yapıştırırsan NOVA tanıyıp doğru kutuya taşır. Anahtarlar Windows şifrelemesiyle saklanır.
- **Sesli dinleme** için ChatGPT, Gemini ya da Groq anahtarı gerekir (sesi yazıya bunlar çevirir). Sadece yerel yapay zekâ ya da diğer servislerle yazarak konuşulur.
- Mikrofon çalışmazsa: Windows Ayarlar → Gizlilik ve güvenlik → Mikrofon → "Masaüstü uygulamalarının mikrofona erişmesine izin ver" açık olmalı.

## Telefon (Android APK)
Aynı arayüz telefonda da çalışır: sesli dinleme ve konuşma (Android'in Türkçe sesi ya da ChatGPT sesi), tüm yapay zekâlar, takvim, hava durumu, notlar, geri sayım. **Alarm ve hatırlatmalar Android'in kendi alarm sistemine kurulur**; uygulama kapalıyken, telefon kilitliyken ve yeniden başlatıldıktan sonra da çalar (alarmlarda 5 dk erteleme ve Kapat düğmesi).

**APK'yı almanın iki yolu:**
1. **GitHub (kurulum gerektirmez):** projeyi NovaYapayZeka deposuna yükle → Actions → "Android APK derle" → *Run workflow*. Birkaç dakika sonra APK, çalışmanın "Artifacts" bölümünde çıkar. Sürüm etiketi (`v1.1.0`) gönderirsen APK Releases sayfasına da eklenir ve telefondaki uygulama yeni sürümü kendisi bulur.
2. **Kendi bilgisayarında:** [Android Studio](https://developer.android.com/studio)'yu kur ve bir kez açıp kurulum sihirbazını bitir, sonra **APK-DERLE.bat**'a çift tıkla. APK `android\app\build\outputs\apk\release\` klasörüne çıkar.

**İmza anahtarı (önemli):** `android/imza/` klasöründe sana özel imza anahtarı var. Bu klasör GitHub'a **yüklenmez** (gizli tutulmalı) ve kaybedilmemeli: sonraki sürümlerin eski sürümün üzerine kurulabilmesi için hepsi aynı anahtarla imzalanmalı. GitHub'da derlerken aynı anahtarı kullanmak için deponun **Settings → Secrets and variables → Actions** sayfasına iki sır ekle:
- `NOVA_KEYSTORE_BASE64` → `android/imza/github-secret-NOVA_KEYSTORE_BASE64.txt` dosyasının içeriği
- `NOVA_KEYSTORE_PASSWORD` → `android/imza/github-secret-NOVA_KEYSTORE_PASSWORD.txt` dosyasının içeriği

**Telefona kurulum:** APK'yı telefona at, dokun → "Bilinmeyen kaynaklardan yüklemeye izin ver" → Yükle. İlk açılışta mikrofon ve bildirim izni iste­nir; ikisine de izin ver. Geri tuşu açık paneli kapatır, panel yoksa NOVA arka plana geçer.

**Google Play:** mağazaya yükleme adımları, mağaza metinleri, görseller ve form cevapları `marka/google-play/PLAY-YUKLEME-REHBERI.md` dosyasında. Gizlilik politikası: `docs/gizlilik.html`.

## Araçlar (soldaki çubuk ya da sesle)
| Araç | Sesli örnek |
|---|---|
| Takvim | "Yarın takvimimde ne var?" · "Bu hafta neler var?" |
| Hava durumu | "Hava nasıl?" · "İzmir'de hava nasıl?" · "Yarın yağmur yağacak mı?" |
| Geri sayım | "10 dakikalık geri sayım başlat" · "Yılbaşına geri sayım" · "29 ekime geri sayım" |
| Notlar | "Not al: süt ve ekmek al" · "Notlarımı oku" |
| Hatırlatmalar | "Yarın 9'da toplantıyı hatırlat" · "20 dakika sonra ilacımı hatırlat" · "Cuma 14:00 dişçiyi hatırlat" |
| Alarm | "Sabah 7.30'a alarm kur" · "Hafta içi her gün 7'de alarm kur" · "Alarmları kapat" |

Hatırlatma ve alarm zamanı gelince ekranda büyük bir uyarı çıkar, Windows bildirimi gösterilir ve ses çalar (alarmda 5 dk erteleme). Hava durumu Open-Meteo'dan anahtarsız alınır; şehir AYARLAR'dan girilir. Pencereyi kapatınca NOVA saatin yanındaki simgede çalışmaya devam eder (alarmlar kaçmasın diye); bu sırada mikrofon kapalıdır. Tamamen kapatmak için simgeye sağ tıkla → Çıkış.

## Otomatik güncelleme
NOVA açılışta ve 6 saatte bir GitHub'daki **pepsicosamet-arch/NovaYapayZeka** deposunun **Releases** sayfasını denetler; yeni sürüm varsa arka planda indirir, uygulama kapanınca kurar (ya da Hakkında → "Yeniden başlat ve güncelle").
Yeni sürüm yayınlamak için: `package.json` içindeki `version`'ı artır (ör. 1.1.1), sonra
```
git tag v1.1.1
git push origin v1.1.1
```
GitHub Actions Setup.exe'yi ve güncelleme dosyası `latest.yml`'yi derleyip Releases'e koyar. Not: depo **herkese açık** olmalı (gizli depodan güncelleme indirilemez).

## Hakkında
Sağ üstte **HAKKINDA**: geliştirici Samet Şahin, sosyal medya hesapları (@xsametsahinx), sürüm ve güncelleme düğmesi.

## Kısayollar
`Ctrl+K` yaz · `Esc` kapat · fare tekerleği: Genel bakış / Ajanlar / Nasıl çalışır · `F11` tam ekran · çekirdeğe tıkla

## Klasörler
```
main.js, preload.js     Electron ana süreç (ayarlar, yapay zekâ istekleri)
android/                Android uygulaması (WebView + Türkçe ses + alarm sistemi), APK-DERLE.bat
src/                    Arayüz: index.html, style.css, app.js, agents.js, ai-core.js
build/                  Uygulama ikonu, kurulum sihirbazı görselleri, lisans
marka/logolar           Logo seti (SVG + PNG + ICO)
marka/sosyal-medya      Instagram, hikâye, YouTube, X, Facebook görselleri + paylaşım metinleri
marka/reklam-filmi      Yatay 1080p reklam + dikey (9:16) uzun ve 15 sn reklamlar
```

Ajan eklemek ya da değiştirmek için `src/agents.js`, ekrandaki yerleri için `src/app.js` içindeki `LAYOUT` yeterli.

© 2026 Samet Şahin · @xsametsahinx · MIT Lisansı
