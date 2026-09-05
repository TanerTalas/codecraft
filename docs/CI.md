# CI ve bildirim zinciri

İki iş akışı var. Biri kodu ölçüyor, diğeri veriyi tazeleyip **kodun o veriye
karşı hâlâ doğru olduğunu** ölçüyor.

Var olma sebebi tek cümle: kaynaklar her sabah güncelleniyor, ve güncellenen
bir kaynak kodda yazılı bir varsayımı sessizce geçersiz kılabilir. `data/`'ya
her gün elle bakmak bir izleme stratejisi değil.

## `ci.yml` — her push ve PR

`dev`, `main` ve her PR'da `npm run typecheck` + `npm test`. Issue açmaz;
koşunun kırmızısı zaten görünür.

`actions/setup-python` **açıkça** kuruluyor: `validate_python` gerçek
yorumlayıcıyla ölçüyor ve `packages/validator/test/python.test.ts:88`
`syntaxChecked === true` diye sabitliyor. Yorumlayıcı yoksa o test düşer, ve
bunu runner imajının varsayılanına bırakmak ölçülmemiş bir bağımlılık olurdu.

> **05-09-2026'ya kadar depoda push/PR üzerine koşan hiçbir iş yoktu.**
> `npm test` yalnızca biri elle çalıştırınca koşuyordu. `docs/SOURCES.md`'de
> "ilk CI koşusu yeşil" diye kapatılmış madde **zamanlanmış veri işini**
> kastediyor, bunu değil.

## `data.yml` — günlük veri koşusu ve üç bildirim

Sıra: pipeline → commit + push → bayatlama → **doğrulama** → bildirim.

| Bildirim | Ne zaman | Issue başlığı |
|---|---|---|
| Pipeline patladı | `failure()` — upstream değişti, veri yazılamadı | `Veri pipeline'ı başarısız` |
| **Kod-veri tutarsız** | doğrulama adımı kırmızı | `Yeni veri kodla tutarsız` |
| **Yeni oyun sürümü** | `data:version` önce ≠ sonra | `Yeni Bedrock sürümü: X → Y` |

Başlıklar **bilerek ayrı**: tekilleştirme başlığa bakıyor ve bunlar farklı
arızalar. Üçü de `.github/scripts/notify-issue.sh` üzerinden gidiyor — aynı
başlıklı açık issue varsa yorum ekler, yoksa açar.

### Doğrulama adımı neyi ölçüyor

`pipeline:freshness` verinin **yapısal** olarak yerinde olduğunu ölçüyor
(dosyalar var mı, indeks sayıları tutuyor mu). Doğrulama adımı bambaşka bir
şeyi ölçüyor: kodun varsayımlarının hâlâ geçerli olduğunu.

Dedektör zaten yazılıydı, yalnızca bu koşuda hiç çalıştırılmıyordu: **19 test
dosyasının 11'i `data/` okuyor.** En keskini
`packages/mcp/test/feasibility.test.ts` — `ABSENT_APIS` listesini gerçek
`index.d.ts`'e karşı sınıyor. Mojang `SimulatedPlayer`'ı `@minecraft/server`
stable'a taşırsa `check_feasibility`'nin kuralı yalan olur ve bu test kırmızıya
döner. Testin kendi yorumu zaten bunu söylüyordu; eksik olan onu koşturmaktı.

### Testler kırmızıyken veri yine commit ediliyor

Bilinçli. Kırmızı test "veri yanlış" demek değil, "belgelenmiş bir varsayımımız
artık doğrulanmadı" demek — düzeltme kodda. Commit'i bloklamak üretimi bayat
veriyle dondururdu ve cron'un `main`'de koşmasının sebebi tam olarak verinin
orada taze olması.

Doğrulama adımı bu yüzden işi kırmızıya **düşürmüyor**, sonucu bir output'a
yazıyor: hem sonraki bildirim adımları koşabilsin hem de sürüm bildirimi
tutarsızlık varken de düşmesin.

### Gürültü ölçümü

"Testleri günlük koştur" adımının sahte alarm üretme riski ölçüldü,
05-09-2026. 14 test dosyasında sabit sürüm var ama ezici çoğunluğu
`format_version` (`1.21.100`, `1.8.0`, `1.13.0`) — CLAUDE.md'nin dediği gibi
ayrı bir eksen, oyun sürümüyle değişmiyor. Oyun sürümü pinleyen yalnız iki yer
var (`command.test.ts:26`, `command-identity.test.ts:14`, ikisi de `"1.26.40"`)
ve pipeline eski klasörü silmiyor, yani sürüm atlamasında ikisi de yeşil kalır.

### Sürüm özeti neden `buildContext`'i kullanıyor

`npm run version:summary -- <eski> <yeni>` issue gövdesini üretiyor ve
`packages/mcp/src/bedrock/context.ts`'teki `buildContext()`'i çağırıyor —
`get_version_info` aracının gövdesi zaten o. Ayrı bir özet yazmak, aracın
söylediğiyle issue'nun söylediğinin zamanla ayrışması demekti.

## Ölçümler — 05-09-2026

| Ne | Nasıl | Sonuç |
|---|---|---|
| `ci.yml` ilk koşusu | `b65a64d`, dal `dev`, koşu `33965413459` | **success** |
| `notify-issue.sh` üç dalı | sahte `gh`/`jq` PATH'e konup koşuldu | üçü de doğru |
| `version:summary` fark yolu | geçici `data/1.26.99.0/` klasörü | sürüm, modül ve yeni modül doğru göründü |
| Workflow YAML'ları | ayrıştırıldı, adım sırası okundu | ikisi de geçerli |

`notify-issue.sh` ölçümünün kapsamı dar ve öyle yazıldı: **kontrol akışı**
ölçüldü (issue yoksa aç + ata, varsa yalnız yorumla, atama patlarsa uyar ama
issue'yu bırak), gerçek `gh`/`jq` ve gerçek GitHub ölçülmedi — `gh` bu
makinede kurulu değil.

## Uçtan uca ölçüm — 05-09-2026

Üç `workflow_dispatch` koşusu, dal `dev`. `ABSENT_APIS`'e `Player` ekilip
(`.d.ts`'de 346 kez geçiyor) yol gerçekten koşturuldu, sonra geri alındı.

| Koşu | Ne ölçüldü | Sonuç |
|---|---|---|
| `33968087850` (kırıksız) | mutlu yol | koşu **yeşil**, doğrulama adımı 8 sn, üç bildirim de **skipped** |
| `33969468638` (kırıklı) | bildirim açılıyor mu | koşu **yeşil**, `Tutarsızlığı bildir` **koştu**, **issue #1 açıldı**, `TanerTalas`'a **atandı** |
| `33970399855` (kırıklı, ikinci) | tekilleştirme | **yeni issue AÇILMADI**, #1'e yorum eklendi |

Yeşil koşu + açılan issue doğru davranış: doğrulama adımı işi bilerek kırmızıya
düşürmüyor, yoksa bildirim adımları hiç koşmazdı.

**E-posta ölçüldü ve geldi.** `--assignee`'nin gerekçesi buydu ve karşılığını
verdi; watch ayarına bakılmadan çalıştığı doğrulandı.

Yan ürün: `ci` koşusu da aynı kırıkta kırmızıya döndü (`7491cec`), yani push
yolu da aynı kırığı yakalıyor.

### Ölçümün gösterdiği kusur

İlk issue'nun gövdesi ham `tail -n 60` idi ve 60 satırın ilk ~35'i **geçen**
testlerdi; hata en altta kalıyordu. Kayıp değildi ama okuyanı aratıyordu.
Gövde düzeltildi: önce `tests/pass/fail` sayıları, sonra yalnız `node --test`'in
sonda topladığı düşen testler bölümü, typecheck düşerse tsc kuyruğuna geri
çekilme. İkinci koşuda düzeltilmiş hâli doğrulandı.

## Ölçülmemiş olan

- **Sürüm bildiriminin uçtan uca koşusu.** `Yeni sürümü bildir` adımı üç
  koşuda da doğru şekilde atlandı ama hiç **tetiklenmedi** — tetiklenmesi için
  gerçek bir sürüm atlaması gerekiyor ve ucuz bir taklidi yok. Gövdeyi üreten
  `version:summary` yerelde ölçüldü (geçici `data/1.26.99.0/` klasörüyle);
  ölçülmemiş olan yalnızca workflow'un o adımı ateşlemesi.
- **Sürüm atlamasında pipeline'ın kendisi.** `data/` içinde bugüne kadar tek
  sürüm klasörü oldu (`1.26.40.5`, `165a71a`'da eklendi, hiç silinmedi) ve
  bütün cron commit'leri aynı sürüm için. Proje **hiç sürüm atlamasından
  geçmedi.** Bu iş yanlış giderse haber vermeyi kuruyor, doğru gideceğini
  garanti etmiyor.
- **`data/` büyümesi.** Sürüm klasörü başına 3.1 MB ve eski klasör silinmiyor.
  Bugün sorun değil (`.git` 17 MB), aylık atlamayla yılda ~37 MB. Budama
  politikası yok.

## Doğrulama adımı daha kurulurken bir şey buldu

**05-09-2026.** Yukarıdaki "bildirim yolu uçtan uca koşulmadı" maddesini
kapatmak için sahte bir kırık hazırlanıyordu: `ABSENT_APIS` listesine
`.d.ts` içinde gerçekten var olan bir ad konup testin kırmızıya döndüğü
görülecekti.

**Test kırmızıya dönmedi.** `Player` `.d.ts` içinde 346 kez geçiyor ve
"kuralların dayandığı API'ler tip tanımlarında gerçekten yok" testi yine geçti.

Sebep `packages/mcp/test/feasibility.test.ts:74`:

```js
new RegExp(`\b${name}\b`)   // şablon dizgesinde \b = BACKSPACE (U+0008)
```

Şablon dizgesinde `\b` kelime sınırı değil, backspace karakteri. Üretilen
desen `<BS>SimulatedPlayer<BS>` oluyordu, hiçbir metinde eşleşmiyordu,
`!test()` her zaman `true` dönüyordu. **Bütün yapılabilirlik kurallarının
dayandığı ölçüm bir no-op'tu.**

`String.raw` ile düzeltildi. Çift ters bölü de doğru olurdu ama aynı hatayı
tekrar yazmak kolay; `String.raw` kaçış sırasına tamamen bağışık.

> Bu satırın kendisi bir kez yanlış yazıldı: çift ters bölü örneği heredoc'tan
> geçerken tek ters bölüye indi ve cümle tam da hatalı biçimi "doğru" diye
> gösterir hâle geldi. Aynı sınıf, aynı gün, üçüncü kez.

### Vardığı sonuç yanlış değildi

Düzeltmeden sonra iki ölçüm koşuldu:

| Ölçüm | Sonuç |
|---|---|
| Sahte kırık (`Player` listede) | test **düşüyor**, mesaj doğru |
| Gerçek liste | test **geçiyor** |
| Bağımsız `grep -cw`, 12 adın hepsi | `.d.ts`'de **0** |

Yani kurallar doğruydu, dayanakları doğrulanmıyordu. Bu depoda ikisi ayrı şey
ve fark tam olarak burada görüldü.

Aynı hata başka yerde aranmadı değil: `new RegExp(<şablon>)` kullanan diğer
iki yer (`packages/validator/src/command.ts:269`,
`pipeline/src/script-types.ts:101`) çift ters bölü kullanıyor, ikisi de doğru.

### Kayda değer olan

Bu bulgu, doğrulama adımının **ilk kez koşmasından önce** geldi. Onu sınamaya
hazırlanmak, sınayacağı şeyin bozuk olduğunu ortaya çıkardı. Ölçüm yolunun
kendisini ölçmenin bedeli buydu ve bir kez daha karşılığını verdi —
`docs/mcp-kullanim.md`'deki curl prob dersinin aynısı, ters yönden.
