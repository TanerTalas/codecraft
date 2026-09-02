# Doğrulamanın yakalayamadıkları

Doğrulama oturduğunda şu soru açıktı: şemadan ve `tsc`'den geçen içerik oyunda
gerçekten çalışıyor mu? 30-08-2026'da ölçüldü. Cevap: **çoğu çalışıyor, ama
beş ayrı sınıf hata doğrulamadan geçip oyunda patlıyor** (A–E).

> Bu cümle önce "dört" diyordu ve doğruydu — E sınıfı aynı gün, ayrı bir
> ölçümde bulundu. 02-09-2026'da bir **altıncısı** eklendi (F · Molang) ama o
> diğerlerinden farklı: oyunda değil, kaynağın kendisinde bulundu ve henüz
> `ContentLog` kanıtı yok. Sayıyı beşte tutan ayrım bu.

Bu doküman o sınıfları kaydeder. `docs/SOURCES.md` verinin nereden geldiğini
anlatır; burası doğrulamanın nerede bittiğini anlatır. Araçların hangi
sınırın neresinde durduğu buradan okunur.

## Nasıl ölçüldü

`npm run fixtures:pack -- --install` ile 10 fixture'dan bir davranış paketi
üretildi. Üreteç her dosyayı yazmadan önce kendi `validateJson` /
`validateScript` fonksiyonlarımızdan geçiriyor — yani oyuna **sadece
doğrulamayı geçmiş** içerik gitti.

| | |
|---|---|
| Oyun | Bedrock 1.26.45 (paket `1.26.4501.0`), Windows |
| Veri | `data/1.26.40.5` |
| Kanıt | `%APPDATA%\Minecraft Bedrock\logs\ContentLog*.txt` |
| Dünya | Düz, yaratıcı, hileler açık |

Doğrulamayı geçip oyunda çalışan taraf: manifest yüklendi, script modülü
keşfedildi, blok/item/entity kaydoldu, `/give`, `/setblock`, `/summon`
çalıştı, script'in olay aboneliği tetiklendi. Dialogue, animasyon denetleyicisi
ve spawn kuralları hiç şikâyet üretmedi.

---

## A. Kimlik referansları — şema hedefin var olduğuna bakmıyor

```
[FeatureRegistry][error] No definition found for feature 'codecraft:ruby_ore_scatter'
[Recipes][error] The Item: codecraft:ruby_block is missing or invalid, can't make the recipe
[Recipes][error] Recipe result malformed
```

Şema `result.item` alanının **biçimini** doğruluyor, işaret ettiği şeyin var
olup olmadığını değil. Bu, `cases.json` içindeki `recipe-result-missing`
boşluğunun oyundaki karşılığı.

**Çözülebilir bir sınıf.** `@codecraft/knowledge` içindeki `lookup` tam olarak
bunun için var: vanilla kimlikleri `data/<sürüm>/` indekslerinden doğrular.
Paket içinde tanımlanan kimlikler (`codecraft:ruby_block` gibi) için de aynı
mantık kurulabilir — üretilen dosyaların kendi kimlik kümesi çıkarılıp
referanslar ona karşı kontrol edilir.

→ Kapatıldı: `checkIdentities` doğrulamadan sonra ikinci bir kimlik kontrolü
koşuyor, `review_pack` onu çağırıyor.

### Genişletme (02-09-2026): yol referansları ve bir yanlış pozitif

Kimlik kontrolünün iki kör noktası ölçüldü.

**1. Yol taşıyan referanslar.** `minecraft:loot` ve `minecraft:trade_table` bir
kimliğe değil bir **dosya yoluna** işaret ediyor:

```json
{ "minecraft:loot": { "table": "loot_tables/entities/cow.json" } }
```

Şema yolun string olduğunu doğruluyor, işaret ettiği dosyanın var olup
olmadığını değil — A sınıfının aynısı, farklı kılıkta. `checkReferences`
kapatıyor: 207 vanilla loot tablosu ve 27 takas tablosu indeksleniyor, paket
kendi tablosunu getiriyorsa referans çözülmüş sayılıyor (C'deki 01-09-2026
dersinin aynısı).

**2. Ses olayları kimlik değil.** `mob.cow.say` nokta ayraçlı bir ad ve
namespace taşımıyor, yani `COMMAND_ID_RE` onu hiç yakalamıyordu.
`checkSounds` `/playsound` satırlarını 1824 vanilla ses olayına karşı ölçüyor.

**3. Parçacıklar — ölçülmüş bir YANLIŞ POZİTİF.** Bu madde diğer ikisinden
önemli, çünkü kaçırma değil **uydurma hata** idi:

```
/particle minecraft:heart_particle ~ ~ ~
→ "minecraft:heart_particle" 1.26.40.5 sürümünde yok        [error]
```

Komut tamamen geçerli. Sebep: `checkCommandIdentities` her `minecraft:`
kimliğini `lookupAny` ile arıyor ve parçacıklar **hiçbir indekste yoktu**.
189 parçacık `particles.json` olarak indekslendi ve `ALL_KINDS` içine girdi;
bulgu kayboldu, uydurulmuş bir parçacık ise hâlâ yakalanıyor (kontrol grubu,
test olarak sabitlendi).

> **Parçacık kimliği dosya adından türetilemiyor** ve bu ölçülerek görüldü:
> `arrowspell.json` → `minecraft:arrow_spell_emitter`,
> `balloon_gas.json` → `minecraft:balloon_gas_particle`. 189 dosyanın hepsi
> okunuyor. Doku atlasındaki %13/%40 bulgusuyla aynı ders: ad türetme kuralı
> yazmak, kuralı uydurtmak demek.

`checkReferences` ve `checkSounds` bulguları **warning**: eksik bir loot
tablosunun oyunda ne yaptığı henüz ölçülmedi. Parçacık düzeltmesi ise bir
ölçüme dayanıyor ve error tarafında duruyor — çünkü orada ölçülen şey aracın
kendi hatasıydı.

## B. Dosya adı ile içerik arasındaki kurallar — hiçbir şema yakalayamaz

```
[FeatureRegistry][error] Feature rule identifier 'ruby_ore_feature'
                         does not match filename 'ruby_ore'
```

Oyun, feature rule dosyasının adının identifier'ın namespace'siz hâliyle aynı
olmasını şart koşuyor. `codecraft:ruby_ore_feature` → `ruby_ore_feature.json`.

**Yapısal olarak şemanın erişemeyeceği bir kural:** JSON şeması dosyanın
içeriğini görür, adını değil. Ne Blockception ne Mojang şemaları bunu ifade
edebilir.

Dosya adı düzeltilip yeniden yüklendiğinde hata kayboldu — kural doğrulandı,
tahmin değil.

→ Bugün yalnızca **bulunuyor**, düzeltilmiyor: `checkFileNames` uyumsuzluğu
rapor ediyor ve doğru adı söylüyor. Düzeltmek çağıranın işi — araç yazmıyor.

## C. Varlık (asset) referansları — davranış paketi tek başına yetmiyor

```
[Json][error] -> components -> minecraft:icon: Missing referenced asset ruby
```

`minecraft:icon` bir kaynak paketinde tanımlı dokuya işaret ediyor. Kaynak
paketi olmayınca oyun bunu **uyarı değil hata** olarak yazıyor.

Oyun içi görüntü: item elde bomboş görünüyor, özel blok soru işaretli
"eksik doku" bloğu olarak çiziliyor.

**Sonuç:** sadece behavior pack üreten bir akış, item ikonu tanımladığı anda
içerik hatası üretir. v1 kapsamı behavior pack (`CLAUDE.md`), o yüzden ya
minimum bir kaynak paketi de üretilmeli ya da kullanıcıya bunun eksik kalacağı
açıkça söylenmeli.

### Karar ve kapanış (30-08-2026)

> **Bu bölümün ilk cümlesi 01-09-2026'da değişti.** Kaynak paketi artık
> üretilebilir; aşağıdaki "Güncelleme" bölümüne bakın. Geri kalan ölçümler
> (atlas anahtar sayıları, %13/%40 bulgusu, yakın anahtar önerisi) aynen
> geçerli.

~~**Kaynak paketi üretilmiyor.**~~ Bunun yerine model yalnızca vanilla'da
**zaten var olan** bir doku anahtarına işaret edebiliyor — bu hâlâ geçerli ve
en ucuz yol, ama artık tek yol değil.

Kaynak makine okunur ve doğrulandı — `Mojang/bedrock-samples@main` içinde
`resource_pack/textures/item_texture.json` (498 anahtar) ve
`terrain_texture.json` (1300 anahtar) var. Diğer dört sınıfla aynı düzen: tek
ölçüm üç yere birden bağlanıyor.

| Nerede | Ne yapıyor |
|---|---|
| `pipeline/src/textures.ts` | `data/<sürüm>/textures.json` üretiyor |
| `packages/validator/src/checks.ts` → `checkAssets` | ölçüyor |
| ~~`packages/core/src/prompt.ts`~~ | ~~önceden anlatıyor~~ — dosya asistan katmanıyla birlikte silindi (02-09-2026). Aynı bilgi bugün `get_version_info` bağlamı üzerinden veriliyor |

**Prompt'a yazılmayan bir kural var ve sebebi ölçüm.** İlk yazılacak cümle
"anahtar, kimliğin namespace'siz hâlidir" idi. Veriye bakıldı ve **yanlış**
çıktı: item kimliklerinin yalnızca **%13'ünün**, blok kimliklerinin **%40'ının**
atlasta aynı adla karşılığı var (`minecraft:acacia_boat` item atlasında yok).
O cümle prompt'a girseydi model kural gereği uyduracaktı. Yerine `checkAssets`
hata mesajında gerçek yakın anahtarları öneriyor, retry onunla yakınsıyor.

**Yanlış atlas hata değil uyarı.** Anahtar gerçekten var, yalnızca beklenen
atlasta değil; ona "yok" demek uydurma hata olurdu.

**Ölçüldü, iki aşamada:**

1. Eski model çıktıları (kural prompt'ta yokken üretilmiş) yeni kontrolden
   **düştü** — `custom-item-01` `"ruby"`, `custom-block-01` `"custom_ruby"`
   yazmıştı. İkisi de oyunda içerik hatası verirdi ve eval bunu "geçti"
   sayıyordu.
2. Kural prompt'a girdikten sonra aynı iki vaka gerçek modele gönderildi
   (`gemini-3.6-flash`) ve **ikisi de geçti**: model item ikonuna `"emerald"`,
   blok yüzeyine `"emerald_ore"` yazdı — ikisi de vanilla atlasında var.

**Bedeli açıkça söyleniyor, gizlenmiyor:** içerik hatası kalkıyor ama özel
görsel elde edilmiyor. "Yakut" item'ı zümrüt dokusuyla görünüyor. Özel doku
kullanıcının kendi kaynak paketini yazmasını gerektirir ve arayüz bunu
çıktının yanında söyleyecek.

### Güncelleme (01-09-2026, docs/mcp-kullanim.md senaryo 5): paket kendi atlasını getirirse

Yukarıdaki karar "kaynak paketi ÜRETİLMİYOR" varsayımına dayanıyordu ve
`checkAssets` yalnızca vanilla atlasına bakıyordu. Gerçek kullanımda o varsayım
tutmadı: MCP üzerinden gelen bir istek kaynak paketi de üreten eksiksiz bir
eklenti verdi — `RP/textures/terrain_texture.json` ve `item_texture.json`
anahtarları tanımlıyor, PNG'ler pakette. `review_pack` yine de iki **error**
bulgusuyla `ok:false` döndü.

Yani doğru ve kurulabilir bir paket "hatalı" raporlandı — **yanlış pozitif.**

**Kapsam kararı değişmedi.** CodeCraft'ın kendi ürettiği şey hâlâ behavior
pack. Değişen tek şey referansın nasıl ÇÖZÜLDÜĞÜ: bir anahtar paketin kendi
atlas tanımında duruyorsa o referans çözülmüştür, kimin yazdığından bağımsız.

| Girdi | Önce | Sonra |
|---|---|---|
| Paket + kendi `terrain_texture.json` / `item_texture.json` | 2 error, `ok:false` | **temiz** |
| Aynı paket, atlas tanımları çıkarılmış | 2 error | **2 error** (kontrol grubu) |

İkinci satır kritik: düzeltme denetimi kapatmadı, yalnızca çözülebilen
referansı çözdü. Test olarak da böyle sabitlendi.

**Asıl risk teknik değildi.** Model bulguyu haklı olarak yok saydı ve
kullanıcıya "bu uyarı geçerli değil" diye yazdı. Aracın kendi yanlış hataları
modele *"bu aracın hatalarını yok say"* öğretir; o alışkanlık bir gün gerçek
bir hatayı da yok saydırır. Yanlış pozitifin pahalı olmasının sebebi bu.

**Açık kalan (ürün kararı, kod değil):** `CLAUDE.md` v1 kapsamı "behavior pack
üretimi" diyor ama model kendiliğinden kaynak paketi de üretiyor ve sonuç
doğrulamadan geçiyor. Kapsam cümlesi gerçeğe göre güncellenecek mi, karar
verilmedi.

## D. Geçerli ama amaçlanmayan — en tehlikeli sınıf

Script şu satırı içeriyordu:

```js
world.afterEvents.worldLoad.subscribe(() => {
  world.sendMessage("CodeCraft test paketi yüklendi");
});
```

Şemadan geçti, `tsc`'den geçti, oyunda **hata vermeden çalıştı** — ve mesaj
kimseye ulaşmadı.

Ölçüm: script'e `console.warn` eklendi, içerik günlüğüne düştü:

```
[Scripting][warning] [codecraft] worldLoad tetiklendi
[Scripting][warning] [codecraft] playerSpawn tetiklendi
```

Yani **`worldLoad` tetikleniyor.** Sorun olayda değil: o anda mesajı alacak
oyuncu henüz yok. Aynı script'teki `playerSpawn` aboneliğinin mesajı sohbete
düştü.

Doğru kalıp — karşılama mesajı `playerSpawn` ile:

```js
world.afterEvents.playerSpawn.subscribe((event) => {
  if (!event.initialSpawn) return;
  event.player.sendMessage("...");
});
```

**Bu sınıfı ne derleyici ne şema yakalayabilir.** Kod her ölçüte göre doğru;
yanlış olan tek şey niyetle sonuç arasındaki fark. Yakalanabilmesi için
çıktının çalıştırılması veya kalıbın bilinmesi gerekiyor.

→ Kapatılan yarısı: bilinen kalıplar `checkPatterns` ile ölçülüyor ve aynı
tablo `get_version_info` bağlamı üzerinden ÖNCEDEN de anlatılıyor. Kapatılmayan
yarısı: tabloda olmayan bir kalıp hâlâ sessizce geçer.

## E. Şemadan geçen ama oyunun hiç yüklemediği manifest

**30-08-2026, uçtan uca bir testte ölçüldü.** Model şu modülü üretti:

```json
{ "type": "javascript", "entry": "scripts/main.js" }
```

Doğrulamadan geçti. Oyun paketi **davranış paketleri listesinde hiç
göstermedi** — hata mesajı bile yok, paket sadece yok.

Tek alan değiştirilip yeniden bakıldı:

```json
{ "type": "script", "language": "javascript", "entry": "scripts/main.js" }
```

Paket göründü, etkinleştirildi, script çalıştı. Sebep kesinleşti.

**Şema neden yakalamadı:** modül tipi için gerçekten bir liste tutuyor ve
uydurma bir tipi reddediyor. Ama listede `javascript` de var:

```
["resources","data","client_data","interface","world_template","javascript","script"]
```

`javascript` 1.16 öncesinden kalma. Blockception geriye dönük uyumluluk için
listede tutuyor; `@minecraft/server` 2.x ile yüklenmiyor. Yani şema "geçerli
bir tip" diyor, oyun "bu tiple yükleyemem" diyor — ikisi de kendi çerçevesinde
haklı.

**Bu sınıf A–D'den farklı ve daha sinsi:** diğerlerinde oyun bir hata basıyordu
ve içerik günlüğünde görünüyordu. Burada hiçbir belirti yok. Kullanıcı paketi
arıyor, bulamıyor, sebebini bilmiyor.

→ `checkManifest` ölçüyor ve doğru tipi söylüyor; aynı ölçüm
`get_version_info` bağlamı üzerinden önceden de anlatılıyor.

## F · Molang — string'in içi hiçbir doğrulayıcının görmediği yer

Yukarıdaki beş sınıf gerçek oyunda ölçülerek yazıldı. **Bu altıncısı
ölçülmedi** ve o yüzden ayrı duruyor; aşağıda ne bilindiği ve ne
bilinmediği ayrı ayrı yazılı.

Molang, entity bileşenlerinde, animasyon ve render denetleyicilerinde **düz
string** olarak duruyor:

```json
{ "transitions": [ { "walk": "query.is_babyy && v.speed > 0.1" } ] }
```

JSON şeması bu alanın **string olduğunu** doğruluyor, içeriğini değil.
`tsc` bu dosyayı hiç görmüyor. Yani yanlış yazılmış bir sorgu adı
doğrulamanın her ayağından geçiyor — A–E ile aynı yapıdaki bir boşluk.

**Kaynak makine okunur ve doğrulandı** (02-09-2026):
`bedrock-samples/metadata/molang_modules/mojang-molang-queries.json` içinde
**315 sorgu ve 61 matematik fonksiyonu** var, her biri `min_args`, `max_args`
ve `return_type` ile. `data/<sürüm>/molang.json` bundan türetiliyor.

Kaynaktan okunan üç kural doğrudan doğrulayıcıyı biçimlendirdi:

| Kural | Nereden | Doğrulayıcıda karşılığı |
|---|---|---|
| Büyük/küçük harfe **duyarsız** | `doc_modules/molang.json`, "Case Sensitivity" | Karşılaştırma küçük harf üzerinden |
| `q.`→`query.`, `v.`→`variable.`, `t.`→`temp.`, `c.`→`context.` | aynı dosya, "Alias Mapping" | `q.is_baby` geçerli sayılıyor |
| Argümansız sorgu **parantezsiz** yazılır | aynı dosya, "Query Functions" | Parantez yokluğu = 0 argüman |

Takma adları çözmemek en pahalı hata olurdu: `q.` ile yazılmış her geçerli
ifadeye uydurma hata üretilirdi.

**Ölçülen bir sürpriz:** 315 sorgunun **217'sinde `max_args` yok.** İlk okuyuş
"max = min" idi; veriye bakıldı ve yanlış çıktı — `max_args` taşıyan 98 kaydın
18'inde `max != min`, yani alan gerçekten bir üst sınır ve yokluğu "üst sınır
yok" demek. Ters kurulsaydı değişken argümanlı her sorguya "fazla argüman"
denirdi.

Ayrıca **6 sorgu kaldırılmış** (`version_ranges[].last_version`) — örneğin
`query.block_property` 1.20.10'dan sonra yok. Bunlar `until` alanıyla
saklanıyor ve kullanıldıklarında sürüm numarasıyla birlikte raporlanıyor.

### Neden hepsi warning

`checkMolang`'ın ürettiği bulguların hepsi **warning**, hiçbiri error. İki
sebep, ikisi de bu depoda yazılı:

1. **Oyunda ölçülmedi.** A–E'nin hepsinin `ContentLog` kanıtı var, bunun yok.
   Bu depoda "çalışıyor" ile "ölçüldü" ayrı şeyler.
2. **Veri sürümü kurulu oyunun gerisinde kalabiliyor** (`docs/SOURCES.md`,
   "Çekme notları"). Yeni eklenmiş bir sorguya "yok" demek yanlış pozitif
   olurdu — ve yanlış pozitifin neden pahalı olduğu C bölümünde ölçüldü
   (01-09-2026): aracın kendi hataları modele *"bu aracın hatalarını yok say"*
   öğretiyor.

**Error'a yükseltmek için gereken şey belli ve tek:** bilerek bozulmuş bir
Molang ifadesi taşıyan bir paketi oyuna yükleyip `ContentLog`'a bakmak.
Ölçülene kadar warning kalacak.

### Ne ölçülmüyor

Tam bir Molang ayrıştırıcısı **yazılmadı** ve yazılmayacak. Ölçülmeyenler:
operatör önceliği, tip uyumu (`bool` beklenen yere `float`), `->` zinciri,
`loop`/`for_each` gövdesi, `variable.`/`temp.`/`context.` adlarının o bağlamda
tanımlı olup olmadığı. Sonuncusu yapısal olarak ölçülemez: o adlar kullanıcı
tanımlı, kapalı bir küme yok.

## G · Bileşen adları — iki şema kaynağı da geçiriyor

Bu boşluk aslında **zaten ölçülmüştü** ve fixture'ı da vardı:
`packages/validator/test/fixtures/cases.json` içindeki
`block-unknown-component` vakasının beklenen sonucu **"pass"** — yani hem
Blockception hem Mojang şemaları bilinmeyen bir bileşen adını geçiriyor
(`npm run validator:compare` tablosunda iki sütun da "geçti ✓").

```json
{ "minecraft:block": { "components": { "minecraft:destructable": {} } } }
```

Doğrusu `minecraft:destructible_by_mining`. Şemadan geçiyor, `tsc` görmüyor,
oyunda bileşen hiç uygulanmıyor.

**Kaynak makine okunur ve doğrulandı** (02-09-2026):
`metadata/doc_modules/` içinde 32 blok bileşeni, 124 entity bileşeni,
171 AI hedefi, 49 entity özelliği, 28 feature tipi ve 27 biyom bileşeni
adı bölüm bölüm yazılı. `data/<sürüm>/components.json` bundan türetiliyor.
Hangi dosyanın alındığı ve **neden 20 dosyadan 5'i** alındığı
`docs/SOURCES.md` içinde tabloyla duruyor.

Ölçülen bir tuzak: `doc_modules/particles.json` makine okunur görünüyor ve 22
`minecraft:` adı taşıyor, ama hepsi `minecraft:example_*` — dokümantasyon
örneği. İndekse girseydi uydurma kimlikleri geçerli sayardık.

**Kümeler ayrı tutuluyor.** Entity'de bileşen, AI hedefi, öznitelik ve özellik
`components` altına yazılabiliyor; "Built-in Events" yazılamaz. Hepsini tek
kümeye koymak, olay adını bileşen yerine yazan bir dosyayı geçirirdi — bu da
test olarak sabitlendi.

**Warning, error değil:** dokümantasyon oyunun gerisinde kalabiliyor ve yeni
eklenmiş bir bileşene "yok" demek yanlış pozitif olurdu. Bu sınıf da oyunda
ölçülmedi.

Yan ürün: `metadata/engine_modules/engine-after-events-ordering.json` da
indeksleniyor (`data/<sürüm>/event-order.json`, 31 modül sürümü). D sınıfının
veri ayağı — hangi `afterEvent`'in var olduğu ve hangi sırada tetiklendiği
artık hatırlanmıyor, okunuyor.

---

## Özet

| Sınıf | Şema yakalar mı | Ne ölçüyor | Durum |
|---|---|---|---|
| A · kimlik referansı | Hayır, ama çözülebilir | `checkIdentities`, `checkCommandIdentities` | **Bulunuyor** — `review_pack` koşuyor, bulgu eyleme dönüştürülebilir metne giriyor |
| A' · yol / ses referansı | Hayır | `checkReferences`, `checkSounds` | **Bulunuyor, warning** — oyunda henüz ölçülmedi |
| B · dosya adı kuralı | **Yapısal olarak hayır** | `checkFileNames` | **Bulunuyor** — doğru ad raporda söyleniyor |
| C · asset referansı | Hayır | `checkAssets` | **Bulunuyor** — vanilla doku indeksine karşı |
| D · geçerli ama yanlış | **Yapısal olarak hayır** | `checkPatterns` | **Bulunuyor + önceden anlatılıyor** — `patternGuide()` aynı tablodan besliyor |
| E · yüklenmeyen manifest | Hayır — eski tip listede | `checkManifest` | **Bulunuyor** — yanlış modül tipi rapor ediliyor |
| F · Molang | Hayır — string'in içine bakmıyor | `checkMolang` | **Bulunuyor, warning** — oyunda henüz ölçülmedi |
| G · bileşen adı | Hayır — iki kaynak da geçiriyor | `checkComponents` | **Bulunuyor, warning** — oyunda henüz ölçülmedi |

> **Dördüncü sütun 02-09-2026'da düzeltildi.** Önce B ve E için "düzeltiliyor"
> yazıyordu ve doğruydu: bir `normalize()` fonksiyonu dosya adını ve manifest
> modül tipini kendisi onarıyordu. O fonksiyon asistan katmanıyla birlikte
> silindi. Bugün araçlar **buluyor ve söylüyor**, yazmıyor — uç salt okunur.
> Düzeltme çağıranın işi.

Kontrollerin hepsi `packages/validator/src/checks.ts` içinde (Molang'ın
gövdesi `packages/validator/src/molang.ts`), saf fonksiyon, model çağrısı yok.
`review_pack` hepsini birden koşuyor; `packages/validator/test/` altındaki
fixture'lar tek tek ölçüyor.

> **F ve G satırları diğerlerinden farklı okunmalı.** A–E "oyunda patladığı görüldü,
> sonra kontrol yazıldı" sırasıyla geldi. F ters yönden geldi: kaynak makine
> okunur olduğu için kontrol önce yazıldı, oyun ölçümü henüz yapılmadı. Bu
> yüzden warning ve bu yüzden ayrı yazılıyor. G aynı yoldan geldi; farkı,
> boşluğun `cases.json` içinde zaten kayıtlı olması.

İki sınır kayda geçmeli:

- **Vanilla feature'lar doğrulanamıyor.** `data/<sürüm>/features.json` yapı
  (structure) feature'larını tutuyor (17 kayıt), `ore`/`scatter` gibi
  yerleştirme feature'larını değil. `minecraft:` namespace'li bir
  `places_feature` bu yüzden uyarı üretiyor, hata değil — bilinmeyene "geçti"
  denmiyor ama uydurma hata da üretilmiyor. Kapatmak için pipeline'ın
  bedrock-samples `features/` klasöründen indeks çıkarması gerekir.
- **`checkFileNames` yalnızca feature rule kuralını biliyor.** Başka dosya
  tipleri için benzer kurallar olabilir ama ölçülmedi. Ölçülmemiş kural
  kodlanmıyor.
- **Özel namespace'li kimlikler komut metninden doğrulanamıyor.** Aynı pakette
  tanımlanmışsa geçer, değilse uyarı üretir, hata değil. Komut GRAMERİ ayrı bir
  eksen ve doğrulanıyor — `docs/COMMANDS.md`.

Doğrulamanın sonucu bu tabloyla birlikte okunmalı: 20 fixture'ın hepsi doğru
sonuç veriyor, ama "doğrulamadan geçti" ile "oyunda çalışıyor" aynı şey değil.
CodeCraft'ın genel modellere üstünlüğü birinci sütunda değil, dördüncü
sütunda ne kadar yol aldığında.

## Tekrar üretmek için

```
npm run fixtures:pack -- --install
```

Sonra oyunda dünyayı aç, `%APPDATA%\Minecraft Bedrock\logs\ContentLog*.txt`
dosyasına bak. Ayarlar → Yaratıcı → "Content Log File" açık olmalı.

Günlük tamponlu yazılıyor: dünya yüklendikten hemen sonra bakılırsa satırlar
henüz düşmemiş olabilir. Oyunu kapatmak yerine birkaç saniye beklemek yeterli
(bu, ölçüm sırasında bir kez yanlış yorumlanıp fazladan bir yeniden başlatmaya
yol açtı).

Temizlik: `development_behavior_packs\codecraft-test-bp\` klasörünü sil.
