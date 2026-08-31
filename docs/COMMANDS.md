# Komut doğrulama

Bedrock komutları iki ayrı eksende yanlış olabiliyor ve ikisi ayrı ayrı
doğrulanıyor:

| Eksen | Ne sorar | Nerede |
|---|---|---|
| **Sözdizimi** | Argümanlar doğru sırada, sayıda ve biçimde mi | `validateCommand` |
| **Kimlik** | Referans verilen `minecraft:...` gerçekten var mı | `checkCommandIdentities` |

Biri diğerini kapsamıyor: `/give @s minecraft:ruby 1` sözdizimi olarak
kusursuz ama böyle bir item yok; `/setblock ~ ~1 minecraft:stone` ise
tamamen geçerli bir kimlik kullanıp koordinat bileşeni eksik bırakıyor.

## Kaynak

`Mojang/bedrock-samples` → `metadata/command_modules/mojang-commands.json`

Mojang'ın **makine okunur** komut tanımı. `pipeline/src/commands.ts` çekiyor,
`data/<sürüm>/commands.json` altına kompakt bir indeks türetiyor (açıklama
metinleri atılır — Mojang'ın prozası birebir commit edilmez, `docs/SOURCES.md`
içindeki aynı gerekçe). Ham dosya `pipeline/raw/` altında kalır.

```
npm run pipeline:commands
```

**Bu dosyanın varlığı bir kararı geçersiz kıldı.** `CLAUDE.md` komut sözdizimi
doğrulayıcısını "Yapılmayacaklar" tablosuna koymuştu ve gerekçesi "Bedrock
komut grameri için makine okunur resmi kaynak yok" idi. Gerekçe yanlıştı:
kaynak, zaten çektiğimiz deponun zaten kullandığımız `metadata/` klasöründe
duruyordu (30-08-2026'da bulundu).

## Ölçüler

| | |
|---|---|
| Komut | 83 |
| Aşırı yükleme (overload) | 270 |
| Parametre | 1.149 |
| Parametre tipi | 248 |
| Enum tablosundan gelen | 225 (14.067 değer) |
| Yapısal tip | 23 |

## Nasıl çalışıyor

1. **Sözcükleme.** Boşlukla bölmek yetmiyor — seçiciler (`@e[type=zombie,r=5]`),
   JSON gövdeleri, blok durumları ve tırnaklı metinler kendi içinde boşluk
   taşıyor. Parantez dengesi sayılarak bölünüyor, tırnak içindekiler
   sayılmıyor.
2. **Aşırı yükleme eşleştirme.** Komutun her biçimi denenir; biri uyarsa komut
   geçerlidir. Hiçbiri uymazsa en çok argüman tüketen adayın hataları
   raporlanır, beraberlikte "yanlış değer" hatası "eksik argüman"a yeğlenir —
   ilki neyin yanlış olduğunu söyler.
3. **Parametre genişliği.** Her parametre bir token tüketmiyor: `POSITION` üç
   (`fill from to` altı sayı alıyor), `MESSAGE_ROOT` satırın kalanını. Bu
   ölçülerek bulundu; bilmeden eşleştirmek her çok argümanlı komuta "fazladan
   argüman" dedirtiyordu.
4. **Enum eşleşmesi namespace'e toleranslı.** Enum değerleri namespace'siz
   tutuluyor (`speed`) ama oyunda `minecraft:speed` de geçerli; ikisi de
   kabul edilir.

## İlke: emin olmadığına hata deme

Yanlış pozitif burada en pahalı hata. Çalışan bir komuta "bozuk" demek, bozuk
bir komutu kaçırmaktan kötü — kullanıcı ilkinden sonra araca güvenmeyi
bırakır.

Bu yüzden **denetlenmeyen bir tip kabul edilir.** Gerçekten denetlenen tipler
`CHECKED_TYPES` içinde açıkça yazılı:

`INT`, `WILDCARDINT`, `POSITION`, `POSITION_FLOAT`, `FULLINTEGERRANGE`,
`SELECTION`, `WILDCARDSELECTION`, `OPERATOR`, `COMPAREOPERATOR`,
`BLOCK_STATE_ARRAY`, `postfix_t/s/d/l`

Denetlenmeyenler de gizlenmiyor, testte tek tek listeli:

`CODEBUILDERARGS`, `EXECUTECHAINEDOPTION_0`, `ID`, `JSON_OBJECT`,
`MESSAGE_ROOT`, `PATHCOMMAND`, `RAWTEXT`, `RVAL`, `VAL`

Liste küçüldükçe test güncellenir. Mojang yeni bir yapısal tip eklerse test
kırmızıya döner ve karar zorlanır — sessizce kabul edilmez.

## Bilinen boşluklar

- **Seçici filtre anahtarları doğrulanmıyor** (`type=`, `r=`, `scores=`).
  Mojang'ın tanımında yoklar.

## Kapatılan boşluk: seçici harfleri

Geçerli harflerin listesi Mojang'ın makine okunur tanımında yok. Elle yazmak
yerine **oyuna soruldu** (`npm run ws:probe`, Bedrock 1.26.x, 30-08-2026):

| Seçici | Sonuç |
|---|---|
| `@s` `@p` `@a` `@e` `@r` `@n` | kabul (statusCode 0) |
| `@z` `@x` `@q` | `Syntax error: Unexpected "@z"` |

`SELECTOR_LETTERS` bu ölçümden geliyor. Yeni bir sürümde harf eklenirse aynı
probe tekrar koşulur.

## Kapatılan boşluk: blok durumu DEĞERLERİ

`BLOCK_STATE_ARRAY` ayrıştırılıyor ve `data/<sürüm>/blocks.json` indeksine
karşı doğrulanıyor: durum adı o bloğa ait mi, değer kabul edilen kümede mi.
`["facing_direction":99]` yakalanır (0–5), `["uydurma_durum":1]` yakalanır.

Blok `minecraft:` dışı bir namespace'teyse **sessizce geçilir**: eklenti bloğu
olabilir ve komut grameri onu bilemez. Aynı ilke enum eşleşmesinde de var —
`/setblock ~ ~ ~ codecraft:ruby_ore` reddedilmiyor. Bu ölçülerek eklendi:
başta kullanıcının kendi bloğu "geçersiz" görünüyordu.

Ayrıca **eski veri değeri biçimi** (`minecraft:glass 0`) kabul ediliyor —
gerekçe aşağıdaki ölçüm bölümünde.

## Kapatılan boşluk: blok durumu SÖZDİZİMİ

Ayraç **iki nokta**, eşittir değil. Oyundan ölçüldü (30-08-2026):

| Biçim | Sonuç |
|---|---|
| `["facing_direction":0]` | **ayrıştı** |
| `["facing_direction"=0]` | `Syntax error: Unexpected "="` |
| `[facing_direction:0]` | `Syntax error: Unexpected "facing_direction"` — ad tırnaksız olamaz |
| `["facing_direction"]` | `Syntax error: Unexpected "]"` — değer zorunlu |
| `[]` | ayrıştı |
| `0` | ayrıştı — eski veri değeri |

Doğrulayıcının ilk hâli `=` bekliyordu ve **her iki yönde de yanlıştı**:
oyunun reddettiği biçimi geçiriyor, kabul ettiğini reddediyordu. Bu bir yanlış
negatif ve yanlış pozitifin aynı anda bulunması demekti; ikisini de ölçüm
düzeltti.

Durum adının kendisi iki nokta içerebiliyor (`"minecraft:cardinal_direction"`),
o yüzden ayraç kapanış tırnağından sonra aranıyor — baştan aramak adı ikiye
bölerdi.

## İlk gün ne yakaladı — ve ne yanlış yakaladı

Doğrulayıcı yazılır yazılmaz elle yazılmış bir eval fixture'ına itiraz etti:

```
/fill ~-5 ~ ~-5 ~5 ~4 ~5 minecraft:glass 0 hollow
```

Mojang'ın yayımladığı tanımda hiçbir `fill` aşırı yüklemesi blok adından sonra
tam sayı almıyor, yani eski `<data>` argümanı kaldırılmış görünüyordu. Fixture
"düzeltildi".

**Sonra oyuna soruldu ve tersi çıktı** (`npm run ws:probe`):

| Komut | Sonuç |
|---|---|
| `fill ... minecraft:air 0 replace` | **ayrıştı** (-2147352576) |
| `fill ... minecraft:air BOGUS replace` | sözdizimi hatası (-2147483648) |
| `fill ... minecraft:air replace` | ayrıştı |

Kontrol grubu belirleyici: sayı ayrışıyor, saçma değer ayrışmıyor. Gerçek
ayrıştırıcı geriye dönük uyumluluğu koruyor; yayımlanan tanım bunu anlatmıyor.

Fixture geri alındı, doğrulayıcı tam sayıyı kabul ediyor, ve ders teste
yazıldı: **yayımlanan tanım tek başına yeterli değil, ölçüm onun üstünde.**

Durum kodlarının ayrımı da bu turda öğrenildi ve kendi başına önemli:

| Kod | Anlam |
|---|---|
| `-2147483648` | Ayrıştırılamadı — sözdizimi hatası |
| `-2147352576` | Ayrıştırıldı, çalıştı, sonuç boş |
| `0` | Ayrıştırıldı, başarılı |

İlk turda "negatif = hata" varsayılmıştı ve yanlış sonuca götürdü.

## Testler

`packages/validator/test/command.test.ts` — 28 test, iki yön de ölçülüyor:
geçerli komutlar geçmeli, bozuk komutlar düşmeli, ve kapsam sınırı (hangi
tipler denetlenmiyor) sabitlenmiş. Eval tarafında `command-give-01` ve
`command-fill-01` vakaları `commandSyntax` kontrolünü istiyor; negatif kontrol
koşuldu — koordinat bileşeni silinince vaka kırmızıya döndü.

## Bilinen boşluk: `execute ... run <komut>` zincirlemesi

**Ölçüldü 01-09-2026, Aşama M3'te `validate_command` MCP'ye açılırken.**

Doğrulayıcı `execute`'un zincirleme biçimini çözmüyor. `run` sonrasındaki
gerçek komutu fazladan argüman sayıyor, yani **geçerli bir komutu geçersiz
raporluyor** — yanlış pozitif:

```
/execute as @a run say hi          ok=false  arity: fazladan argüman: "say hi"
/execute as @a at @s run say hi    ok=false  arity: fazladan argüman: "@s run say hi"
/execute as @a run                 ok=true
/give @p diamond 1                 ok=true
```

**Veri eksik değil.** `execute`'un 18 aşırı yüklemesinin hepsinde son parametre
`chainedCommand: EXECUTECHAINEDOPTION_0` olarak duruyor. Doğrulayıcı o
parametreye özyinelemiyor, tek bir jeton gibi tüketip duruyor. Yani düzeltme
sınırlı ve belirli bir yerde: zincirleme parametresi görüldüğünde kalan
jetonlar yeni bir komut satırı gibi yeniden ayrıştırılmalı.

Aynı biçime sahip başka komutlar da var ve hepsi taranarak bulundu —
`function`, `place`, `schedule` (`PATHCOMMAND`), `help` (`COMMANDNAME`),
`locate`, `project`. Bunlar `execute` kadar sık kullanılmıyor ama aynı yoldan
geçiyorlar.

**Neden yanlış pozitif özellikle kötü:** `execute ... run` Bedrock'un en yaygın
komut biçimlerinden biri. Model doğru yazdığı bir komutu "hatalı" görüp
bozmaya çalışır — CodeCraft'ın önlemek için var olduğu hatanın aynısı, ters
yönden.

**Bugünkü durum:** boşluk kapatılmadı, gizlenmedi. İki yerde yazılı:
`validate_command` aracının açıklamasında (model o biçimdeki arity hatasını
yok saysın diye) ve `packages/mcp/test/tools.test.ts` içinde bugünkü davranışı
sabitleyen bir testte. Doğrulayıcı düzeltilince o test kırmızıya döner ve
boşluğun kapandığı görülür — `cases.json`'daki `expect: "gap"` kalıbının aynısı.
