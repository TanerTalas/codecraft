# MCP sunucusunun gerçek kullanımı

Aşama M5'in ölçüm dosyası. `docs/SOURCES.md` verinin nereden geldiğini,
`docs/VALIDATION-LIMITS.md` doğrulamanın nerede bittiğini anlatır; burası
**araçların gerçek bir Claude oturumunda çağrılıp çağrılmadığını** kaydeder.

Şimdiye kadar ölçülen her şey sunucunun kendi ölçümüydü: probe script'i, birim
testleri, kendi yazdığımız istemci. Hiçbiri şunu ölçmedi — model bu araçları
kendiliğinden çağırıyor mu, hangi sırayla, ve çağırmadığında neden. Karar
dokümanının dördüncü gerekçesi (`docs/anlik_karar_degisikligi.md`) tam olarak
bu.

Ölçütün cümlesi TODO.md M5'ten: **çağrılmayan araç ya gereksiz ya da açıklaması
kötü.** İkisi farklı sonuç doğurur, o yüzden ayrıştırılmadan yazılmaz.

## Durum

**01-09-2026 — bağlayıcı bağlı, senaryo 1 tamamlandı, BİTİŞ KRİTERİ
KARŞILANDI.** Altı senaryodan biri bitti.

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
| Senaryolar | `evals/cases/cases.json` içindeki gerçek isteklerden altı vaka |
| Kayıt | Elle. Sunucuda loglama YOK, gerekçesi aşağıda |

**Neden elle.** Sunucu durumsuz ve her istekte yok ediliyor
(`packages/mcp/src/http.ts`), süreç içi sayaç tutulamaz. Vercel'in rota bazlı
logu hangi *aracın* çağrıldığını göstermez — araç adı JSON-RPC gövdesinin
içinde ve gövde loglanmıyor. Zaten asıl soru "kaç kez" değil "neden değil" ve o
cevap konuşmanın kendisini okumayı gerektiriyor.

## Taban çizgisi — bağlamadan önce

Bağlayıcı takılırsa hatanın sunucuda mı istemcide mi olduğu tartışmasız olsun
diye, bağlamadan önce ölçüldü. `npm run mcp:probe -- https://codecraft-ashy-seven.vercel.app/mcp`,
gerçek SDK istemcisi, 10 kontrol:

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

**1 / 6 senaryo koşuldu.** Sayılar geçici, her senaryodan sonra güncelleniyor.
Senaryo 1 iki turda koştu (tek dosya → yedi dosyalık paket) ve iki turun
davranışı FARKLI; ayrım aşağıdaki notlarda.

| Araç | Çağrıldığı senaryo | Kendiliğinden | Not |
|---|---|---|---|
| `check_feasibility` | **0 / 1** | — | İki turda da çağrılmadı. Tek gözlem, erken |
| `get_version_info` | 1 / 1 | evet | 1. turun ilk çağrısı, dosya yazılmadan önce |
| `get_schema` | 1 / 1 (4 çağrı) | evet | Her iki turda da, hep üretimden önce |
| `lookup_id` | **0 / 1** | — | Ortada vanilla kimlik yoktu, çağrılmaması savunulabilir |
| `validate_json` | 1 / 1 (4 çağrı) | evet | Her dosya tek tek, üç ayrı belge tipi |
| `validate_command` | — | — | S1'de beklenmiyordu |
| `validate_script` | — | — | S1'de beklenmiyordu |
| `review_pack` | 1 / 1 | evet | **1. turda çağrılmadı, 2. turda çağrıldı** — ayrım aşağıda |

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

**Koşulmadı.**

### 3. `command-fill-01` — "Etrafıma on çarpı on camdan bir kutu yap"

Komut yolu ve blok kimliği.

Beklenen: `validate_command`, `lookup_id`.

**Ek mikro kontrol:** aynı oturumda `execute ... run <komut>` içeren bir şey
istenecek. `validate_command` bugün geçerli komutu geçersiz raporluyor (bilinen
yanlış pozitif, `docs/COMMANDS.md` sonu) ve araç açıklaması "o biçimdeki arity
hatasını yok say" diyor. Ölçülecek: model bu uyarıyı okuyup doğru komutu
koruyor mu, yoksa doğru yazdığını bozmaya mı çalışıyor.

**Koşulmadı.**

### 4. `python-afk-fish-01` — "Ben klavyeye dokunmadan otomatik balık tutsun"

Engellenen yol. Girdi simülasyonu Bedrock script API'sinde yok;
`check_feasibility` engelleyip dışarıdan çalışan Python'a yönlendirmeli.

Beklenen: `check_feasibility` (engelli sonuç).

**Koşulmadı.**

### 5. `ore-gen-01` — "Yakut cevheri yer altında doğal olarak oluşsun"

Çok dosyalı (feature + feature rules). Ayrıca `docs/VALIDATION-LIMITS.md`'deki
bilinen sınıra değiyor: vanilla `ore`/`scatter` feature'ları doğrulanamıyor,
uyarı üretiliyor, hata değil.

Beklenen: `get_schema`, `validate_json`, `review_pack`.

**Koşulmadı.**

### 6. `custom-entity-01` — "Köylüleri koruyan bir muhafız yaratığı ekle"

Bayt tavanının gerçek kullanımdaki sınavı. `behavior/entities` şemasının
`minecraft:entity/components` düğümü 390 alan taşıyor ve tam özeti 59.763 bayt;
tavan 24.000. Ölçülecek: model daralmayı bildiren `truncated` alanını okuyup
`path` ile alt düğüme iniyor mu, yoksa eksik özetle mi devam ediyor.

Beklenen: `get_schema` (daralmış), `validate_json`, `review_pack`.

**Koşulmadı.**

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
| 3 | `check_feasibility` iki turda da hiç çağrılmadı | `packages/mcp/src/tools/feasibility.ts` açıklaması | Açık, tek senaryoluk gözlem — kontrol koşusu bekliyor |

Üçüncüsü için tek bir senaryo yeterli veri değil; kalan beş senaryodan sonra
tekrar bakılacak. Bir kez çağrılmamak "keşfedilmiyor" demek değildir — ikinci
satır tam olarak bunu gösterdi ve erken yazılsaydı yanlış olurdu.

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
bayt), `npm run mcp:probe` on kontrolün onunda yeşil. Yani düzeltme yalnızca
yerelde değil, bağlayıcının konuştuğu uçta da yürürlükte.

## Değişen açıklamalar

Bir aracın `description`'ı gerçek kullanımdaki bulgu yüzünden değiştiyse:
öncesi, sonrası, ve **değişiklikten sonra aynı senaryonun tekrar koşulmuş
sonucu**. Düzeldiği ölçülmeden "düzeltildi" yazılmaz.

**Henüz yok.**

## Tekrar üretmek için

```
npm run mcp:probe -- https://codecraft-ashy-seven.vercel.app/mcp
```

Sonra Claude'da **Customize > Connectors** (Settings değil) → özel bağlayıcı →
yukarıdaki adres. Sekiz araç listelenmeli, hepsi salt okunur.

Beklenen ve hata olmayan üç şey: `GET /mcp` **405** döner (spec, SSE sunmayan
sunucunun 405 dönmesine izin veriyor); OAuth keşif uçları yok, uç kimlik
doğrulamasız (M4 kararı, Vercel Authentication kapalı kalmak zorunda); sunucu
sürümü `0.0.0` görünür (`packages/mcp/src/server.ts`, M6'da bakılacak açık
madde).
