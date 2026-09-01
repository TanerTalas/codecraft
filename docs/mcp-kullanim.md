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

**01-09-2026 — taban çizgisi alındı, senaryolar HENÜZ KOŞULMADI.**

Bu dosya şu an yalnızca bağlamadan önceki ölçümü taşıyor. Aşağıdaki araç
kullanım tablosu ve senaryo günlükleri bilerek boş: bir senaryo koşulmadan o
satıra sayı yazılmaz. "Koşulmadı" bir eksiklik değil, bugünkü doğru cevap.

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

## Araç kullanım tablosu

Sekiz satırın sekizi de burada duruyor, hiç çağrılmayanlar dahil. "Kendiliğinden"
sütunu kritik: araç adı telaffuz edilmeden çağrıldıysa `evet`, ancak zorlayınca
çağrıldıysa `hayır` — ikincisi "araç sağlam ama keşfedilmiyor" demektir ve
açıklama işidir.

| Araç | Kaç senaryoda çağrıldı | Kendiliğinden | Not |
|---|---|---|---|
| `check_feasibility` | koşulmadı | — | — |
| `get_version_info` | koşulmadı | — | — |
| `get_schema` | koşulmadı | — | — |
| `lookup_id` | koşulmadı | — | — |
| `validate_json` | koşulmadı | — | — |
| `validate_command` | koşulmadı | — | — |
| `validate_script` | koşulmadı | — | — |
| `review_pack` | koşulmadı | — | — |

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

**Koşulmadı.**

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

**Henüz yok** — senaryolar koşulmadı.

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
