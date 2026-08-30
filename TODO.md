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

- [x] **Komut sözdizimi doğrulayıcısı — yapıldı (30-08-2026).**
  `packages/validator/src/command.ts`, `npm run pipeline:commands`.

  `CLAUDE.md` bunu "Yapılmayacaklar" tablosuna koymuştu ve gerekçesi
  **yanlıştı**: "Bedrock komut grameri için makine okunur resmi kaynak yok"
  deniyordu, oysa `bedrock-samples` içinde
  `metadata/command_modules/mojang-commands.json` duruyor — zaten çektiğimiz
  deponun zaten kullandığımız klasöründe. Madde kaldırıldı.

  | | |
  |---|---|
  | Komut | 83 |
  | Aşırı yükleme | 270 |
  | Parametre tipi | 248 — **225'i enum tablosundan kesin doğrulanıyor** |
  | Elle ayrıştırılan yapısal tip | 13 (koordinat, seçici, tam sayı, aralık, işleç, zaman eki) |
  | Henüz denetlenmeyen | 10 — kabul ediliyor, uydurma hata üretilmiyor |

  **İlke: emin olmadığına hata deme.** Denetlenmeyen tipler testte tek tek
  listeli (`packages/validator/test/command.test.ts`); liste küçüldükçe test
  güncellenir, Mojang yeni tip eklerse test kırmızıya döner.

  **Bilinen boşluk:** seçici harfi (`@z` gibi) doğrulanmıyor — geçerli
  harflerin listesi Mojang'ın tanımında yok ve elle liste yazmak bu projenin
  kaçındığı şey. Testte kayıtlı.

- [x] **Komut kimlik kontrolü — Aşama 3'te yapıldı.**
  `checkCommandIdentities` (`packages/validator/src/checks.ts`) komut
  metnindeki kimlikleri doğruluyor. Sözdizimi hâlâ doğrulanmıyor — grameri
  için makine okunur resmi kaynak yok (`CLAUDE.md`)
  - Arama `lookupAny` ile bütün indekslere bakıyor: komutlarda efekt, boyut
    ve büyü kimlikleri de geçiyor, dar arama onlara uydurma "yok" derdi
  - İki komut vakası artık `extra` listesinde **ölçülüyor** (kapıya sayılmaz).
    Negatif kontrol koşuldu: `minecraft:diamond` yerine `minecraft:ruby`
    yazıldığında vaka kırmızıya dönüyor
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

- [x] Akış: istek → ilgili veriyi topla → sürüme kilitli prompt kur → modele gönder → validator'dan geçir
  - `packages/core/src/generate.ts`. Sıra: yapılabilirlik → bağlam → prompt →
    model → normalize → doğrulama
- [x] **Tek retry döngüsü** — hata metni `review.report`'tan geliyor ve
  bulguların `evidence` alanını da taşıyor
- [x] LLM soyutlaması Vercel AI SDK üzerinden — `ai@7`, `@ai-sdk/google@4`
  - `generateObject` ai@7'de deprecated; doğru yol `generateText` +
    `Output.object`. Kurulu `.d.ts`'ten okundu, hatırlanmadı
  - Yeniden deneme SDK'ya bırakıldı: 429'da `Retry-After` başlığına saygılı
    üstel geri çekilmeyi kendisi yapıyor, ikinci bir backoff yazılmadı
- [x] Model ID'leri yapılandırmadan okunur, koda gömülmez —
  `codecraft.config.json`. Anahtar yalnızca ortam değişkeninden; yapılandırmaya
  sır yazılırsa yükleyici duruyor
  - Model kimliği tahmin edilmiyor: `npm run codecraft -- --models` anahtarla
    sağlayıcının listesini çekiyor
- [x] CLI komutu — `npm run codecraft`, diske yazar, `--install` ile oyuna kurar

### Sağlayıcı seçimi

**Google Gemini, ücretsiz kademe.** Projede ücretli API kullanılmıyor. Bunun
iki mühendislik sonucu var ve ikisi de koda girdi:

- Vakalar arası bekleme (`requestDelayMs`) ve limitten düşen vakanın ayrı
  işaretlenmesi — "model yanlış üretti" ile "çağrı hiç yapılamadı" karışırsa
  kapı skoru yalan söyler
- `--generator=cached`: model bir kez koşar, sonraki koşular önbelleği oynatır

### Kalan iş

- [x] **Kapıyı gerçek modelle ölç — yapıldı, 19/20.** Ayrıntı ⛔ GEÇİŞ KAPISI
  bölümünde.

- [x] **`format_version` kuralı düzeltildi ve ölçüldü.**

  Prompt "format_version her zaman 1.26.xx" diyordu; `format_version` oyun
  sürümü değil, dosya tipinin kendi şema sürümü. Değerler artık veriden
  geliyor: derlenmiş şemaların kısıtladıkları + oyunda yüklendiği ölçülmüş
  fixture değerleri (`packages/core/src/context.ts`). `CLAUDE.md`'deki
  yanıltıcı cümle de düzeltildi — tablo artık beş sürüm biçimi sayıyor.

  `spawn-rule-01` beş koşudur kotaya takılıyordu; `--case=` liste desteği
  eklenince doğrudan hedeflenip ölçüldü ve **geçti**.

- [x] **Güncel prompt tam ölçüldü: 19/20, kapı açık.**

  Düşen tek vaka `ore-gen-01`: `minecraft:ore_feature` içinde hem üst düzey
  `places_block` hem `replace_rules` var, şema ikisini birden kabul etmiyor.
  **İki bağımsız ölçümde aynı hata** — üçüncüsü gelirse gerçek bir bilgi
  boşluğu sayılır ve prompt'a girer.

- [x] **Önbellek bozulması bulundu ve onarıldı — ölçümleri kirletmişti.**

  `writeCache` klasörü silmeden yazıyordu. Model bir koşuda
  `BP/entities/player.json` üretip sonraki koşuda script-only bir çözüm
  verince eski dosya klasörde kalıyor ve oynatma ikisini birden okuyor:
  **hiç var olmamış bir paket** doğrulanıyor.

  Belirtisi şuydu: `no-fall-damage-01` üretildiği koşuda geçti, önbellekten
  oynatıldığı koşuda düştü. Doğrulayıcının belirlenimsiz olduğundan
  şüphelenildi, üç kez koşturulup belirlenimci olduğu ölçüldü, sonra dosya
  zaman damgaları sebebi gösterdi.

  Altı vaka etkilenmişti, sekiz bayat dosya silindi. `core/pack.ts` içindeki
  `writePack` bunu baştan doğru yapıyordu ("bayat dosya kalmasın"); aynı kural
  önbelleğe uygulanmamıştı.

  **Bu yüzden 17/20 ve 18/20 okumaları geçersiz.** Onarımdan sonra aynı
  önbellekle 19/20 çıktı. Güvenilir sayılar: her şeyin taze üretildiği koşular
  ve onarım sonrası ölçüm.

  | Prompt | Ölçüm | Güvenilir mi |
  |---|---|---|
  | `format_version` öncesi | 19/20 | evet, hepsi taze üretildi |
  | düzeltilmiş | 17/20 | **hayır, bozuk önbellek** |
  | + `worldInitialize` | 18/20 | **hayır, bozuk önbellek** |
  | + `worldInitialize` (onarım sonrası) | **19/20** | evet |

  Yani `format_version` ve `worldInitialize` düzeltmeleri skoru düşürmedi;
  düşüren şey ölçüm aracının kendisiydi.
- [ ] Prompt iyileştirme turları — kapı ölçüldükten sonra. Her tur önbelleği
  geçersiz kılar, yani her turun kendi kota bütçesi var

### Sağlayıcı gerçekleri — ölçüldü (30-08-2026)

Tahmin değil, bu makinede bu anahtarla alınan sonuçlar:

| Model | Durum |
|---|---|
| `gemini-3.6-flash` | çalışıyor, ~2,2 sn — **kapı bunda ölçülüyor** |
| `gemini-3.5-flash` | çalışıyor, ~7 sn |
| `gemini-3-flash-preview` | çalışıyor, ~1,2 sn |
| `gemini-3.7-flash` | HTTP 503, aşırı yük |
| `gemini-pro-latest` | HTTP 429 — **pro modellerde ücretsiz kota yok** |
| `gemini-2.5-flash`, `gemini-2.5-pro` | HTTP 404, yeni kullanıcılara kapalı |

Model kimliği `codecraft.config.json`'da. Takma ad (`gemini-flash-latest`)
kullanılmıyor: altındaki model habersiz değişirse ölçüm sessizce kayar.
- ~~**Vanilla feature indeksi**~~ → **yapılamıyor, kaynak yok.** 30-08-2026'da
  ölçüldü: `Mojang/bedrock-samples` ağacında (22645 giriş, kesilmemiş)
  `behavior_pack/` altında `features/` klasörü **yok** — repo biomes, entities,
  items, loot_tables, recipes, shapes, spawn_rules, trading içeriyor. Vanilla
  yerleştirme feature'ları bu kaynakta yayınlanmıyor
  - Sonuç: `minecraft:` namespace'li `places_feature` **uyarı olarak kalıyor**.
    Bilinmeyene "geçti" denmiyor ama uydurma hata da üretilmiyor
  - Başka bir kaynak bulunursa yeniden açılır. Tahminle indeks üretilmeyecek

### WebSocket sağlık kontrolü (Aşama 1'den taşındı)

`/connect` ve `/wsserver` hiç belgelenmedi, her sürümde kırılabilir ve izlenecek
resmi changelog yok. CI'da koşamaz — çalışan bir oyun istemcisi gerekiyor.

- [x] Yerelden koşan bir script — `npm run ws:health` (`pipeline/src/ws-health.ts`)
- [x] Kırıldığında ne yapılacağı belli — `docs/WEBSOCKET.md`

> **Ölçüldü (30-08-2026, Bedrock 1.26.x).** Bağlantı kuruldu, komut cevabı
> geldi (`time query daytime` → `statusCode=0`, "Daytime is 17839"),
> `BlockBroken`, `BlockPlaced` ve `PlayerTravelled` olayları düştü.
> `PlayerMessage` gelmedi ama oyunda sohbete mesaj yazıldığı doğrulanmadı —
> **ölçülmedi sayılıyor**, kırık değil.
>
> Üç ön koşul da ölçülerek bulundu; ilk deneme
> `Websocket server request rejected` verdi:
> "Require Encrypted Websockets" kapalı olmalı (sunucumuz düz `ws://`),
> dünyada hileler açık olmalı, ve UWP sürümünde loopback izni gerekir — bu
> makinede gerekmedi, kurulum yeni düzende.

### Niyet ve yapılabilirlik eşlemesi

Doğrulamadan **önce** çalışır, LLM gerektirmez, kalıp eşlemesiyle yapılır. Hem token tasarrufu sağlar hem en sık hatayı baştan keser.

- [x] Platformun izin vermediği kategorileri tanı: girdi simülasyonu, dosya
  sistemi erişimi, ağ isteği — `packages/core/src/feasibility.ts`
- [x] Yakalandığında doğrudan alternatif öner — gerekçe, kanıt ve alternatif
  birlikte basılıyor. Model **hiç kurulmuyor**, o yüzden anahtar bile
  gerekmiyor; "model çağrılmaz" iddiası testle sabit
  - Her kuralın dayanağı `.d.ts` üzerinde taranıyor: `SimulatedPlayer`,
    `readFile`, `XMLHttpRequest` gerçekten yok. Mojang birini eklerse test
    kırmızıya döner ve kural yeniden ölçülür

### Doğrulamanın yakalayamadıkları (gerçek oyun testinden)

Ölçüm ve kanıt: `docs/VALIDATION-LIMITS.md`. Dördü de şemadan ve `tsc`'den
geçip oyunda hata üretti.

Kontrol fonksiyonları Aşama 2.5'te yazıldı (`packages/validator/src/checks.ts`)
ve eval seti onları koşuyor. Burada kalan iş, aynı fonksiyonları **üretim
döngüsüne** bağlamak — ölçmek değil, düzeltmek.

- [x] **Kimlik referansı kontrolü.** `review()` doğrulamadan sonra
  `checkIdentities`'i koşuyor ve bulgular retry'ın hata metnine giriyor —
  `evidence` alanıyla birlikte
- [x] **Dosya adı içerikten türetiliyor.** `packages/core/src/normalize.ts`
  feature rule dosya adını identifier'dan türetip dosyayı yeniden adlandırıyor,
  doğrulamadan önce. Testi negatif kontrol biçiminde: normalize çıktısı her
  zaman `checkFileNames`'i geçmeli
- [x] **Bilinen kalıplar prompt'a giriyor.** `checks.ts`'deki `Pattern` tipine
  `guidance` alanı eklendi ve `patternGuide()` ile dışa açıldı. Prompt aynı
  tablodan besleniyor, ikinci bir liste tutulmuyor
- [ ] **Asset referansı.** `minecraft:icon` kaynak paketi olmayınca içerik
  hatası veriyor. **Karar verildi (30-08-2026): vanilla doku indeksi.** Kaynak
  paketi üretilmiyor, v1 kapsamı değişmiyor; model yalnızca var olan bir
  vanilla doku anahtarına işaret edebiliyor ve `checkAssets` bunu ölçüyor.
  Uygulaması Aşama 4'te
  - Kaynak doğrulandı (GitHub contents API, `Mojang/bedrock-samples@main`):
    `resource_pack/textures/item_texture.json` ve `terrain_texture.json` var,
    yani indeks makine okunur bir kaynaktan türetilebiliyor
  - Kararın dürüst yarısı atlanmıyor: vanilla anahtarı içerik hatasını kaldırır
    ama **özel görsel vermez**. Arayüz bunu açıkça söyleyecek

**Bitiş kriteri:** CLI uçtan uca çalışıyor. Prompt burada onlarca istekle iyileştirilir — tarayıcıda yapmak çok yavaş.

> **Karşılandı (30-08-2026).** CLI gerçek bir istekle uçtan uca koşuldu:
>
> ```
> npm run codecraft -- "Kırdığım bloğun aynı türden komşularını da kırsın" --install
> ```
>
> İlk denemede doğrulamadan geçti (retry gerekmedi), paket
> `development_behavior_packs` altına kuruldu, oyunda etkinleştirildi ve
> **zincirleme kazma çalıştı**. Model `gemini-3-flash-preview` idi; kapı
> modeli `gemini-3.6-flash`'ın kotasına dokunulmadı.
>
> **Ve test tam da var olma sebebini kanıtladı.** Paket ilk kurulumda oyunda
> HİÇ GÖRÜNMEDİ. Sebep manifest'teki `"type": "javascript"` idi: şemadan
> geçiyor (modül tipi listesinde var, eski biçim) ama `@minecraft/server`
> 2.x ile yüklenmiyor ve oyun hiçbir hata basmıyor — paket sadece yok.
>
> Tek alan düzeltilip (`"type": "script"` + `"language": "javascript"`)
> yeniden bakıldı, paket göründü. Sebep kesinleşti, tahmin değil.
>
> Bu, doğrulamanın yakalayamadığı **E sınıfı** olarak kaydedildi
> (`docs/VALIDATION-LIMITS.md`) ve üç yere birden bağlandı: `checkManifest`
> ölçüyor, `normalize()` düzeltiyor, prompt önceden anlatıyor. Eval'de
> `manifest-01` vakası bunu istiyor ve negatif kontrolü koşuldu.
>
> Eval'de 20/20 alsak bu hatayı göremezdik: çıktı doğrulamadan geçiyordu.
> Gerçek oyun testinin yerini hiçbir ölçüt tutmuyor.

> **Durum (30-08-2026): kod tamam, ölçüm eksik.**
>
> `npm run typecheck` exit 0, `npm test` 122/122, `npm run eval` regresyonsuz
> (çekirdek hâlâ 15/20, kayıtlı üreticiyle).
>
> Model gerektirmeyen her şey koşuyor ve doğrulandı:
> - Yapılabilirlik kapısı uçtan uca çalışıyor, **anahtar bile istemiyor**:
>   `npm run codecraft -- "Fareme basılı tutmuş gibi otomatik kazsın"`
>   modeli hiç kurmadan gerekçe, kanıt ve alternatif basıyor
> - Tek retry döngüsü `ai/test` sahte modeliyle ölçüldü: birinci deneme
>   düştüğünde ikinci istem hata metnini taşıyor, üçüncü deneme yok
> - Yapılabilirlik kurallarının dayandığı API yokluğu `.d.ts` üzerinde
>   taranıyor — Mojang `SimulatedPlayer`'ı taşırsa test kırmızıya döner
> - Katman ayrımı testle sabit: üretim yolundaki modüllerde `node:` import'u
>   yok, Aşama 4 baştan refactor olmayacak
>
> **Koşulmamış tek şey gerçek model çağrısı.** API anahtarı yok
> (`GOOGLE_GENERATIVE_AI_API_KEY`). Kapı bu yüzden **ölçülmedi** — atlanmadı,
> bekliyor.

---

## ⛔ GEÇİŞ KAPISI

- [x] **Eval seti 20'de 18 doğrulamadan geçiyor** — **19/20 ölçüldü, kapı açıldı**

> **30-08-2026, `gemini-3.6-flash`.** `npm run eval -- --generator=model --gate --reuse --list=core`
>
> Ölçüm iki koşuda tamamlandı: ilk koşuda 16 vaka modele gitti ve 16'sı geçti,
> kalan 4 günlük kotaya takıldı. İkinci koşuda o 16'sı **önbellekten** oynatıldı
> (parmak izi tuttu: aynı model, aynı sistem prompt'u, aynı istek) ve eksik
> dördü modele gitti.
>
> **Düşen tek vaka `spawn-rule-01`** ve gerçek bir hata: model
> `"format_version": "1.26.40"` yazdı, spawn rules şeması yalnızca
> `1.8.0`/`1.10.0`/`1.12.0` kabul ediyor. Sebebi bizim prompt'umuz —
> aşağıdaki maddeye bak.

Bu sayıya ulaşmadan arayüze geçilmez. Kapıya ulaşılmadığında ne üzerinde çalışılacağı da belli olur, çünkü hangi vakaların patladığı görülür.

Kapı ölçülebilir tiplerle sınırlı: `core` listesinde yalnızca `script` ve `json`
var. Komut ve Python vakaları `extra` listesinde ölçülür ama sayılmaz —
gerekçeler Aşama 2.5 bölümünde.

Kayıtlı üreticiyle bugünkü skor 20'de 15 ve bu **model başarımı değil**, tezgâh
ölçümü. Kapı gerçek model çıktısına bakar.

---

## Aşama 4 — Web arayüzü

Next.js + Tailwind. Üretim tarayıcıda, doğrulama sunucuda (mimari kural 2).

### Adım 0 — Planın dayandığı iki varsayım (ölçüldü, 30-08-2026)

Aşama 4'ün tamamı bu ikisine dayanıyordu ve ikisi de tahmindi. İkisi de artık
ölçüldü ve **ikisi de yeşil** — plan değişmiyor.

- [x] **Tarayıcıdan Gemini çağrılabiliyor mu (CORS).** Mimari kural 2
  "anahtar sunucuya hiç uğramaz" diyor; bu ancak sağlayıcı CORS'a izin
  veriyorsa mümkün. `generativelanguage.googleapis.com`, `Origin:
  http://localhost:3000` ile:

  | Ne | Sonuç |
  |---|---|
  | `OPTIONS …:generateContent` (preflight, `POST`) | `200`, `Access-Control-Allow-Origin` origin'i yansıtıyor |
  | İzin verilen başlıklar | `content-type, x-goog-api-key` |
  | `GET /v1beta/models` (gerçek çağrı, gerçek anahtar) | `200`, 50 model, ACAO var |

  Kritik ayrıntı: `@ai-sdk/google` anahtarı **`x-goog-api-key`** başlığıyla
  gönderiyor (`node_modules/@ai-sdk/google/dist/index.js`) — preflight'ın izin
  verdiği başlığın aynısı. `Authorization: Bearer` olsaydı preflight düşerdi.
  Yani proxy gerekmiyor, kural 2 esnetilmiyor.

- [x] **Next `@codecraft/core`'u derleyebiliyor mu.** Core ham TypeScript
  yayınlanıyor ve göreli import'larda `.ts` uzantısı zorunlu
  (`allowImportingTsExtensions`, derleme adımı yok).

  Ölçüm: Next **16.3.3** (Turbopack), `transpilePackages: ["@codecraft/core"]`,
  `next build` → `✓ Compiled successfully`. Core için **ayrı bir derleme adımı
  gerekmiyor**. Ayrıca istemci paketlerinde `node:fs|path|os|child_process`
  aranıp bulunamadı; barrel'ın tamamı (`checkFeasibility`, `buildSystemPrompt`,
  `callModel`, `normalize`, `generationSchema`) pakete girmiş, ağaç budaması
  ölçümü boşa çıkarmamış.

### Adım 1 — Katman ayrımı (tamamlandı)

- [x] **`generate()` bağlamı parametre olarak alıyor.** `review` ile aynı
  dikiş: `context: Context | (() => Promise<Context>)`. `generate.ts` artık
  `context.ts`'i yalnızca **tip** olarak import ediyor
- [x] **`src/browser.ts`** — tarayıcı yüzeyinin tek giriş noktası,
  `@codecraft/core/browser` alt yoluyla dışa açık
- [x] **`src/provider.ts`** — `config.ts`'in saf parçaları (`Config`,
  `ProviderName`, `API_KEY_ENV`, `requireApiKey`, `Env`) oraya taşındı
- [x] **`layers.test.ts` geçişli grafiği yürüyor**, tek dosyaya bakmıyor

> **Önceki iddia yanlıştı ve testin kendisi yüzündendi.** TODO'da
> "üretim yolundaki modüllerde `node:` import'u yok, Aşama 4 baştan refactor
> olmayacak" yazıyordu. Test yalnızca modülün **kendi** import satırlarına
> bakıyordu, o yüzden iki sızıntıyı görmüyordu:
>
> ```
> generate.ts -> context.ts -> @codecraft/knowledge -> node:fs
> model.ts    -> config.ts  -> node:fs
> ```
>
> İkisi de ölçüldü: eski hâlde yeni test kırmızı, düzeltmeden sonra yeşil.
> Yani refactor "baştan" olmadı ama sıfır da değildi.
>
> `npm test` 162/162, `npm run typecheck` exit 0,
> `npm run eval -- --generator=cached --list=all` **19/20** (değişmedi).

### Kalan iş

- [ ] Sunucu uçları: `POST /api/context`, `POST /api/review`, `GET /api/config`
- [ ] Kalıcı sürüm seçici
- [ ] Sohbet alanı
- [ ] Kod bloğu ve kopyala butonu
- [ ] **Doğrulama rozeti** — "1.26.40 şemasına karşı doğrulandı". Atlanmaz. Tek görünür fark bu, ve kullanıcıya neden genel bir sohbet arayüzü yerine bunu kullandığını anlatan tek şey
- [ ] BYOK anahtar girişi — anahtar tarayıcıda kalır, sunucuya hiç uğramaz
- [ ] Anahtar girildiğinde test çağrısı yap, model listesini çek, menüyü doldur, hata gelirse net mesaj göster
- [ ] Eylül 2026 Gemini geçişi: eski standart anahtarlar reddedilecek, doğrulama akışı bunu yakalayacak şekilde kurulmalı
- [ ] Hosting: **Vercel, Node runtime** — karar verildi. Doğrulama `tsc`
  çalıştırıyor ve `data/` altındaki 1313 şemayı dosya olarak okuyor; Workers
  ikisini de olduğu gibi koşturamaz, validator yeniden yazılmak zorunda kalırdı
  - Deploy'a gelindiğinde durulacak: hesap ve repo bağlantısı gerekiyor
  - `next.config` içinde `outputFileTracingIncludes` ile `data/**` ve
    `node_modules/typescript/**` fonksiyon paketine alınmalı — ikisi de dinamik
    yolla okunuyor, Next kendiliğinden bulmaz
  - `/api/review` için `maxDuration` yükseltilmeli; `tsc` bir alt süreç

**Aşama 4'e alınmayanlar (karar, 30-08-2026):**

- ~~Varsayılan mod: kendi anahtarımla günde 5 mesaj~~ → **ertelendi.** İki kuralı
  birden zorluyor: anahtar sunucuda durmak zorunda (mimari kural 2 "anahtar
  sunucuya hiç uğramaz" diyor) ve kota sayacı veritabanısız tutulmak zorunda
  ("Yapılmayacaklar"). Aşama 4 sadece BYOK ile çıkıyor; bu madde ayrı ele
  alınacak

---

## Sürekli — Legal

Ayrıntı: `notlar/kurulum-ve-legal.md`.

- [x] Gizlilik metni taslağı — `docs/LEGAL.md` §1. Anahtarın tarayıcıda kaldığı, isteğin doğrudan sağlayıcıya gittiği ve **üretilen dosyaların doğrulama için sunucuya gittiği** ayrı ayrı yazılı. Ücretsiz kademede eğitim kullanımı uyarısı var
- [x] Sorumluluk reddi taslağı — `docs/LEGAL.md` §2. "Doğrulandı" rozetinin ne demek OLMADIĞI da yazılı, kanıtı `docs/VALIDATION-LIMITS.md`
- [x] Sunucu kuralları uyarısı taslağı — `docs/LEGAL.md` §3. Çıktının yanında görünür olacak, dipnot değil
- [x] Minecraft marka kuralları — `docs/LEGAL.md` §4. Zorunlu feragat biçimi kaynağından doğrulandı (minecraft.net/usage-guidelines). Ad "CodeCraft", kural sağlanıyor; alan adı alınırken tekrar bakılacak
- [x] `@minecraft/server` paket lisansı kontrol edildi — **MIT**. Paket lisans metnini yayınlamıyor, beyan `package.json` içinde
- [x] MicrosoftDocs/minecraft-creator repo lisansı kontrol edildi — **CC-BY-4.0**, atıf zorunlu
- [x] `Mojang/bedrock-samples` lisansı kontrol edildi (30-08-2026) —
  `LICENSE.md` **var** (önceki not 404 diyordu): "(c) Mojang AB. All rights
  reserved" + Minecraft EULA. Varsayım doğruymuş, artık yazılı kaynağı da var
- [ ] Şemaların birebir commit edilmesi kararı — repo public yapılmadan önce
  yeniden değerlendirilecek. Lisans netleştiği için bu madde artık daha
  kritik, daha az (`docs/SOURCES.md`)

**Karar alınmış:** v1'de hiç kişisel veri toplanmayacak, hesap sistemi kurulmayacak. Bu `CLAUDE.md` içinde mimari kısıt olarak yazılı — çocuk verisi (KVKK/GDPR/COPPA) riskini baştan keser.

---

## Yapılmayacaklar (hatırlatma)

`CLAUDE.md`'deki tablo bağlayıcı. Özetle: vektör DB / embedding / RAG yok, kullanıcı hesabı ve veritabanı yok, kendi JSON şemamızı yazmıyoruz (Blockception var), model ID'leri koda gömülmüyor, komut sözdizimi doğrulayıcısı v1'de yok.
