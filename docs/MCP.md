# MCP sunucusunun kurulumu ve araç yüzeyi

`docs/mcp-kullanim.md` araçların gerçek bir Claude oturumunda çağrılıp
çağrılmadığını kaydeder; **burası** sunucunun nereye bağlandığını ve yüzeyinin
ne olduğunu anlatır. Ölçüm günlüğü orada, sözleşme burada.

Uç internetten erişilebilir ve bugün ayakta. Bağlanan istemci sekiz araç
görüyor, sekizi de salt okunur — sunucu hiçbir şey yazmıyor, hiçbir yere veri
göndermiyor.

## Uç ve durum

| | |
|---|---|
| Uç | `https://codecraft-ashy-seven.vercel.app/mcp` |
| Transport | Durumsuz Streamable HTTP, yalnızca `POST` |
| Sunucu adı / sürümü | `codecraft` / `0.1.0` |
| Araç | 8, hepsi `readOnlyHint` |
| Çalışma ortamı | Vercel Node runtime, `maxDuration = 60`, `linux-x64`, bölge `iad1` |
| Kimlik doğrulama | Yok — Vercel Authentication kapalı ve kapalı kalmak zorunda |
| Veri sürümü | `1.26.40.5` (`@minecraft/server` 2.9.0) |

**Ölçüldü 01-09-2026**, dağıtılmış uçta `npm run mcp:probe` ile: dokuz
kontrolün dokuzu da yeşil.

Kimlik doğrulamasının olmaması bir eksiklik değil, gereklilik: bağlantıyı
Anthropic'in bulut altyapısı kuruyor, SSO'nun arkasına geçemez. Uç salt okunur
ve gizli veri döndürmüyor. Hız sınırı yok, gerekçesi `## Açık kalan` altında.

## Bağlayıcı olarak ekleme

Claude'da **Customize > Connectors**. Settings **değil** — eski rehberler orayı
gösteriyor ve orada özel bağlayıcı alanı yok.

1. Customize > Connectors → özel bağlayıcı ekle
2. Yukarıdaki uç adresini yapıştır
3. Kaydet

Eklendikten sonra görülmesi gereken üç şey — tek bir "çalıştı" cümlesi yetmez:

| Gözlem | Beklenen |
|---|---|
| Araç sayısı | **8**, eksiksiz |
| İstemcinin sınıflandırması | **"read only tools: 8"** — ayrı bir izin sınıfı |
| Başlıklar | Kendi `title` alanlarımız, örn. "İstek Bedrock'ta yapılabilir mi" |

İkinci satır kayda değer: `annotations` uçtan uca taşınıyor ve istemci sekizini
de ayrı bir izin sınıfına koyuyor. Bu, bağlanmadan önce bilinmiyordu
(`docs/mcp-kullanim.md`, "Bağlayıcı bağlandı").

Araç izinleri **"her seferinde sor"da bırakılabilir.** Sunucuda log yok, o
yüzden onay istemi hangi aracın hangi argümanla çağrıldığını gösteren tek
kaçırılamaz kayıt. Gerekçenin uzunu ölçüm dosyasında.

### Yerel geliştirme — tünel gerekiyor

`localhost` bağlanmaz: bağlantı Anthropic'in bulut altyapısından kuruluyor ve
firewall arkasına ulaşamıyor. Geliştirme sırasında ngrok veya Cloudflare Tunnel
gerekiyor.

`npm run dev` ile ayağa kalkan `http://localhost:3000/mcp` yalnızca
`mcp:probe` içindir; yerel bir koşu bitiş kriteri sayılmaz.

## Sekiz araç

Kayıt sırası alfabetik değil, kullanım sırası — ve `tools/list` bu sırayı
koruyor, yani modelin okuduğu ilk şey bu. Sunucu bağlanırken şu yönergeyi de
gönderiyor:

```
Minecraft Bedrock için doğrulanmış çıktı üretmeye yarayan araçlar. Sıra
önemli: önce check_feasibility (istek Bedrock'ta yapılabilir mi), sonra
get_version_info ve get_schema (hangi alanlar zorunlu, format_version ne
olmalı), üretimden sonra review_pack. Bedrock'un sürüm alanları birbirine
karışıyor — format_version oyun sürümü DEĞİL, o dosya tipinin kendi şema
sürümü. Değerleri buradan al, hatırladığından değil.
```

| Araç | Ne döndürür | Ne zaman |
|---|---|---|
| `check_feasibility` | Engelin sebebi, kanıtı ve alternatifi | Üretimden önce |
| `get_version_info` | Sürüm alanları, modüller, geçerli `format_version`'lar | Dosya yazmadan önce |
| `get_schema` | Zorunlu alanlar ve o düğümdeki alan listesi | Dosya yazmadan önce |
| `lookup_id` | Kimlik var mı, hangi tür, blok durumları | Hatırlanan her kimlik için |
| `validate_json` | JSON pointer'lı şema hataları | Ürettiğin her JSON için |
| `validate_command` | Komut, arity, seçici, blok durumu | Komut vermeden önce |
| `validate_script` | Satır, sütun ve TS koduyla gerçek `tsc` tanısı | Her API çağrısı için |
| `review_pack` | Bütün dosyalar, artı şemanın yakalayamadıkları | Vermeden önceki son adım |

Girdi alanları:

| Araç | Zorunlu | Opsiyonel |
|---|---|---|
| `check_feasibility` | `request` | — (`version` almaz) |
| `get_version_info` | — | `version` |
| `get_schema` | `type` | `path`, `version` |
| `lookup_id` | `id` | `version` |
| `validate_json` | `content`, `type` | `version` |
| `validate_command` | `line` | `version` |
| `validate_script` | `code` | `version`, `channel` |
| `review_pack` | `files[]` (`path`, `content`) | `version` |

### Ortak alan: `version`

Opsiyonel ve her araçta tek biçim: verilmezse `data/` altındaki en yeni sürüm
kullanılır. `1.26.40` gibi üç haneli bir önek de kabul edilir, dört haneye
çözülür. Pazarlama numarası (`26.40`) **geçersiz** ve sessizce en yeniye
düşmüyor, hata döndürüyor — modele yanlış bir sürümle çalıştığını hiç
söylememek en kötü sonuç olurdu. Sürüm eksenleri `CLAUDE.md` içinde.

`check_feasibility` tek istisna, `version` almaz: girdisi bir cümle ve sürüme
bakmıyor.

`validate_script`'in `channel` alanı `stable` (varsayılan) ya da `beta`. `beta`
istenip o modülün betası yoksa kararlıya düşüyor; hangi sürüme karşı
derlendiği sonucun `modules` alanında yazıyor.

### Açıklamalar koddadır, burada tekrarlanmaz

Her aracın `description` metni `packages/mcp/src/tools/<ad>.ts` içinde ve model
onu `tools/list`'ten okuyor. Bu dosyaya ikinci bir kopya konmuyor: kopya çürür,
ve M5 tam bunu ölçtü — iki açıklama senaryolar sırasında değişti
(`docs/mcp-kullanim.md`, "Değişen açıklamalar").

Sekizinde de `annotations: {readOnlyHint: true, openWorldHint: false}`
(`packages/mcp/src/tool.ts`).

### Araç yüzeyinde yazılıydı, kapatıldı

`validate_command` bir süre geçerli `execute ... run <komut>` satırlarını
geçersiz raporladı ve bu, aracın açıklamasında modele **açıkça yazılı**
duruyordu ("o biçimdeki arity hatasını yok say"). Boşluk 02-09-2026'da
kapatıldı; zincir artık çözülüyor, `run` sonrasındaki komut da doğrulanıyor
(iç içe `execute` dahil) ve o uyarı açıklamadan kaldırıldı.

Kapanışın ölçümü ve düzeltmenin şekli `docs/COMMANDS.md`, "Kapatılan boşluk:
`execute ... run`".

> **Neden burada duruyor:** kötü bir aracın modele *"bu aracın hatalarını yok
> say"* öğretmesi M5'in kaydettiği bir risk. Uyarı yazıldığı sürece o
> alışkanlığı besliyordu; kaldırıldı.

## Çıktı boyutu ve token bütçesi

Token sınırı bu sunucuda bir tasarım kısıtı, optimizasyon değil: `data/`
içindeki indeksler bütçeyi kat kat aşıyor (`commands.json` tek başına 650.454
bayt). Yani araçlar registry döndüremez, **hedefe yönelik sonuç** döndürür.
Gerekçenin uzunu `docs/ROADMAP.md` ve `docs/anlik_karar_degisikligi.md`.

Her araç çıktısına sert bir tavan uygulanıyor: `BYTE_LIMIT = 24.000`
(`packages/mcp/src/limit.ts`). Çıktı girintisiz yazılıyor — girintili yazılsa
tavana göre daraltılmış bir özet girintiyle tavanı tekrar aşar ve sert kesmeye
yakalanırdı, yani geçerli JSON bozulurdu.

Ölçülen uç değerler (01-09-2026): en küçük çıktılar 200 baytın altında
(`review_pack` tek dosyayla 192 B, `lookup_id` 199 B), en büyük ise
`get_schema`'nın 390 alanlı düğümü — **15.898 bayt**, tavanın **%66**'sı.
Kalan sekiz çağrı %14'ün altında. Yani sınır tek bir araçta baskı yapıyor.

**`tools/list` 9.036 bayt.** Karar dokümanının andığı ~30.000 token bütçesi
araç TANIMLARI için ve orada sıkışıklık yok — bu, bütçenin yaklaşık **%7**'si.
Asıl sınır sonuçlarda.

### Kesme sessiz değil

Tavan aşılırsa gövdenin sonuna şu ekleniyor:

```
[KESİLDİ] Çıktı <n> bayttı, 24000 bayt tavanına indirildi. Yukarıdaki JSON
eksik ve ayrıştırılamayabilir. Daha dar bir istekle tekrar çağır.
```

Model eksik veriyle çalıştığını bilmeli, yoksa yarım JSON'u tam sanıp ona göre
üretir. Bu son savunma hattı; asıl daraltmayı `get_schema` kendi yapıyor.

### `get_schema`'nın daralma kademeleri

Daralma kademeli ve her basamak `truncated` alanında **adıyla** bildiriliyor:

| Kademe | Ne düşer |
|---|---|
| `full` | hiçbir şey |
| `no-descriptions` | açıklamalar |
| `names-only` | tipler; alan adlarının hepsi durur |
| `clipped` | ad listesi de kesilir |

"İlk 60 alanı göster, sus" yapılmadı: o yol modele geri kalan 330 alanın var
olmadığını düşündürürdü. `names-only` basamağında 390 adın hepsi duruyor, model
sonra `path` ile tek bir alt düğüme inip tam ayrıntıyı alıyor. Özetleyici
`packages/validator/src/schema-summary.ts` içinde ve saf bir fonksiyon —
MCP'ye bağlı değil (mimari kural 3).

## Barındırma — ölçümün sonucu

Sunucu ücretsiz kademede koşuyor. Riskli varsayım `validate_script`'ti:
`tsc`'yi **alt süreç** olarak açıyor, `mkdtemp` ile yazılabilir bir dizin
istiyor ve `data/` altındaki `.d.ts` dosyalarını okuyor. Serverless bir ortamda
üçü de garanti değil.

Dağıtılmış uçta altı ön koşulun altısı da yeşil ölçüldü — `root`, `data`,
`tmpdir`, `tscShim`, `tscExe`, `spawn` (`scriptRuntimeReport()`,
`packages/validator/src/script.ts`; `GET /api/review` dışarı veriyor).

Sonuç: container tabanlı barındırmaya inilmedi, hiçbir ücretli plana geçilmedi,
hiçbir araç üründen çıkarılmadı. Ücretsiz kalma merdiveninin (`TODO.md` Aşama
M0) hiçbir basamağı kullanılmadı.

**Ölçülmeyen:** dağıtılmış fonksiyon paketinin gerçek boyutu. Ölçülen şey
dosyaların orada olduğu — uç koşuyor — kaç MB tuttuğu değil.

### Her istekte yeni transport ve yeni sunucu

Tercih değil, SDK kısıtı: durumsuz transport ikinci `handleRequest`'te atıyor
("Stateless transport cannot be reused across requests"). `enableJsonResponse:
true` çünkü JSON modda cevap tam materyalize dönüyor ve `finally`'deki
`close()` gövdeyi kesmiyor; SSE modda fonksiyon keep-alive çerçeveleriyle açık
kalırdı.

Bağlantı mantığı `packages/mcp/src/http.ts` içinde (`handleMcpRequest`), route
dosyasında değil. Sebebi ölçülmüş bir hata: kök `tsconfig.json` `app/` dizinini
kapsamıyor, orada duran kod `npm run typecheck`'e girmiyor ve sessizce çürüyor.
`createServer()` hâlâ hiçbir transport bilmiyor.

### `GET` ve `DELETE` bilerek bağlı

Üçü de aynı fonksiyona bağlı ama `POST` dışındakiler transport'a
**devredilmiyor**: HTTP **405** ve JSON-RPC `-32000` dönüyor.

İki ayrı gerekçe, ikisi de ölçülmüş. Rotaya hiç bağlanmasalardı Next'in kendi
405'i **HTML** dönerdi, MCP istemcisi JSON bekler. Transport'a devredilselerdi
`GET` durumsuz modda 200 + `text/event-stream` açıyor ve akış hiç veri vermeden
hiç bitmiyor — fonksiyon `maxDuration`'a kadar asılı kalır, ücretsiz kademede
doğrudan kota yakardı.

### Dosya izleme yolları

`/mcp` **kendi** fonksiyon paketini alıyor; Next izlemeyi rota başına yapıyor,
yani `/api/review` için ölçülen yeşil buraya taşınmıyor. `app/next.config.ts`
dört yol bildiriyor ve dördü de gerekli:

| Yol | Neden | Paketlenen |
|---|---|---|
| `../data/**` | şemalar ve `.d.ts` tipleri | 3.372 dosya |
| `../codecraft.config.json` | `isRoot()` iki işaretçiyi birden arıyor | 1 |
| `../node_modules/typescript/**` | `tsc` kabuğu | 417 |
| `../node_modules/@typescript/**` | tsgo ikilisi **ve yanındaki** `lib.*.d.ts` | 114 |

Son iki satır M1'de ölçülen iki kırığın birebir sebebi.
`codecraft.config.json` olmadan uç ilk istekte "Repo kökü bulunamadı" ile
düşüyor; `lib.*.d.ts` olmadan tsgo `panic: bundled: .../lib/lib.d.ts does not
exist` veriyor. İkili ile standart kütüphanesi ayrılamaz.

## Sağlık kontrolü: `mcp:probe`

```
npm run mcp:probe -- https://codecraft-ashy-seven.vercel.app/mcp
```

Script kökte tanımlı (`packages/mcp` içinde script yok). Argümansız çağrılırsa
`http://localhost:3000/mcp` denenir.

Dokuz kontrol koşuyor: sekiz araç listeleniyor mu, hepsi `readOnlyHint` taşıyor
mu, kaldırılmış bir API gerçek `tsc` tanısı döndürüyor mu, geçerli script temiz
geçiyor mu, en kalabalık `get_schema` düğümü tavanın altında mı, sert kesmeye
yakalanıyor mu, `get_version_info` gerçek sürüm veriyor mu, `GET` ve `DELETE`
405 + JSON dönüyor mu. Hepsi geçerse `HEPSİ YEŞİL`, aksi hâlde
`<n> KONTROL KIRIK` ve exit 1.

Üçüncü kontrol kritik: yalnızca `ok:true` görmek, sessizce hiçbir şey
derlemeyen bir yoldan da gelebilirdi. O yüzden bozuk bir payload bilerek
gönderiliyor ve gerçek bir tanı bekleniyor.

Dağıtılmış ölçüm (01-09-2026):

| Adım | Sonuç |
|---|---|
| bağlantı (initialize) | 1.604 ms (soğuk) |
| `tools/list` | 8 araç, 9.036 bayt, 277 ms soğuk / 172 ms sıcak |
| `validate_script` (kaldırılmış API) | 285 bayt, gerçek `TS2551` tanısı, 592 ms |
| `validate_script` (geçerli) | 144 bayt, `ok:true`, 313 ms |
| `get_schema` (390 alanlı düğüm) | 15.898 bayt, kesilmedi, 488 ms |
| `GET` / `DELETE` | 405 + JSON gövde |

Yerelde: `npm run typecheck` exit 0, `npm test` 227/227.

## Nerede ne yazılı

| Soru | Dosya |
|---|---|
| Araçlar gerçek kullanımda çağrılıyor mu, hangi senaryoda | `docs/mcp-kullanim.md` |
| Komut doğrulamasının kapsamı ve boşlukları | `docs/COMMANDS.md` |
| Doğrulamanın yakalayamadıkları | `docs/VALIDATION-LIMITS.md` |
| Verinin kaynağı ve lisansı | `docs/SOURCES.md` |
| Neden MCP, hangi kısıtlarla | `docs/ROADMAP.md`, `docs/anlik_karar_degisikligi.md` |
| Oyunla konuşan WebSocket köprüsü | `docs/WEBSOCKET.md` |

## Açık kalan

**Uçta hız sınırı yok ve v1'de olmayacak.** Vercel'in Firewall rate limiting'i
ücretli plan özelliği, yani `CLAUDE.md`'nin "Yapılmayacaklar" tablosuna giriyor.
Süreç-içi bir sayaç serverless'ta örnek başına sıfırlandığı için gerçek bir
sınır değil — ölçülmemiş bir güvenlik hissi verirdi.

**Ücretsiz kademedeki diğer koruma mekanizmaları kontrol edilmedi** — Attack
Challenge Mode ve kullanım uyarısı.

**Dağıtılmış fonksiyon paketinin boyutu ölçülmedi.** Yerel Windows koşusunda
`/mcp` 70,8 MB; M1'de Linux'ta `/api/review` 47,3 MB ölçülmüştü. Fark
Windows'un iki `tsc` ikilisini birden paketlemesinden geliyor. "Linux'ta yakın
kalır" hâlâ tahmin.

**Namespace toleransı tek yönlü.** `matchesEnum` değerden `minecraft:`
soyuyor ama eklemiyor; tamamı önekli tutulan altı enumda çıplak değer
reddediliyor (`/locate biome plains`). Oyunun çıplak biçimi kabul edip
etmediği ölçülmediği için değiştirilmedi — `docs/COMMANDS.md`.

**Sunucu tarafında log yok.** Sunucu durumsuz ve her istekte yok ediliyor;
Vercel'in rota bazlı logu hangi ARACIN çağrıldığını göstermiyor. Yani araç
kullanımı otomatik ölçülemiyor, elle ölçülüyor.

**`mcp:probe` yalnızca kökten koşuyor.** `packages/mcp/package.json`'da script
yok; paket tek başına klonlanırsa probe çağrısı bulunmaz. Karar değil, henüz
gerekmedi.

**Hiçbir üretilen PAKET Minecraft'a yüklenmedi.** MCP üzerinden üretilmiş
çıktının oyun içi ölçümü yalnızca komut yolunda yapıldı.
`docs/VALIDATION-LIMITS.md`'nin cümlesi aynen geçerli: "doğrulamadan geçti" ile
"oyunda çalışıyor" aynı şey değil.

## Tekrar üretmek için

```
npm run typecheck
npm test
npm run mcp:probe -- https://codecraft-ashy-seven.vercel.app/mcp
```

Bağlayıcının kendisi elle ekleniyor; otomatik ölçümü yok. Yerel bir koşu
(`npm run dev` + `mcp:probe`) sunucunun ayakta olduğunu söyler ama bağlanabilir
olduğunu söylemez — bağlantı Anthropic'in bulut altyapısından kuruluyor.

Sunucu sürümünü doğrulamak için (probe bunu kontrol etmiyor):

```
curl -sS -X POST https://codecraft-ashy-seven.vercel.app/mcp \
  -H 'content-type: application/json' \
  -H 'accept: application/json, text/event-stream' \
  -d '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18","capabilities":{},"clientInfo":{"name":"check","version":"0"}}}'
```

`serverInfo` alanı `{"name":"codecraft","version":"0.1.0"}` döndürmeli.
**İstemci arayüzü bu sürümü göstermiyor** ve gösteren bir yer aranmamalı:
uzak bağlayıcı bulut altyapısı üzerinden proxy'leniyor, masaüstü uygulaması
sunucuyu yerel bir süreç olarak başlatmıyor ve `initialize` cevabını hiç
görmüyor — `mcp.log` bu bağlayıcı için boş kalıyor. Ölçüldü 01-09-2026.
