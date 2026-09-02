# Veri kaynakları ve lisansları

Projenin asıl değeri burada. Model değil, kürate edilmiş ve güncel tutulan
veri. Araçların döndürdüğü her değer bu kaynaklardan türetiliyor.

## Kritik ayrım: türetilmiş indeks ≠ yeniden yayın

Bir veriyi **yeniden yayınlamak** ile ondan **türetilmiş olgu üretmek** farklı
şeyler. İkincisi her zaman güvenli tarafta:

| | Yeniden yayın | Türetilmiş olgu |
|---|---|---|
| Ne | Kaynağın metni, birebir | "Bu id var", "bu alan zorunlu", "bu sürüm şu" |
| Örnek | Mojang'ın şema dosyasının içeriği | `blocks.json` içindeki 1415 id |
| Bizde | Mümkün olduğunca kaçınılır | Varsayılan |

Pipeline mümkün olan her yerde kendi indeksini üretir. Git'e giren tek birebir
kopya kümesi Blockception'ın şemaları (BSD-3-Clause, atıfla). Mojang'ınkiler
02-09-2026'dan beri `pipeline/raw/` altında ve git'e girmiyor — repo o gün
public yapıldı (aşağıda, "Ne dışarı çıkıyor").

## Kaynaklar

| Kaynak | Ne için | Lisans | `data/` içine nasıl girer |
|---|---|---|---|
| `Mojang/bedrock-samples` → `vanilladata_modules` | Blok, entity, item tanımları | Minecraft EULA, **tüm hakları saklı** | Türetilmiş indeks (id listeleri, blok durumları) |
| `Mojang/bedrock-samples` → `metadata/json_schemas/` | Mojang'ın kendi JSON şemaları | Minecraft EULA | Birebir kopya **git dışında** (`pipeline/raw/`); `data/` içine yalnızca türetilmiş `schemas-index.json` |
| `Mojang/bedrock-samples` → `metadata/command_modules/` | Komut grameri: 83 komut, 270 aşırı yükleme, 225 enum | Minecraft EULA | Türetilmiş indeks (açıklama metinleri atılır) |
| `Mojang/bedrock-samples` → `metadata/molang_modules/` | Molang: 315 sorgu, 61 matematik fonksiyonu (02-09-2026) | Minecraft EULA | Türetilmiş indeks (açıklama metinleri atılır) |
| `Mojang/bedrock-samples` → `resource_pack/particles/` | 189 parçacık kimliği | Minecraft EULA | Türetilmiş indeks (yalnızca `identifier`) |
| `Mojang/bedrock-samples` → `resource_pack/sounds/` | 1824 ses, 48 müzik olayı | Minecraft EULA | Türetilmiş indeks (yalnızca anahtar adları) |
| `Mojang/bedrock-samples` → `behavior_pack/{loot_tables,trading}/` | 207 loot + 27 takas tablosu YOLU | Minecraft EULA | Türetilmiş indeks (yalnızca yollar, içerik değil) |
| `Mojang/bedrock-samples` → `metadata/doc_modules/` | Bileşen adları: 32 blok, 124 entity, 28 feature tipi | Minecraft EULA | Türetilmiş indeks (yalnızca adlar, açıklamalar atılır) |
| `Mojang/bedrock-samples` → `metadata/engine_modules/` | 31 modül sürümü için afterEvent sırası | Minecraft EULA | Türetilmiş indeks |
| `Mojang/bedrock-schemas` | Resmi şema deposu | — | **Bugün kullanılmıyor.** İncelenecek; lisansı ve içeriği henüz kaynağa karşı doğrulanmadı |
| `Blockception/Minecraft-bedrock-json-schemas` | Doğrulamanın kullandığı şemalar | **BSD-3-Clause**, atıf zorunlu | Birebir kopya + `LICENSE` + türetilmiş `schema-map.json` |
| `@minecraft/*` (npm, 9 paket) | Script tip tanımları | **MIT** (paketlerin `package.json` beyanı) | Birebir `index.d.ts` + `package.json` |
| `MicrosoftDocs/minecraft-creator` | Sürüm notları | **CC-BY-4.0** (29-08-2026, GitHub API ile doğrulandı) | Birebir kopya + atıf başlığı |

### `Mojang/bedrock-samples` — açık lisanslı DEĞİL

Bu maddenin ayrı yazılması gerekiyor çünkü depo GitHub'da açıkta duruyor ve
"açık kaynak" sanılıyor. Değil. `LICENSE.md` metni (30-08-2026'da okundu):

> (c) Mojang AB. All rights reserved.
>
> By downloading the files in this repository, you agree to the Minecraft End
> User License Agreement and that these files are subject to its terms.

Sonuç, bizim için üç kural:

1. **Ham dosyalar dağıtılamaz veya servis edilemez.** İndirilen ham içerik
   `pipeline/raw/` altında kalır ve `.gitignore` içindedir.
2. **Yalnızca türetilmiş olgular indekslenir** — bir id'nin var olup olmadığı,
   bir alanın adı, bir sürüm numarası. Bunlar olgudur, ifade değil.
3. **Ham içerik geri sunulmaz.** `get_schema` ham şema döndürmez; özet verir ve
   ham şema isteğini açıkça reddeder.

> **Bu paragraf 02-09-2026'da düştü.** Repo o gün public yapıldı; gerekçesi
> deponun private olmasına dayanıyordu ve dayanak kalmadı.

~~`data/<sürüm>/schemas/` altındaki 1313 Mojang şeması bu kuralın istisnası
değil, kapsamı dışında: depoda duruyorlar (sürüm farkı okumak ve ikinci bir
kontrol için), ama hiçbir uçtan dışarı çıkmıyorlar.~~

Yanlış olan kısım "hiçbir uçtan dışarı çıkmıyorlar" değildi — o hâlâ doğru,
`/mcp` paketine girmiyorlar. Yanlış olan, **git'i bir uç saymamaktı.** Public
bir repoda depo kendisi bir dağıtım kanalıdır ve bu dosyalar EULA'ya tabi
birebir kopyalar.

1313 şema git'ten çıkarıldı ve `pipeline/raw/bedrock-samples/<sürüm>/json_schemas/`
altına taşındı (`.gitignore` içinde). Yerelde durmaya devam ediyorlar — sürüm
farkı okumak, ikinci bir kontrol ve `npm run validator:compare` için — ama
yayınlanmıyorlar. Yoksa `npm run pipeline:schemas` yeniden üretir.

`data/<sürüm>/schemas-index.json` **git'te kalıyor:** o bir olgu indeksi
(doküman tipi → hangi `format_version`'lar var), ham metin değil.

Ölçüldü 02-09-2026, taşımadan sonra: `npm run validator:compare` aynı sonucu
verdi (blockception 26/26, mojang 12/26, karşılaştırılabilir 17 vakada 12/17).
Taşıma ölçümü bozmadı.

Geçmiş git nesnelerinde içerik kalıyor. `filter-repo`/force push yapılmadı:
geri alınması zor bir işlem ve upstream aynı içeriği aynı şartlarla zaten
GitHub'da yayınlıyor. İleriye dönük düzeltme yeterli görüldü.

### Ne dışarı çıkıyor

MCP ucu herkese açık ve kimlik doğrulaması yok (`docs/MCP.md`). Yani Vercel
fonksiyon paketine giren her dosya üçüncü bir tarafa yüklenmiş demektir. Bu
liste bu yüzden dar tutuluyor ve tahminle değil manifest sayımıyla ölçülüyor.

**Ölçüldü 02-09-2026.** İzleme haritası `../data/**` idi, yani klasörün tamamı.
`packages/*/src` ve `app/src` içinde `schemas/`, `schemas-index` ve
`release-notes` için **sıfır** referans olduğu görülünce daraltıldı
(`app/next.config.ts`, `DATA_FILES`):

| | Önce | Sonra |
|---|---|---|
| `/mcp` toplam dosya | 4.152 | **731** |
| └ `data/` | 3.372 | **88** |
| └ ham Mojang şeması | 1.313 | **0** |
| └ Blockception kaynağı | 1.140 | **0** |
| İzlenen boyut (Windows) | 70,8 MB | **59,1 MB** |

Pakete girmesi **zorunlu** olan dört küme ayrıca sayıldı: repo kökü işaretçisi,
`@typescript/` (114 dosya — `tsc` alt süreç olarak koşuyor), `script-types/`
(11) ve `blockception/compiled/` (60). Daraltma sonrası gerçek bir üretim
build'i üzerinde `npm run mcp:probe` koşturuldu: dokuz kontrolün dokuzu yeşil.

İhlal olmuş değildi — dışarı giden zaten türetilmiş veriydi. Ama okunmayan
11 MB EULA içeriğini herkese açık bir pakete koymamak doğru taraf.

## Atıf ve lisans dosyaları — silinmez

Bunlar lisans şartıdır, kolaylık değil:

```
data/blockception/LICENSE                  BSD-3-Clause, (c) 2020 Blockception Ltd
data/1.26.40.5/script-types/NOTICE.md      @minecraft/* MIT beyanı
data/1.26.40.5/script-types/@minecraft/**/package.json
data/1.26.40.5/release-notes/Update1.26.40.md   CC-BY-4.0 atıf başlığı
```

`NOTICE.md` dosyalarını pipeline üretiyor — `writeTree` haritada olmayan her
dosyayı sildiği için elle yazılamıyorlar.

Mojang şema künyesi bu listeden 02-09-2026'da çıktı: klasörle birlikte
`pipeline/raw/bedrock-samples/<sürüm>/json_schemas/NOTICE.md` altına taşındı ve
artık git'te değil. Üretilmeye devam ediyor, çünkü yerel kopyanın da nereden
geldiği ve hangi lisansa tabi olduğu yazılı durmalı.

npm paketleri MIT olduklarını `package.json` içinde beyan ediyor ama tarball'a
lisans metnini ve telif satırını koymuyorlar. Telif sahibi uydurulmadı: beyanın
kendisi her sürüm klasöründe duruyor, `NOTICE.md` künyeyi kayda geçiriyor.

## Minecraft marka kuralları

Mojang'ın kullanım kılavuzu, marka adını kullanan üçüncü taraf ürünlerin şu
feragati göstermesini şart koşuyor:

```
NOT AN OFFICIAL MINECRAFT PRODUCT.
NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
```

Türkçe arayüzde altına çeviri konabilir ama **İngilizce aslı kalmalı** — şart
koşulan biçim o. Kaynak:
[Minecraft Usage Guidelines](https://www.minecraft.net/en-us/usage-guidelines)

| Kural | Bizdeki durum |
|---|---|
| Ürün adında "Minecraft" geçmemeli | **Uygun** — ad "CodeCraft" |
| Alan adında "Minecraft" geçmemeli | Alan adı alınırken dikkat edilecek |
| Resmi görünüm/onay izlenimi verilmemeli | Mojang logosu, resmi font ve blok dokusu kullanılmayacak |
| Feragat görünür olmalı | **Uygun** (02-09-2026) — `README.md` altbilgisinde ve `NOTICE` içinde, İngilizce aslı korunarak |

## `doc_modules` — 20 dosyanın yalnızca 5'i makine okunur

Bu bölüm bir ölçümün kaydı. "20 doküman modülünü indeksle" cümlesi kolay
yazılırdı ve **yanlış** olurdu.

**Ölçüldü 02-09-2026**, 20 dosyanın hepsi indirildi ve `nodes` ağacındaki her
düğüm sayıldı:

| Dosya | Düğüm | `minecraft:` adlı | Alındı mı |
|---|---|---|---|
| `entities.json` | 5068 | 708 | **evet** |
| `blocks.json` | 186 | 39 | **evet** |
| `biomes.json` | 154 | 43 | **evet** |
| `features.json` | 81 | 29 | **evet** |
| `client-biomes.json` | 73 | 29 | **evet** |
| `addons.json` | 7636 | 5339 | hayır — adlar `minecraft:acacia_button:000`, veri değerli eski blok kimlikleri |
| `particles.json` | 103 | 22 | **hayır — tuzak**, adlar `minecraft:example_*`, dokümantasyon örneği |
| `molang.json` | 502 | 0 | hayır — düz prosa |
| `entity-events.json` | 10 | 0 | hayır — düz prosa |
| `recipes.json` | 44 | 0 | hayır — `minecraft:` adlı düğüm yok |
| diğer 10 dosya | <60 | 0-1 | hayır |

`particles.json` satırı en önemlisi: dosya makine okunur GÖRÜNÜYOR ve 22
`minecraft:` adı var, ama hepsi `minecraft:example_beziercurve` gibi
dokümantasyon örnekleri. İndekse girseydi uydurma kimlikleri "geçerli"
sayardık. Gerçek parçacık kimlikleri `resource_pack/particles/` altından
okunuyor (189 dosya, ayrı bir toplayıcı).

### Bölüm adları elle yazılı ve bu bilinçli

Ağacın tamamından `minecraft:` adları toplamak daha kısa olurdu ama **anlamı
bozardı.** `entities.json` içinde dört ayrı bölüm var ve hepsi aynı önekle
başlıyor:

| Bölüm | Adet | `components` altına yazılır mı |
|---|---|---|
| Components | 124 | evet |
| AI Goals | 171 | evet |
| Properties | 49 | evet |
| Attributes | 3 | evet |
| **Built-in Events** | 4 | **hayır** |

Son satır kümeleri ayrı tutmanın sebebi: hepsini tek torbaya koysaydık, olay
adını bileşen yerine yazan bir dosya sessizce geçerdi. Test olarak sabitlendi.

Bölüm bulunamazsa **pipeline durur.** Upstream başlığı değiştirmişse sessizce
boş indeks yazmak, doğrulamayı sessizce kapatmak demek olurdu.

## Şema kaynağı: Blockception'ın derlenmiş çıktısı

Doğrulama Mojang'ın şemalarını değil Blockception'ınkileri kullanıyor. Karar
ölçülerek verildi, ölçüm script'i `npm run validator:compare`.

Blockception iki ayrı küme yayınlıyor ve doğru olan ikincisi:

| | `source/` | derlenmiş kök klasörler |
|---|---|---|
| Dosya | 1140 | **60** |
| Ne | yazım kaynağı | GitHub Action'ın ürettiği çıktı |
| `$ref` | dosyalar arası, `$id` tabanlı | tamamı `#/definitions/…`, dış ref yok |
| JSONC yorumu | 14 dosyada var | yok |
| Tip eşlemesi | yok | `vscode-settings.json` (glob → şema) |

Derlenmiş çıktıda `$id` çözümleyicisi de JSONC okuyucusu da gerekmiyor; her
dosya tek başına yeterli ve `ajv` 60/60'ını derliyor. Doküman tipi → şema
eşlemesini de upstream veriyor, yani kendi şemamızı yazmıyoruz.

**Mojang şemaları neden birincil kaynak değil** (26 fixture, 30-08-2026):

| | Blockception | Mojang |
|---|---|---|
| Beklenen sonucu veren | **26 / 26** | 12 / 26 |
| Karşılaştırılabilir vakalarda | — | 12 / 17 |
| 8 doküman tipinden kapsanan | 8 | 5 |

Sebebi yapısal: Mojang'ın şemaları dosyayı değil **iç nesneyi** tanımlıyor.
`minecraft:block` değerini anlatan bir şema var ama
`{format_version, "minecraft:block": …}` dosyasını anlatan yok — sarmalayıcıyı
bizim yazmamız gerekirdi. Tarif, diyalog, animasyon denetleyicisi ve feature
rules için ise Mojang'da hiç şema yok.

## Sürüm eşlemesi: oyun ↔ `@minecraft/server` modülü

`CLAUDE.md`'nin sürüm tablosundaki en tuzaklı satır. Eşleme tahminle değil, iki
kaynağın kesişimiyle kuruluyor (`pipeline/src/script-types.ts`):

1. `bedrock-samples/metadata/script_modules/@minecraft/` klasörü, o oyun
   sürümünde hangi modül sürümlerinin var olduğunu söyler
   (`server-bindings_2.9.0.json` gibi).
2. npm o sürümün gerçekten yayınlandığını doğrular. Kararlı sürüm birebir
   eşleşir; beta'da oyun sürümü etikete gömülüdür:
   `2.10.0-beta` + oyun `1.26.40` → `2.10.0-beta.1.26.40-stable`.

İkisi kesişmezse pipeline durur. Yakın bir sürüme düşmek yok.

1.26.40.5 için sonuç (29-08-2026'da doğrulandı, 02-09-2026'da genişletildi):

| Paket | Kararlı | Beta |
|---|---|---|
| `@minecraft/common` | 1.3.0 | yok |
| `@minecraft/server` | 2.9.0 | 2.10.0-beta |
| `@minecraft/server-ui` | 2.1.0 | 2.2.0-beta |
| `@minecraft/server-gametest` | **yok** | 1.0.0-beta |
| `@minecraft/server-net` | **yok** | 1.0.0-beta |
| `@minecraft/server-admin` | **yok** | 1.0.0-beta |
| `@minecraft/server-graphics` | **yok** | 1.0.0-beta |
| `@minecraft/diagnostics` | **yok** | 1.0.0-beta |
| `@minecraft/debug-utilities` | **yok** | 1.0.0-beta |

**Alt altı 02-09-2026'da eklendi.** Öncesinde bunlardan birini import eden bir
script `validate_script`'te `Cannot find module` alıyordu — araç var olan bir
API'ye "yok" diyordu, yani tam olarak önlemek için var olduğu hata sınıfını
kendisi üretiyordu.

İki şey ölçüldü, ikisi de tahmin değil:

1. **Dosya adı eşlemesi farklı.** Mojang tip bilgisini `server` ve `server-ui`
   için `-bindings` ekli dosyalarda tutuyor (`server-bindings_2.9.0.json`),
   bu altısı için eklemiyor (`server-net_1.0.0-beta.json`). Ağaçtan okundu.
2. **Altısı da yalnızca beta.** Hem bedrock-samples yalnızca
   `<ad>_1.0.0-beta.json` listeliyor hem npm yalnızca beta yayınlıyor. Yani
   kararlı kanalda görünmemeleri bir eksiklik değil, kaynağın söylediği şey.
   `validate_script` kararlı kanalda bu modüllere hâlâ "yok" diyor ve bu doğru
   cevap; `channel: "beta"` ile çözümleniyorlar.

`pickModuleVersions` "kararlı sürüm yoksa dur" diyordu; o kural gevşetildi.
Kararlı VE beta'nın ikisinin birden yokluğu hâlâ hata — o zaman dosya adı
biçimi değişmiş demektir.

Aynı sebeple `resolveModules` (script.ts) artık kanalda sürümü olmayan modülü
**atlıyor**, throw etmiyor. Eski hâlde altı beta-only modül eklendiği anda
kararlı kanaldaki HER script doğrulaması patlardı — o modülleri hiç
kullanmayanlar dahil. Test olarak sabitlendi.

Ek kanıt: npm'de `2.9.0` ile `2.10.0-beta.1.26.40-stable` aynı saniyede
yayınlanmış (2026-08-04T17:57).

**`@minecraft/common` atlanamaz.** `server` ve `server-ui` doğrudan ondan
import ediyor; olmadan `tsc` "Cannot find module" verir ve `validate_script`
hiçbir kodu doğrulayamaz.

`@minecraft/vanilla-data` çekilmiyor: `server/index.d.ts` içinde sadece
`import type` olarak geçiyor ve derlemeyi engellemiyor. İçeriği zaten
`vanilladata_modules`'tan türetiliyor. Ayrıca kendi sürüm şeması var (npm
`latest` = 1.26.44), yani altıncı bir sürüm biçimi olurdu.

## Çekme notları

- **Sürüm tespiti `version.json` ile yapılır.** Repo kökündeki 2 KB'lık bu
  dosya `latest.version` alanını verir (`1.26.40.5`). Repoyu klonlamaya gerek
  yok.
- **"Veri güncel" ile "kurulu oyunla aynı sürüm" aynı şey değil.**
  `version.json` ara hotfix sürümlerini yayınlamıyor: 1.26 serisinde sadece
  `.0/.10/.20/.30/.40` kayıtlı. 30-08-2026'da ölçüldü — kurulu oyun **1.26.45**
  iken upstream hâlâ `1.26.40.5` diyordu. `npm run pipeline:freshness` bunu
  bayatlama saymaz ve saymamalı: `data/` bedrock-samples ile eşleşiyorsa
  görevini yapmıştır. Pratikte sorun çıkarmaz çünkü `min_engine_version` bir
  alt sınırdır ve `[1, 26, 40]` 1.26.45'te sorunsuz yüklenir (gerçek oyun
  testiyle doğrulandı, `docs/VALIDATION-LIMITS.md`). Ama şema ve tip tanımları
  hotfix'te değişmiş bir şeyi bilemez.
- bedrock-samples: `main` dalı kararlı sürümü izler, `preview` haftalık.
  Kararlı tag'ler var ama adlandırma tutarsız — `v1.26.40.05` sıfır dolgulu,
  `v1.26.30.5` değil. Sürüm numarasından tag adı türetilemez; pipeline `main`
  dalına bakar.
- bedrock-samples reposu 358 MB — tarball indirilmez, dosyalar tek tek `raw`
  üzerinden çekilir. Blockception 8 MB olduğu için tarball tercih edilir
  (1 istek, 1140 dosya).
- Blockception: sürüm etiketleri geride kalabiliyor, `main` dalına bakılır.
- Sürüm notu dosyaları üç parçalı adlandırılır: oyun `1.26.40.5` →
  `Update1.26.40.md`. Dokümanlar oyunun gerisinde kalabiliyor; dosya yoksa
  pipeline durmaz, uyarı basar.
- `minecraft-creator` reposu 1.2 GB — klonlanmaz, tek dosya çekilir.
- Kaynakların bir kısmı CRLF ile geliyor (Blockception'da 172 dosya). Pipeline
  yazarken LF'e normalize eder; yoksa `.gitattributes` ile birlikte her koşuda
  sahte diff üretirdi.

## Açık kalan

- **`Mojang/bedrock-schemas` incelenmedi.** Resmi bir şema deposu olarak
  direktifte geçiyor ama içeriği, lisansı ve Blockception'a göre kapsamı bu
  depoda hiç ölçülmedi. İncelenene kadar buraya bir iddia yazılmayacak.
- ~~**Marka feragatı henüz hiçbir yerde görünmüyor.**~~ Kapatıldı 02-09-2026:
  depo public yapılınca `README.md` görünen yüzey oldu, feragat oraya ve
  `NOTICE` dosyasına girdi. Kullanım sitesi yapıldığında altbilgiye de
  konacak — o zaman README yeniden ele alınacak.
