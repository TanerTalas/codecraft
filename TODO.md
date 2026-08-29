# CodeCraft — Yapılacaklar

Bu dosya `docs/ROADMAP.md`'nin yürütülebilir hâli. Gerekçeler ve sıralamanın **neden** böyle olduğu orada; burada sadece işaretlenecek adımlar var.

**Nasıl kullanılır**

- Aşamalar sırayla yapılır. Bir aşamanın bitiş kriteri karşılanmadan sonrakine geçilmez.
- "Tamamlandı" sadece bitiş kriteri ölçüldüğünde yazılır. Ölçüt yoksa yarım iş için de aynı cümle kurulur.
- Bir madde bittiğinde `- [ ]` → `- [x]` yapılır ve commit edilir.

**Sürüm numarası hatırlatması**

Dosyalara yazılan biçim her zaman `1.26.xx`. Pazarlama numarası (`26.40`) hiçbir JSON alanına yazılmaz. Bkz. `CLAUDE.md`.

---

## Aşama 0 — Kurulum

- [x] Git deposu başlatıldı, `origin` bağlandı, ilk push atıldı
- [x] `.gitignore` Node/TS şablonuyla değiştirildi (eski Visual Studio şablonu `packages/` klasörünü gizliyordu)
- [ ] Node workspace iskeleti: kök `package.json`, npm workspaces tanımı, `tsconfig.json`
- [ ] Klasör iskeleti: `packages/core`, `packages/validator`, `packages/knowledge`, `pipeline/`, `evals/`, `data/`
- [ ] Test ortamı — `notlar/kurulum-ve-legal.md` listesinden:
  - [ ] Minecraft Bedrock lisansı (Windows) — çıktının gerçekten çalıştığını doğrulamanın başka yolu yok
  - [x] Node.js
  - [x] Python 3.10+
  - [ ] Opsiyonel: Bedrock Dedicated Server

**Bitiş kriteri:** `npm install` ve `npx tsc --noEmit` hatasız koşuyor.

---

## Aşama 0.5 — 20 soruluk test (kod yazılmaz)

Ürünün var olma sebebini ölçen test. Kod yazmadan önce yapılır.

- [ ] Sürüme bağımlı 20 soru hazırla. Konular: `format_version`, `min_engine_version`, script API sürümü, deneysel anahtar gerektiren özellikler, WebSocket ile dış otomasyon, pazarlama numarası / API numarası karışıklığı
- [ ] Üç genel modele sor, ham cevapları kaydet
- [ ] Her cevabı Mojang verisine karşı kontrol et
- [ ] Sonuç tablosunu `docs/` altına kalıcı olarak yaz — sonraki her kararın dayanağı bu

**Bitiş kriteri:** Hata oranı ölçüldü ve yazıldı.

- Hata oranı düşükse (20'de 3 gibi) → **dur.** Ürünün var olma sebebi yok, devam kararı burada yeniden verilir.
- Hata oranı yüksekse (20'de 12 gibi) → hem ürün doğrulandı hem ilk pazarlama materyali hazır.

---

## Aşama 1 — Veri pipeline'ı

Detaylar ve bilinen aksaklıklar: `docs/SOURCES.md`.

- [ ] **İlk somut adım:** bedrock-samples'ı çeken, sürüm numarasını çıkaran ve `data/<sürüm>/` altına yazan tek script. Yüz satırı geçmez, projenin en riskli varsayımını doğrular
- [ ] Blockception şemaları — `main` dalı, tag değil (tag'ler geride kalabiliyor)
- [ ] npm'den `@minecraft/server` tip tanımları
- [ ] MicrosoftDocs/minecraft-creator sürüm notları
- [ ] Ham içerik `pipeline/raw/` içinde kalır, git'e girmez. Sadece türetilen indeks commit edilir (Minecraft EULA)
- [ ] GitHub Actions: günlük cron, değişiklik varsa otomatik commit
- [ ] Veri bayatlama bildirimi
- [ ] WebSocket sağlık kontrolü: `/connect` her sürümde kırılabilir, resmi changelog yok — bağlantı ve temel olaylar test edilir, kırıldığında bildirilir

**Bitiş kriteri:** Repo her sabah otomatik güncelleniyor ve veri bayatladığında bildirim geliyor.

---

## Aşama 2 — Validator paketi

LLM yok, arayüz yok. `packages/validator` saf fonksiyonlardan oluşur (mimari kural 3).

- [ ] `validateJson(içerik, tip, sürüm)` — Blockception şemasına karşı, `ajv` ile
- [ ] `validateScript(kod, apiSürümü)` — `tsc` sarmalayıcısı
- [ ] `lookup(blokId, sürüm)` — geçerli mi
- [ ] Sürüm çözümleme: `data/` içindeki mevcut sürümlerden
- [ ] Test fixture'ları: bilerek doğru 10 dosya + bilerek bozuk 10 dosya

**Bitiş kriteri:** 20 fixture'ın hepsi doğru sonuç veriyor.

Bu aşama LLM'den önce geliyor: validator çalışmazsa ürün de çalışmaz. En riskli parça en ucuz şekilde test edilmiş olur.

---

## Aşama 2.5 — Eval altyapısı

Aşama 3 boyunca ana çalışma yüzeyi burası olacak.

- [ ] `evals/` içine 20 gerçek istek. Şema:
  ```json
  {
    "id": "chain-mining-01",
    "istek": "Kırdığım bloğun aynı türden komşularını da kırsın",
    "sürüm": "1.26.40",
    "tip": "script",
    "beklenen": "validator_geçer"
  }
  ```
- [ ] `npm run eval` runner — 20 isteği modele gönderir, çıktıları validator'dan geçirir, tablo basar
- [ ] HTML rapor. Tasarım yok, sadece tablo: istek / üretilen çıktı / doğrulama sonucu / hata mesajı
- [ ] Rapor `evals/output/` altına yazılır, git'e girmez (model cevapları ve istek metinleri içerir)

**Bitiş kriteri:** `npm run eval` koşuyor ve okunabilir bir tablo basıyor.

---

## Aşama 3 — LLM katmanı, CLI olarak

Çekirdek mantık `packages/core` içinde, CLI ince kabuk (mimari kural 1).

- [ ] Akış: istek → ilgili veriyi topla → sürüme kilitli prompt kur → modele gönder → validator'dan geçir
- [ ] **Tek retry döngüsü:** hata varsa hatayı da vererek bir kez daha dene. Ürünün kalite farkını yaratan şey bu, genel modeller yapmıyor
- [ ] LLM soyutlaması Vercel AI SDK üzerinden
- [ ] Model ID'leri yapılandırmadan okunur, koda gömülmez
- [ ] CLI komutu

### Niyet ve yapılabilirlik eşlemesi

Doğrulamadan **önce** çalışır, LLM gerektirmez, kalıp eşlemesiyle yapılır. Hem token tasarrufu sağlar hem en sık hatayı baştan keser.

- [ ] Platformun izin vermediği kategorileri tanı: girdi simülasyonu, dosya sistemi erişimi, ağ isteği
- [ ] Yakalandığında doğrudan alternatif öner (örn. "fareye basılı tutmuş gibi kazsın" → zincirleme kazma veya dışarıdan çalışan script)

**Bitiş kriteri:** CLI uçtan uca çalışıyor. Prompt burada onlarca istekle iyileştirilir — tarayıcıda yapmak çok yavaş.

---

## ⛔ GEÇİŞ KAPISI

- [ ] **Eval seti 20'de 18 doğrulamadan geçiyor**

Bu sayıya ulaşmadan arayüze geçilmez. Kapıya ulaşılmadığında ne üzerinde çalışılacağı da belli olur, çünkü hangi vakaların patladığı görülür.

---

## Aşama 4 — Web arayüzü

Next.js + Tailwind. Üretim tarayıcıda, doğrulama sunucuda (mimari kural 2).

- [ ] Kalıcı sürüm seçici
- [ ] Sohbet alanı
- [ ] Kod bloğu ve kopyala butonu
- [ ] **Doğrulama rozeti** — "1.26.40 şemasına karşı doğrulandı". Atlanmaz. Tek görünür fark bu, ve kullanıcıya neden genel bir sohbet arayüzü yerine bunu kullandığını anlatan tek şey
- [ ] BYOK anahtar girişi — anahtar tarayıcıda kalır, sunucuya hiç uğramaz
- [ ] Anahtar girildiğinde test çağrısı yap, model listesini çek, menüyü doldur, hata gelirse net mesaj göster
- [ ] Eylül 2026 Gemini geçişi: eski standart anahtarlar reddedilecek, doğrulama akışı bunu yakalayacak şekilde kurulmalı
- [ ] Varsayılan mod: kendi anahtarımla, günde 5 mesaj gibi sıkı kota. İlk ekranda anahtar isteme — kullanıcıların çoğu ürünü görmeden kaybedilir
- [ ] Hosting: Vercel veya Cloudflare, ücretsiz kademe

---

## Sürekli — Legal

Ayrıntı: `notlar/kurulum-ve-legal.md`.

- [ ] Gizlilik metni — promptlar üçüncü taraflara gidiyor, işlenme şartları kullanıcının kendi hesap tier'ına bağlı, tek bir garanti cümlesi kurulamaz
- [ ] Sorumluluk reddi — üretilen çıktı kullanıcının dünyasında veri kaybına yol açabilir
- [ ] Sunucu kuralları uyarısı — AFK otomasyon çıktılarında görünür not
- [ ] Minecraft marka kuralları — isimlendirme, resmi bağlantı izlenimi verilmemesi
- [ ] `@minecraft/server` paket lisansı kontrol edilecek
- [ ] MicrosoftDocs/minecraft-creator repo lisansı kontrol edilecek

**Karar alınmış:** v1'de hiç kişisel veri toplanmayacak, hesap sistemi kurulmayacak. Bu `CLAUDE.md` içinde mimari kısıt olarak yazılı — çocuk verisi (KVKK/GDPR/COPPA) riskini baştan keser.

---

## Yapılmayacaklar (hatırlatma)

`CLAUDE.md`'deki tablo bağlayıcı. Özetle: vektör DB / embedding / RAG yok, kullanıcı hesabı ve veritabanı yok, kendi JSON şemamızı yazmıyoruz (Blockception var), model ID'leri koda gömülmüyor, komut sözdizimi doğrulayıcısı v1'de yok.
