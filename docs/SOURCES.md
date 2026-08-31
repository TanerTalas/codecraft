# Veri Kaynakları

Projenin asıl değeri burada. Model değil, kürate edilmiş ve güncel tutulan veri.

## Kritik ayrım

Bu verileri **yeniden yayınlamak** ile onlardan **türetilmiş indeks üretmek** farklı şeyler. İkincisi her zaman güvenli. Pipeline mümkün olan yerde kendi indekslerini üretir; birebir kopyalanan tek kaynak grubu aşağıdaki lisans tablosunda işaretli.

## Otomatik çekilenler (pipeline)

| Kaynak | Ne için | Lisans | `data/` içine nasıl girer |
|---|---|---|---|
| `Mojang/bedrock-samples` → `vanilladata_modules` | Blok, entity, item tanımları | Minecraft EULA | **Türetilmiş indeks** (id listeleri, blok durumları) |
| `Mojang/bedrock-samples` → `metadata/json_schemas/` | Mojang'ın kendi JSON şemaları | Minecraft EULA | **Birebir kopya** — bilinçli karar, aşağıya bak |
| `Mojang/bedrock-samples` → `metadata/command_modules/` | Komut grameri: 83 komut, 270 aşırı yükleme, 225 enum | Minecraft EULA | **Türetilmiş indeks** (açıklama metinleri atılır) |
| `Blockception/Minecraft-bedrock-json-schemas` → `source/` | Şemaların yazım kaynağı | BSD-3-Clause, izin verici | Birebir kopya + `LICENSE` |
| `Blockception/…` → kök klasörler | **Doğrulamanın kullandığı** derlenmiş şemalar | BSD-3-Clause | Birebir kopya + türetilmiş `schema-map.json` |
| `@minecraft/common`, `@minecraft/server`, `@minecraft/server-ui` (npm) | Script tip tanımları | **MIT** (doğrulandı: `npm view @minecraft/server license`) | Birebir `index.d.ts` + `package.json` |
| `MicrosoftDocs/minecraft-creator` | Sürüm notları | **CC-BY-4.0** (doğrulandı 29-08-2026, GitHub API) | Birebir kopya + atıf başlığı |

### EULA kararı: Mojang şemaları neden birebir commit ediliyor

`metadata/json_schemas/` içeriği EULA kapsamında. Yine de `data/<sürüm>/schemas/`
altına birebir kopyalanıyor. Karar bilinçli ve gerekçesi şu:

- Klonlayan herkeste hazır olur; doğrulama ağ erişimi gerektirmez. Aşama 4'te
  sunucu tarafı doğrulama (mimari kural 2) her dağıtımda 1313 dosya indirmek
  zorunda kalmaz.
- Geçmiş sürümler git'te birikir. `main` ilerlediğinde eski şemalar tag'den
  geri alınabilir ama tag adlandırması tutarsız (aşağıya bak), yani güvenilir
  bir geri dönüş yolu değil.

**Lisans durumu (30-08-2026'da yeniden ölçüldü).** Daha önce "repoda `LICENSE`
yok (HTTP 404)" yazıyordu ve EULA *varsayılıyordu*. Artık varsayım değil:
`LICENSE.md` mevcut (HTTP 200) ve metni şu:

> (c) Mojang AB. All rights reserved.
>
> By downloading the files in this repository, you agree to the Minecraft End
> User License Agreement and that these files are subject to its terms.

Yani "tüm hakları saklı" + EULA, açıkça yazılı. Varsayımımız doğruymuş ama
kaynak artık kesin — ve bu, aşağıdaki uyarıyı zayıflatmıyor, **güçlendiriyor**.

**Repo public yapılırsa bu karar yeniden değerlendirilmeli** — git geçmişinden
temizlemek zahmetlidir. Alternatif: şemaları `pipeline/raw/` içinde tutup
`data/` altına sadece türetilmiş `schemas-index.json` yazmak.

**Aşama 2 notu:** birinci gerekçe zayıfladı. Doğrulama Blockception'ın
derlenmiş şemalarını kullanıyor, Mojang'ınkileri değil (aşağıdaki karar
bölümü). 1313 dosya artık doğrulama için değil, sürüm farklarını okumak ve
ikinci bir kontrol için duruyor. Repo public yapılırsa kaldırma maliyeti
düşük — bu karar da o anda birlikte gözden geçirilmeli.

**Çekme notları:**
- bedrock-samples: `main` dalı kararlı sürümü izler, `preview` haftalık.
  - **Düzeltme (29-08-2026):** daha önce buraya "kararlı seride tek tag var"
    yazılmıştı, doğru değil. En az 15 kararlı tag mevcut (`v1.26.40.05`,
    `v1.26.30.5`, `v1.26.20.26`, `v1.26.10.4`, …). Ancak adlandırma tutarsız —
    `v1.26.40.05` sıfır dolgulu, `v1.26.30.5` değil. Sürüm numarasından tag adı
    türetilemez, liste çekip eşleştirmek gerekir. Pipeline yine `main` dalına bakar.
- **Sürüm tespiti `version.json` ile yapılır.** Repo kökündeki 2 KB'lık bu dosya `latest.version` alanını verir (`1.26.40.5`). Repoyu klonlamaya gerek yok.
- **"Veri güncel" ile "kurulu oyunla aynı sürüm" aynı şey değil.** `version.json`
  ara hotfix sürümlerini yayınlamıyor: 1.26 serisinde sadece `.0/.10/.20/.30/.40`
  kayıtlı. 30-08-2026'da ölçüldü — kurulu oyun **1.26.45** iken upstream hâlâ
  `1.26.40.5` diyordu. `npm run pipeline:freshness` bunu bayatlama saymaz ve
  saymamalı: `data/` bedrock-samples ile eşleşiyorsa görevini yapmış olur.
  Pratikte sorun çıkarmaz, çünkü `min_engine_version` bir alt sınırdır ve
  `[1, 26, 40]` 1.26.45'te sorunsuz yüklenir (gerçek oyun testiyle doğrulandı,
  `docs/VALIDATION-LIMITS.md`). Ama şema ve tip tanımları hotfix'te değişmiş
  bir şeyi bilemez.
- bedrock-samples reposu 358 MB — tarball indirilmez, dosyalar tek tek `raw` üzerinden çekilir. Blockception 8 MB olduğu için tarball tercih edilir (1 istek, 1140 dosya).
- Blockception: sürüm etiketleri geride kalabiliyor, `main` dalına bakılır.
- Sürüm notu dosyaları üç parçalı adlandırılır: oyun `1.26.40.5` → `Update1.26.40.md`. Dokümanlar oyunun gerisinde kalabiliyor; dosya yoksa pipeline durmaz, uyarı basar.
- `minecraft-creator` reposu 1.2 GB — klonlanmaz, tek dosya çekilir.
- Kaynakların bir kısmı CRLF ile geliyor (Blockception'da 172 dosya). Pipeline yazarken LF'e normalize eder, yoksa `.gitattributes` ile birlikte her koşuda sahte diff üretirdi.

## Sürüm eşlemesi: oyun ↔ `@minecraft/server` modülü

`CLAUDE.md`'nin sürüm tablosundaki en tuzaklı satır. Eşleme **tahminle değil**,
iki kaynağın kesişimiyle kuruluyor (`pipeline/src/script-types.ts`):

1. `bedrock-samples/metadata/script_modules/@minecraft/` klasörü, o oyun
   sürümünde hangi modül sürümlerinin var olduğunu söyler —
   `server-bindings_2.9.0.json`, `server-bindings_2.10.0-beta.json` gibi.
2. npm o sürümün gerçekten yayınlandığını doğrular. Kararlı sürüm birebir
   eşleşir; beta'da oyun sürümü etikete gömülüdür:
   `2.10.0-beta` + oyun `1.26.40` → `2.10.0-beta.1.26.40-stable`.

İkisi kesişmezse pipeline durur. Yakın bir sürüme düşmek yok.

1.26.40.5 için sonuç (doğrulandı 29-08-2026):

| Paket | Kararlı | Beta |
|---|---|---|
| `@minecraft/common` | 1.3.0 | yok |
| `@minecraft/server` | 2.9.0 | 2.10.0-beta |
| `@minecraft/server-ui` | 2.1.0 | 2.2.0-beta |

Ek kanıt: npm'de `2.9.0` ile `2.10.0-beta.1.26.40-stable` aynı saniyede
yayınlanmış (2026-08-04T17:57).

**`@minecraft/common` atlanamaz.** `server` ve `server-ui` doğrudan ondan import
ediyor; olmadan `tsc` "Cannot find module" verir ve Aşama 2'nin `validateScript`
fonksiyonu hiçbir kodu doğrulayamaz.

`@minecraft/vanilla-data` çekilmiyor: `server/index.d.ts` içinde sadece
`import type` olarak geçiyor ve derlemeyi engellemiyor. İçeriği (blok/item
listeleri) zaten `vanilladata_modules`'tan kendimiz türetiyoruz. Ayrıca kendi
sürüm şeması var (npm `latest` = 1.26.44), yani dördüncü bir sürüm biçimi.

npm paketleri MIT olduklarını `package.json` içinde beyan ediyor ama tarball'a
lisans metnini ve telif satırını koymuyorlar. Telif sahibi uydurulmadı: beyanın
kendisi (`package.json`) her sürüm klasöründe duruyor, `script-types/NOTICE.md`
künyeyi kayda geçiriyor.

## Şema kaynağı: **Blockception'ın derlenmiş çıktısı** (karar verildi)

Karar Aşama 2'ye bırakılmıştı. Aşama 2'de ölçüldü ve kapandı.
Ölçüm script'i: `npm run validator:compare`.

### Blockception iki ayrı küme yayınlıyor

Aşama 1'de sadece `source/` çekiliyordu, asıl kullanılacak küme o değil:

| | `source/` | kök klasörler (`behavior/`, `resource/`, `general/`, …) |
|---|---|---|
| Dosya | 1140 | **60** |
| Ne | yazım kaynağı | GitHub Action'ın ürettiği derlenmiş çıktı |
| `$ref` | dosyalar arası, `$id` tabanlı | tamamı `#/definitions/…`, **dış ref yok** |
| JSONC yorumu | 14 dosyada var | yok |
| Tip eşlemesi | yok | `vscode-settings.json` (glob → şema) |

**Aşama 1'de yazılan iki engel `source/` klasörüne aitti.** Derlenmiş çıktıda
`$id` çözümleyicisi de JSONC okuyucusu da gerekmiyor; her dosya tek başına
yeterli ve `ajv` 60/60'ını derliyor (ölçüldü). Doküman tipi → şema eşlemesini de
upstream veriyor, elle yazmıyoruz — `CLAUDE.md`'nin "kendi JSON şemalarını yazma"
kuralı korunuyor.

Pipeline artık ikisini de çekiyor: `data/blockception/source/` (yazım kaynağı,
ileride açıklama ve snippet için) ve `data/blockception/compiled/` +
`schema-map.json` (doğrulamanın kullandığı).

### Mojang şemaları neden birincil kaynak değil

Ölçüm sonucu (26 fixture, 30-08-2026):

| | Blockception | Mojang |
|---|---|---|
| Beklenen sonucu veren | **26 / 26** | 12 / 26 |
| Karşılaştırılabilir vakalarda | — | 12 / 17 |
| Fixture'ların 8 doküman tipinden kapsanan | 8 | 5 |

İki yapısal fark var, ikisi de ölçülerek görüldü:

**1. Şemalar dosyayı değil iç nesneyi tanımlıyor.** `minecraft:block` değerini
anlatan bir şema var, ama `{format_version, "minecraft:block": …}` dosyasını
anlatan yok. Dosya düzeyinde doğrulama için o sarmalayıcıyı bizim yazmamız
gerekirdi. Tarif, diyalog, animasyon denetleyicisi ve feature rules için ise
Mojang'da hiç şema yok.

**2. Şemalar motorun iç temsilini anlatıyor, yazılan JSON'u değil.** Bu, kritik
olan madde — kanıt Mojang'ın kendi dosyaları:

- `client_server/packaging/3.0.0/Manifest.json`, `version` ve
  `min_engine_version` alanlarını **metin** olarak istiyor. Mojang'ın kendi
  `bedrock-samples/behavior_pack/manifest.json` dosyası ise dizi yazıyor:
  `"version": [0, 0, 1]`, `"min_engine_version": [1, 26, 40]`.
- `client_server/spawn/1.21.60/Spawn Rules.json`, her koşulda `weight` alanını
  zorunlu tutuyor. Yazım biçimi ise `"minecraft:weight": { "default": 50 }`
  bileşeni. Şema, Mojang'ın kendi `behavior_pack/spawn_rules/creeper.json`
  dosyasını **reddediyor** (doğrulandı, `ajv` ile koşuldu).

Yani Mojang şemaları birincil kaynak yapılsaydı doğru manifest'lerin ve doğru
spawn kurallarının tamamı hatalı işaretlenirdi. Bu, aracın var olma sebebinin
tam tersi olurdu.

`x-ordinal-index`, `x-underlying-type` gibi anahtarların şemalarda bulunması da
aynı yöne işaret ediyor: bu dosyalar C++ serileştirme meta verisinden
üretilmiş, yazar için değil motor için.

**Mojang şemaları silinmiyor.** İki gerekçe: (1) `format_version` klasörlerine
ayrılmış olmaları sürüm farklarını okumak için tek yapılandırılmış kaynak,
(2) tek bir vakada Blockception'ın kaçırdığını yakalıyorlar
(`manifest-format-version-string`, aşağıda). Karşılaştırma script'i duruyor;
Aşama 3'te ikinci bir kontrol olarak değerlendirilebilir.

### Blockception'ın ölçülmüş boşlukları

20 fixture'ın hepsi doğru sonuç veriyor, ama fixture yazarken şemanın
yakalamadığı dört durum ölçüldü. `packages/validator/test/fixtures/cases.json`
içinde `expect: "gap"` olarak kayıtlı — şema ilerideki bir güncellemede
yakalamaya başlarsa test kırmızıya döner ve boşluğun kapandığı görülür:

| Boşluk | Sonuç |
|---|---|
| `manifest`'te `format_version` sayı yerine metin | `if/then` dalı eşleşmiyor, manifest gövdesi **hiç doğrulanmıyor** |
| Uydurulmuş blok bileşeni (`minecraft:hardness`) | Şema bileşen adlarını kısıtlamıyor |
| Blok `identifier`'ında namespace yok | Şema namespace zorunlu tutmuyor |
| Shaped tarifte `result` yok | Şema zorunlu tutmuyor |

Birinci maddeyi Mojang'ın manifest şeması yakalıyor. Diğer üçü için ikisinde de
karşılık yok — bu boşluklar Aşama 3'ün niyet/yapılabilirlik katmanına veya
`lookup` ile yapılacak ek bir kimlik kontrolüne kalıyor.

`lookup` bu boşluğun bir kısmını zaten kapatabiliyor: uydurulmuş bir blok/item
kimliğini şema değil `@codecraft/knowledge` yakalar.

### Upstream'de bulunan iki tutarsızlık

Ölçüm sırasında Blockception tarafında iki kusur görüldü, ikisi de bizim
kodumuzu ilgilendirdiği için kayda geçiyor:

- `vscode-settings.json`, `resource/cubemaps/cubemaps.json` şemasını adresliyor
  ama o dosya derlenmiş çıktıda yok (raw URL 404). `source/` altında var, yani
  derleme adımı o şema için henüz koşmamış. Pipeline durmuyor: uyarı basıyor ve
  eksik listesini `index.json` → `sources.blockception.compiled.missing` altına
  yazıyor. Liste büyürse günlük diff'te görünür.
- Üç şemada `"format": "colox-hex"` yazıyor — `color-hex` yazım hatası. Zararsız,
  çünkü ikisi de `ajv`'nin tanımadığı biçim ve yok sayılıyor.

`ajv` kurulumuyla ilgili Aşama 1'de ölçülen madde hâlâ geçerli ve uygulandı:
`unicodeRegExp: false` olmadan 5 Mojang şeması derlenmiyor (`pattern` içindeki
`\-` unicode kipinde geçersiz kaçış), etkilenenlerin hepsi
`client_server/packaging/3.0.0/` altında.

`ajv` 8'de yerleşik `format` yok; `ajv-formats` ekleniyor. Derlenmiş şemalarda
geçen biçimler: `uuid` (2) ve `uri` (2) standart, gerçekten doğrulanıyor;
`color-hex` (25), `molang` (14), `colox-hex` (3) Blockception'a özgü ve yok
sayılıyor. Kendi tanımlarını yazmak uydurma doğrulama olurdu.

## Referans (otomatik çekilmez)

| Kaynak | Ne için |
|---|---|
| feedback.minecraft.net changelog | Sürüm takibi |
| minecraft.wiki | Boşluk doldurma, ticari kısıt olabilir |
| WebSocket protokol dokümantasyonu | Dış otomasyon, topluluk kaynağı |

## Dış otomasyon kütüphaneleri (üretilen script'lerde kullanılır)

- `bedrockpy` veya `py-mcws` — WebSocket bağlantısı
- `pydirectinput` — girdi simülasyonu (`pyautogui` oyunlarda çalışmaz)
- `opencv` — ekran okuma, gerekirse

## WebSocket hakkında uyarı

`/connect` ve `/wsserver` hiçbir zaman resmi olarak belgelenmedi ve bakımı yapılmıyor. Her sürümde kırılabilir ve izlenecek resmi changelog yok.

Gereksinimler: dünyada hileler açık (bağlantı kurmak için), Ayarlar > Genel > Profil altında "Require Encrypted Websockets" kapalı. Konsollarda çalışmaz.

Sağlık kontrolü **pipeline'a eklenmedi ve Aşama 3'e taşındı**: çalışan bir
Minecraft istemcisi gerektiriyor, GitHub Actions'ta oyun çalıştırılamıyor.
Yerelden koşan bir script olarak yazılacak
(`docs/ileride-donulecek-todo.md`, Aşama 3).
