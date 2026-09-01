# Doğrulamanın yakalayamadıkları

Aşama 2 biterken şu soru açıktı: şemadan ve `tsc`'den geçen içerik oyunda
gerçekten çalışıyor mu? 30-08-2026'da ölçüldü. Cevap: **çoğu çalışıyor, ama
dört ayrı sınıf hata doğrulamadan geçip oyunda patlıyor.**

Bu doküman o sınıfları kaydeder. `docs/SOURCES.md` verinin nereden geldiğini
anlatır; burası doğrulamanın nerede bittiğini anlatır. Aşama 3'ün
niyet/yapılabilirlik katmanı ve Aşama 2.5'in eval seti buradaki maddeleri
hedef alacak.

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

→ Aşama 3: doğrulamadan sonra ikinci bir kimlik kontrolü.

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

→ Aşama 3: üretim tarafı dosya adını içerikten türetmeli. Doğrulama katmanının
işi değil, üretim katmanının işi.

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

**Kaynak paketi üretilmiyor.** Bunun yerine model yalnızca vanilla'da **zaten
var olan** bir doku anahtarına işaret edebiliyor. v1 kapsamı değişmedi.

Kaynak makine okunur ve doğrulandı — `Mojang/bedrock-samples@main` içinde
`resource_pack/textures/item_texture.json` (498 anahtar) ve
`terrain_texture.json` (1300 anahtar) var. Diğer dört sınıfla aynı düzen: tek
ölçüm üç yere birden bağlanıyor.

| Nerede | Ne yapıyor |
|---|---|
| `pipeline/src/textures.ts` | `data/<sürüm>/textures.json` üretiyor |
| `packages/validator/src/checks.ts` → `checkAssets` | ölçüyor |
| `packages/core/src/prompt.ts` | önceden anlatıyor |

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

### Güncelleme (01-09-2026, Aşama M5 senaryo 5): paket kendi atlasını getirirse

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

→ Aşama 2.5: eval setinde bu sınıftan vakalar olmalı, yoksa "validator geçti"
ölçütü yanıltıcı olur.
→ Aşama 3: bilinen kalıplar (karşılama mesajı, başlangıç kurulumu) prompt'ta
adıyla verilmeli.

## E. Şemadan geçen ama oyunun hiç yüklemediği manifest

**30-08-2026, Aşama 3'ün uçtan uca testinde ölçüldü.** Model şu modülü üretti:

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

→ `checkManifest` ölçüyor, `normalize()` düzeltiyor, prompt önceden anlatıyor.
Üçü de aynı ölçümden geliyor.

---

## Özet

| Sınıf | Şema yakalar mı | Ne ölçüyor | Durum |
|---|---|---|---|
| A · kimlik referansı | Hayır, ama çözülebilir | `checkIdentities`, `checkCommandIdentities` | **Aşama 3'te bağlandı** — `review()` koşuyor, bulgular retry'ın hata metnine giriyor |
| B · dosya adı kuralı | **Yapısal olarak hayır** | `checkFileNames` | **Aşama 3'te düzeltiliyor** — `normalize()` dosya adını identifier'dan türetiyor |
| C · asset referansı | Hayır | `checkAssets` | **Aşama 4'te kapatıldı** — vanilla doku indeksi; `review()` koşuyor, prompt anlatıyor |
| D · geçerli ama yanlış | **Yapısal olarak hayır** | `checkPatterns` | **Aşama 3'te prompt'a girdi** — `patternGuide()` aynı tablodan besliyor |
| E · yüklenmeyen manifest | Hayır — eski tip listede | `checkManifest` | **Aşama 3'te kapatıldı** — `normalize()` düzeltiyor, prompt anlatıyor |

Üç kontrol de `packages/validator/src/checks.ts` içinde, saf fonksiyon, model
çağrısı yok. Aşama 2.5'te yazıldılar ve eval seti onları koşuyor: `expect.checks`
alanı hangi kontrolün hangi vakada isteneceğini söylüyor
(`evals/cases/cases.json`).

İki sınır kayda geçmeli:

- **Vanilla feature'lar doğrulanamıyor.** `data/<sürüm>/features.json` yapı
  (structure) feature'larını tutuyor (17 kayıt), `ore`/`scatter` gibi
  yerleştirme feature'larını değil. `minecraft:` namespace'li bir
  `places_feature` bu yüzden uyarı üretiyor, hata değil — bilinmeyene "geçti"
  denmiyor ama uydurma hata da üretilmiyor. Kapatmak için pipeline'ın
  bedrock-samples `features/` klasöründen indeks çıkarması gerekir.
- **`checkFileNames` yalnızca feature rule kuralını biliyor.** Başka dosya
  tipleri için benzer kurallar olabilir ama ölçülmedi. Ölçülmemiş kural
  kodlanmıyor. `normalize()` de yalnızca bu kuralı düzeltiyor, aynı sebeple.
- **Komut sözdizimi hâlâ doğrulanmıyor.** `checkCommandIdentities` yalnızca
  kimliklere bakıyor; gramer v1 kapsamı dışında (`CLAUDE.md`). Özel
  namespace'li bir kimlik komut metninden doğrulanamaz — aynı üretimde
  tanımlanmışsa geçer, değilse uyarı üretir, hata değil.

Aşama 2'nin sonucu bu tabloyla birlikte okunmalı: 20 fixture'ın hepsi doğru
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
