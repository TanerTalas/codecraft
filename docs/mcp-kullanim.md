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

**01-09-2026 — taban çizgisi alındı, bağlayıcı bağlandı, altı senaryodan
BİRİ koşuldu.**

Koşulmamış senaryonun satırına sayı yazılmaz; "koşulmadı" bir eksiklik değil,
o satırın bugünkü doğru cevabı.

**Bitiş kriteri henüz karşılanmadı** ve karşılandığı iddia edilmiyor. Senaryo
1'in gerekçesi aşağıda: üretilen dosya şemadan temiz geçti ama paket
incelemesi çağrılsaydı `ok:false` dönecekti.

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

| Araç | Çağrıldığı senaryo | Kendiliğinden | Not |
|---|---|---|---|
| `check_feasibility` | 0 / 1 | — | S1'de beklendi, çağrılmadı |
| `get_version_info` | 1 / 1 | evet | İlk çağrı, dosya yazılmadan önce |
| `get_schema` | 1 / 1 (iki çağrı) | evet | İlki boş döndü, aşağıdaki boşluk |
| `lookup_id` | 0 / 1 | — | S1'de beklendi; ortada vanilla kimlik yoktu, savunulabilir |
| `validate_json` | 1 / 1 | evet | `ok:true`, bağımsız doğrulandı |
| `validate_command` | — | — | S1'de beklenmiyordu |
| `validate_script` | — | — | S1'de beklenmiyordu |
| `review_pack` | **0 / 1** | — | **Beklendi, çağrılmadı. Cevabın durumunu değiştirdi** |

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
| 1 | `get_schema` dizi düğümünde boş özet döndürüyor (`items` içine inmiyor) | `packages/validator/src/schema-summary.ts` | Senaryo 1'de ölçüldü, açık |
| 2 | `review_pack` kendiliğinden çağrılmıyor | `packages/mcp/src/tools/review.ts` açıklaması ya da `server.ts` `instructions` | 1 senaryoda 1 kez, tek gözlem — kontrol koşusu bekliyor |

İkincisi için tek bir senaryo yeterli veri değil; kalan beş senaryodan sonra
tekrar bakılacak. Bir kez çağrılmamak "keşfedilmiyor" demek değildir.

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
