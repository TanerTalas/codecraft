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
- **Namespace toleransı tek yönlü.** `matchesEnum` değerden `minecraft:`
  soyuyor ama eklemiyor, yani tamamı önekli tutulan altı enumda çıplak değer
  reddediliyor (`/locate biome plains` → `ok=false`). Ölçüldü 02-09-2026;
  oyunun çıplak biçimi kabul edip etmediği ölçülmediği için değiştirilmedi.
  Ayrıntı "Kapatılan boşluk: `execute ... run`" bölümünün sonunda.

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

~~Ayrıca **eski veri değeri biçimi** (`minecraft:glass 0`) kabul ediliyor.~~
**Çürütüldü 01-09-2026, reddediliyor.** Gerekçe aşağıda, "Kanal farkı"
bölümünde: o kabul kararı WebSocket kanalında ölçülmüştü, sohbet reddediyor.

## Kapatılan boşluk: blok durumu SÖZDİZİMİ

Ayraç **iki nokta**, eşittir değil. Oyundan ölçüldü (30-08-2026):

| Biçim | Sonuç |
|---|---|
| `["facing_direction":0]` | **ayrıştı** |
| `["facing_direction"=0]` | `Syntax error: Unexpected "="` |
| `[facing_direction:0]` | `Syntax error: Unexpected "facing_direction"` — ad tırnaksız olamaz |
| `["facing_direction"]` | `Syntax error: Unexpected "]"` — değer zorunlu |
| `[]` | ayrıştı |
| `0` | ws'te ayrıştı, **sohbette HATA** — aşağıya bak |

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

> **Bu paragrafın sonucu 01-09-2026'da çürütüldü.** Ders yanlış değildi, ölçüm
> eksikti: hangi KANALDA ölçüldüğü sorulmamıştı. Ayrıntı bir alttaki bölümde.
> Doğrulayıcı bugün tam sayıyı **reddediyor**.

Durum kodlarının ayrımı da bu turda öğrenildi ve kendi başına önemli:

| Kod | Anlam |
|---|---|
| `-2147483648` | Ayrıştırılamadı — sözdizimi hatası |
| `-2147352576` | Ayrıştırıldı, çalıştı, sonuç boş |
| `0` | Ayrıştırıldı, başarılı |

İlk turda "negatif = hata" varsayılmıştı ve yanlış sonuca götürdü.

## Testler

`packages/validator/test/command.test.ts` — 32 test (ölçüldü 02-09-2026;
bu satır 28 diyordu), iki yön de ölçülüyor:
geçerli komutlar geçmeli, bozuk komutlar düşmeli, ve kapsam sınırı (hangi
tipler denetlenmiyor) sabitlenmiş. Eval tarafında `command-give-01` ve
`command-fill-01` vakaları `commandSyntax` kontrolünü istiyor; negatif kontrol
koşuldu — koordinat bileşeni silinince vaka kırmızıya döndü.

## Kapatılan boşluk: `execute ... run <komut>` zincirlemesi

**Bulundu 01-09-2026** (Aşama M3'te `validate_command` MCP'ye açılırken),
**kapatıldı 02-09-2026.**

Doğrulayıcı `execute`'un zincirleme biçimini çözmüyordu. `run` sonrasındaki
gerçek komutu fazladan argüman sayıyor, yani **geçerli bir komutu geçersiz
raporluyordu** — yanlış pozitif. Bulunduğu gündeki ölçüm:

```
/execute as @a run say hi          ok=false  arity: fazladan argüman: "say hi"
/execute as @a at @s run say hi    ok=false  arity: fazladan argüman: "@s run say hi"
/execute as @a run                 ok=true
/give @p diamond 1                 ok=true
```

**Neden özellikle kötüydü:** `execute ... run` Bedrock'un en yaygın komut
biçimlerinden biri. Model doğru yazdığı bir komutu "hatalı" görüp bozmaya
çalışır — CodeCraft'ın önlemek için var olduğu hatanın aynısı, ters yönden.

### Düzeltmeden önce iki ölçüm, ikisi de bu dosyayı yanlış çıkardı

**1. "18 aşırı yüklemesinin hepsinde" yanlıştı — doğrusu 17.** 18.'si zincirin
terminali ve başka bir tip taşıyor:

```
 0-16   subcommand:…  chainedCommand:EXECUTECHAINEDOPTION_0
   17   subcommand:OPTION_RUN  command:CODEBUILDERARGS
```

Bu ayrım düzeltmeyi belirledi: **iki tipe birden** dokunmak gerekiyordu.
Yalnızca birincisi ele alınsaydı `/execute run say hi` düşmeye devam ederdi.

**2. "Aynı biçime sahip başka komutlar da var" yanlıştı.** Bu dosya
`function`, `place`, `schedule`, `help`, `locate` ve `project`'i sayıyordu.
83 komutun tamamı tarandı: **`chainedCommand` yalnızca `execute`'ta var.**
Diğerleri `PATHCOMMAND` (fonksiyon yolu) ya da dolu bir enum (`COMMANDNAME`)
üzerinden gidiyor, zincirleme taşımıyorlar ve zaten doğru çalışıyorlardı.

Kapsam bu cümlenin ima ettiğinden çok daha dardı — ve o cümleye güvenip
düzeltmeyi altı komuta yaymak gereksiz yüzey açardı.

**3. Yanlış pozitif dokümandakinden genişti.** İki vaka hiç yazılmamıştı:

```
/execute run say hi                düşüyordu — zincirlemeyle ilgisi yok,
                                   terminal aşırı yüklemenin kendisi bozuktu
/execute as @a at @s run           düşüyordu — yani "zincir uzunluğu > 1 olan
                                   HER execute yanlış pozitif" demek daha doğru
```

### Düzeltme

`tryOverload` iki tipi de tanıyor ve özyineliyor
(`packages/validator/src/command.ts`):

| Tip | Kalan jetonlar neye karşı denenir |
|---|---|
| `EXECUTECHAINEDOPTION_0` | `execute`'un **kendi** aşırı yükleme tablosu |
| `CODEBUILDERARGS` | Başlı başına bir komut satırı |

İkisi tek bir sabit nokta: `run …` zaten o tablonun 18. satırı, yani ayrı bir
kural değil aynı tablonun bir dalı. Bugün:

```
/execute as @a run say hi                     ok=true
/execute as @a at @s run say hi               ok=true
/execute run say hi                           ok=true
/execute as @a run execute at @s run say hi   ok=true   (iç içe)
/execute if block ~ ~ ~ stone run say hi      ok=true
/execute if block ~ ~ ~ stone                 ok=true   (opsiyonel zincir)
/execute as @a run uydurmakomut               ok=false  unknown-command
```

Son satır kritik: özyineleme **her şeyi kabul ederek** de yeşil görünürdü.
Zincirin gövdesinin gerçekten doğrulandığı ayrıca ölçülüyor, ve hata indeksinin
gövdedeki jetonu gösterdiği de — kaydırma yanlış olsaydı kullanıcıya yanlış
argüman gösterilirdi ve bunu başka hiçbir test ölçmüyordu.

### Bir davranış tersine döndü

```
/execute as @a run        önce ok=true      şimdi ok=false
                          "eksik argüman: command (CODEBUILDERARGS)"
```

Bu dosya eski hâlinde o satırı **doğru davranış** diye gösteriyordu. Veri
aksini söylüyor: 18. aşırı yüklemede `command` zorunlu, yani `run`dan sonra
hiçbir şey gelmemesi geçerli değil.

> **Oyunda ölçüldü ve doğrulandı, 02-09-2026.** Sohbet kanalına yazıldı:
>
> ```
> /execute as @a run        Syntax error
> ```
>
> Yani oyun da reddediyor. Veriden çıkarılan sonuç (18. aşırı yüklemede
> `command` zorunlu) sohbet kanalıyla uyuşuyor; davranış tersine dönüşü doğru
> yönde. `ws:probe` değil **sohbet** kullanıldı — iki ayrıştırıcı aynı değil
> (`docs/WEBSOCKET.md`).

### Yan etki: yanlış pozitif riski yer değiştirdi

Zincir gövdesi artık doğrulandığı için, gövdedeki **her** doğrulayıcı boşluğu
`execute` satırlarına da bulaşıyor. Ölçülmüş somut örnek:

```
/locate biome plains    ok=false   "plains" biome için geçerli değil
```

`matchesEnum` namespace toleransı tek yönlü: değerden `minecraft:` **soyuyor**
ama **eklemiyor**. Altı enum tamamen önekli — `biome` (88), `features` (286),
`featurerules` (170), `structurefeature` (35), `jigsawstructure` (20),
`camerapresets` (7). Yani çıplak `plains` reddediliyor, ve artık
`/execute … run locate biome plains` de reddedilecek.

**Açık madde:** ters yön eklenmedi, çünkü oyunun çıplak `plains`'i kabul edip
etmediği ölçülmedi. Tek yönlülük bilinçli yazılmış bir karardı; ölçmeden
değiştirilmiyor.

## Kapatılan boşluk: boş enum her değeri reddediyordu

**Bulundu ve kapatıldı 01-09-2026, Aşama M5 senaryo 3'te** — gerçek bir Claude
oturumunda, planlanmamış bir yerden. Model `/tag @s add kutucu` önerdi,
doğrulayıcı reddetti:

```
argument: "kutucu" name için geçerli değil. Kabul edilenler:
```

"Kabul edilenler:" satırının arkası boş, çünkü liste gerçekten boştu.

**Sebep veride, ve veri eksik değil.** `commands.json`'ın 225 enum'undan
**dördü** kaynakta tamamen boş geliyor:

| Enum | Neyi listeler |
|---|---|
| `tagvalues` | Dünyadaki etiketler |
| `scoreboardobjectives` | Tanımlı skorbord hedefleri |
| `gametestname` | Kayıtlı gametest adları |
| `gametesttag` | Gametest etiketleri |

Dördü de oyunun **çalışma anında** dünyadan doldurduğu listeler. Mojang'ın
metadata'sı onları boş yayınlıyor çünkü değerleri dünyaya bağlı, şemaya değil.
Doğrulayıcı boşu "hiçbir değer geçerli değil" diye okuyordu; doğrusu "serbest
metin".

**Etkilenen dört komut** (83 komut tarandı) ve ikisi çok yaygın:

| Komut | Parametre |
|---|---|
| `/tag` | `name: TAGVALUES` |
| `/scoreboard` | `objective`, `targetObjective: SCOREBOARDOBJECTIVES` |
| `/execute` | `objective: SCOREBOARDOBJECTIVES` |
| `/gametest` | `testName`, `tag` |

Düzeltmeden önce ölçülen:

```
ok=false  /scoreboard objectives add kills dummy
ok=false  /scoreboard players add @s kills 1
ok=false  /tag @s add kutucu
ok=false  /tag @s remove kutucu
ok=true   /tag @s list          (bu aşırı yüklemede enum yok)
```

Sonra dördü de `ok=true`.

**Düzeltme dar:** `packages/validator/src/command.ts` içinde enum denetimi
yalnızca liste **doluysa** uygulanıyor; boş liste görülünce parametre yapısal
denetime düşüyor. Enum denetiminin geri kalanı gevşemedi ve bunu ölçen ayrı
bir test var — `/gamemode uydurmamod` ve `/fill … uydurma_mod` hâlâ
reddediliyor.

İki test eklendi, biri bilerek kırılarak doğrulandı: guard geri alınınca
yalnızca boş-enum testi kırmızıya döndü, regresyon bekçisi yeşil kaldı.

**Neden `execute … run` boşluğundan farklı.** O boşluk araç açıklamasında
yazılı ve model onu yok saymayı biliyor — senaryo 3'te üç kez tetiklendi ve
model doğru komutu korudu. Bu yazılıydı bile değildi; model yine yanılmadı ama
uyarı okuduğu için değil kendi muhakemesiyle. O yüzden bu boşluk belgelenmedi,
**kapatıldı**.

## Kanal farkı: `ws:probe` sohbetten daha gevşek

**Ölçüldü 01-09-2026, Aşama M5 senaryo 3.** Bu bölüm yalnızca bir komut
kuralını değil, **ölçüm yönteminin kendisini** düzeltiyor.

### Nasıl bulundu

Kullanıcı MCP üzerinden üretilen bir komutu oyunda denedi:

```
/fill ~-5 ~-1 ~-5 ~4 ~8 ~4 glass 0 outline
Syntax error: Unexpected "0": at " ~4 glass >>0<< outline"
```

Doğrulayıcı o komuta `ok=true` demişti. **Yanlış negatif** — bu proje için en
pahalı hata, çünkü kullanıcı araca güvenip komutu denedi.

### Dört hipotez, dördü de çürüdü

`ws:probe` ile iki tur ölçüldü (Bedrock 1.26.45):

| Hipotez | Ölçüm | Sonuç |
|---|---|---|
| H1 sürüm değişti | İki ölçüm de 1.26.45 | çürüdü |
| H2 komuta bağlı | `fill`, `setblock`, `testforblock` üçü de ayrıştı | çürüdü |
| H3 doldurma moduna bağlı | `replace`, `hollow`, `outline` üçü de ayrıştı | çürüdü |
| H4 bloğa bağlı | `air`, `glass`, `stone` üçü de ayrıştı | çürüdü |
| H5 bölge büyüklüğü | 1x1x1 ve 3x1x3 ayrıştı | çürüdü |

Yani `ws:probe` kullanıcının düşen komutunu **ayrıştırıyordu**.

### H6: kanal — doğrulandı

Geriye tek fark kaldı: probe komutu WebSocket üzerinden gönderiyor, kullanıcı
sohbete yazıyor. Aynı komutlar elle sohbete yazıldı:

| Komut | `ws:probe` | Sohbet |
|---|---|---|
| `testforblock ~ ~-1 ~ minecraft:acacia_button 0` | ayrıştı | **SÖZDİZİMİ HATASI** |
| `fill ~ ~ ~ ~ ~ ~ glass 0 outline` | ayrıştı | **SÖZDİZİMİ HATASI** |
| `fill ~ ~ ~ ~ ~ ~ glass 0 hollow` | ayrıştı | **SÖZDİZİMİ HATASI** |

Aynı oyun, aynı dünya, aynı oturum. **İki ayrıştırıcı aynı değil.**

Birinci satır kritik: 30-08-2026'da "int serbest" kararını kuran ölçümün
**birebir kendisi**. O ölçüm doğru yapılmıştı ve doğru sonuç vermişti — sadece
başka bir kanalın sonucuydu.

### Sonuç ve kural

Doğrulayıcı **sohbet/komut bloğu** kanalını hedefliyor, çünkü kullanıcı komutu
oraya yazıyor. Daha gevşek kanala göre doğrulamak yanlış negatif üretir.

Bugün:

```
/fill ~-5 ~-1 ~-5 ~4 ~8 ~4 glass 0 outline
  ok=false  eski veri değeri "0" sohbette kabul edilmiyor;
            blok durumu kullan: ["ad":değer]
/fill ~-5 ~-1 ~-5 ~4 ~8 ~4 glass outline        ok=true
```

**`ws:probe` ile ölçülen her kural artık sohbette de doğrulanmalı.** Alet
atılmıyor — hâlâ tek otomatik ölçüm yolu — ama tek başına yeterli değil.
`docs/WEBSOCKET.md` bu şerhi taşıyor.

### Açık kalan

**Script içinden çalışan komutlar (`dimension.runCommand`) hangi ayrıştırıcıyı
kullanıyor ÖLÇÜLMEDİ.** Üçüncü bir kanal olabilir. Ölçülmeden kural yazılmıyor;
bugünkü doğrulayıcı üçü için de sohbetin kuralını uyguluyor, yani en katı olanı.
