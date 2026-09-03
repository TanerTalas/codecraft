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

> Mesaj metni o gün Türkçeydi; araç yüzeyi aynı gün İngilizceye çevrildi
> (`CLAUDE.md`, "Dil"). Bugünkü karşılığı
> `"minecraft:heart_particle" does not exist in version 1.26.40.5`. Ölçümün
> kaydı olduğu için yukarıdaki satır olduğu gibi bırakıldı.

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

`checkReferences` ve `checkSounds` bulguları **warning**: ~~eksik bir loot
tablosunun oyunda ne yaptığı henüz ölçülmedi.~~ Parçacık düzeltmesi ise bir
ölçüme dayanıyor ve error tarafında duruyor — çünkü orada ölçülen şey aracın
kendi hatasıydı.

**Ölçüldü 03-09-2026 ve gerekçe değişti.** `codecraft:probe_loot`, olmayan bir
tabloya (`loot_tables/entities/codecraft_probe_missing.json`) işaret ederek
oyuna sokuldu; `/summon` ile doğuruldu, `/kill` ile öldürüldü (ölüm dumanı
görüldü, yani ölüm gerçekten oldu). `ContentLog`'un **tamamı** tarandı:

| Arama | Sonuç |
|---|---|
| `loot\|table` | yalnızca **yanlış eşleşme** — "destruc**table**" kelimesi |
| `error\|warning` (Sound gürültüsü hariç) | 12 satır: F, G, feature, recipe, icon ve script — **loot yok** |

Yani oyun eksik loot tablosuna **hiçbir seviyede tek satır yazmıyor.** Entity
yükleniyor, doğuyor, ölüyor; sadece hiçbir şey düşmüyor.

**Bu, F ve G'nin tersi bir sınıf.** Orada oyun reddediyordu ve severity
yükseldi. Burada oyun susuyor — ve susması "sorun yok" demek değil, bu deponun
var olma sebebi zaten sessiz başarısızlık. Warning kalıyor ama artık *başka*
bir sebeple: error'a yükseltmenin şartı, G'de olduğu gibi, **indeksin
eksiksizliğinin ölçülmesi**. 207 vanilla tablosunun tam olduğu doğrulanmadı;
eksikse her bulgu yanlış pozitif olur.

### İkinci kanıt (03-09-2026): feature rule → `places_feature`

Probe paketi oyuna yüklendiğinde `ContentLog` bu sınıftan **iki** hata daha
yazdı ve ikisi de probe değil, paketin kendi fixture'larıydı:

```
[FeatureRegistry][error]-My World | No definition found for feature
    'codecraft:ruby_ore_scatter'
[Recipes][error]-recipes/ruby_block.json | codecraft:ruby_block |
    The Item: codecraft:ruby_block is missing or invalid, can't make the recipe
```

İkincisi bu bölümün zaten kayıtlı kanıtı. **Birincisi yeni:** bir feature
rule'un işaret ettiği feature pakette tanımlı değilse oyun onu `error` olarak
yazıyor — yani `places_feature` de A sınıfının içinde ve sessiz değil.

Doğrulayıcı ikisini de **zaten yakalıyor** (03-09-2026'da paketin tamamı
`review`den geçirilerek ölçüldü):

```
ERROR [identity] feature_rules/ruby_ore_feature.json
  /minecraft:feature_rules/description/places_feature:
  "codecraft:ruby_ore_scatter" is not defined in any feature file
ERROR [identity] recipes/ruby_block.json
  /minecraft:recipe_shaped/result/item: "codecraft:ruby_block" is not defined in this pack
```

Yani kontrol doğru; **eksik olan üreteçte:** `build-test-pack.ts` yalnızca şema
ve `tsc` koşuyor, dosyalar arası kontrolleri koşmuyor. Bu yüzden bilinen iki
A sınıfı hatası paketle birlikte oyuna gitti ve günlüğe gürültü olarak düştü.
Ölçüm sırasında "bu satır probe'a mı ait, fixture'a mı" sorusu bu yüzden
soruldu. Üretecin bu kontrolleri koşup **beklenen gürültüyü önceden yazdırması**
gerekiyor — açık madde.

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

### Üçüncü kanıt (03-09-2026): oyun `error` diyor, biz de

Probe oturumunun günlüğünde bu sınıftan bir satır daha çıktı — yine probe
değil, fixture:

```
[Json][error]- -> components -> minecraft:icon:  Missing referenced asset ruby
```

`items/ruby.json` içindeki `minecraft:icon` `"ruby"` doku anahtarına işaret
ediyor ve o anahtar ne vanilla atlasında ne de pakette var. `checkAssets`
aynı dosyaya **error** veriyor (`texture key "ruby" is defined neither in the
vanilla atlas nor in this pack's own ...`).

Kayda değer olan eşleşme: bu sınıfta bizim severity'miz **error** ve oyunun
severity'si de `[Json][error]`. F'te aynı şey oldu. A'da ise oyun hiç
konuşmuyor ve biz warning'de duruyoruz. Üç sınıfın üçünde de bizim seviyemiz
oyunun davranışıyla aynı yönde — bu tesadüf değil, ölçülerek kuruldu.

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

> **Bu başlık 03-09-2026'da kısmen geçersizleşti.** Aşağıdaki ölçüme bak:
> `unknown-query` artık **error**, diğer üç tür warning kaldı. Aşağıdaki iki
> gerekçe o ölçümden önce yazıldı ve kaydı olarak duruyor.

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

### Ölçüldü 03-09-2026 — oyun reddediyor, sınıf error'a yükseldi

Probe paketi oyuna yüklendi (`blocks/probe_molang.json`, tek kasıtlı hata:
`query.is_babyy`). `ContentLog` dört satır birden yazdı:

```
[Molang][error] ... codecraft:probe_molang | components | query.is_babyy |
    Failed to resolve query query.is_babyy.  Either the query does not exist
    or it is not supported in this context.
[Molang][error] ... unrecognized token: query.is_babyy
[Blocks][error] ... permutation condition failed to parse
[Blocks][error] ... blocks/probe_molang.json | Block definition parsing failed
```

Sonuç tek bir satırdan ibaret değil: **blok tanımının tamamı düştü.** Bağımsız
doğrulaması da var — `/setblock ~ ~1 ~ codecraft:probe_molang` komutu
`Syntax error: Unexpected "codecraft:probe_molang"` verdi, yani blok oyunun
kayıt defterine hiç girmemiş. Kontrol grubu aynı oturumda koşuldu:
`/setblock ~ ~1 ~ stone` ve `/setblock ~ ~1 ~ codecraft:ruby_ore` **çalıştı**,
yani sorun paketin kendisinde ya da komut biçiminde değil, o dosyada.

**`molang:unknown-query` artık error.** Bu bölümün yukarıda yazdığı kriter
buydu ve karşılandı.

**Diğer üç tür warning kalıyor:** `unknown-math`, `removed-query`, `arity`.
Aynı arıza gibi duruyorlar ama aynı ölçümden geçmediler ve bu depoda "gibi
duruyor" bir gerekçe değil. Sonraki probe turunda ölçülebilirler.

> **Ölçüm bir sınır da gösterdi.** Oyunun mesajı "Either the query does not
> exist **or it is not supported in this context**" diyor. Yani var olan bir
> sorgu yanlış bağlamda yazıldığında da aynı hatayı veriyor; bizim kontrolümüz
> yalnızca VARLIĞA bakıyor, bağlama bakmıyor. Bu ikinci yarı ölçülmedi ve
> kapsam dışında — hangi sorgunun hangi bağlamda geçerli olduğunu söyleyen
> makine okunur bir kaynak bilinmiyor.

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

### Ölçüldü 03-09-2026 — oyun reddediyor, ama sınıf warning KALIYOR

Probe paketi oyuna yüklendi (`blocks/probe_component.json`, tek kasıtlı hata:
`minecraft:destructable`). `ContentLog`:

```
[Blocks][inform] ... codecraft:probe_component | components |
    minecraft:destructable | {}
[Blocks][error]  ... child 'minecraft:destructable' not valid here.
[Blocks][error]  ... blocks/probe_component.json | Block definition parsing failed
```

F ile aynı sonuç: **blok tanımının tamamı düşüyor**, blok kayıt defterine
girmiyor (`/setblock` sözdizimi hatası veriyor, kontrol blokları çalışıyor).

**Buna rağmen error'a yükseltilmedi.** Sebep aynı gün ölçüldü ve sayısı belli:

| | Sayı |
|---|---|
| Mojang'ın kendi şemasındaki entity bileşeni (`json_schemas/server/entity/1.26.40/Entity component definitions.json`) | **401** |
| Bizim `components.json` indeksimizde toplam (bileşen + AI hedefi + öznitelik + özellik) | 347 |
| **Şemada var, indekste YOK** | **126** |

`minecraft:health` bu 126'nın içinde — yani her vanilla mob'da geçen bir
bileşen. Bulunduğu yer de kayda değer: **hiçbir `doc_modules` dosyasında
geçmiyor.** İndeksin kaynağı olan dokümantasyon eksik, "geride kalmış" değil.

Ölçümün nasıl bulunduğu ayrıca anlamlı: bu yanlış pozitif, oyun ölçümü için
üretilen paketin kendi fixture'ında çıktı — `entities/guard.json` içindeki
`minecraft:health` uyarı olarak raporlandı.

**Sonuç:** oyun tarafı kanıtlandı ama kaynak tarafı kanıtlanmadı. Bugün error
yapmak 126 geçerli adı hataya çevirirdi ve C bölümünde ölçülen bedel tam
olarak budur — aracın kendi hataları modele "bu aracın hatalarını yok say"
öğretiyor.

**Yükseltmenin şartı artık ölçüm değil, veri:** `components.json` Mojang'ın
şemasındaki adlarla birleştirilsin, fark sıfıra insin. O olduğunda bu sınıf
error olur ve bu satır güncellenir.

Yan ürün: `metadata/engine_modules/engine-after-events-ordering.json` da
indeksleniyor (`data/<sürüm>/event-order.json`, 31 modül sürümü). D sınıfının
veri ayağı — hangi `afterEvent`'in var olduğu ve hangi sırada tetiklendiği
artık hatırlanmıyor, okunuyor.

---

## H · Sürüme bağlı zorunlu alan — şema geçiriyor, oyun yüklemiyor

**Bu sınıf 03-09-2026'da OYUN TARAFINDAN bulundu.** Ölçüm paketi temizlendikten
sonra kullanıcı günlüğü yeniden taradı ve tek bir satır kaldığını gördü:

```
[Recipes][error]-recipes/ruby_block.json | codecraft:ruby_block |
    1.20+ Recipes require unlock data
```

Tarif şemadan **temiz** geçmişti. Blockception `unlock`'u tanıyor — altı tarif
tipinin altısında da tanımlı — ama hiçbirinde **zorunlu** tutmuyor. Yani bu,
şemanın yapısal olarak yakalayamayacağı bir kural: zorunluluk dosya tipine
değil, dosyanın `format_version`'ına bağlı.

### Kapsam ölçüldü, tahmin edilmedi

Kuralı "her tarif unlock ister" diye yazmak kolaydı ve yanlış olurdu.
`Mojang/bedrock-samples`'tan 90 vanilla tarifi örneklendi (03-09-2026):

| Tip | `format_version` | `unlock` var / yok |
|---|---|---|
| shaped + shapeless | 1.12 ve 1.16 | **0 / 11** |
| shaped + shapeless | 1.20.10 ve üstü | **48 / 0** |
| brewing_mix | 1.20.10 | **0 / 4** |
| smithing_transform | 1.20.10 | **0 / 1** |
| furnace | her sürüm | hepsinde var |

İlk iki satır istisnasız: eşik gerçekten 1.20 ve oyunun mesajı da bunu
söylüyor. Üçüncü ve dördüncü satır kapsamı daraltıyor — brewing ve smithing
**modern formatta bile** `unlock` taşımıyor, onları kapsama almak her modern
brewing tarifine uydurma hata üretirdi. Furnace her sürümde taşıyor, yani
eksikliği sürümle açıklanamaz; ölçülmediği için kapsam dışında.

### Kontrol

`checkRecipes`, `packages/validator/src/checks.ts`. Yalnızca
`minecraft:recipe_shaped` ve `minecraft:recipe_shapeless`, yalnızca
`format_version >= 1.20`. Severity **error**: kanıt doğrudan oyundan ve sonucu
kesin — tarif hiç yüklenmiyor.

Mesaj çözümü de söylüyor, çünkü "eksik" demek tek başına ne yazılacağını
söylemiyor: `"unlock": [{ "item": "<id>" }]` ya da
`"unlock": { "context": "AlwaysUnlocked" }`.

### Nasıl bulundu — ve bu neden ayrıca kayda değer

Bu hata, **başka bir hata düzeltilene kadar görünmüyordu.** Tarif dosyası
30-08-2026'dan beri oyuna gidiyordu ama günlükte üstteki satır
`The Item: codecraft:ruby_block is missing or invalid` idi — sonucun item'ı
tanımlı olmadığı için oyun tarifi zaten reddediyordu. Eksik item eklenince
(03-09-2026) altındaki kural ortaya çıktı.

Ders ölçüm yöntemine ait: **bir günlükte hata kalmışken "başka hata yok"
denemez.** Hatalar birbirini gizliyor ve ancak üsttekiler temizlendikçe alttaki
görünüyor. Paketin temiz yüklenmesi bu yüzden yalnızca kozmetik değil, ölçüm
şartı.

## Özet

| Sınıf | Şema yakalar mı | Ne ölçüyor | Durum |
|---|---|---|---|
| A · kimlik referansı | Hayır, ama çözülebilir | `checkIdentities`, `checkCommandIdentities` | **Bulunuyor** — `review_pack` koşuyor, bulgu eyleme dönüştürülebilir metne giriyor |
| A' · yol / ses referansı | Hayır | `checkReferences`, `checkSounds` | **Bulunuyor, warning** — 03-09-2026'da ölçüldü: oyun hiçbir şey yazmıyor, sessiz başarısızlık |
| B · dosya adı kuralı | **Yapısal olarak hayır** | `checkFileNames` | **Bulunuyor** — doğru ad raporda söyleniyor |
| C · asset referansı | Hayır | `checkAssets` | **Bulunuyor** — vanilla doku indeksine karşı |
| D · geçerli ama yanlış | **Yapısal olarak hayır** | `checkPatterns` | **Bulunuyor + önceden anlatılıyor** — `patternGuide()` aynı tablodan besliyor |
| E · yüklenmeyen manifest | Hayır — eski tip listede | `checkManifest` | **Bulunuyor** — yanlış modül tipi rapor ediliyor |
| F · Molang | Hayır — string'in içine bakmıyor | `checkMolang` | **Bulunuyor** — `unknown-query` 03-09-2026'da oyunda ölçüldü ve **error**; diğer üç tür warning |
| G · bileşen adı | Hayır — iki kaynak da geçiriyor | `checkComponents` | **Bulunuyor, warning** — oyun 03-09-2026'da reddetti ama indekste 126 adlık ölçülmüş boşluk var |
| H · sürüme bağlı zorunlu alan | **Yapısal olarak hayır** — zorunluluk `format_version`'a bağlı | `checkRecipes` | **Bulunuyor, error** — 03-09-2026'da oyunda ölçüldü, tarif hiç yüklenmiyor |

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
> sonra kontrol yazıldı" sırasıyla geldi. F ve G ters yönden geldi: kaynak makine
> okunur olduğu için kontrol önce yazıldı, oyun ölçümü sonra yapıldı (03-09-2026).
>
> **Ölçüm ikisini ayırdı.** Oyun ikisini de aynı sertlikte reddetti — blok
> tanımının tamamı düşüyor. Ama F yükseldi, G yükselmedi: F'in kaynağı
> (`molang_modules`) bütün görünüyor, G'nin kaynağında (`doc_modules`) **126
> adlık ölçülmüş bir boşluk** var. Yani severity'yi belirleyen şey yalnızca
> "oyun ne yapıyor" değil, "bizim listemiz ne kadar eksiksiz" — ikisi ayrı
> sorular ve ikisi de ölçülmeden karar verilmiyor.

### Ölçüm — üç sınıfın üçü de koşuldu (03-09-2026)

> **Koşuldu, Bedrock, probe paketiyle.** Sonuçlar:
>
> | Sınıf | Oyun ne yaptı | Karar |
> |---|---|---|
> | **F · Molang** | Blok tanımının tamamını düşürdü, dört `error` satırı | **error'a yükseltildi** |
> | **G · Bileşen adı** | Blok tanımının tamamını düşürdü, iki `error` satırı | **warning kaldı** — indekste 126 adlık ölçülmüş boşluk var |
> | **A' · Yol referansı** | **Hiçbir şey yazmadı** — günlüğün tamamında loot'a dair tek satır yok | **warning kaldı, gerekçesi değişti** — oyun susuyor, sessiz başarısızlık |
>
> Ayrıntı: A, F ve G bölümlerindeki "Ölçüldü 03-09-2026" başlıkları.
>
> **Üçünden çıkan asıl ders severity'nin neye bağlı olduğu.** "Oyun ne yapıyor"
> tek başına yetmedi: F ve G'ye oyun aynı cevabı verdi ama biri yükseldi diğeri
> yükselmedi, çünkü ikincisinin KAYNAĞINDA ölçülmüş bir boşluk vardı. A' ise
> oyun hiç konuşmadığı hâlde silinmedi. Karar iki ayrı ölçümün kesişimi:
> oyunun davranışı **ve** bizim listemizin eksiksizliği.

**A', F ve G warning seviyesinde ve orada kalmalarının tek sebebi ölçüm
eksikliği.** Üçünün de kaynağı makine okunur ve kontrolleri testle sabitlendi,
ama hiçbirinin `ContentLog` kanıtı yok. *(Bu paragraf ölçümden önce yazıldı;
F ve G için artık geçerli değil, kaydı olarak duruyor.)*

**Hazırlık yapıldı 03-09-2026.** O güne kadar bu bölüm "fixture üreteci üç
vakayı taşımalı" diyordu; **taşımıyordu.** Yani belgelenen komut koşulsaydı
oyun oturumu hiçbir şey ölçmeden geçerdi. Üç probe artık üreteçte:

| Sınıf | Dosya | İçindeki kasıtlı hata |
|---|---|---|
| F · Molang | `blocks/probe_molang.json` | `query.is_babyy` (doğrusu `query.is_baby`) |
| G · Bileşen adı | `blocks/probe_component.json` | `minecraft:destructable` |
| A' · Yol referansı | `entities/probe_loot.json` | `loot_tables/entities/codecraft_probe_missing.json` |

Üçü **ayrı dosya ve ayrı kimlik**: tek dosyada toplansalardı günlükteki satırın
hangi sınıfa ait olduğu bilinemezdi. Üçü de **gerçekten yüklenen içerik** — iki
blok tanımı ve bir entity. Yüklenmeyen bir dosyada "oyun şikâyet etmedi" ile
"dosya hiç okunmadı" ayırt edilemez ve ölçüm boşa giderdi.

Üreteç iki şeyi birden ölçüyor ve ikisi de tutmazsa **hiçbir şey yazmıyor**:
probe şemadan geçmeli (yoksa oyuna hiç gitmez) ve kendi kontrolünü gerçekten
tetiklemeli (yoksa paket sessizce ölçmeyen bir pakete döner). Kontrol koşusu
03-09-2026'da yapıldı: üçü de bozukken 1 bulgu, düzeltilmiş hâlleriyle 0.

#### Koşmak için

```
npm run fixtures:pack -- --install --probe
```

**`--probe` gerekiyor ve bu 03-09-2026'da değişti.** Ölçüm yapılmadan önce
probe'lar varsayılan olarak açıktı; ölçüm yapıldıktan sonra varsayılan paketin
oyuna hata yazdırması için sebep kalmadı. Bayraksız koşu **temiz** paket verir,
`--probe` ölçümü yeniden üretir. Komut, kurulumdan sonra ne aranacağını da
yazdırıyor.

> **Üreteç artık dosyalar arası kontrolleri de koşuyor** (03-09-2026). Ölçüm
> sırasında paket iki bilinen A sınıfı hatasıyla oyuna gitti ve günlüğe gürültü
> düştü; "bu satır probe'a mı ait, fixture'a mı" sorusu bu yüzden soruldu.
> Artık beklenmeyen tek bir bulgu bile paketi **yazdırmıyor**, ve beklenenlerin
> sayısı kurulum çıktısında yazıyor.

Sonra oyunda dünyayı aç (Ayarlar → Yaratıcı → "Content Log File" açık olmalı)
ve `%APPDATA%\Minecraft Bedrock\logs\ContentLog*.txt` dosyasına bak:

| Sınıf | Aranan |
|---|---|
| F | `codecraft:probe_molang` veya `is_babyy` geçen satır |
| G | `codecraft:probe_component` veya `destructable` geçen satır |
| A' | `codecraft_probe_missing` geçen satır |

**A' için dünyada bir adım daha gerekiyor:** loot tablosu ölüm anında
çözülüyor, dosya yüklenirken değil.

```
/summon codecraft:probe_loot
```

sonra öldür.

**İki sonuç da kazanç:** oyun şikâyet ederse sınıf **error**'a yükseltilir;
etmezse "warning kalması doğruymuş" diye buraya yazılır. Ölçülmeden ikisi de
bilinmiyor.

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
