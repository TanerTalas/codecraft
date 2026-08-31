# CodeCraft — Yapılacaklar (MCP öncelikli)

Bu liste 31-08-2026'da yeniden yazıldı. Kararın kaynağı
`docs/anlik_karar_degisikligi.md`: web arayüzü **ertelendi**, öncelik bir **MCP
sunucusuna** kaydı. Gerekçe orada, burada sadece işaretlenecek adımlar var.

**Aşama 0–4 ve Geçiş Kapısı arşivde:** `docs/ileride-donulecek-todo.md`. Kod
içindeki `bkz. TODO.md Aşama N` yorumları oraya bakar. Aşama 0–3 tamamlandı,
Aşama 4 (web arayüzü) ertelendi — iptal değil.

**Nasıl kullanılır**

- Aşamalar sırayla yapılır. Bir aşamanın bitiş kriteri karşılanmadan sonrakine geçilmez.
- "Tamamlandı" sadece bitiş kriteri ölçüldüğünde yazılır. Ölçüt yoksa yarım iş için de aynı cümle kurulur.
- Bir madde bittiğinde `- [ ]` → `- [x]` yapılır ve commit edilir.
- Yanlış çıkan ölçüm silinmez, üstü çizilir ve nereye gittiği yazılır.

**Sürüm numarası hatırlatması**

Dosyalara yazılan biçim her zaman `1.26.xx`. Pazarlama numarası (`26.40`) hiçbir JSON alanına yazılmaz. Bkz. `CLAUDE.md`.

**Yerleşim kararı (31-08-2026, M1 ile doğrulandı)**

Araç mantığı yeni bir `packages/mcp` workspace'inde, transport mevcut Next
uygulamasında `app/src/app/mcp/route.ts` olarak. Mimari kural 1: mantık
çekirdekte, arayüz ince kabuk. Vercel Node runtime ve `data/` dosya izleme
zaten kurulu (`app/next.config.ts`), sıfırdan bir dağıtım hedefi açılmıyor.
~~**Bu karar Aşama M1'in ölçümüne bağlı** — `tsc` alt süreci orada koşmazsa
container tabanlı barındırmaya geçilir.~~ **Ölçüldü ve tuttu (31-08-2026):**
dağıtılmış Vercel Node runtime'da alt süreç açılıyor, `/tmp` yazılabilir ve
native `tsc` ikilisi exec izniyle birlikte paketleniyor. Ayrıntı Aşama M1.

---

## Aşama M0 — Karar kayda geçsin, kural çelişkisi çözülsün

MCP kodu yazılmadan önce, çünkü son iki madde `CLAUDE.md`'nin "Takıldığında dur
ve sor" tablosuna giriyor.

- [x] `docs/anlik_karar_degisikligi.md` commit edildi (31-08-2026) — yönü
  değiştiren karar artık depoda, listeden önce geliyor
- [x] `docs/ROADMAP.md`'ye MCP aşaması yazıldı (31-08-2026) — "Aşama M: MCP
  sunucusu", kapıdan sonra ve Aşama 4'ten önce. Aşama 4 numarasını koruyup
  "ertelendi" notu aldı; arşiv ve kod yorumları o numaraya gönderme yapıyor,
  yeniden numaralandırmak onları kırardı
- [x] **Mimari kural 2 genelleştirildi (31-08-2026).** Eski hâli "Üretim
  tarayıcıda, doğrulama sunucuda" idi ve tek bir dünyayı, web arayüzünü
  anlatıyordu — MCP'de tarayıcı da yok, anahtar da yok. Yeni hâli iki istemciyi
  birden kapsıyor: CodeCraft modeli kendi çalıştırmaz, kullanıcının anahtarını
  görmez; doğrulama her iki durumda da sunucuda. Niyet değişmedi, kelimeler
  değişti. `CLAUDE.md` içinde gerekçesiyle yazılı
- [x] **Barındırma kuralı yerinde kaldı (31-08-2026).** "Ücretli API, tier veya
  hosting kullanmak" maddesi esnetilmedi. Karar: **projeyi ücretsiz tutmak için
  elden gelen yapılır.** Önce Aşama M1 ölçülür; ücretsiz kademe `tsc`'yi
  koşturamıyorsa önce ücretsiz kalmayı koruyan alternatifler denenir, ancak
  ondan sonra ve gerçek rakamla birlikte tekrar sorulur. `CLAUDE.md`
  "Yapılmayacaklar" satırına bu şekilde işlendi

**Bitiş kriteri:** Karar dokümanı commit'li, iki soru cevaplanmış, `CLAUDE.md`
ve `docs/ROADMAP.md` MCP'yi anlatıyor. ✅

> **Kapandı, 31-08-2026.** Dört madde de bitti: karar dokümanı commit'lendi
> (`52a7ef2`), `docs/ROADMAP.md`'ye "Aşama M: MCP sunucusu" yazıldı ve Aşama 4
> "ertelendi" notu aldı (`58cacaa`), mimari kural 2 genelleştirildi ve
> barındırma kuralı yerinde bırakıldı.
>
> Bu aşamada ölçülen bir şey yok — hepsi karar ve doküman işi. Ölçüm Aşama
> M1'de başlıyor.

---

## Aşama M1 — Barındırma ölçümü

Karar dokümanı bunu risk olarak işaretlemiş: "**Bunu erken test et**, mimariyi
etkiler". Yerleşim kararı verildi ama ayakta kalması bu ölçüme bağlı.

Ölçülecek somut şey: `validateScript()` `tsc`'yi **alt süreç** olarak
çalıştırıyor (`packages/validator/src/script.ts`, `spawn(process.execPath,
[tscBin(), …])`), her çağrıda `mkdtemp` ile yazılabilir bir geçici dizin açıyor
ve `data/<sürüm>/script-types/` altındaki `.d.ts` dosyalarını okuyor. Serverless
bir ortamda bu üçünün hiçbiri garanti değil.

- [x] Dağıtılmış Vercel Node runtime'da `POST /api/review` gerçekten koşuyor mu.
  Uç nokta zaten var (`app/src/app/api/review/route.ts`, `runtime = "nodejs"`,
  `maxDuration = 60`) — ~~ölçüm için yeni kod yazmaya gerek yok, sadece deploy~~
  **Yanlış çıktı, 31-08-2026.** Deploy'dan önce üç kırık bulundu ve üçü de ilk
  koşuyu barındırmayla ilgisi olmayan bir sebeple kırmızıya düşürecekti; böyle
  bir yanlış kırmızı projeyi gereksiz yere ücretli container barındırmaya
  iterdi. Ayrıntı aşağıdaki blokquote'ta
- [x] Üç şey ayrı ayrı ölçülür, tek "çalıştı" cümlesi yetmez — **dağıtılmış
  uçta altısı da yeşil.** `scriptRuntimeReport()`
  (`packages/validator/src/script.ts`) altı ön koşulu ayrı ayrı, her biri kendi
  `try/catch`'inde ölçüyor; `GET /api/review` onu dışarı veriyor
  - [x] süreç spawn edilebiliyor mu — `spawn` kontrolü
  - [x] `os.tmpdir()` yazılabilir mi — `tmpdir` kontrolü
  - [x] `outputFileTracingIncludes` ile paketlenen `node_modules/typescript/**`
    ve `data/**` çalışma zamanında bulunuyor mu — `data`, `tscShim`, `tscExe`
    kontrolleri, artı build çıktısındaki `.nft.json` manifestinin okunması
- [x] **Düşerse sıra şu — ücretsiz kalmak öncelikli (M0 kararı).** Gerek
  kalmadı, hiçbir basamağa inilmedi:
  1. Başka bir **ücretsiz** kademe denenir; kök `CODECRAFT_ROOT` ortam
     değişkeniyle sabitlenir (`packages/knowledge/src/paths.ts` bunu zaten
     destekliyor, yukarı yürüyen kök arayışına güvenilmez)
  2. Olmuyorsa ürün esnetilir: `validate_script` MCP'den çıkarılır, alt süreç
     gerektirmeyen araçlarla (JSON, komut, lookup, şema) sınırlı bir sunucu
     yayınlanır
  3. İkisi de olmuyorsa **durulur ve gerçek rakamla sorulur.** Kendiliğinden
     ücretli plana geçilmez
- [x] Deploy hesabı gerekiyor (Vercel). Bağlandı (`tanertalas`,
  `taner-s-team/codecraft`), production deploy `Ready`

**Bitiş kriteri:** Dağıtılmış bir uçta gerçek bir script doğrulaması gerçek
`tsc` çıktısı döndürüyor. Sonuç yeşil de olsa kırmızı da olsa buraya blokquote
olarak yazılır.

> **YEŞİL, 31-08-2026. Bitiş kriteri karşılandı.** Dağıtılmış bir uçta gerçek
> bir script doğrulaması gerçek `tsc` çıktısı döndürdü. Yerleşim kararı
> (`packages/mcp` + `app/src/app/mcp/route.ts`) ayakta kalıyor; container
> tabanlı barındırmaya geçilmiyor, merdivenin hiçbir basamağına inilmedi.
>
> **Dağıtılmış ölçüm** — `codecraft-8bed0yz8k`, production, `linux-x64`,
> Node v24.18.0, bölge `iad1`:
>
> ```
> GET /api/review                                    HTTP 200, 1,78 s (soğuk)
>   root     ROOT=/var/task  data=var  codecraft.config.json=var  cwd=/var/task/app
>   data     sürüm=1.26.40.5  server@2.9.0 734.924 bayt  common@1.3.0  server-ui@2.1.0
>   tmpdir   /tmp yazılabilir
>   tscShim  /var/task/node_modules/typescript/bin/tsc (44 bayt)
>   tscExe   .../@typescript/typescript-linux-x64/lib/tsc (24.101.026 bayt)
>            lib.d.ts var, exec izni var
>   spawn    Version 7.0.2 (exit 0), 211 ms
> ```
>
> Altı kontrolün altısı da yeşil. Üç kritik cevap: **alt süreç açılabiliyor**,
> **`/tmp` yazılabilir**, **paketlenen dosyalar çalışma zamanında bulunuyor** —
> exec biti dahil, ki bu ölçülene kadar bilinmiyordu.
>
> **Gerçek doğrulama** (`POST /api/review`, 0,64 s ve 0,57 s):
>
> | Payload | Sonuç |
> |---|---|
> | `runCommandAsync` (2.x'te kaldırılmış) | `ok:false` — `2:33 TS2551: Property 'runCommandAsync' does not exist on type 'Dimension'. Did you mean 'runCommand'?` |
> | `playerBreakBlock` aboneliği | `ok:true` |
>
> Bozuk payload'ın gerçek bir tanı döndürmesi kritik: yalnızca `ok:true`
> görmek, sessizce hiçbir şey derlemeyen bir yoldan da gelebilirdi.
>
> **Ücretsiz kademe yetti.** Hiçbir ücretli plana geçilmedi, `validate_script`
> üründen çıkarılmadı.
>
> **Deploy'dan önce bulunan üç kırık.** Üçü de yerelde ölçüldü, üçü de ilk
> dağıtılmış koşuyu düşürürdü ve hiçbiri Vercel'in yeteneğiyle ilgili değil:
>
> 1. **`codecraft.config.json` paketlenmiyordu.** `knowledge/src/paths.ts`
>    içindeki `isRoot()` iki işaretçiyi **birden** arıyor (`data` VE
>    `codecraft.config.json`); izleme haritasında yalnızca `data/**` vardı.
>    Eski yapılandırmayla alınan `.nft.json` manifestinde
>    `codecraft.config.json` **0 dosya**. `ROOT` modül yüklenirken
>    hesaplandığı için uç nokta daha ilk istekte "Repo kökü bulunamadı" ile
>    düşerdi.
> 2. **tsgo'nun standart kütüphanesi paketlenmiyordu.** `typescript@7` bir
>    kabuk (3,2 MB, `bin/tsc` 44 bayt); asıl derleyici platforma özel bir Go
>    ikilisi (`@typescript/typescript-<platform>-<arch>/lib/tsc`, 24,5 MB).
>    Next ikilinin **kendisini zaten izliyordu** — eski manifestte
>    `@typescript/` altından tam olarak 1 dosya vardı, `tsc.exe` — ama
>    yanındaki `lib.*.d.ts` dosyalarını bırakıyordu. Yalnızca ikili kopyalanıp
>    çalıştırıldığında ölçülen sonuç:
>
>    ```
>    panic: bundled: .../lib/lib.d.ts does not exist;
>           this executable may be misplaced
>    ```
>
>    tsgo standart kütüphaneyi ikilinin yanındaki `lib/` dizininden okuyor;
>    ikili ile o dosyalar ayrılamaz. İlk tahminim ("ikili hiç paketlenmiyor")
>    yanlıştı, manifest karşılaştırması düzeltti.
> 3. **`next build` zaten kırıktı.** `app/src/app/page.tsx` içindeki Adım 0.2
>    ölçüm literali `Context` tipinin sonradan kazandığı `textures` alanını
>    taşımıyordu. Kök `tsconfig.json` `app/` dizinini kapsamadığı için
>    `npm run typecheck` bunu hiç görmüyor — sessizce çürümüştü. Deploy build
>    adımında düşerdi.
>
> **Ölçülen rakamlar (yerel, Windows, Node 24.13.0):**
>
> | Ne | Değer |
> |---|---|
> | `/api/review` fonksiyon paketi | 4.148 dosya, **47,3 MB** |
> | └ `data/` (izlenen) | 14,0 MB — `schemas/` 11 MB, `script-types/` 1,7 MB |
> | └ typescript kabuğu | 3,2 MB |
> | └ tsgo ikilisi + `lib.*.d.ts` | 28 MB (`tsc` 24,5 MB) |
> | `tsc --version` alt süreci | 77–218 ms |
> | `npm test` | 175/175 |
>
> Altı kontrolün hepsi yerelde yeşil: `root`, `data`, `tmpdir`, `tscShim`,
> `tscExe`, `spawn`. Yerel kurulumda yalnızca `win32-x64` paketi var, yani bu
> koşu **Linux ikilisini kanıtlamıyor**; `package-lock.json` içinde
> `@typescript/typescript-linux-x64` kayıtlı (`os: linux, cpu: x64`), Vercel'in
> Linux build'i onu kuracak.
>
> **Elenen alternatif.** "Alt süreçten kurtulmak için `typescript/unstable/*`
> JS API'sine geçilsin" fikri ölçüldü ve işe yaramaz:
> `dist/api/async/client.js` ve `dist/api/syncChannel.js` `child_process`
> kullanıyor, yani JS API de aynı native ikiliyi alt süreç olarak açıyor. Bu
> yol kapalı, tekrar denenmesin.
>
> **Deploy sürtünmesi, kayda değer iki tanesi.** (1) Vercel'in "preview
> comments" adımı Next 16.3.3'ün immutable static upload'ıyla çakışıyor ve
> deploy'u çıktı yükleme aşamasında düşürüyordu — CLI preview, CLI production,
> `--archive=tgz` ve git-tetiklemeli deploy, dördü de aynı satırda düştü, yani
> hedefle veya yükleme biçimiyle ilgisi yok. Çözüm: proje ayarlarında Vercel
> Toolbar → Comments, Preview ve Production için Off. (2) Monorepo yerleşimi
> `vercel.json` ile çözüldü: dağıtım kökü repo kökü, `buildCommand` workspace'i
> hedefliyor. Böylece "Include files outside root directory" ayarına hiç
> ihtiyaç olmadı ve `data/` ile `@typescript` doğal olarak paket içinde kaldı.
>
> **Açık kalan:** ölçüm için Vercel Authentication kapatıldı, yani uç şu an
> herkese açık. Salt okunur ve gizli veri döndürmüyor ama `tsc` koşturuyor;
> istek sınırı Aşama M4'te zaten açık madde. M4 bunu kalıcı olarak public
> istiyor (bağlantı Anthropic'in bulut altyapısından kuruluyor, SSO'nun
> arkasına geçemez), o yüzden karar M4'e devredildi.

---

## Aşama M2 — `packages/mcp` iskeleti ve bağımlılık sınırı

- [x] `packages/mcp` workspace'i — `package.json`, `exports: "./src/index.ts"`.
  Derleme adımı yok; depoda hiçbir paketin derleme adımı yok, Node `.ts`
  dosyalarını doğrudan çalıştırıyor. Kök `package.json` ve `tsconfig.json`
  değişmedi: `workspaces: ["packages/*"]`, test glob'u ve `include` yeni paketi
  kendiliğinden kapsıyor
- [x] `@modelcontextprotocol/sdk` bağımlılığı — **1.30.0** kuruldu
- [x] **Bağımlılık sızıntısı** — `@codecraft/core/server` alt yolu açıldı
  (`packages/core/src/server.ts`). `review.ts`, `feasibility.ts`, `context.ts`,
  `normalize.ts` dışa açıldı; `model.ts` ve `generate.ts` açılmadı. Ayrıca
  `errors.ts` (`UserError`, hata eşlemesi için) ve `output.ts`
  (`generatedFileSchema`, M3'te `review_pack`'in girdi şeması) — ikisi de saf,
  `ai` çekmiyor. `src/browser.ts` ile aynı dikiş, aynı gerekçe
- [x] Testi `packages/core/test/layers.test.ts` kalıbıyla yazıldı: **geçişli**
  import grafiği yürünüyor. `packages/mcp` tarafında **ikinci bir test** var,
  gerekçesi aşağıda
- [x] `packages/mcp` `@codecraft/core`'a değil `@codecraft/core/server`'a
  bağlanıyor; `@codecraft/validator` ve `@codecraft/knowledge`'a doğrudan
  (emsal: `evals/package.json` aynı üçlüyü bildiriyor — mcp bir kabuk değil,
  core ile aynı katmanda bir mantık paketi; kabuk M4'te `app/` tarafında olacak)
- [x] Tek canlı araç: `get_version_info`. M2'nin yazılı bitiş kriteri hiçbir şey
  **koşmadan** da karşılanıyordu; boş bir iskelet de yeşil görünürdü

**Bitiş kriteri:** `npm run typecheck` exit 0, yeni katman testi yeşil,
`npm test` düşmüyor. ✅

> **YEŞİL, 31-08-2026.** `npm run typecheck` exit 0, `npm test` **184/184**
> (M1'de 175'ti, dokuz yeni test). Sızıntı dikişi yerinde ve **ölçülerek**
> yerinde.
>
> **Beş test, üçü bilerek kırılarak doğrulandı.** Arşivdeki Aşama 4 Adım 1'de
> "yeşil ama hiçbir şey ölçmeyen test" hatası bir kez yapıldı, o yüzden her
> yeni testin kırmızıya döndüğü görülmeden yazıldı sayılmadı:
>
> | Enjekte edilen hata | Kırmızıya dönen |
> |---|---|
> | `server.ts`'e `export { callModel } from "./model.ts"` | *LLM SDK'sına ulaşılamıyor*, *LLM'e bağlı modüller grafikte değil* |
> | `validator/package.json`'a `@ai-sdk/google` bağımlılığı | *workspace paketleri LLM SDK'sı bildirmiyor* |
> | `version.ts`'te `@codecraft/core/server` → `@codecraft/core` | mcp'nin iki katman testi de |
>
> Üçüncüsü ayrı bir test gerektirdi ve gerekçesi şu: core tarafındaki dikiş,
> mcp'nin o dikişi **kullandığını** ölçmüyor. Tek satırlık bir barrel import'u
> sızıntıyı geri getirir ve `packages/core`'un testleri yeşil kalırdı.
>
> İkinci kör nokta manifest testiyle kapatıldı: yürüyücü paket sınırını
> geçmiyor (`layers.test.ts` bunu kendi yorumunda söylüyor), yani
> `@codecraft/validator`'ın **içindeki** bir `ai` import'unu göremezdi. O yüzden
> grafikte adı geçen workspace paketlerinin `package.json`'ları ayrıca
> okunuyor.
>
> **`layers.test.ts`'in 4. testi `server.ts` eklenince kırılıyordu.** `known`
> set'i `[...graph.keys(), ...NODE_BOUND, "index.ts", "browser.ts"]` ve `src/`
> tam 16 dosyaydı — sıfır boşluk. `"server.ts"` elle eklendi. Yeni bir giriş
> noktası açan herkes aynı yere bakacak.
>
> **`get_version_info` ölçüldü** (`InMemoryTransport`, gerçek `tools/list` +
> `tools/call`, gerçek `data/`):
>
> | Alan | Bayt |
> |---|---|
> | **toplam (compact)** | **3.290** |
> | toplam (girintili) | 4.025 |
> | └ `documentTypes` (60 tip) | 1.936 |
> | └ `formatVersions` | 640 |
> | └ `patterns` | 435 |
> | └ `modules` | 88 |
> | └ kalanı (sürüm alanları, textures, identities) | ~60 |
>
> ~30.000 token sınırının kat kat altında. **M3'ün token tavanı maddesinin ilk
> gerçek rakamı bu** — ve bu araç en küçüğü; `get_schema` ham şemayı
> döndüremez (`commands.json` tek başına 650.454 bayt).
>
> Dönen sürüm `resolveVersion()` ile ikinci bir yoldan karşılaştırıldı: yalnızca
> "hata atmadı" görmek, sessizce boş dönen bir yoldan da gelebilirdi. Ayrıca
> pazarlama numarası (`26.40`) verildiğinde araç **hata döndürüyor**, sessizce
> en yeni sürüme düşmüyor.
>
> **Yanlış varsayım, ölçümle düzeldi.** Test önce `tool.annotations.title`'a
> bakıyordu ve kırmızıydı. `title` `Tool`'un **üst düzey** alanı;
> `ToolAnnotations` içinde de aynı adlı bir alan var ve ikisi karıştırılıyor.
> SDK 1.30.0 üst düzeyde veriyor — araç doğruydu, test yanlıştı.
>
> **M4'ü etkileyen iki ölçüm.** İkisi de M2'nin işi değil ama burada bulundu:
>
> 1. **M4'ün "bilinen sürtünme" maddesi çözülmüş.** SDK 1.30.0
>    `WebStandardStreamableHTTPServerTransport` taşıyor
>    (`dist/esm/server/webStandardStreamableHttp.js`) ve imzası
>    `handleRequest(req: Request): Promise<Response>` — Next App Router'ın
>    verdiği şeklin aynısı. Durumsuz bir `POST /mcp` elle yazmaya gerek yok.
>    M4'e gelindiğinde o madde bu ölçümle güncellenir
> 2. **Paket ağırlığı sorun değil.** SDK `node_modules`'a 5,7 MB koyuyor ve
>    `express`, `hono`, `jose`, `eventsource` gibi ağır bağımlılıkları var — ama
>    `server/mcp.js`'in geçişli import kapanışı yürünüp ölçüldü: **14 yerel
>    dosya**, çıplak bağımlılık olarak yalnızca `ajv`, `ajv-formats`, `zod`,
>    `zod-to-json-schema`. Express ve hono kapanışta **yok**; ilk ikisi zaten
>    validator üzerinden pakette. Yani M4'te `/mcp` fonksiyon paketi
>    `/api/review`'un 47,3 MB'ının üstüne kayda değer bir şey eklemeyecek
>
> **Açık kalan (M2 kapsamı dışı, kayda geçiyor):** `SERVER_VERSION`
> `packages/mcp/src/server.ts` içinde elle tutuluyor ve `package.json` ile
> eşleşmesi test edilmiyor. Tek bir sürüm dizesi için `package.json` okumak
> gereksiz göründü; M6'da doküman yazılırken tekrar bakılır.

---

## Aşama M3 — Araçlar

Karar dokümanındaki altı araç, artı sonradan onaylanan ikisi — **toplam
sekiz.** Hepsi salt okunur, hepsine `readOnlyHint`, hepsinin açık bir başlığı
var. Yazma işlemi yok.

| Araç | Sarmaladığı |
|---|---|
| `validate_json(içerik, tip, sürüm)` | `validateJson` — `packages/validator/src/json.ts` |
| `validate_script(kod, sürüm, kanal)` | `validateScript` — `packages/validator/src/script.ts` |
| `lookup_block(id, sürüm)` | `lookup` / `lookupAny` / `blockStates` — `packages/knowledge/src/lookup.ts` |
| `get_schema(tip, sürüm, yol?)` | `resolveType` / `listTypes` / `schemaFormatVersions` — `packages/validator/src/schema-map.ts` |
| `get_version_info()` | `resolveVersion` + `buildContext` — `packages/knowledge/src/version.ts`, `packages/core/src/context.ts` |
| `check_feasibility(niyet)` | `checkFeasibility` — `packages/core/src/feasibility.ts` |

Altısı da yazılmış ve testli fonksiyonlar. Bu sarmalama işi, sıfırdan iş değil.

- [x] Kalan yedi aracın girdi şeması, başlığı ve `readOnlyHint`'i.
  `get_version_info` M2'de bitti ve kalıbı kurdu: `registerTool(ad, {title,
  description, inputSchema, annotations}, cb)`, sürüm parametresi her araçta
  tek biçim (opsiyonel `version` dizesi), `annotations: {readOnlyHint: true,
  openWorldHint: false}`. **Dikkat:** `title` `Tool`'un üst düzey alanı,
  `annotations`'ın içinde değil — ikisi de spec'te var ve M2'de bir kez
  karıştırıldı
- [x] **Token sınırı bu aşamanın asıl işi.** Karar dokümanı bunu optimizasyon
  değil zorunluluk sayıyor (özel bağlayıcılar için ~30.000 token). Ölçülmüş
  dosya boyutları:

  | Dosya | Bayt |
  |---|---|
  | `data/<sürüm>/commands.json` | 650.454 |
  | `blockception/compiled/behavior/entities/entities.json` | 585.237 |
  | `data/<sürüm>/blocks.json` | 166.558 |
  | `blockception/compiled/behavior/features/features.json` | 85.105 |
  | `blockception/compiled/behavior/spawn_rules/spawn_rules.json` | 77.288 |

  Bayt sayıları ölçüldü, token karşılıkları ölçülmedi — ama en büyüğü sınırın
  kat kat üstünde ve bunu görmek için dönüştürmeye gerek yok. Yani `get_schema`
  ham şemayı **döndüremez**
- [x] `get_schema` tasarımı: zorunlu alanlar + `format_version` için izin
  verilen değerler (`schemaFormatVersions`) + istenen alt yol (`yol?`
  parametresi). Tüm registry değil, hedefe yönelik sonuç
- [x] Her araç çıktısına sert bayt tavanı ve kesildi bildirimi. Sessiz kesme
  yok — model neyin eksik olduğunu bilmeli
- [x] ~~`lookup_block`~~ `lookup_id` tek kimliğin sonucunu döndürür, indeksi değil. Mevcut
  `lookup()` zaten öyle çalışıyor, korunmalı
- [x] Hata çıktısı düzleştirilmeden geçirilir. `json.ts`'teki `describe()` ve
  `checks.ts`'teki `Finding.evidence` zaten eyleme dönüştürülebilir mesaj
  üretiyor; arşivdeki Adım 3.5 ölçümü tam olarak bunun bir vakayı kurtardığını
  gösteriyor (`ore-gen-01`)

**Karar dokümanında olmayan iki araç önerisi — ~~onay bekliyor~~ ONAYLANDI
(31-08-2026).** İkisi de M3 kapsamına girdi. Yani araç sayısı altı değil sekiz,
biri (`get_version_info`) M2'de bitti:

- [x] `validate_command(satır, sürüm)` — `validateCommand`,
  `packages/validator/src/command.ts`. 83 komut, 270 aşırı yükleme, 225 enum.
  Yazıldı ve `CLAUDE.md`'de "yapıldı" diye işaretli; dışarı açılmaması kayıp
- [x] `review_pack(dosyalar, sürüm)` — `review()`, `packages/core/src/review.ts`.
  Bütün doğrulayıcıları ve semantik kontrolleri bir pakete birden koşturan
  toplayıcı. Tek çağrıda en çok değer üreten araç bu;
  `app/src/app/api/review/route.ts` zaten aynı şekli kullanıyor.
  `@codecraft/core/server` bunu M2'de dışa açtı, girdi şeması için
  `generatedFileSchema` de orada

**Bitiş kriteri:** Her aracın girdi şeması, `readOnlyHint`'i ve bayt tavanı var;
en büyük şema tipi (`entities`) sınırın altında anlamlı bir yanıt döndürüyor —
ölçülerek. ✅

> **YEŞİL, 01-09-2026.** `npm run typecheck` exit 0, `npm test` **206/206**
> (M2'de 184'tü, 22 yeni test). Sekiz aracın sekizi de bağlı ve ölçüldü.
>
> **Sekiz aracın gerçek çıktısı** (`InMemoryTransport`, gerçek istemci, gerçek
> `data/`, sıkıştırılmış JSON):
>
> | Araç | Bayt | Süre |
> |---|---|---|
> | `lookup_id` (`oak_stairs`, durumlarıyla) | 199 | 4 ms |
> | `review_pack` (1 dosya) | 192 | 272 ms |
> | `validate_script` (kaldırılmış API) | 285 | 140 ms |
> | `validate_json` (bozuk manifest) | 458 | 77 ms |
> | `get_schema` (kök) | 695 | 2 ms |
> | `check_feasibility` (engellendi) | 773 | 2 ms |
> | `validate_command` (`/execute`) | 2.683 | 3 ms |
> | `get_version_info` | 3.290 | 36 ms |
> | **`get_schema` (`minecraft:entity/components`)** | **15.898** | 8 ms |
>
> Tavan 24.000 bayt. En büyük çıktı onun **%66'sı**, geri kalan sekizi %14'ün
> altında.
>
> **Sınır tek bir araçta baskı yapıyor, ölçümden önce bu bilinmiyordu.** TODO
> "token sınırı bu aşamanın asıl işi" diyordu ve doğruydu — ama iş sekiz araca
> yayılmış bir optimizasyon değil, `get_schema`'nın tasarımı çıktı. Diğer yedi
> araç hiç dokunulmadan sığıyor.
>
> **`tools/list` 8.857 bayt** (~2.214 token) — karar dokümanının andığı
> ~30.000 token bütçesinin **%7'si**. O sınır araç TANIMLARI için ve orada
> sıkışıklık yok; asıl sınır sonuçlarda.
>
> **`get_schema` şema özetleyicisi** `packages/validator/src/schema-summary.ts`
> içinde — MCP'ye bağlı değil, saf fonksiyon (mimari kural 3). Tasarımı üç
> ölçüme dayanıyor:
>
> 1. **Bütün `$ref`'ler içsel** — `blocks.json`'daki 76 ref'in 76'sı
>    `#/definitions/…`. "compiled" dış ref'leri zaten gömmüş, yani alt ağaç
>    çıkarmak için başka dosya okumak gerekmiyor
> 2. **Ham şema büyük olmasa bile işe yaramazdı** — derleme tanım adlarını tek
>    harfe indirmiş (`#/definitions/A`, `B`, `B_components_ref`)
> 3. **Patlama derinlerde** — kök özetleri 700-830 bayt, ama
>    `minecraft:entity/components` düğümünde **390 alan** var ve tam özeti
>    59.763 bayt
>
> Daralma kademeli ve her basamak adıyla bildiriliyor: `full` →
> `no-descriptions` → `names-only` → `clipped`. **"İlk 60 alanı göster, sus"
> yapılmadı** — o yol modele geri kalan 330 alanın var olmadığını düşündürürdü.
> `names-only` basamağında 390 adın hepsi duruyor, model sonra `path` ile tek
> bir bileşene inip tam ayrıntıyı alıyor (644 bayt).
>
> **İki ölçülmüş küçültme, ikisi de tahminle değil rakamla:**
>
> | Değişiklik | Önce | Sonra |
> |---|---|---|
> | `required: false` alanını hiç yazmamak (390 alanlı düğüm) | 22.528 B | 15.898 B |
> | Girintiyi bırakmak (`get_schema`, aynı düğüm) | 22.966 B | 15.898 B |
>
> İkincisi aynı zamanda bir **hatayı kapattı**: `summarizeSchema` daralmasını
> sıkıştırılmış bayt üzerinden ölçüyor. Girintili yazsaydık tam da tavana göre
> daraltılmış bir özet girintiyle tavanı tekrar aşar ve sert kesmeye
> yakalanırdı — yani geçerli JSON bozulurdu. Ölçüm olmasa fark edilmezdi.
>
> **Tavanın gerçekten ölçtüğü kanıtlandı.** Tavan geçici olarak 300 bayta
> çekildi: üç aracın üçü de tam 300 baytta kesildi, üçü de `[KESİLDİ]`
> bildirdi, araç testlerinden 7'si kırmızıya döndü. Geri alındı. M2'deki
> enjekte-et-ve-kırmızıya-dön yönteminin aynısı.
>
> **`lookup_block` → `lookup_id`, karar dokümanından sapma.** Doküman aracı
> blokla sınırlıyordu ama lookup katmanı on iki türü tanıyor (blok, eşya,
> varlık, biyom, efekt, büyü, feature, boyut, kamera ön ayarı,
> cooldown-category, potion-effect, potion-type). Blokla sınırlamak
> `minecraft:blaze` sorusunu hiç sorulamaz yapardı. Kapsam ölçümle de serbestti:
> tek sonuç 74 bayt. Blok çıkarsa durumları da ekleniyor.
>
> **Uçtan uca senaryo koşuldu** (M5'in provası): `check_feasibility` →
> `get_version_info` → `get_schema` → `lookup_id` → `validate_json` →
> `review_pack`. Araçların verdiği `format_version` (`1.21.100`) ve zorunlu
> alanlarla (`description`, `components`) kurulan blok dosyası hem şemadan hem
> paket incelemesinden temiz geçti.
>
> ---
>
> ### Bulunan boşluk: `execute ... run <komut>` yanlış pozitif veriyor
>
> **M3'ün işi değildi, `validate_command` açılırken çıktı.** Doğrulayıcı
> `execute`'un zincirleme biçimini çözmüyor ve `run` sonrasındaki gerçek komutu
> "fazladan argüman" sayıyor — yani **geçerli bir komutu geçersiz raporluyor:**
>
> ```
> /execute as @a run say hi        ok=false   arity: fazladan argüman: "say hi"
> /execute as @a run               ok=true
> /give @p diamond 1               ok=true
> ```
>
> Veri eksik değil: execute'un 18 aşırı yüklemesinin hepsinde
> `chainedCommand: EXECUTECHAINEDOPTION_0` duruyor, doğrulayıcı o parametreye
> özyinelemiyor. Aynı biçim `function`, `place`, `schedule`, `help`, `locate`
> ve `project` komutlarında da var (tarandı).
>
> Yanlış pozitif burada özellikle kötü: `execute … run` en yaygın biçimlerden
> biri ve model doğru yazdığı komutu bozmaya çalışır — CodeCraft'ın önlemek
> için var olduğu hatanın ters yönden aynısı.
>
> **Kapatılmadı, gizlenmedi.** Üç yerde yazılı: `docs/COMMANDS.md`'de ölçümüyle,
> `validate_command`'ın açıklamasında (model o arity hatasını yok saysın diye),
> ve `packages/mcp/test/tools.test.ts` içinde bugünkü davranışı sabitleyen bir
> testte — düzeltilince o test kırmızıya döner (`cases.json`'daki
> `expect: "gap"` kalıbı).
>
> **Düzeltme M3'ün kapsamında değil ve kendiliğinden yapılmadı:** bu
> `packages/validator` işi, sarmalama değil. Karar açık madde olarak duruyor.

---

## Aşama M4 — Transport ve rota

- [ ] **Streamable HTTP.** SSE Mart 2025 spesifikasyonunda kaldırıldı, yeni kod
  SSE ile yazılmaz
- [ ] `app/src/app/mcp/route.ts` — `runtime = "nodejs"`, `maxDuration`
  `validate_script` alt süreci için yükseltilmiş
- [ ] ~~**Bilinen sürtünme:** MCP SDK'sının `StreamableHTTPServerTransport`'u
  Node `req`/`res` bekliyor, Next App Router ise Web `Request`/`Response`
  veriyor.~~ **Çözülmüş, M2'de ölçüldü (31-08-2026).** SDK 1.30.0
  `WebStandardStreamableHTTPServerTransport` taşıyor
  (`dist/esm/server/webStandardStreamableHttp.js`), imzası
  `handleRequest(req: Request): Promise<Response>` — App Router'ın verdiği
  şeklin aynısı. Elle durumsuz `POST /mcp` yazılmayacak. Yine de bu ölçüm
  yalnızca **tipin** uyduğunu söylüyor; dağıtılmış uçta koştuğu M4'te ayrıca
  ölçülür
- [ ] `app/next.config.ts` → `outputFileTracingIncludes` haritasına `/mcp`
  girdisi: `../data/**` ve `../node_modules/typescript/**`. İkisi de dinamik
  yolla okunuyor, Next kendiliğinden bulmuyor (gerekçe dosyada yazılı)
- [ ] Kimlik doğrulama v1'de yok — araçlar salt okunur, gizli veri yok. **Kötüye
  kullanım ve istek sınırı açık madde olarak burada durur**, sessizce atlanmaz

**Bitiş kriteri:** İnternetten erişilebilir HTTPS `/mcp` ucu `tools/list`
çağrısına araç listesini döndürüyor. Localhost sayılmaz — bağlantı Anthropic'in
bulut altyapısından kuruluyor. Geliştirme sırasında ngrok veya Cloudflare Tunnel.

---

## Aşama M5 — Gerçek hesapta bağla ve kullan

- [ ] Kendi Claude Pro hesabına bağlanır: **Customize > Connectors** (Settings
  değil; eski rehberler yanlış yeri gösteriyor)
- [ ] Günlük kullanım. Karar dokümanının dördüncü gerekçesi bu: ürünü test
  etmenin en iyi yolu kendim kullanmak
- [ ] Hangi araçların gerçekten çağrıldığı, hangilerinin hiç çağrılmadığı
  gözlemlenir ve yazılır. Çağrılmayan araç ya gereksiz ya da açıklaması kötü

**Bitiş kriteri:** Sunucu bağlı ve gerçek bir Bedrock isteği baştan sona MCP
üzerinden doğrulanmış çıktı üretiyor.

---

## Aşama M6 — Kurulum dokümantasyonu

- [ ] `docs/MCP.md`: araç listesi, kurulum yolu (Customize > Connectors), token
  sınırı kararları, barındırma ölçümünün sonucu. Diğer `docs/` dosyalarıyla
  aynı sözleşme
- [ ] `CLAUDE.md` "Ayrıntı" listesine satır eklenir

---

## Devralınan açık işler (MCP dışı)

Arşivde `- [ ]` olarak duran ve MCP yolunu da ilgilendiren maddeler.

- [ ] **Taze kapı koşusu.** Çekirdek liste 20/20 ama `--generator=cached` ile
  alındı ve o üretici parmak izini doğrulamıyor; 19 vakanın çıktısı bugünkü
  prompt'tan önce üretilmişti. Skor "bu çıktılar bugünkü doğrulayıcıdan
  geçiyor" demek, "bugünkü prompt 20/20 üretiyor" **demiyor**. 20 taze istek
  gerekiyor
- [ ] **Şemaların birebir commit edilmesi kararı.** Depo public yapılmadan önce
  yeniden değerlendirilecek (`docs/SOURCES.md`). MCP sunucusu yayınlamak
  demek, bu madde artık daha yakın
- [ ] **Pipeline'ın hiç koşmamış iki yolu:** (1) veri gerçekten değiştiğinde
  bot'un commit + push atması, (2) başarısızlıkta GitHub issue açılması.
  İlki Mojang bir sonraki sürümü yayınladığında kendiliğinden ölçülür
- [ ] **`execute ... run <komut>` zincirlemesi** — `validateCommand` geçerli
  komutu geçersiz raporluyor (yanlış pozitif). M3'te bulundu ve ölçüldü,
  kapsamı dışı olduğu için kapatılmadı: bu `packages/validator` işi. Ölçüm ve
  düzeltmenin nereye gireceği `docs/COMMANDS.md` sonunda
- [ ] Python doğrulayıcısı kararı (arşiv, Aşama 2.5)
- [ ] Opsiyonel: Bedrock Dedicated Server (arşiv, Aşama 0)

---

## Ertelendi — arşivde

Karar dokümanının "Ertelenen işler" listesi. **İptal değil**, MCP oturduktan
sonra dönülecek:

- Web arayüzü tasarımı
- BYOK anahtar giriş akışı
- Sürüm seçici arayüzü
- Doğrulama rozeti — MCP'de araç çıktısının kendisi zaten bu işlevi görüyor

Ayrıntı: `docs/ileride-donulecek-todo.md` Aşama 4, ve tasarım brief'i
`docs/UI.md`.

---

## Açık soru

MCP sunucusu ucuz bir şekilde nasıl kâra dönüştürülür. Karar dokümanı "şimdi
karar verilmeyecek, çalıştığı doğrulandıktan sonra düşünülecek" diyor; burada da
açık soru olarak duruyor.

---

## Yapılmayacaklar (hatırlatma)

`CLAUDE.md`'deki tablo bağlayıcı. Özetle: vektör DB / embedding / RAG yok,
kullanıcı hesabı ve veritabanı yok, kendi JSON şemamızı yazmıyoruz (Blockception
var), model ID'leri koda gömülmüyor, ücretli API / tier / hosting yok.

Sonuncusu Aşama M0'da soruldu ve **esnetilmedi**: proje ücretsiz kalacak,
barındırma için elden gelen yapılacak. Ücretsiz kademe yetmezse önce ürün
esnetilir, ücretli plana kendiliğinden geçilmez.
