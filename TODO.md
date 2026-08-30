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
- [x] Node workspace iskeleti: kök `package.json`, npm workspaces tanımı, `tsconfig.base.json` + `tsconfig.json`
- [x] Klasör iskeleti: `packages/core`, `packages/validator`, `packages/knowledge`, `pipeline/`, `evals/`, `data/`
- [ ] Test ortamı — `notlar/kurulum-ve-legal.md` listesinden:
  - [x] Minecraft Bedrock lisansı (Windows) — çıktının gerçekten çalıştığını doğrulamanın başka yolu yok
  - [x] Node.js
  - [x] Python 3.10+
  - [ ] Opsiyonel: Bedrock Dedicated Server

**Bitiş kriteri:** `npm install` ve `npm run typecheck` hatasız koşuyor. ✅

> Doğrulandı: TypeScript 7.0.2, `tsc --noEmit` → exit 0. Paketler arası import
> (`@codecraft/validator` → `@codecraft/core`) hem `tsc` hem Node çalışma zamanında
> çözülüyor. Node 24 `.ts` dosyalarını doğrudan çalıştırıyor, ayrı derleme adımı yok.

---

## Aşama 1 — Veri pipeline'ı

Detaylar ve bilinen aksaklıklar: `docs/SOURCES.md`.

- [x] **İlk somut adım:** bedrock-samples'ı çeken, sürüm numarasını çıkaran ve `data/<sürüm>/` altına yazan script — `pipeline/src/bedrock-samples.ts`, `npm run pipeline:bedrock`
  - `data/1.26.40.5/` üretildi: 1415 blok, 1607 item, 129 entity, 89 biome + blok durum indeksi
  - Deterministik çıktı (zaman damgası/SHA yok) → cron sadece veri değişince diff görür
- [x] Blockception şemaları — `main` dalı, tag değil — `pipeline/src/schemas-blockception.ts`
  - `data/blockception/source/` altına 1140 şema + `LICENSE` (BSD-3-Clause)
  - Sürüm klasörünün içinde değil: kaynak oyun sürümüne göre klasörlenmiyor
  - **Aşama 2'de genişletildi:** derlenmiş 60 şema (`compiled/`) ve upstream'in
    glob eşlemesinden türetilen `schema-map.json` de çekiliyor. Doğrulamanın
    kullandığı küme bu, gerekçe `docs/SOURCES.md`'deki karar bölümünde
- [x] Mojang'ın kendi şemaları — `pipeline/src/schemas-mojang.ts`
  - `data/1.26.40.5/schemas/` altına 1313 dosya + `schemas-index.json`
  - **EULA kararı:** birebir kopyalanıyor, gerekçesi `docs/SOURCES.md` içinde. Repo public yapılırsa yeniden değerlendirilecek
- [x] npm'den `@minecraft/*` tip tanımları — `pipeline/src/script-types.ts`
  - Modül sürümü tahmin edilmiyor: bedrock-samples listesi ile npm kesiştiriliyor, eşleşmezse duruyor
  - `@minecraft/common` da çekiliyor — onsuz `server` ve `server-ui` derlenmiyor
- [x] MicrosoftDocs/minecraft-creator sürüm notları — `pipeline/src/release-notes.ts` (CC-BY-4.0, atıf başlığı ekleniyor)
- [x] Ham içerik `pipeline/raw/` içinde kalır, git'e girmez — `vanilladata_modules` ham hâli commit edilmiyor, sadece türetilen indeks
- [x] GitHub Actions: günlük cron, değişiklik varsa otomatik commit — `.github/workflows/data.yml`
- [x] Veri bayatlama bildirimi — `pipeline/src/check-freshness.ts` + workflow'un `if: failure()` adımı GitHub issue açar
- [x] Workflow izinleri açıldı ("Read and write permissions") ve workflow GitHub'da elle tetiklenip yeşil koştu (30-08-2026)
- ~~WebSocket sağlık kontrolü~~ → **Aşama 3'e taşındı.** Çalışan bir Minecraft istemcisi gerektiriyor, GitHub Actions'ta oyun çalıştırılamıyor. Lisans engel değil, ortam engel

**Bitiş kriteri:** Repo her sabah otomatik güncelleniyor ve veri bayatladığında bildirim geliyor.

> Yerelde doğrulandı (29-08-2026): `npm run pipeline` iki kez üst üste koşuldu,
> ikincisinde `git status` temiz — cron boş commit atmaz. `npm run pipeline:freshness`
> güncel veride "veri güncel", sürüm klasörü yeniden adlandırıldığında `exit 1`.
> `ajv` 1313/1313 Mojang şemasını derliyor; `tsc` indirilen tip tanımlarıyla doğru
> kodu geçiriyor, `runCommandAsync` gibi 2.x'te kaldırılmış çağrıları reddediyor.
>
> GitHub'da doğrulandı (30-08-2026): `workflow_dispatch` ile koşu yeşil, veri
> güncel olduğu için commit atılmadı — cron'un boş commit atmadığının kanıtı.
>
> **Henüz koşmamış iki yol:** (1) veri gerçekten değiştiğinde bot'un commit +
> push atması, (2) başarısızlıkta GitHub issue açılması. İlki Mojang bir sonraki
> sürümü yayınladığında kendiliğinden test olur.

---

## Aşama 2 — Validator paketi

LLM yok, arayüz yok. `packages/validator` saf fonksiyonlardan oluşur (mimari kural 3).

- [x] Şema kaynağı kararı — **Blockception'ın derlenmiş çıktısı**. Ölçümle
  kapandı, `npm run validator:compare`, ayrıntı `docs/SOURCES.md`
- [x] `validateJson(içerik, tip, sürüm)` — `packages/validator/src/json.ts`, `ajv` ile
  - Tip çözümleme kanonik ad, kısaltma veya dosya yolu kabul ediyor; eşleme
    `schema-map.json`'dan geliyor, elle yazılmadı
  - JSON ayrıştırma hatası şema ihlalinden ayrı bir tür olarak dönüyor
- [x] `validateScript(kod, seçenekler)` — `packages/validator/src/script.ts`
  - `tsc` ikilisi çalıştırılıyor; typescript 7'nin JS API'si `unstable/` altında
  - Modül sürümleri `index.json`'dan okunuyor, `stable` / `beta` kanalı seçilebiliyor
  - `paths` ile mutlak yol; symlink yok (Windows'ta yönetici yetkisi ister)
- [x] `lookup(blokId, sürüm)` — `packages/knowledge/src/lookup.ts`
  - `blockStates` de var: bir bloğun durumları ve alabildiği değerler
- [x] Sürüm çözümleme — `packages/knowledge/src/version.ts`
  - Üç parçalı istek dördüncü haneli klasöre eşleşiyor (`1.26.40` → `1.26.40.5`),
    eksik hane önek sayılmıyor. `check-freshness` artık bu paketten okuyor
- [x] Test fixture'ları: bilerek doğru 10 dosya + bilerek bozuk 10 dosya
  - `packages/validator/test/fixtures/cases.json` → `core` listesi tam 20 vaka
  - Bozuk vakalarda hatanın beklenen JSON pointer'da çıktığı doğrulanıyor
  - `extra` listesi ölçüm: 2 fazladan vaka + şemanın yakalamadığı 4 boşluk

**Bitiş kriteri:** 20 fixture'ın hepsi doğru sonuç veriyor. ✅

> Doğrulandı (30-08-2026): `npm test` → 53/53 geçiyor, bunun 20'si bitiş
> kriterinin `core` listesi. `npm run typecheck` exit 0.
>
> **Negatif kontrol var:** doğru bir fixture bilerek bozulduğunda test kırmızıya
> dönüyor. Yirmi vakanın yeşil olması tek başına şemanın gerçekten baktığını
> göstermez, bunun kanıtı o test.
>
> `ajv` derlenmiş 60 şemanın 60'ını da derliyor (testte tek tek ölçülüyor).
> `tsc` sarmalayıcısı çağrı başına ~90 ms.
>
> **Ölçülen ve kayda geçen dört şema boşluğu var** (`expect: "gap"`): metin
> `format_version`'lı manifest hiç doğrulanmıyor, uydurulmuş blok bileşeni,
> namespace'siz blok identifier'ı, `result`'ı olmayan shaped tarif. Şema
> güncellenip yakalamaya başlarsa testler kırmızıya döner.
>
> **Gerçek oyun testi koşuldu (30-08-2026, Bedrock 1.26.45).** Fixture'lardan
> üretilen paket oyuna yüklendi: manifest, blok, item, entity, dialogue,
> animasyon denetleyicisi ve spawn kuralları temiz geçti; `/give`, `/setblock`,
> `/summon` çalıştı; script'in olay abonelikleri tetiklendi.
>
> Ama doğrulamadan geçip oyunda patlayan **dört sınıf** bulundu. Ayrıntı ve
> kanıt: `docs/VALIDATION-LIMITS.md`. Kısaca: kimlik referansları (şema hedefin
> var olduğuna bakmıyor), dosya adı ↔ içerik kuralları (hiçbir şema yakalayamaz),
> asset referansları (behavior pack tek başına yetmiyor), ve geçerli ama
> amaçlanmayan kod (`worldLoad`'da `sendMessage` hatasız çalışıp kimseye
> ulaşmıyor).
>
> Sonuç: 20/20 geçmek "oyunda çalışıyor" demek değil. Aşama 2 kendi kapsamında
> tamam, fark Aşama 2.5 ve 3'ün konusu.

Bu aşama LLM'den önce geliyor: validator çalışmazsa ürün de çalışmaz. En riskli parça en ucuz şekilde test edilmiş olur.

---

## Aşama 2.5 — Eval altyapısı

Aşama 3 boyunca ana çalışma yüzeyi burası olacak.

- [x] Şemanın yakalayamadığı üç kontrol — `packages/validator/src/checks.ts`
  - `checkIdentities` (A), `checkFileNames` (B), `checkPatterns` (D)
  - Saf fonksiyon, model çağrısı yok. Aşama 3 aynılarını üretim döngüsüne
    bağlayacak, mantık ikinci kez yazılmayacak
- [x] `evals/cases/cases.json` içine 20 gerçek istek. Alan adları İngilizce,
  içerik Türkçe — `cases.json` fixture düzeninin aynısı (`core` / `extra`):
  ```json
  {
    "id": "chain-mining-01",
    "request": "Kırdığım bloğun aynı türden komşularını da kırsın",
    "version": "1.26.40",
    "kind": "script",
    "expect": { "validation": "pass", "checks": [] }
  }
  ```
- [x] Takılabilir üretici arayüzü — model katmanı olmadan ölçüm yapılabilsin
  - `evals/recorded/` elle yazılmış çıktılar; **model çıktısı değil** ve rapor
    bunu her koşuda yazıyor
  - Aşama 3 `--generator=model` ekleyecek, runner değişmeyecek
- [x] `npm run eval` runner — çıktıları validator'dan ve istenen kontrollerden
  geçirir, tablo basar. `--case=<id>` tek vaka, `--gate` kapı sağlanmazsa `exit 1`
- [x] HTML rapor. Tasarım yok, sadece tablo: istek / üretilen çıktı / doğrulama
  sonucu / hata mesajı. Yanına makine okunur `report.json`
- [x] Rapor `evals/output/` altına yazılır, git'e girmez (model cevapları ve istek metinleri içerir)
- [x] **"Geçerli ama amaçlanmayan" vakaları da olmalı.** Doğrulamadan geçen ama
  oyunda istediğini yapmayan çıktı sınıfı ölçüldü (`docs/VALIDATION-LIMITS.md`).
  Eval setinde karşılığı yoksa "validator geçer" ölçütü yanıltıcı olur
  - Üç vaka D sınıfını, üç vaka A sınıfını, bir vaka B sınıfını hedefliyor;
    testler bu alt sınırları ölçüyor

### Komut ve Python doğrulayıcısı — ertelendi

Kapıya sayılan 20 vaka yalnızca bugün ölçülebilen tiplerden oluşuyor
(`script`, `json`). Komut ve Python vakaları `extra` listesinde duruyor.

- [ ] **Komut kimlik kontrolü — Aşama 3.** Komut sözdizimi doğrulayıcısı v1'de
  yok (`CLAUDE.md`), çünkü Bedrock komut grameri için makine okunur resmi
  kaynak yok. Ama komut metnindeki kimlikler (`/give @s codecraft:ruby`)
  `checkIdentities` ile kontrol edilebilir — bu sözdizimi doğrulaması değil,
  var olan kontrolün komut metnine uygulanması. Modelin en sık hatasını keser
- [ ] **Python doğrulayıcısı — Aşama 3'ten sonra ölç, sonra karar ver.**
  `CLAUDE.md` "altyapıda Python çalıştırılmıyor" diyor; en ucuz doğrulama bile
  (`py_compile`) bu kuralı esnetir, o yüzden sormadan yapılmaz. Seçenekler:
  (1) doğrulama yok, çıktı "test edilmedi" notuyla verilir — bugünkü hâl,
  (2) sözdizimi kontrolü, (3) `mypy`/`pyright` ile tip kontrolü.
  Aşama 3 koştuktan sonra "model kaç Python vakasında uydurulmuş API üretti"
  ölçülür; sayı yüksekse (3), düşükse (1) kalır. Tahminle altyapı kurulmaz

**Bitiş kriteri:** `npm run eval` koşuyor ve okunabilir bir tablo basıyor. ✅

> Doğrulandı (30-08-2026): `npm run eval` 24 vakayı koşuyor (20 çekirdek +
> 4 ek), tablo ve `evals/output/report.html` üretiliyor. `npm test` 77/77,
> `npm run typecheck` exit 0.
>
> **Bugünkü skor 20'de 15.** Beş vaka bilerek düşüyor ve her biri ayrı bir
> sınıfı gösteriyor: ajv (`custom-item-01`), tsc (`mob-timer-01`), kimlik
> (`recipe-ruby-01`), dosya adı (`ore-gen-01`), kalıp (`welcome-message-01`).
> Hepsi geçseydi runner'ın hata dalları hiç koşmazdı. `npm run eval -- --gate`
> bu yüzden bugün `exit 1` veriyor — kapının gerçekten kapı olduğunun kanıtı.
>
> **Negatif kontrol var:** geçen bir kayıtlı çıktı bozulduğunda vakası
> kırmızıya dönüyor (`evals/test/evaluate.test.ts`).
>
> **Bu skor model başarımı değil.** Çıktılar elle yazıldı. Gerçek ölçüm Aşama
> 3'te `--generator=model` ile alınacak; geçiş kapısı o sayıya bakar.

---

## Aşama 3 — LLM katmanı, CLI olarak

Çekirdek mantık `packages/core` içinde, CLI ince kabuk (mimari kural 1).

- [ ] Akış: istek → ilgili veriyi topla → sürüme kilitli prompt kur → modele gönder → validator'dan geçir
- [ ] **Tek retry döngüsü:** hata varsa hatayı da vererek bir kez daha dene. Ürünün kalite farkını yaratan şey bu, genel modeller yapmıyor
- [ ] LLM soyutlaması Vercel AI SDK üzerinden
- [ ] Model ID'leri yapılandırmadan okunur, koda gömülmez
- [ ] CLI komutu

### WebSocket sağlık kontrolü (Aşama 1'den taşındı)

`/connect` ve `/wsserver` hiç belgelenmedi, her sürümde kırılabilir ve izlenecek
resmi changelog yok. CI'da koşamaz — çalışan bir oyun istemcisi gerekiyor.

- [ ] Yerelden koşan bir script: bağlantı kurulabiliyor mu, temel olaylar geliyor mu
- [ ] Kırıldığında ne yapılacağı belli olsun — üretilen otomasyon script'leri buna bağlı

### Niyet ve yapılabilirlik eşlemesi

Doğrulamadan **önce** çalışır, LLM gerektirmez, kalıp eşlemesiyle yapılır. Hem token tasarrufu sağlar hem en sık hatayı baştan keser.

- [ ] Platformun izin vermediği kategorileri tanı: girdi simülasyonu, dosya sistemi erişimi, ağ isteği
- [ ] Yakalandığında doğrudan alternatif öner (örn. "fareye basılı tutmuş gibi kazsın" → zincirleme kazma veya dışarıdan çalışan script)

### Doğrulamanın yakalayamadıkları (gerçek oyun testinden)

Ölçüm ve kanıt: `docs/VALIDATION-LIMITS.md`. Dördü de şemadan ve `tsc`'den
geçip oyunda hata üretti.

Kontrol fonksiyonları Aşama 2.5'te yazıldı (`packages/validator/src/checks.ts`)
ve eval seti onları koşuyor. Burada kalan iş, aynı fonksiyonları **üretim
döngüsüne** bağlamak — ölçmek değil, düzeltmek.

- [ ] **Kimlik referansı kontrolü.** `checkIdentities` yazıldı. Üretim
  döngüsünde doğrulamadan sonra koşacak ve bulguları retry'ın hata metnine
  girecek
- [ ] **Dosya adı içerikten türetilmeli.** `checkFileNames` kuralı ölçüyor ama
  düzeltmiyor. Üretim tarafı feature rule dosya adını identifier'dan türetmeli
  — doğrulama katmanının değil, üretim katmanının işi
- [ ] **Bilinen kalıplar prompt'a girmeli.** `checkPatterns` tablosu kalıpları
  adıyla tutuyor (`welcome-on-player-spawn`). Prompt aynı tablodan beslenmeli:
  kalıp hem önceden anlatılsın hem sonradan ölçülsün
- [ ] **Vanilla feature indeksi.** `places_feature` bugün yalnızca `minecraft:`
  dışı namespace'lerde kesin sonuç veriyor; `features.json` yapı feature'larını
  tutuyor, yerleştirme feature'larını değil. Pipeline bedrock-samples
  `features/` klasöründen indeks çıkarırsa uyarı hataya döner
- [ ] **Asset referansı kararı.** `minecraft:icon` kaynak paketi olmayınca
  içerik hatası veriyor. Ya minimum kaynak paketi de üretilir ya kullanıcıya
  açıkça söylenir (Aşama 4)

**Bitiş kriteri:** CLI uçtan uca çalışıyor. Prompt burada onlarca istekle iyileştirilir — tarayıcıda yapmak çok yavaş.

---

## ⛔ GEÇİŞ KAPISI

- [ ] **Eval seti 20'de 18 doğrulamadan geçiyor** — `npm run eval -- --gate`,
  gerçek model üreticisiyle

Bu sayıya ulaşmadan arayüze geçilmez. Kapıya ulaşılmadığında ne üzerinde çalışılacağı da belli olur, çünkü hangi vakaların patladığı görülür.

Kapı ölçülebilir tiplerle sınırlı: `core` listesinde yalnızca `script` ve `json`
var. Komut ve Python vakaları `extra` listesinde ölçülür ama sayılmaz —
gerekçeler Aşama 2.5 bölümünde.

Kayıtlı üreticiyle bugünkü skor 20'de 15 ve bu **model başarımı değil**, tezgâh
ölçümü. Kapı gerçek model çıktısına bakar.

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
- [x] `@minecraft/server` paket lisansı kontrol edildi — **MIT**. Paket lisans metnini yayınlamıyor, beyan `package.json` içinde
- [x] MicrosoftDocs/minecraft-creator repo lisansı kontrol edildi — **CC-BY-4.0**, atıf zorunlu
- [ ] `Mojang/bedrock-samples` — repoda `LICENSE` yok (404), EULA varsayılıyor. Şemalar birebir commit ediliyor; repo public yapılmadan önce yeniden değerlendirilecek (`docs/SOURCES.md`)

**Karar alınmış:** v1'de hiç kişisel veri toplanmayacak, hesap sistemi kurulmayacak. Bu `CLAUDE.md` içinde mimari kısıt olarak yazılı — çocuk verisi (KVKK/GDPR/COPPA) riskini baştan keser.

---

## Yapılmayacaklar (hatırlatma)

`CLAUDE.md`'deki tablo bağlayıcı. Özetle: vektör DB / embedding / RAG yok, kullanıcı hesabı ve veritabanı yok, kendi JSON şemamızı yazmıyoruz (Blockception var), model ID'leri koda gömülmüyor, komut sözdizimi doğrulayıcısı v1'de yok.
