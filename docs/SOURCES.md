# Veri Kaynakları

Projenin asıl değeri burada. Model değil, kürate edilmiş ve güncel tutulan veri.

## Kritik ayrım

Bu verileri **yeniden yayınlamak** ile onlardan **türetilmiş indeks üretmek** farklı şeyler. İkincisi her zaman güvenli. Pipeline mümkün olan yerde kendi indekslerini üretir; birebir kopyalanan tek kaynak grubu aşağıdaki lisans tablosunda işaretli.

## Otomatik çekilenler (pipeline)

| Kaynak | Ne için | Lisans | `data/` içine nasıl girer |
|---|---|---|---|
| `Mojang/bedrock-samples` → `vanilladata_modules` | Blok, entity, item tanımları | Minecraft EULA | **Türetilmiş indeks** (id listeleri, blok durumları) |
| `Mojang/bedrock-samples` → `metadata/json_schemas/` | Mojang'ın kendi JSON şemaları | Minecraft EULA | **Birebir kopya** — bilinçli karar, aşağıya bak |
| `Blockception/Minecraft-bedrock-json-schemas` | JSON doğrulama şemaları | BSD-3-Clause, izin verici | Birebir kopya + `LICENSE` |
| `@minecraft/common`, `@minecraft/server`, `@minecraft/server-ui` (npm) | Script tip tanımları | **MIT** (doğrulandı: `npm view @minecraft/server license`) | Birebir `index.d.ts` + `package.json` |
| `MicrosoftDocs/minecraft-creator` | Sürüm notları | **CC-BY-4.0** (doğrulandı 29-08-2026, GitHub API) | Birebir kopya + atıf başlığı |

### EULA kararı: Mojang şemaları neden birebir commit ediliyor

`metadata/json_schemas/` içeriği EULA kapsamında ve repoda `LICENSE` dosyası yok
(HTTP 404, doğrulandı). Yine de `data/<sürüm>/schemas/` altına birebir
kopyalanıyor. Karar bilinçli ve gerekçesi şu:

- Klonlayan herkeste hazır olur; doğrulama ağ erişimi gerektirmez. Aşama 4'te
  sunucu tarafı doğrulama (mimari kural 2) her dağıtımda 1313 dosya indirmek
  zorunda kalmaz.
- Geçmiş sürümler git'te birikir. `main` ilerlediğinde eski şemalar tag'den
  geri alınabilir ama tag adlandırması tutarsız (aşağıya bak), yani güvenilir
  bir geri dönüş yolu değil.

**Repo public yapılırsa bu karar yeniden değerlendirilmeli** — git geçmişinden
temizlemek zahmetlidir. Alternatif: şemaları `pipeline/raw/` içinde tutup
`data/` altına sadece türetilmiş `schemas-index.json` yazmak.

**Çekme notları:**
- bedrock-samples: `main` dalı kararlı sürümü izler, `preview` haftalık.
  - **Düzeltme (29-08-2026):** daha önce buraya "kararlı seride tek tag var"
    yazılmıştı, doğru değil. En az 15 kararlı tag mevcut (`v1.26.40.05`,
    `v1.26.30.5`, `v1.26.20.26`, `v1.26.10.4`, …). Ancak adlandırma tutarsız —
    `v1.26.40.05` sıfır dolgulu, `v1.26.30.5` değil. Sürüm numarasından tag adı
    türetilemez, liste çekip eşleştirmek gerekir. Pipeline yine `main` dalına bakar.
- **Sürüm tespiti `version.json` ile yapılır.** Repo kökündeki 2 KB'lık bu dosya `latest.version` alanını verir (`1.26.40.5`). Repoyu klonlamaya gerek yok.
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

## Şema kaynağı: Blockception mı, Mojang mı

Karar **Aşama 2'ye bırakıldı** — validator'ın 20 fixture'ı hangisinin daha iyi
tuttuğunu gösterecek, tahminle seçilmeyecek. Pipeline ikisini de çeker.

Aşama 1'de ölçülen, karara girdi olacak farklar (`ajv` 8.20.0 ile denendi):

| | Mojang | Blockception |
|---|---|---|
| Dosya | 1313 | 1140 |
| `$schema` | tamamı draft-07 | 1066'sında yok, 59'u draft-07, 1'i üçüncü taraf URL |
| Geçerli JSON | 1313 | **1126** — 14 dosya `//` yorum içeriyor (JSONC), `JSON.parse` reddediyor |
| `$ref` biçimi | tamamı dosya içi (`#/definitions/…`), dosyalar kendi kendine yeterli | `$id` tabanlı ve dosyalar arası göreli |
| `ajv` ile derlenme | **1313 / 1313** | ölçülmedi — `$id` çözümleyicisi gerekiyor |

Aşama 2 için üç somut not:

1. **`ajv` `unicodeRegExp: false` ile kurulmalı.** Varsayılan ayarda 5 Mojang
   şeması derlenmiyor: `pattern` içindeki `\-` unicode kipinde geçersiz kaçış.
   Etkilenenlerin hepsi `client_server/packaging/3.0.0/` altında — yani
   `manifest.json`, behavior pack'in en kritik dosyası.
2. **Blockception `$id` çözümleyicisi ister.** Şemalar `$id` olarak
   `blockception.minecraft.resource.texture.ui_definition` gibi değerler
   kullanıyor; `ajv` göreli `$ref`'leri dosya yoluna göre değil bu `$id`'ye göre
   çözüyor. Dosya yoluyla yüklemek yetmez.
3. **14 Blockception dosyası JSONC.** Yorum ayıklayan bir okuyucu gerekir:
   `resource/cubemaps/cubemaps.json`, `resource/block_culling/block_culling.json`,
   `resource/biomes/format/minecraft.client_biome.json`,
   `resource/biomes/format/components/ambient_sounds.json`,
   `behavior/worldgen/jigsaw_structures/format/pool_aliases.json`,
   `behavior/features/features/minecraft.structure_template_feature.json`,
   `behavior/entities/format/components/ageable.json`,
   `behavior/entities/format/components/breedable.json`,
   `behavior/entities/format/behaviors/pet_sleep_with_owner.json`,
   `behavior/entities/format/behaviors/ram_attack.json`,
   `behavior/entities/format/behaviors/random_fly.json`,
   `behavior/entities/format/behaviors/use_kinetic_weapon.json`,
   `behavior/blocks/format/minecraft.block.json`,
   `behavior/blocks/format/components/random_offset.json`.
   Ayrıca `resource/lighting/lighting.json` içinde `#/defintions/` yazım hatası var.

`CLAUDE.md`'nin "kendi JSON şemalarını yazma" kuralı iki seçenekte de korunuyor.

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
Yerelden koşan bir script olarak yazılacak (`TODO.md`, Aşama 3).
