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

→ Aşama 4'te kullanıcıya görünür bir not, ya da kapsam kararı.

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

---

## Özet

| Sınıf | Şema yakalar mı | Nerede çözülür |
|---|---|---|
| A · kimlik referansı | Hayır, ama çözülebilir | Aşama 3 — `lookup` ile ikinci kontrol |
| B · dosya adı kuralı | **Yapısal olarak hayır** | Aşama 3 — üretim tarafı |
| C · asset referansı | Hayır | Aşama 4 — kapsam kararı veya uyarı |
| D · geçerli ama yanlış | **Yapısal olarak hayır** | Aşama 2.5 eval + Aşama 3 kalıplar |

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
