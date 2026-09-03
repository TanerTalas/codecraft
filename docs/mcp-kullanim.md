# MCP sunucusunun gerçek kullanımı

docs/mcp-kullanim.md'nin ölçüm dosyası. `docs/SOURCES.md` verinin nereden geldiğini,
`docs/VALIDATION-LIMITS.md` doğrulamanın nerede bittiğini anlatır; burası
**araçların gerçek bir Claude oturumunda çağrılıp çağrılmadığını** kaydeder.

Şimdiye kadar ölçülen her şey sunucunun kendi ölçümüydü: probe script'i, birim
testleri, kendi yazdığımız istemci. Hiçbiri şunu ölçmedi — model bu araçları
kendiliğinden çağırıyor mu, hangi sırayla, ve çağırmadığında neden. Karar
sorusu tam olarak bu.

Ölçütün cümlesi: **çağrılmayan araç ya gereksiz ya da açıklaması
kötü.** İkisi farklı sonuç doğurur, o yüzden ayrıştırılmadan yazılmaz.

## Durum

**01-09-2026 — bağlayıcı bağlı, BİTİŞ KRİTERİ KARŞILANDI.** Altı senaryodan
**altısı da bitti.**

Koşulmamış senaryonun satırına sayı yazılmaz; "koşulmadı" bir eksiklik değil,
o satırın bugünkü doğru cevabı.

**Bitiş kriteri karşılandı** (senaryo 1, ikinci tur): gerçek bir Bedrock
isteği bağlayıcı üzerinden baştan sona doğrulanmış çıktı üretti — yedi
dosyalık, kurulabilir bir `.mcaddon`. `review_pack` `ok:true` döndü ve bu
sonuç bağımsız olarak tekrarlandı.

**Karşılanmayan:** paket Minecraft'a hiç yüklenmedi. `docs/VALIDATION-LIMITS.md`
tam bunun için var — "doğrulamadan geçti" ile "oyunda çalışıyor" aynı şey
değil.

## Nasıl ölçülecek

| | |
|---|---|
| İstemci | Claude Pro hesabı, **Customize > Connectors** özel bağlayıcı |
| Uç | `https://codecraft-ashy-seven.vercel.app/mcp` (production alias) |
| Bölge | `iad1` (`x-vercel-id: fra1::iad1::…`) |
| Veri | `data/1.26.40.5` |
| Sunucu | `codecraft`, sürüm `0.0.0`, sekiz araç, hepsi salt okunur |
| Senaryolar | Gerçek Bedrock isteklerinden altı vaka |
| Kayıt | Elle. Sunucuda loglama YOK, gerekçesi aşağıda |

**Neden elle.** Sunucu durumsuz ve her istekte yok ediliyor
(`packages/mcp/src/http.ts`), süreç içi sayaç tutulamaz. Vercel'in rota bazlı
logu hangi *aracın* çağrıldığını göstermez — araç adı JSON-RPC gövdesinin
içinde ve gövde loglanmıyor. Zaten asıl soru "kaç kez" değil "neden değil" ve o
cevap konuşmanın kendisini okumayı gerektiriyor.

## Taban çizgisi — bağlamadan önce

Bağlayıcı takılırsa hatanın sunucuda mı istemcide mi olduğu tartışmasız olsun
diye, bağlamadan önce ölçüldü. `npm run mcp:probe -- https://codecraft-ashy-seven.vercel.app/mcp`,
gerçek SDK istemcisi, dokuz kontrol:

```
bağlantı (initialize)            1626 ms
tools/list                       433 ms (soğuk), 216 ms (sıcak), 9036 bayt
validate_script (bozuk)          583 ms, 285 bayt   gerçek tsc tanısı
validate_script (geçerli)        407 ms, 144 bayt   ok:true
get_schema (en kalabalık düğüm)  333 ms, 15898 bayt tavanın altında, kesilmedi
get_version_info                 1.26.40.5
GET / DELETE                     405 + JSON gövde

HEPSİ YEŞİL
```

Aynı gün `npm run typecheck` exit 0, `npm test` **211/211**.

Yani M5 başlarken uç sağlam. Bundan sonra ölçülen her kırık, bağlayıcının ya da
modelin davranışıdır; sunucunun ayakta olmaması değil.

## Bağlayıcı bağlandı

**01-09-2026, Claude Pro, Customize > Connectors.** Özel bağlayıcı yukarıdaki
adresle eklendi ve araç izinleri ekranında göründü.

Ölçülen — tek bir "çalıştı" cümlesi değil, üç ayrı gözlem:

| Gözlem | Sonuç |
|---|---|
| Araç sayısı | **8**, eksiksiz |
| İstemcinin sınıflandırması | **"read only tools: 8"** — sekizin sekizi de salt okunur |
| Başlıklar | Bizim `title` alanlarımız görünüyor: "İstek Bedrock'ta yapılabilir mi" (`check_feasibility`), "Belge tipinin şema özeti" (`get_schema`) |

> **Başlıklar 02-09-2026'da İngilizceye çevrildi** — yukarıdaki satır o günkü
> ölçümün kaydı, bugünkü yüzey değil. Aynı araçlar artık "Can Bedrock do this"
> ve "Schema summary for a document type" diye görünüyor. Gerekçe: MCP'ye
> bağlanan model global (`CLAUDE.md`, "Dil").

İkinci satır kayda değer: `annotations: {readOnlyHint: true, openWorldHint:
false}` (`packages/mcp/src/tool.ts`) uçtan uca taşınıyor. M3'te kendi
testimizle ölçülmüştü; burada gerçek istemcinin onu okuyup **ayrı bir izin
sınıfı** olarak gösterdiği görüldü. Bağlanmadan önce bilinmiyordu.

Araç izinleri **"her seferinde sor"da bırakıldı**, "always allow"a
çevrilmedi. Tercih değil, yöntem: sunucuda log yok, onay istemi hangi aracın
hangi argümanla çağrıldığını gösteren tek kaçırılamaz kayıt.

## Araç kullanım tablosu

Sekiz satırın sekizi de burada duruyor, hiç çağrılmayanlar dahil. "Kendiliğinden"
sütunu kritik: araç adı telaffuz edilmeden çağrıldıysa `evet`, ancak zorlayınca
çağrıldıysa `hayır` — ikincisi "araç sağlam ama keşfedilmiyor" demektir ve
açıklama işidir.

**6 / 6 senaryo koşuldu — set tamamlandı.** Sayılar geçici, her senaryodan sonra güncelleniyor.
Senaryo 1 iki turda koştu (tek dosya → yedi dosyalık paket) ve iki turun
davranışı FARKLI; ayrım aşağıdaki notlarda.

| Araç | Çağrıldığı senaryo | Kendiliğinden | Not |
|---|---|---|---|
**Sekiz aracın sekizi de en az bir kez, kendiliğinden çağrıldı.** M5'in asıl
sorusunun cevabı bu: hiçbir araç "hiç çağrılmayan" değil. Dört senaryo sonunda:

| Araç | Çağrıldığı senaryo | Kendiliğinden | Not |
|---|---|---|---|
| `check_feasibility` | S2, S4, S5, S6 | evet | Dosya üretilen her senaryoda; yalnız komut isteğinde (S3) yok |
| `get_version_info` | S1, S2, S4, S5, S6 | evet | Dosya üretilen her senaryoda, hep üretimden önce |
| `get_schema` | S1, S5, S6 | evet | S5'te on kez, S6'da yalnız iki kez — sebebi aşağıda |
| `lookup_id` | S4, S5 | evet | İlk üç senaryoda hiç yoktu; son ikisinde her ikisinde de |
| `validate_json` | S1, S5, S6 | evet | S6'da **sekiz kez** — deneme-doğrulama döngüsü |
| `validate_command` | S2, S3, S4, S6 | evet | Üçünde beklenmiyordu bile |
| `validate_script` | S2, S4 | evet | Gerçek `tsc`, script üretilen her senaryoda |
| `review_pack` | S1, S2, S4, S5, S6 | evet | Dosya üretilen her senaryoda, hep son adım |

## Senaryo günlükleri

Altı vaka, her biri ayrı konuşmada, istek kendi cümlesiyle sorulacak — araç adı
telaffuz edilmeden. "Beklenen araçlar" bir tahmin, ölçüm değil; sapma çıkarsa
sapma yazılır, beklenti düzeltilmez.

### 1. `spawn-rule-01` — "Muhafız yaratığı gece yüzeyde doğsun"

**Bitiş kriterinin taşıyıcısı.** Tarihsel kırılma vakası: `format_version`
karışıklığı burada ölçülmüştü (CLAUDE.md). Ölçülen şey, sunucunun sürüm
yönlendirmesinin modele gerçekten ulaşıp ulaşmadığı.

Beklenen: `check_feasibility` → `get_version_info` → `get_schema` → `lookup_id`
→ `validate_json` → `review_pack`.

**Koşuldu, 01-09-2026.** Gerçekleşen zincir dört çağrı:

| # | Araç | Argüman |
|---|---|---|
| 1 | `get_version_info` | — |
| 2 | `get_schema` | `{type: "behavior/spawn_rules", path: "minecraft:spawn_rules/conditions"}` |
| 3 | `get_schema` | `{type: "behavior/spawn_rules"}` (kök) |
| 4 | `validate_json` | üretilen dosya |

Çağrılmayan üç araç: `check_feasibility`, `lookup_id`, `review_pack`.

**`format_version` doğru çıktı: `"1.8.0"`.** Tarihsel kırılmanın ölçüldüğü
nokta buydu ve bu koşuda tuttu — model oyun sürümünü değil, spawn rule
dosyasının kendi şema sürümünü yazdı. `get_version_info` zincirin ilk çağrısı
ve dosya yazılmadan önce geliyor, yani yönlendirme okunuyor.

### Modelin cümlesi bağımsız doğrulandı

Model "şemaya karşı doğruladım, temiz geçiyor" dedi. Bu cümle olduğu gibi kabul
edilmedi; aynı dört çağrı artı çağrılmayan ikisi dağıtılmış uçta tekrarlandı:

| Çağrı | Sonuç | Bayt |
|---|---|---|
| `get_schema(conditions)` | `required:[]`, `properties:[]`, `description:"UNDOCUMENTED."` | 307 |
| `get_schema(kök)` | `format_version` enum `["1.8.0","1.10.0","1.12.0"]` | 734 |
| `validate_json` | **`ok:true`**, `errors:[]` | 145 |
| `review_pack` *(çağrılmadı)* | **`ok:false`** | 832 |
| `lookup_id("custom:muhafiz")` *(çağrılmadı)* | `found:false` | 71 |

Modelin cümlesi doğru: dosya **şemadan** temiz geçiyor. Ama `review_pack`
çağrılsaydı dönecek olan:

```
BP/spawn_rules/muhafiz.json [identity]:
  - /minecraft:spawn_rules/description/identifier: "custom:muhafiz" pakette
    tanımlı değil. minecraft: dışı bir kimliği ancak paketin kendisi
    tanımlayabilir
    kanıt: docs/VALIDATION-LIMITS.md · A ("The Item … is missing or invalid")
```

**Çağrılmayan araç burada kozmetik değil, cevabın durumunu değiştiriyor.**
`validate_json` `ok:true`, `review_pack` `ok:false` — ikisi de doğru,
çünkü farklı şeylere bakıyorlar. Kullanıcıya giden cümle "temiz geçiyor" oldu.

Hakkını vermek gerek: model bu kusuru **kendi muhakemesiyle** yakaladı ve son
paragrafta sordu — "yaratığın gerçek identifier'ı ne? yoksa spawn rules hiçbir
şeye bağlanmaz". Yani doğru teşhis prozada var, araçtan gelmedi. Bir sonraki
koşuda aynı şansın tekrarlanacağı varsayılamaz; `review_pack` tam olarak bunu
mekanik hâle getirmek için var.

### Boşluk: `get_schema` dizi düğümlerinde boş özet döndürüyor

Model **doğru yolu** istedi (`minecraft:spawn_rules/conditions`) ve eli boş
döndü — sonra köke geri çıktı. Sebep ölçüldü, şemada eksiklik yok:

```
conditions.type            = "array"
conditions.properties      = 0 alan
conditions.items.properties = 22 alan
  minecraft:biome_filter, minecraft:brightness_filter, minecraft:delay_filter,
  minecraft:density_limit, minecraft:difficulty_filter, minecraft:herd, …
```

`summarizeSchema` (`packages/validator/src/schema-summary.ts`) yalnızca
`properties` üzerinde yürüyor, dizi düğümlerinde `items` içine inmiyor. 22
spawn koşulu bileşeninin hepsi orada duruyor ve hiçbiri döndürülmüyor.

Sonucu **hatadan kötü**: araç "burada alan yok" diyor, "bakamıyorum" demiyor.
M3'te `get_schema` tasarlanırken "ilk 60 alanı göster, sus" yolu tam bu
gerekçeyle reddedilmişti — model olmayan alanların var olmadığını sanmasın
diye. Dizi düğümlerinde o hata yine de yapılıyor.

**Bu koşuda ne oldu:** model altı koşul bileşenini (`spawns_on_surface`,
`brightness_filter`, `difficulty_filter`, `weight`, `herd`,
`biome_filter`) şemadan değil **kendi belleğinden** yazdı. Altısı da doğru
çıktı ve `validate_json` onları ajv ile tam şemaya karşı denetleyip geçirdi —
yani ağ tutmadı çünkü düşen olmadı. Ama üretim anında modele rehberlik eden
şema yoktu; yakalayan şey üretimden sonraki doğrulama oldu.

Düzeltmenin yeri `packages/validator`, MCP değil.

#### İkinci tur — paket tamamlandı, bitiş kriteri karşılandı

Modelin kendi sorusuna doğal cevap verildi ("yaratığı da sen oluştur,
identifier'ı sen seç"). Yönlendirme yok, araç adı telaffuz edilmedi.

Zincir altı çağrı:

| # | Araç | Argüman |
|---|---|---|
| 1 | `get_schema` | `{type: "behavior/entities"}` |
| 2 | `get_schema` | `{type: "behavior/entities", path: "minecraft:entity"}` |
| 3 | `validate_json` | behavior entity |
| 4 | `validate_json` | resource client entity |
| 5 | `validate_json` | render controllers |
| 6 | **`review_pack`** | paketin tamamı |

**`review_pack` bu turda kendiliğinden çağrıldı.** Birinci turda çağrılmamıştı.
Aradaki tek fark ortada gerçek bir paket olması: 1 dosya → 7 dosya, tek belge
tipi → üç belge tipi, iki ayrı pack. Yani ilk turdaki eksik "aracın
keşfedilmemesi" değil; tek dosyada model doğrulamayı zaten `validate_json` ile
yapmış sayıyor. **Tek gözlem yeterli veri değil**, ama şu ana kadarki
en açıklayıcı hipotez bu ve kalan beş senaryo onu sınayacak.

**Bağımsız doğrulama.** `.mcaddon` açıldı, yedi dosya olduğu gibi dağıtılmış
uca gönderildi:

```
ok=true  validation=true  measured=true  ·  956 bayt  ·  bulgu 0

OK  muhafiz_bp/entities/muhafiz.json                         [behavior/entities/entities]
OK  muhafiz_bp/manifest.json                                 [general/manifest]
OK  muhafiz_bp/spawn_rules/muhafiz.json                      [behavior/spawn_rules/spawn_rules]
OK  muhafiz_rp/entity/muhafiz.entity.json                    [resource/entity/entity]
OK  muhafiz_rp/manifest.json                                 [general/manifest]
OK  muhafiz_rp/render_controllers/muhafiz.render_controllers.json
OK  muhafiz_rp/texts/en_US.lang                              [atlandı — doğrulayıcı yok]
```

Modelin "hata yok" cümlesi doğru çıktı. Birinci turdaki kimlik bulgusu da
kapandı: spawn rule artık `codecraft:muhafiz` diyor ve o kimliği paketin
kendisi tanımlıyor.

**Beş sürüm ekseninin beşi de doğru** — CodeCraft'ın var olma sebebi tam olarak
bu tablonun karışması:

| Alan | Değer | Doğru mu |
|---|---|---|
| manifest `format_version` | `2` | ✓ manifestin kendi şema sürümü |
| `min_engine_version` | `[1, 26, 40]` | ✓ üç parçalı dizi, oyun sürümü |
| behavior entity `format_version` | `"1.21.100"` | ✓ |
| client entity `format_version` | `"1.8.0"` | ✓ |
| render controllers `format_version` | `"1.10.0"` | ✓ |
| spawn rules `format_version` | `"1.8.0"` | ✓ |

Pazarlama numarası (`26.40`) hiçbir alana yazılmadı. BP'nin `dependencies`
girdisi RP'nin header UUID'sine işaret ediyor, dört UUID de birbirinden farklı.

**Ağın gerçekten tuttuğu ölçüldü.** "`ok:true` gördük" tek başına, hiçbir şeyi
denetlemeyen bir yoldan da gelebilirdi. İki uydurma bileşen enjekte edildi:

```
spawn rule + "minecraft:uydurma_filtre"   -> ok=false
   must NOT have additional properties: "minecraft:uydurma_filtre"
entity     + "minecraft:uydurma_bilesen"  -> ok=false
   must NOT have additional properties: "minecraft:uydurma_bilesen"
```

Şema `additionalProperties: false` taşıyor, yani uydurulmuş bileşen adı
sessizce geçmiyor. Ayrıca modelin kullandığı altı spawn koşulu bileşeninin
altısı da düğümün gerçek 22 bileşeninin içinde.

**Ölçülmeyen — ve bu kayda geçiyor:** paket Minecraft'a yüklenmedi. Modelin
kendi söylediği bir sınır da var ve doğru: kendi geometrisi ve dokusu olmadığı
için vanilla zombie modelini kullanıyor. `.mcaddon` depoya girmiyor
(`.gitignore` `*.mcaddon`), doğru davranış.

### 2. `chain-mining-01` — "Kırdığım bloğun aynı türden komşularını da kırsın"

Script yolu. Ezberden yazılan `@minecraft/server` API'si en sık sessiz hata
kaynağı; `validate_script` bunu yakalamak için var.

Beklenen: `check_feasibility`, `validate_script`.

**Koşuldu, 01-09-2026.** Sekiz çağrı, altı ayrı araç:

| # | Araç | Not |
|---|---|---|
| 1-2 | `check_feasibility` | **iki kez** |
| 3 | `get_version_info` | |
| 4 | `validate_command` | beklenmiyordu |
| 5-6 | `validate_script` | iki kez |
| 7 | `review_pack` | paketin tamamı |

Çağrılmayan üç araç: `get_schema`, `lookup_id`, `validate_json`.

Üretilen: `manifest.json` + `scripts/main.js` (zincirleme kazma,
`playerBreakBlock` → genişlik öncelikli arama → `setblock … air destroy`,
iş `system.runJob` ile tick'lere bölünmüş).

**`check_feasibility` açık maddesi kapandı.** Senaryo 1'in iki turunda da
çağrılmamıştı ve "belki keşfedilmiyor" diye açık madde yazılmıştı. Burada iki
kez çağrıldı. Yani araç sağlam; S1'deki yokluğu isteğin biçiminden geliyor —
tek bir JSON dosyası için yapılabilirlik sorusu zaten sorulmuyor.

**`validate_command` beklenmiyordu ve tam da işe yaradı.** Bu bir script
senaryosu, komut senaryosu değil; ama script içinde `setblock … air destroy`
çalıştırılıyor ve model o satırı doğrulayıcıdan geçirmiş. Bağımsız tekrarlandı:

```
validate_command("setblock 1 2 3 air destroy")  ->  ok=true  requiresCheats=true
```

Modelin kullanıcıya yazdığı üçüncü uyarı ("setblock cheat gerektiriyor, dünyada
cheats kapalıysa ilk bakılacak yer burası") **doğrudan bu araç çıktısından
geliyor**. Ölçülen en somut değer bu: araç, modelin kendi başına söylemeyeceği
bir şeyi söyletti.

**Bağımsız doğrulama.** İki dosya olduğu gibi dağıtılmış uca gönderildi:

```
validate_script -> ok=true, 0 hata
   @minecraft/server 2.9.0, @minecraft/common 1.3.0, @minecraft/server-ui 2.1.0
review_pack     -> ok=true, 0 bulgu
   OK  manifest.json      [json]   general/manifest
   OK  scripts/main.js    [script] @minecraft/server@2.9.0
```

Modelin "hatasız geçti" cümlesi doğru. Manifest'te `"type": "script"` +
`"language": "javascript"` yazılı — `docs/VALIDATION-LIMITS.md` sınıf E tam
olarak bunun tersinin (`"type": "javascript"`) hiçbir belirti vermeden
sessizce yüklenmemesiydi. Doğru yazılmış.

**`lookup_id` yine hiç çağrılmadı ve bu ikinci senaryo.** Script dört vanilla
kimlik içeriyor (`minecraft:bedrock` DENY_LIST'te, `minecraft:coal_ore`,
`minecraft:deepslate_coal_ore`, `minecraft:oak_log` örnekte). Dördü de
sonradan kontrol edildi ve **dördü de gerçek**:

```
VAR minecraft:bedrock              kind=block
VAR minecraft:coal_ore             kind=block
VAR minecraft:deepslate_coal_ore   kind=block
VAR minecraft:oak_log              kind=block
```

Yani çağrılmaması bu koşuda bir şeye mal olmadı — ama **doğrulanmadı da**,
model belleğine güvendi ve tuttu. `lookup_id` artık "keşfedilmiyor"
hipotezinin en güçlü adayı; kontrol koşusu onu sınayacak.

**Ölçülmeyen:** paket oyunda çalıştırılmadı. Modelin kendi saydığı üç sınır
(`setblock destroy` Fortune/Silk Touch'ı yok sayıyor, alet dayanıklılığı
düşmüyor, cheats gerekiyor) doğrulamanın değil oyun davranışının konusu —
`docs/VALIDATION-LIMITS.md` sınıf D. Ne `tsc` ne şema bunları görebilir.

### 3. `command-fill-01` — "Etrafıma on çarpı on camdan bir kutu yap"

Komut yolu ve blok kimliği.

Beklenen: `validate_command`, `lookup_id`.

**Koşuldu, 01-09-2026.** İki tur, dört çağrı, **tek araç**:

| Tur | Araç | Kez |
|---|---|---|
| 1 (kutu) | `validate_command` | 2 |
| 2 (execute ile sarmala) | `validate_command` | 2 |

Başka hiçbir araç çağrılmadı — dosya üretilmediği için `review_pack`
uygulanmıyor, ama `lookup_id` yine yok (üçüncü senaryo).

Üretilen: `/fill ~-5 ~-1 ~-5 ~4 ~8 ~4 glass 0 hollow`, sonra
`/execute as @s at @s run fill …`.

#### Bilinen boşluk gerçek kullanımda: model YANILMADI

Mikro kontrolün ölçtüğü şey buydu ve sonuç net. Aynı komutlar dağıtılmış uçta
tekrarlandı:

```
ok=true   /fill ~-5 ~-1 ~-5 ~4 ~8 ~4 glass 0 hollow
ok=FALSE  /execute as @s at @s run fill ~-5 ~-1 ~-5 ~4 ~8 ~4 glass 0 hollow
            arity: fazladan argüman: "@s run fill ~-5 ~-1 ~-5 ~4 ~8 ~4 glass 0 hollow"
ok=FALSE  /execute as @a[name="…"] at @s run fill …      (aynı hata)
ok=FALSE  /execute as @a[tag=kutucu] at @s run fill …     (aynı hata)
```

Yanlış pozitif **üç kez** tetiklendi. Model üçünde de doğru komutu kullanıcıya
verdi, hiçbirinde "hata var" demedi, komutu bozmaya çalışmadı.

`docs/COMMANDS.md` bu riski şöyle yazmıştı: "model doğru yazdığı bir komutu
hatalı görüp bozmaya çalışır — CodeCraft'ın önlemek için var olduğu hatanın
aynısı, ters yönden." **Olmadı.** Aracın açıklamasındaki uyarı
(`packages/mcp/src/tools/command.ts`: "BİLİNEN BOŞLUK … o biçimdeki arity
hatasını yok say") işini gördü. Azaltma yöntemi ölçülerek doğrulanmış oldu.

Bu boşluğun kapatılması gerektiğini değiştirmiyor — yalnızca bugünkü zararının
ölçülmüş olduğunu söylüyor.

#### YENİ boşluk: boş enum her değeri reddediyor

Bu M5'in aradığı türden bir bulgu — gerçek kullanımda, planlanmamış bir yerden
çıktı. Model ikinci turda `/tag @s add kutucu` önerdi ve doğrulayıcı onu da
reddetti, ama **farklı** bir sebeple:

```
ok=FALSE  /tag @s add kutucu
            argument: "kutucu" name için geçerli değil. Kabul edilenler:
```

"Kabul edilenler:" satırının arkası boş. Sebep veride: `commands.json`'ın 225
enum'undan **dördü tamamen boş** — `tagvalues`, `scoreboardobjectives`,
`gametestname`, `gametesttag`. Bunlar oyunun **çalışma anında** doldurduğu
listeler (dünyadaki etiketler, skorbord hedefleri); Mojang'ın metadata'sı
onları boş yayınlıyor, çünkü değerleri dünyaya bağlı.

Doğrulayıcı boş enum'u "hiçbir değer geçerli değil" diye okuyor. Doğrusu
"serbest metin, çalışma anında dolar" olmalı.

**Etkilenen dört komut** (83 komut tarandı):

| Komut | Parametre |
|---|---|
| `/tag` | `name: TAGVALUES` |
| `/scoreboard` | `objective`, `targetObjective: SCOREBOARDOBJECTIVES` |
| `/execute` | `objective: SCOREBOARDOBJECTIVES` |
| `/gametest` | `testName`, `tag` |

İlk ikisi çok yaygın. Ölçüldü:

```
ok=FALSE  /scoreboard objectives add kills dummy
ok=FALSE  /scoreboard players add @s kills 1
ok=FALSE  /tag @s add kutucu
ok=FALSE  /tag @s remove kutucu
ok=true   /tag @s list          (bu aşırı yüklemede enum yok)
ok=true   /give @p diamond 1
```

`execute … run` boşluğundan **ayrı** bir hata sınıfı ve bir bakımdan daha
kötü: o boşluk araç açıklamasında yazılı, model onu yok saymayı biliyor. Bu
yazılı değil. Bu koşuda model yine yanılmadı ve doğru komutu verdi, ama bunu
uyarı okuduğu için değil kendi muhakemesiyle yaptı.

**Ölçülmeyen:** hiçbir komut oyunda çalıştırılmadı. Modelin "10 çift sayı
olduğu için tam ortada duramazsın" ve "komut bloğunda `@s` blok olur"
uyarıları doğru görünüyor ama doğrulayıcının konusu değil.

#### Sonra kullanıcı komutu OYUNDA denedi — ve düştü

Yukarıdaki "ölçülmeyen" maddesi aynı gün ölçüldü ve M5'in en değerli bulgusunu
verdi. Kullanıcı komutu sohbete yazdı:

```
/fill ~-5 ~-1 ~-5 ~4 ~8 ~4 glass 0 outline
Syntax error: Unexpected "0": at " ~4 glass >>0<< outline"
```

Doğrulayıcı o komuta `ok=true` demişti. **Yanlış negatif** — bu proje için en
pahalı hata, çünkü kullanıcı araca güvenip komutu denedi. `docs/COMMANDS.md`
yanlış pozitifi "en pahalı" sayıyordu; bu turda tersi ölçüldü.

**Beş hipotez kuruldu, beşi de çürüdü** (`ws:probe`, iki tur, Bedrock 1.26.45):
sürüm değil, komut değil, doldurma modu değil, blok değil, bölge büyüklüğü
değil. Alet kullanıcının düşen komutunu **ayrıştırıyordu**.

**Geriye kanal kaldı ve doğrulandı.** Aynı komutlar elle sohbete yazıldı:

| Komut | `ws:probe` | Sohbet |
|---|---|---|
| `testforblock ~ ~-1 ~ minecraft:acacia_button 0` | ayrıştı | **HATA** |
| `fill ~ ~ ~ ~ ~ ~ glass 0 outline` | ayrıştı | **HATA** |
| `fill ~ ~ ~ ~ ~ ~ glass 0 hollow` | ayrıştı | **HATA** |

Aynı oyun, aynı dünya, aynı oturum. **WebSocket ve sohbet aynı ayrıştırıcı
değil.** Birinci satır, 30-08-2026'da "int serbest" kaçamağını kuran ölçümün
birebir kendisi — o ölçüm yanlış yapılmamıştı, sadece başka bir kanalın
sonucuydu ve hangi kanal olduğu sorulmamıştı.

Bu yalnızca bir komut kuralını değil **ölçüm yönteminin kendisini** düzeltti:
`ws:probe` ile ölçülen hiçbir kural sohbette tekrarlanmadan yazılamaz.
`docs/WEBSOCKET.md` artık bu şerhi taşıyor, geçmişe dönük olarak.

**Bulunuş biçimi kayda değer.** Bu boşluğu ne birim testi ne şema ne `tsc`
bulabilirdi; ancak biri üretilen çıktıyı gerçekten kullanınca ortaya çıktı.
Karar dokümanının dördüncü gerekçesi ("ürünü test etmenin en iyi yolu kendim
kullanmak") bu tek bulguyla karşılığını verdi.

#### İki düzeltme, dağıtılmış uçta doğrulandı

| Komut | Önce | Sonra |
|---|---|---|
| `/scoreboard objectives add kills dummy` | `ok=false` | **`ok=true`** |
| `/scoreboard players add @s kills 1` | `ok=false` | **`ok=true`** |
| `/tag @s add kutucu` | `ok=false` | **`ok=true`** |
| `/fill … glass 0 outline` | `ok=true` | **`ok=false`** + ne yapılacağı |
| `/testforblock … acacia_button 0` | `ok=true` | **`ok=false`** |
| `/fill … glass outline` | `ok=true` | `ok=true` |
| `/gamemode uydurmamod` | `ok=false` | `ok=false` |

Dokuz kontrolün dokuzu da beklendiği gibi, `npm run mcp:probe` 9/9 yeşil.
`npm test` **218/218**.

Reddedilen komutun mesajı eyleme dönüştürülebilir:

```
eski veri değeri "0" sohbette kabul edilmiyor; blok durumu kullan: ["ad":değer]
```

Çürüyen test silinmedi, üstü çizilip nereye gittiği yazıldı — bu deponun
"yanlış çıkan ölçüm silinmez" kuralı.

**Açık kalan:** script içinden çalışan komutlar (`dimension.runCommand`) hangi
ayrıştırıcıyı kullanıyor **ölçülmedi**. Üçüncü bir kanal olabilir ve bu teorik
bir soru değil — senaryo 2'nin ürettiği script tam da onu kullanıyor. Bugün
doğrulayıcı üçüne de en katısını, sohbetin kuralını uyguluyor.


### 4. `python-afk-fish-01` — "Ben klavyeye dokunmadan otomatik balık tutsun"

Engellenen yol. Girdi simülasyonu Bedrock script API'sinde yok;
`check_feasibility` engelleyip dışarıdan çalışan Python'a yönlendirmeli.

Beklenen: `check_feasibility` (engelli sonuç).

**Koşuldu, 01-09-2026.** Altı araç:

`check_feasibility` → `get_version_info` → `validate_command` → **`lookup_id`**
→ `validate_script` → `review_pack`

**`lookup_id` nihayet çağrıldı.** Üç senaryo boyunca hiç çağrılmamıştı ve
"keşfedilmiyor" hipotezinin tek gerçek adayıydı. Dördüncü kez aynı ders:
**bir araç henüz çağrılmadıysa bu "keşfedilmiyor" demek değil.** Bu satır
üçüncü senaryodan sonra "boşluk" diye yazılsaydı yanlış olurdu — nitekim
`review_pack` ve `check_feasibility` için erken yazılmış ve ikisi de geri
alınmıştı.

#### Bulunan boşluk: `check_feasibility` engellemesi gerekeni engellemedi

Bu senaryo tam olarak engellenen yolu ölçmek için seçilmişti. Ölçüldü:

```
check_feasibility("Ben klavyeye dokunmadan otomatik balık tutsun")
  ->  {"blocked": false}
```

Oysa istek bu deponun **kendi eval korpusunda** duruyor
("Ben klavyeye dokunmadan otomatik balık tutsun") ve doğru cevap açık:

> "Yapılabilirlik vakası: @minecraft/server oyuncu girdisini simüle edemez,
> doğru cevap dışarıdan çalışan script"

Sebep tetikleyici listesinde: `otomatiks*(tıkla|vur|kaz|kır)` "balık" ile
eşleşmiyor, klavye kalıbı ise `(bas|tıkla|simüle)` bekliyor ve "dokunmadan"
onların hiçbiri değil. Girdinin **yokluğu** üzerinden kurulan ifade listede
hiç yoktu.

**Modeli durduran şey araç değil kendi bilgisi oldu.** Cevabın ilk cümlesi:
"Bedrock script API'sinde girdi simülasyonu yok." Doğru teşhis, ama
`check_feasibility`'den gelmedi. Bu bir şans değil ama garanti de değil —
aracın var olma sebebi tam olarak o garantiyi vermek.

Model uydurma bir API de yazmadı; bunun yerine davranışı taklit eden bir paket
üretti (elde olta + yakında su → sayaç → vanilla `fishing.json` loot table'ı).
Eval vakasının beklediği "dışarıdan Python" değil, ama uydurma da değil.

**Düzeltildi ve ölçüldü.** Tetikleyiciye girdinin yokluğu kalıbı eklendi:

```
/(klavye|keyboard|fare|mouse|tu[şs]a?)w*s*(dokun|bas|de[ğg])w*m[ae]/i
```

| İstek | Önce | Sonra |
|---|---|---|
| "Ben klavyeye dokunmadan otomatik balık tutsun" | serbest | **ENGEL** (input-simulation) |
| "Tuşa basmadan ağaç kessin" | serbest | **ENGEL** |
| "Fareye değmeden madencilik yapsın" | serbest | **ENGEL** |
| "Dünyamı her akşam otomatik yedeklesin" | ENGEL | ENGEL |
| 22 python olmayan eval isteği | serbest | **serbest** |

**"otomatik <şey>" kalıbı bilerek eklenmedi.** "Yakut cevheri doğal olarak
oluşsun" ve "her otuz saniyede bir zombi belirsin" tamamen yapılabilir
istekler; geniş bir kalıp onları yanlış engellerdi. 24 eval isteğinin
tamamında ölçüldü: **yanlış engelleme sıfır.**

`m[ae]` ayrıntısı testin kendi bulduğu bir şey: Türkçe ünlü uyumu yüzünden
"dokunmadan" ve "basmadan" *ma* alırken "değmeden" *me* alıyor. Yalnızca *ma*
yazılmıştı ve test kırmızıya döndü.

Tetikleyici listesi bir regex listesi, yani doğası gereği eksik kalabilir. Test
kapsamı genişletmeyi değil **ölçülen kaybı** sabitliyor.

#### Bağımsız doğrulama

```
validate_script -> ok=true, 0 hata      (@minecraft/server 2.9.0)
review_pack     -> ok=true, 0 bulgu     (manifest + scripts/main.js)
validate_command('loot give @s loot "loot_tables/gameplay/fishing.json" mainhand')
                -> ok=true, requiresCheats=true
```

Sonuncusu yine kullanıcıya ulaşan bir uyarıya dönüşmüş: modelin "loot cheat
gerektiren bir komut, cheats kapalıysa ilk bakılacak yer burası" notu doğrudan
bu araç çıktısından geliyor. Senaryo 2'deki `setblock` uyarısıyla aynı kalıp.

**Açık maddeyi doğrudan ilgilendiriyor:** script komutu `player.runCommand` ile
çalıştırıyor, yani senaryo 3'te ölçülemeyen **üçüncü kanal**. Bugün doğrulayıcı
o komuta sohbetin kuralını uyguluyor ve komut zaten temiz geçiyor, ama hangi
ayrıştırıcının koştuğu hâlâ ölçülmedi.

**Ölçülmeyen:** paket oyunda çalıştırılmadı.

### 5. `ore-gen-01` — "Yakut cevheri yer altında doğal olarak oluşsun"

Çok dosyalı (feature + feature rules). Ayrıca `docs/VALIDATION-LIMITS.md`'deki
bilinen sınıra değiyor: vanilla `ore`/`scatter` feature'ları doğrulanamıyor,
uyarı üretiliyor, hata değil.

Beklenen: `get_schema`, `validate_json`, `review_pack`.

**Koşuldu, 01-09-2026.** Şimdiye kadarki en uzun zincir — yaklaşık 18 çağrı:

`check_feasibility` → `get_version_info` → `get_schema` **×10** →
`lookup_id` **×3** → `validate_json` ×2 → `review_pack`

Üretilen: 14 dosyalık bir `.mcaddon` — BP (blok, eşya, feature, feature rule,
loot table, manifest) ve RP (manifest, iki atlas tanımı, iki **PNG**, üç dil
dosyası). Model dokuları kendisi üretti.

**`get_schema` on kez çağrıldı** ve bu senaryo 1'deki dizi/oneOf düzeltmesinin
ilk gerçek sınavıydı: feature ve feature rule şemaları artık boş dönmüyor.

#### Bulunan boşluk: `checkAssets` doğru paketi hatalı raporladı

Model cevabının sonunda bizim aracımızı **yanlış ilan etti**:

> "Yalnız iki uyarı düştü: doku anahtarlarının vanilla atlasında bulunmadığını
> söylüyor. Bu, aracın v1 kapsamının sadece behavior pack olduğunu
> varsaymasından geliyor. Burada kaynak paketi de ürettiğim ve anahtarlar
> terrain_texture.json ile item_texture.json içinde tanımlı olduğu için geçerli
> değil."

Kontrol edildi ve **model haklıydı.** Üstelik bulgular "uyarı" değil
`severity: "error"` ve `review_pack`'i `ok:false`'a çeviriyorlardı:

```
ok=false  bulgu 2
  [error/asset] BP/blocks/yakut_cevheri.json
    doku anahtarı "yakut_cevheri" hiçbir vanilla atlasında yok. Kaynak paketi
    üretilmiyor (v1 kapsamı behavior pack) …
```

Oysa paket o anahtarı kendi içinde tanımlıyor
(`RP/textures/terrain_texture.json`, `texture_name: "atlas.terrain"`).
`checkAssets` yalnızca vanilla atlasına bakıyordu ve mesajı artık doğru
olmayan bir varsayımı ("kaynak paketi üretilmiyor") sabit metin olarak
taşıyordu.

**Doğru ve kurulabilir bir paket "hatalı" raporlandı — yanlış pozitif.**

**Asıl risk teknik değil.** Model bulguyu yok saydı ve kullanıcıya "bu geçerli
değil" diye yazdı. Bu sefer haklıydı. Ama aracın kendi yanlış hataları modele
*"bu aracın hatalarını yok say"* öğretir ve o alışkanlık bir gün gerçek bir
hatayı da yok saydırır. Senaryo 3'te `execute … run` yanlış pozitifini
"açıklamaya yaz, model yok saysın" diye çözmüştük; bu, o çözümün sınırını
gösteriyor.

**Düzeltildi ve kontrol grubuyla ölçüldü:**

| Girdi | Önce | Sonra |
|---|---|---|
| Paket + kendi atlas tanımları | 2 error, `ok:false` | **`ok:true`, 0 bulgu** |
| Aynı paket, atlas tanımları çıkarılmış | 2 error | **2 error** |

İkinci satır belirleyici: düzeltme denetimi kapatmadı. Üç test eklendi, ikisi
enjekte edilen kırıkla kırmızıya döndü, kontrol testi yeşil kaldı.

Yol boyunca bir de sessiz tuzak çıktı: ilk deneme hiçbir anahtar bulamadı çünkü
`parseJsonFiles` belgeyi **üst düzey anahtar başına** parçalıyor, yani
`texture_data` ile `texture_name` ayrı kayıtlara düşüyor ve atlas adı
görünmez oluyor. Yardımcı ham dosya üzerinden çalışacak şekilde yazıldı.

**Açık kalan (ürün kararı):** `CLAUDE.md` v1 kapsamı "behavior pack üretimi"
diyor, ama model kendiliğinden kaynak paketi de üretiyor — PNG dahil — ve
sonuç doğrulamadan geçiyor. Kapsam cümlesi gerçeğe göre güncellenecek mi, karar
verilmedi. Kod tarafında bir şey beklemiyor.

**Ölçülmeyen:** paket oyunda çalıştırılmadı. Modelin kendi saydığı sınır doğru
görünüyor ve doğrulamanın konusu değil: feature'lar yalnızca yeni üretilen
chunk'larda çalışır.

### 6. `custom-entity-01` — "Köylüleri koruyan bir muhafız yaratığı ekle"

Bayt tavanının gerçek kullanımdaki sınavı. `behavior/entities` şemasının
`minecraft:entity/components` düğümü 390 alan taşıyor ve tam özeti 59.763 bayt;
tavan 24.000. Ölçülecek: model daralmayı bildiren `truncated` alanını okuyup
`path` ile alt düğüme iniyor mu, yoksa eksik özetle mi devam ediyor.

Beklenen: `get_schema` (daralmış), `validate_json`, `review_pack`.

**Koşuldu, 01-09-2026.** On dört çağrı:

`check_feasibility` → `get_version_info` → `validate_json` ×3 →
`get_schema` ×2 → `validate_json` ×5 → `review_pack` → `validate_command`

Üretilen: dokuz dosyalık BP + RP çifti (`codecraft:village_guard`), demir golem
modeli ve dokusu ödünç alınmış. Bağımsız doğrulandı: `review_pack` **`ok:true`,
0 bulgu**.

#### Beklenen ölçüm gerçekleşmedi — ve sebebi bir boşluk çıktı

Bu senaryo bayt tavanını sınamak için seçilmişti: `behavior/entities` şemasının
390 alanlı düğümü `names-only` basamağına iniyor ve model `truncated`
bildirimini okuyup `path` ile inmeli.

**Olmadı.** `get_schema` yalnızca iki kez çağrıldı, sonra model stratejisini
değiştirip **sekiz kez `validate_json`** ile deneme-yanılmaya geçti.

Sebebi ölçüldü ve aracımızda: `resource/entity` şeması kökte
`if`/`then`/`else` kullanıyor, `properties` hiç yok. `get_schema` o tip için
**sıfır alan** döndürüyordu, alt yola inmek de mümkün değildi:

```
get_schema("resource/entity")                          ->  0 alan
get_schema("resource/entity", "minecraft:client_entity/description")
  ->  HATA: "(kök)" altında "minecraft:client_entity" yok. Orada alan yok.
```

Yani model şemayı okumayı bırakıp denemeye geçti çünkü **şema ona hiçbir şey
söylemiyordu.** Araç tasarımının model davranışını doğrudan değiştirdiği
ölçülmüş tek vaka bu.

**Kapsam ölçüldü:** 60 derlenmiş şemanın **yedisinin** kökü boş dönüyordu ve
aralarında en çok kullanılan tip vardı — `general/manifest`. Sebep `allOf`
(manifest, attachables, items) ya da `if`/`then`/`else` (resource/entity,
model_entity). 60 şemada 517 `if/then`, 18 `allOf` düğümü var.

**Düzeltildi:**

| Tip | Önce | Sonra |
|---|---|---|
| `general/manifest` | **0 alan** | 8 alan, zorunlu `format_version`, `header` |
| `resource/entity` | **0 alan** | 2 alan, iki dal birleşmiş |
| `resource/entity` @ `client_entity/description` | **hata** | **16 alan** (`scripts` dahil) |
| `behavior/entities` @ `components` | 15.898 B | değişmedi |

`allOf` ile `oneOf` arasında karıştırılırsa sessizce yanlış cevap veren bir
ayrım var: `allOf`'ta bütün dallar aynı anda geçerli, zorunluluk **birleşim**;
`oneOf` ve `if/then/else`'te dallar alternatif, zorunluluk **kesişim**.
Düğümün kendi `required`'ı da sayılıyor — `general/manifest` zorunlularını
kökte, alanlarını `allOf` içinde tutuyor.

Üç test eklendi, ikisi ayrı ayrı enjekte edilen kırıklarla doğrulandı.

#### Modelin şema iddiası — bu sefer model yanılmış

Cevabın sonunda bir bulgu bildirdi:

> "resource/entity şeması description.scripts.animate alanını reddediyor,
> 'additional property' diyor. Oysa vanilla client entity dosyalarının çoğu
> animasyonu tam olarak oradan sürüyor. … şema verinde gerçek bir boşluk gibi
> duruyor."

Ölçüldü. Şema `format_version`'a göre dallanıyor (`if: format_version ===
"1.8.0"`) ve `scripts` düğümü iki dalda **farklı**:

| `format_version` | `scripts` içeriği | `scripts.animate` |
|---|---|---|
| `1.8.0` | `pre_animation` … | **yok** |
| diğerleri | `animate` … | **var** |

```
1.8.0    + scripts.animate  ->  ok=false  must NOT have additional properties: "animate"
1.10.0   + scripts.animate  ->  ok=true
1.21.100 + scripts.animate  ->  ok=true
```

**Şemada boşluk yok.** Model `format_version: "1.8.0"` seçmişti; doğru çözüm
sürümü yükseltmekti, `animation_controllers`'a dolanmak değil. Ürettiği dosya
gerçekten `1.8.0` ile yazılmış ve dolanma yolunu kullanıyor.

**Ama araç da yardımcı olmadı** ve asıl ders bu. Dönen mesaj şuydu:

```
must NOT have additional properties: "animate"
must match "then" schema
```

Bu mesaj "bu alan var ama başka bir format_version dalında" demiyor. Model
elindeki bilgiyle makul bir yanlış sonuca vardı. Senaryo 5'in aynası: orada
model haklıydı araç yanlıştı, burada araç haklı ama **anlaşılmaz**.

**Açık madde:** koşullu dal içinde düşen bir doğrulama hatası, alanın hangi
`format_version` ile kabul edileceğini söylemeli. Bugün söylemiyor.

**Ölçülmeyen:** `scripts.animate`'in oyunda gerçekten 1.10.0 gerektirdiği
ölçülmedi — yalnızca şemanın öyle dediği ölçüldü. Paket de oyunda
çalıştırılmadı.

### Kontrol koşusu — "çağrılmadı" iki farklı şey

Altı senaryo bitince hiç çağrılmayan araç kalırsa, o araç adıyla istenir.
Ayrım yapılmadan bulgu eyleme dönüşmez:

- Zorlayınca çalışıyor → araç sağlam, **keşfedilmiyor**. Sorun `description`
  ya da `packages/mcp/src/server.ts` içindeki `instructions` metni
- Zorlayınca da çalışmıyor → araç bozuk, bu bir hata kaydı

**Koşulmadı.**

## Bulunan boşluklar

Gerçek kullanımda çıkan her şey buraya. Kapatılmaz, gizlenmez; nereye gittiği
yazılır — `docs/COMMANDS.md` sonundaki `execute ... run` maddesinin kalıbı.

| # | Boşluk | Nerede | Durum |
|---|---|---|---|
| 1 | `get_schema` dizi düğümünde boş özet döndürüyor (`items` içine inmiyor) | `packages/validator/src/schema-summary.ts` | **Düzeltildi**, aşağıda |
| 1b | Aynı sınıf: `oneOf`/`anyOf` dalları da okunmuyordu | aynı dosya | **Düzeltildi**, 1'i düzeltirken ölçüldü |
| 2 | ~~`review_pack` kendiliğinden çağrılmıyor~~ | — | **Kapandı.** Senaryo 1'in ikinci turunda kendiliğinden çağrıldı; eksik araçta değil, tek dosyalık istekte |
| 3 | ~~`check_feasibility` hiç çağrılmıyor~~ | — | **Kapandı.** S2'de iki kez çağrıldı; S1'deki yokluğu isteğin biçiminden |
| 4 | ~~`lookup_id` hiç çağrılmıyor~~ | — | **Kapandı.** S4'te kendiliğinden çağrıldı. Sekiz aracın sekizi de çağrıldı |
| 9 | ~~`check_feasibility` girdi yokluğu ifadesini kaçırıyor~~ | `packages/core/src/feasibility.ts` | **Kapatıldı.** Kendi eval vakamızı kaçırıyordu |
| 10 | ~~`checkAssets` paketin kendi atlas tanımını görmüyor~~ (**yanlış pozitif**) | `packages/validator/src/checks.ts` | **Kapatıldı.** Doğru paket `ok:false` dönüyordu |
| 11 | ~~v1 kapsamı "behavior pack" diyor, model kaynak paketi de üretiyor~~ | `CLAUDE.md` | **Karara bağlandı 01-09-2026:** kaynak paketi üretilebilir, teşvik ediliyor |
| 12 | `prompt.ts` hâlâ "vanilla dokusu ödünç al" diyor | `packages/core/src/prompt.ts` | Açık. **Üretim davranışını değiştirir**, eval koşusu gerektirir |
| 13 | ~~`get_schema` `allOf` ve `if/then/else` şemalarında boş dönüyor~~ | `packages/validator/src/schema-summary.ts` | **Kapatıldı.** 7 tipin kökü boştu, `general/manifest` dahil |
| 14 | Koşullu dalda düşen hata hangi `format_version`'ın kabul edeceğini söylemiyor | `packages/validator/src/json.ts` | Açık. Model bu yüzden yanlış teşhis koydu |

On ikinci satır bilerek açık: `prompt.ts` MCP yolunda hiç kullanılmıyor
(model kendi kararıyla üretiyor), yalnızca CLI/web üretim yolunu yönlendiriyor.
O metni değiştirmek `custom-item-01` ve `custom-block-01` için **ölçülmüş** bir
sonucu geçersiz kılar (`docs/VALIDATION-LIMITS.md` C: model `emerald` ve
`emerald_ore` yazmıştı ve ikisi de geçmişti). Ölçülmeden değiştirilmiyor.
| 5 | ~~Boş enum her değeri reddediyor~~ | `packages/validator/src/command.ts` | **Kapatıldı ve dağıtıldı.** Boş enum artık serbest metin |
| 6 | ~~Eski veri değeri kabul ediliyordu~~ (**yanlış negatif**) | aynı dosya | **Kapatıldı ve dağıtıldı.** Sohbet kanalı reddediyor |
| 7 | `ws:probe` sohbetten daha gevşek bir kanalı ölçüyor | `docs/WEBSOCKET.md`, `pipeline/src/ws-probe.ts` | **Şerh düşüldü.** Alet duruyor, tek başına kural yazdırmıyor |
| 8 | `dimension.runCommand` hangi kanalı kullanıyor bilinmiyor | ölçülmedi | Açık. Senaryo 2'nin script'i tam da onu kullanıyor |

İki satırın üstü çizildi ve ikisi de aynı dersi verdi: **bir kez çağrılmamak
"keşfedilmiyor" demek değil.** Erken yazılsalardı ikisi de yanlış olurdu.
Dördüncü satır için de aynısı geçerli — iki gözlem hâlâ az, kontrol koşusu
bekliyor.

## Düzeltilen: `get_schema`'nın iki kör noktası

Senaryo 1'de ölçülen boşluk kapatıldı. Kapatırken aynı sınıftan ikinci bir
körlük çıktı ve o da kapatıldı — ikisi de `summarizeSchema`'nın "alanlar
nerede duruyor" sorusuna eksik cevap vermesiydi.

**Kapsam ölçüldü** (60 derlenmiş şema, 01-09-2026):

| Kör nokta | Düğüm sayısı | Arkasında gerçek alan olan |
|---|---|---|
| `items` (dizi düğümleri) | 618 | 91 |
| `oneOf` / `anyOf` | 436 | 144 (123'ünde dallar aynı alan kümesi) |
| `items` tuple biçimi | 141 | **0** — hepsi koordinat/aralık çifti |

Üçüncü satır bir şeyi kapsam dışı bıraktı: tuple biçimine inilmiyor, çünkü
inecek bir şey yok. Ölçülmemiş kural kodlanmıyor.

**Önce / sonra.** İkisi de **aynı dağıtılmış uçtan**, deploy'un iki yakasından:
"önce" düzeltme gönderilmeden, "sonra" `codecraft-f548r62mb` (Ready 36 sn)
sonrası. Aynı arayüz, aynı `data/`, aynı istemci:

| Yol | Önce | Sonra |
|---|---|---|
| `minecraft:spawn_rules/conditions` | 307 B, **0 alan** | 4.342 B, **22 alan**, `arrayItems:true` |
| `…/conditions/minecraft:herd` | **`isError`** | 1.091 B, **6 alan**, `oneOfBranches:2` |
| `minecraft:block/permutations` | 383 B, 0 alan, `required:[]` | 641 B, 2 alan, `required:["condition"]` |
| `minecraft:entity/components` | 15.898 B, names-only | **değişmedi** |
| `behavior/blocks` kökü | 695 B | **değişmedi** |

İkinci satır en kötüsüydü ve ölçülene kadar görülmemişti — araç yalnızca boş
dönmüyor, **hata veriyordu**:

```
Şema yolu çözümlenemedi: "minecraft:spawn_rules/conditions/minecraft:herd".
"minecraft:spawn_rules/conditions" altında "minecraft:herd" yok. Orada alan yok.
```

"Orada alan yok" cümlesi kendinden emin ve yanlış. Model `min_size` /
`max_size` alanlarını orada bulamadığı için belleğinden yazdı; doğru
çıktılar ama şema rehberlik etmedi, yakalayan şey üretim sonrası
`validate_json` oldu.

**Ne değişti.** `fieldsOf()` dört yere sırayla bakıyor: `properties`,
`additionalProperties`, `items`, `oneOf`/`anyOf`. İki tasarım kararı
ayrıca yazılı:

- **`required` alanların durduğu düğümden okunuyor**, dıştaki düğümden değil.
  `permutations` satırı bunu gösteriyor: zorunluluk `items` içinde yazılı,
  dışa bakılınca kayboluyordu
- **`oneOf`'ta zorunluluk KESİŞİM**, birleşim değil. Yalnızca her dalda
  zorunlu olan alan gerçekten zorunlu; birleşim alsaydık modele olmayan bir
  kısıt dayatırdık. Alanlar birleşimden geliyor ve kaç daldan geldiği
  `oneOfBranches` ile bildiriliyor — hepsi aynı anda geçerli olmayabilir

**Üç test eklendi, üçü de bilerek kırılarak doğrulandı** (M2-M4'teki
enjekte-et-ve-kırmızıya-dön yöntemi):

| Enjekte edilen hata | Kırmızıya dönen |
|---|---|
| `items` inişi kapatıldı | üç testin üçü de |
| `oneOf` dalları kapatıldı | yalnızca `oneOf` testi |

`npm test` **214/214** (senaryo 1 öncesi 211'di), `npm run typecheck` exit 0.

**Bu düğümlerin hiçbiri tavanı zorlamıyor:** en büyüğü 4.342 bayt, tavan
24.000. En kalabalık düğüm (`minecraft:entity/components`, 390 alan) ve kök
özetleri bayt bayt aynı kaldı — düzeltme yalnızca boş dönen düğümlere dokundu.

**Dağıtılmış uçta doğrulandı** (`codecraft-f548r62mb`, 01-09-2026): üç yolun
üçü de yereldeki rakamların birebir aynısını döndürdü (4.342 / 1.091 / 641
bayt), `npm run mcp:probe` dokuz kontrolün dokuzunda yeşil. Yani düzeltme yalnızca
yerelde değil, bağlayıcının konuştuğu uçta da yürürlükte.

## Değişen açıklamalar

Bir aracın `description`'ı gerçek kullanımdaki bulgu yüzünden değiştiyse:
öncesi, sonrası, ve **değişiklikten sonra aynı senaryonun tekrar koşulmuş
sonucu**. Düzeldiği ölçülmeden "düzeltildi" yazılmaz.

**Henüz yok.**

## Açık kalan: yüzey değişti, ölçüm değişmedi

> **Bu bölüm 03-09-2026'da eklendi ve bu dosyanın en büyük borcu.**

02-09-2026'da dokuz aracın **bütün** `title` ve `description` metinleri
Türkçeden İngilizceye çevrildi (`CLAUDE.md`, "Dil"). Bu dosyadaki senaryoların
hepsi **Türkçe açıklamalarla ve sekiz araçla** ölçüldü.

Neden bu önemli: M5 tam olarak açıklama metninin modeli yönlendirdiğini
ölçtü — iki açıklama senaryolar sırasında değişti ve davranış değişti
("Değişen açıklamalar"). Yani açıklama metni bu araçta bir uygulama detayı
değil, ürünün kendisi.

**Bugün ölçülen ve ölçülmeyen:**

| | Durum |
|---|---|
| `tools/list` yükünde Türkçe kalmadı | ✅ ölçüldü — `packages/mcp/test/english-surface.test.ts` |
| `review_pack` çıktısının tamamı İngilizce | ✅ ölçüldü, aynı test |
| Dağıtılmış uçta dokuz kontrol yeşil | ✅ ölçüldü 03-09-2026, `npm run mcp:probe` |
| Yükün boyutu | ✅ 10.297 bayt (sekiz araç + Türkçeyken 9.036) |
| **Yeni açıklamalar modeli doğru yönlendiriyor mu** | ❌ **hiç ölçülmedi** |

Son satır otomatikleştirilemez: "Türkçe karakter yok" ile "bu açıklama işe
yarıyor" ayrı şeyler ve ikincisi gerçek bir oturum gerektiriyor. Bağlayıcı
açılıp aşağıdaki senaryolar yeniden koşturulduğunda bu dosyaya **ikinci bir
ölçüm kümesi** yazılacak; eskiler silinmeyecek, yan yana duracak.

~~`validate_python` de aynı sepette: 02-09-2026'da eklendi ve **gerçek
kullanımda henüz hiç çağrılmadı.**~~ İlk gerçek çağrısı 03-09-2026'da
yapıldı, sonucu aşağıda.

> **Kısmen kapandı 03-09-2026.** Dört senaryo yeniden koşuldu ve iki gerçek
> kırık çıktı — biri tam olarak "Türkçe kalmadı" satırının sınırıydı. Ayrıntı
> aşağıda, "İkinci ölçüm kümesi". İki senaryo (S5, S6) hâlâ koşulmadı.

## İkinci ölçüm kümesi — 03-09-2026

Yukarıdaki altı senaryo **sekiz araçla ve Türkçe açıklamalarla** ölçülmüştü.
Bu küme dokuz araç ve İngilizce açıklamalarla alındı. Eskiler yerinde duruyor,
bu yeni bir sütun.

### Yöntem ve onun sınırı

| | Birinci küme (01-09) | İkinci küme (03-09) |
|---|---|---|
| İstemci | Claude Pro masaüstü, Customize > Connectors | **Claude Code'un kendi MCP istemcisi** |
| Uç | `codecraft-ashy-seven.vercel.app/mcp` | aynı |
| Araç | 8, Türkçe açıklama | **9, İngilizce açıklama** |
| Operatör | depoyu bilmeyen oturum | **depoyu bilen oturum** |

**Son satır bu kümenin en zayıf yeri ve olduğu gibi yazılıyor.** M5'in asıl
sorusu — "açıklama metni modeli doğru yönlendiriyor mu" — depoyu tanıyan bir
operatörle ölçülemez; ölçülen şey açıklama değil hafıza olur. Bu yüzden
aşağıdaki araç sırası **birinci kümeyle karşılaştırılabilir sayılmıyor.**

Yanlılığı azaltmak için tek bir kural konuldu ve uygulandı: **senaryo
günlükleri koşudan önce okunmadı.** İstek cümleleri başlıklardan alındı,
hangi aracın ne sırayla çağrıldığı ancak koşu bittikten sonra açıldı.

Geriye ölçülebilen ne kaldı: araçların gerçek bir istemciden çağrıldığında ne
döndürdüğü. Ve orada iki gerçek kırık çıktı.

### Koşulan

Dört senaryo koşuldu, ikisi koşulmadı (S5 `ore-gen-01`, S6 `custom-entity-01`).

| | İstek | Çağrılan araçlar (sırayla) | Sonuç |
|---|---|---|---|
| S1 | Muhafız gece yüzeyde doğsun | `get_version_info` → `get_schema` ×3 → `validate_json` → `review_pack` | dosya geçerli, `review_pack` iki bulgu verdi |
| S2 | Kırdığım bloğun komşuları da kırılsın | `check_feasibility` → `validate_script` ×2 | ilk script **düştü**, düzeltilip geçti |
| S3 | On çarpı on camdan kutu | `lookup_id` → `validate_command` | `ok:true`, `requiresCheats:true` |
| S4 | Klavyeye dokunmadan balık tutsun | `check_feasibility` → `validate_python` | istek **bloklandı**, Python yolu doğrulandı |

İki şey kayda değer:

**`validate_script` gerçek bir hata yakaladı.** Zincirleme kazma script'i
`queue.shift()` sonucunu doğrudan kullanıyordu; `tsc` üç satırda
`TS18048 'origin' is possibly 'undefined'` verdi. Elle yazılmış, gözden
kaçabilecek bir hata.

**`check_feasibility` S4'ü doğru bloklandı** ve Türkçe istekte tetikleyici
eşleşti (`matched: "klavyeye dokunma"`), cevap İngilizce döndü. Girdi dil
bağımsız, çıktı İngilizce kuralı gerçek kullanımda doğrulandı.

### Bulgu 1 — modele giden metinde Türkçe kaldı

`get_version_info`'nun çıktısındaki `patterns[].guidance` **yarım çevrilmişti**:

```
...there is no player in the world to receive it.
world.afterEvents.playerSpawn kullan ve event.player.sendMessage ile instead;
if the message is only meant for the first join, filter with event.initialSpawn.
```

Yukarıdaki tabloda "`tools/list` yükünde Türkçe kalmadı ✅" satırı **doğruydu
ama yetmiyordu** — sızıntı araç açıklamasında değil, aracın döndürdüğü yükte.

`english-surface.test.ts` bunu **iki ayrı sebeple birden** kaçırdı:

1. `get_version_info` yalnızca **hata yoluyla** çağrılıyordu (`version: "26.40"`).
   Aracın başarılı çıktısı — sürüm tablosu ve `patterns` — hiç taranmamıştı.
2. "kullan", "ve", "ile" kelimelerinde Türkçeye özgü harf yok; kelime listesi
   de onları taşımıyordu.

İkincisi 02-09'daki "sorgu" kaçırmasının **birebir tekrarı**. O gün testin
kendi sınırı ölçülüp kapatılmıştı; aynı sınır başka bir kelimeyle geri geldi.

Düzeltildi (`7301514`): metin İngilizceye çevrildi, başarılı çıktıları tarayan
yeni bir test eklendi, kelime listesi genişletildi.

**Kontrol koşusu yapıldı:** metin bilerek Türkçeye geri çevrildi, eski dört
test **yeşil** kaldı, yalnızca yeni test kırmızı verdi. Yani boşluk gerçekten
oradaydı ve tam olarak orada kapandı. 234/234 test, typecheck temiz.

### Bulgu 2 — `review_pack` paket kökünden yazılan yolları çözemiyordu

S1'in paketi `manifest.json` + `spawn_rules/guard.json` olarak verildi. Cevap:

```
spawn_rules/guard.json (json, document type could not be resolved)
```

Oysa aynı içerik `validate_json`'dan `behavior/spawn_rules` tipiyle geçmişti.
Sınır ölçülerek çıkarıldı — **aynı içerik, farklı yol**:

| Yol | Sonuç |
|---|---|
| `BP/spawn_rules/guard.json` | çözüldü, **gerçek şema hatasını buldu** (`population_control` eksik) |
| `behavior_packs/guard/spawn_rules/guard.json` | çözüldü, aynı hatayı buldu |
| `spawn_rules/guard.json` | **çözülemedi**, hata görülmedi |
| `blocks/ruby.json`, `entities/guard.json` | **çözülemedi** |

Kök neden Blockception'ın `fileMatch` kalıplarında: hepsi klasörden **önce**
bir paket segmenti istiyor. Kök göreli yol için kalıp yok. `matchByGlob`'un
sonek döngüsü baştan segment **atabiliyor ama ekleyemiyordu.**

Bu bir istisna değil varsayılan hâl: modelin doğal yazımı kök göreli ve
`build-test-pack.ts` de paketi diske öyle yazıyor.

İki yönlü zarar, ikisi de bu depoda pahalı sayılan sınıflardan: geçerli bir
pakete **yanlış alarm** (C sınıfının bedeli), bozuk bir dosyanın gerçek şema
hatasının ise **hiç görünmemesi**.

Düzeltildi (`bd00c92`): sonek döngüsü boşa düşerse `BP/` ve `RP/` önekleri
deneniyor. Hem BP hem RP'de aynı adla duran klasörler (`items`,
`animation_controllers`) için **tahmin yok** — hangi tiplere uyduğu söylenip
önek isteniyor. İki test eklendi, 236/236.

> `review_pack`'in kimlik kontrolü bu sırada **doğru** çalıştı: pakette
> tanımlanmayan `codecraft:guard` kimliği A sınıfı bulgusu olarak yakalandı.
> Yani kırık şema ayağındaydı, kontrollerde değil.

### Bulgu 3 — aynı sınıf, iki örnek daha (ve biri üretimde canlıydı)

Bu ikisi senaryolardan değil, **oyun ölçümü hazırlığının kontrol koşusundan**
çıktı: probe dosyalarının kendi kontrollerini tetiklediği doğrulanırken bulgu
metinleri ekrana düştü ve içlerinde Türkçe vardı.

| Nerede | Metin | Nasıl görülüyordu |
|---|---|---|
| `validate_command`, bilinmeyen komut dalı | `"uydurmakomut" diye bir komut yok` | **üretimde canlı**, dağıtılmış uçtan doğrulandı |
| `checkReferences` bulgusu | `... :: loot tablosu "..." exists neither in vanilla nor...` | İngilizce cümlenin ortasında Türkçe etiket |

İkisi de `english-surface.test.ts`'ten aynı sebeple kaçmıştı — **o kod yolları
hiç sürülmüyordu**:

- Testteki `validate_command` çağrısı `"give @p"` idi: bu **tanınan** bir
  komutun yanlış argümanı. Komutun hiç bulunmadığı dal başka bir dal ve o dal
  hiç çağrılmamıştı.
- `BROKEN_PACK` içinde loot/takas tablosu referansı yoktu, yani o mesaj hiç
  üretilmiyordu.

Kelime listesi de yetmezdi: "diye", "yok", "tablosu" — hiçbirinde Türkçeye
özgü harf yok.

Düzeltildi (`241a6c9`): iki metin İngilizceye çevrildi, iki kod yolu da teste
eklendi (bilinmeyen komut çağrısı ve `BROKEN_PACK`'e bir loot referansı),
kelime listesine `tablo*` ve `diye` girdi. **Kontrol koşusu:** ikisi geri
Türkçeye çevrilince iki ayrı test kırmızı veriyor.

**Günün dersi bu üç bulgunun toplamında:** bir günde üç ayrı Türkçe sızıntısı
çıktı ve üçü de aynı yapıdaydı — metin İngilizceye çevrilmişti ama **onu
üreten kod yolu taranmıyordu.** Kelime listesini uzatmak bunu kapatmıyor,
yalnızca son bulunanı kapatıyor. Kalıcı olan şey listede değil kapsamda:
testin sürdüğü kod yolu sayısı. Bugün üç yol eklendi (başarılı çıktılar,
bilinmeyen komut, yol referansı bulgusu).

> Kalan bir tane var ve bilerek dokunulmadı: `scriptRuntimeReport` içindeki
> `var`/`YOK` metinleri. Bugün **hiçbir çağıranı yok** — MCP katmanından
> erişilmiyor, yalnızca dışa aktarılmış duruyor. Modele giden bir yüzey
> olmadığı için kural kapsamında değil; bir gün çağrılırsa olacak.

### Gözlem 1 — iki araç aynı soruya iki farklı cevap veriyor

Aynı doküman tipi için `format_version`:

| Araç | spawn_rules için dönen |
|---|---|
| `get_version_info` | `["1.8.0"]` |
| `get_schema` | `["1.8.0", "1.10.0", "1.12.0"]` |

**Bug değil, bilerek yapılmış:** `get_version_info` şemadan gelen kümeyi
ölçülmüş değerlerle daraltıyor (`packages/mcp/src/bedrock/context.ts`,
`MEASURED_FORMAT_VERSIONS`) — ölçüm şemayı daraltabilir, genişletemez.

Ama **yükün hiçbir yerinde bunun daraltılmış bir liste olduğu yazmıyor.** İki
aracı da çağıran bir model iki farklı doğru görüyor ve hangisinin neden dar
olduğunu bilmiyor. Davranış değiştirilmedi; bu bir tasarım kararı, ölçümle
değil tercihle çözülür.

### Gözlem 2 — üretimde Python yorumlayıcısı yok

`validate_python`'ın ilk gerçek çağrısı. Dağıtılmış uçtan dönen:

```json
{"ok":true,"syntaxChecked":false,
 "syntaxSkipped":"No Python interpreter was found (tried python3, python, py). Syntax was NOT checked; the other axes did run.",
 "commandsChecked":3,"findings":[]}
```

Yani Vercel Node runtime'ında Python yok ve **sözdizimi ayağı üretimde her
zaman atlanıyor.** Üç eksenden ikisi koşuyor: gömülü komutlar ve `/connect`
zarfı.

Bu tam olarak tasarlanan davranış — `packages/validator/src/python.ts` sessizce
"ok" dönmüyor, atladığını söylüyor ve araç açıklaması da uyarıyor ("ok:true
alone does not mean the syntax is valid"). **Ölçülmemiş olan, üretimde bunun
istisna değil kural olduğuydu.** Yorumlayıcısı olan bir makinede üç eksen de
koşar; barındırılan uçta hiçbir zaman koşmaz.

### Gözlem 3 — geçici transport hataları

Üç çağrı `The socket connection was closed unexpectedly` ile düştü:
`validate_python` (iki kez, aynı yük) ve `check_feasibility` (bir kez).

Sunucu tarafında karşılığı yok, ölçüldü:

- Aynı yük `curl` ile doğrudan uca gönderildi → **HTTP 200, 0,70 sn**
- Aynı yük bağlayıcıdan tekrar denendi → üçüncüde **geçti**
- Yükün iki yarısı ayrı ayrı gönderildi → **ikisi de geçti**
- 1.050 baytlık başka bir script → **geçti**, yani boyut sınırı değil

İki farklı aracı vurduğu için araca özgü de değil. Kalan açıklama istemci ile
uç arasındaki yol. **Sebep bulunmadı, tekrarlanabilir değil** — burada bir
"düzeltildi" satırı yok, sadece kaydı var.

### Dağıtım ve doğrulaması

Bulgu 1 ve 2 `dev`'de düzeltildi, `main`'e alındı ve dağıtıldı.
**Üretimde ölçüldü, 03-09-2026, dağıtımdan sonra:**

| Ne | Uçtan dönen |
|---|---|
| `get_version_info` → `patterns[].guidance` | `...playerSpawn and event.player.sendMessage instead...` — Türkçe yok |
| `review_pack` → `spawn_rules/guard.json` | `behavior/spawn_rules/spawn_rules` diye çözüldü ve **gerçek şema hatasını buldu** (`population_control` eksik) |
| `npm run mcp:probe` | dokuz kontrolün dokuzu **yeşil** |
| `tools/list` yükü | 10.297 bayt — **değişmedi**, açıklama metinlerine dokunulmadı |

Kayda değer olan üçüncü satır değil ikincisi: aynı çağrı dağıtımdan önce
"document type could not be resolved" diyordu. Düzeltmenin çalıştığı testte
değil **dağıtılmış uçta** doğrulandı.

**Bulgu 3 henüz dağıtılmadı.** `241a6c9` `dev`'de duruyor; üretimdeki uç
bilinmeyen bir komuta hâlâ `"..." diye bir komut yok` diye cevap veriyor.
Bu satır dağıtımdan sonra ölçülüp güncellenecek.


## Tekrar üretmek için

```
npm run mcp:probe -- https://codecraft-ashy-seven.vercel.app/mcp
```

Sonra Claude'da **Customize > Connectors** (Settings değil) → özel bağlayıcı →
yukarıdaki adres. Bugün **dokuz** araç listelenmeli, hepsi salt okunur —
bu dosyadaki ölçümler sekiz araçlıyken alındı, dokuzuncusu
(`validate_python`) 02-09-2026'da eklendi ve **gerçek kullanımda henüz
çağrılmadı.**

Beklenen ve hata olmayan üç şey: `GET /mcp` **405** döner (spec, SSE sunmayan
sunucunun 405 dönmesine izin veriyor); OAuth keşif uçları yok, uç kimlik
doğrulamasız (M4 kararı, Vercel Authentication kapalı kalmak zorunda); sunucu
sürümü istemci arayüzünde **hiç görünmüyor** (aşağıdaki şerh).

> **Üç düzeltme, 01-09-2026.** (1) Sunucu sürümü `0.0.0` idi ve
> "M6'da bakılacak açık madde" diye buraya yazılmıştı; `0.1.0` oldu ve
> `package.json` ile eşleştiği artık test ediliyor. **Ama "görünür" kelimesi
> yanlıştı ve ölçülerek düzeltildi:** masaüstü uygulamasında sunucu sürümünü
> gösteren bir yer yok. Kullanıcı bağlayıcıyı ekledi, sekiz aracı gördü,
> sürümü bulamadı; `%LOCALAPPDATA%\Claude\Logs\mcp.log` **0 bayt** ve içinde
> `codecraft` geçen tek satır yok. Sebebi yapısal: uzak bağlayıcı Anthropic'in
> bulut altyapısı üzerinden proxy'leniyor, masaüstü uygulaması onu yerel bir
> süreç olarak başlatmıyor, dolayısıyla `initialize` cevabını hiç görmüyor.
> Sürümün tek doğrulanabilir yeri ucun kendisi — `initialize` çağrısının
> `serverInfo` alanı (`docs/MCP.md`, "Tekrar üretmek için"). (2) Bu dosyada üç yerde
> "10 kontrol" yazıyordu, probe koşulup ekrandaki `OK` satırları sayıldı:
> **dokuz.** `probe.ts`'te sekiz `check()` çağrı yeri var ve sonuncusu
> `["GET","DELETE"]` döngüsünde, yani çalışma anında dokuz doğrulama oluyor.
> Ölçümlerin kendisi değişmedi, yalnızca sayı yanlış yazılmıştı. Ayrıntı
> `docs/MCP.md`.

## Oyun içi doğrulama — düzeltme çalıştı

**01-09-2026, Bedrock 1.26.45, senaryolardan sonra.** M5'in tek gerçek oyun içi
ölçümü bu. Senaryo 3'te bulunan yanlış negatifin kapandığı doğrulandı.

Komutlar bu sefer **MCP sunucusundan geçirilerek** kuruldu (`lookup_id` ile
kimlik, `validate_command` ile satır), sonra sohbete elle yazıldı:

| Komut | Sonuç |
|---|---|
| `/fill ~-5 ~-1 ~-5 ~5 ~9 ~5 glass hollow` | **çalıştı** |
| `/fill ~-5 ~-1 ~-5 ~5 ~9 ~5 glass outline` | **çalıştı** |
| `/fill ~-5 ~-1 ~-5 ~5 ~9 ~5 air replace glass` | **çalıştı** |

Aynı biçim birkaç saat önce `Syntax error: Unexpected "0"` veriyordu —
aradaki tek fark, doğrulayıcının artık eski veri değerini reddedip komutu
`glass hollow` biçiminde kurdurması. **Yanlış negatifin kapandığı oyunda
doğrulandı**, testte değil.

### Bir de yanlış alarm çıkmadı

Kullanıcı `hollow` ile `outline`'ın aynı sonucu verdiğini bildirdi ve bu ilk
bakışta bir bulgu gibi duruyordu. Ayırt edici test kuruldu (yanına katı toprak
küp, sonra iki kabuk sırayla) ve ikisi de **doğru** çıktı:

| | Kabuk | İçerisi |
|---|---|---|
| `hollow` | cam | havayla dolduruluyor |
| `outline` | cam | dokunulmuyor |

Fark yalnızca içeride blok varsa görünüyor; açık alanda ikisi aynı sonucu
verir. Ayrıca ilk koşuda `hollow` içeriyi zaten boşaltmıştı, sonraki
`outline`'ın koruyacak bir şeyi kalmamıştı.

Kayda değer olan şu: **"garip görünüyor" ile "bozuk" arasındaki fark yine
ölçümle ayrıldı.** Bulgu diye yazılsaydı olmayan bir hata için kod
değiştirilecekti.

### Hâlâ ölçülmeyen

Üretilen **paketlerin** hiçbiri oyuna yüklenmedi. Doğrulanan tek şey komut
yolu. `docs/VALIDATION-LIMITS.md`'nin cümlesi paketler için aynen geçerli.
