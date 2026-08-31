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

**Yerleşim kararı (31-08-2026)**

Araç mantığı yeni bir `packages/mcp` workspace'inde, transport mevcut Next
uygulamasında `app/src/app/mcp/route.ts` olarak. Mimari kural 1: mantık
çekirdekte, arayüz ince kabuk. Vercel Node runtime ve `data/` dosya izleme
zaten kurulu (`app/next.config.ts`), sıfırdan bir dağıtım hedefi açılmıyor.
**Bu karar Aşama M1'in ölçümüne bağlı** — `tsc` alt süreci orada koşmazsa
container tabanlı barındırmaya geçilir.

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
- [ ] **SOR — mimari kural 2.** "Üretim tarayıcıda, doğrulama sunucuda" diyor.
  MCP'de tarayıcı yok; üretimi kullanıcının kendi modeli, kendi arayüzünde
  yapıyor. Kural MCP'yi kapsayacak biçimde yeniden yazılmalı. Kural
  değiştirmek izne tabi
- [ ] **SOR — "Ücretli API, tier veya hosting kullanmak".** Karar dokümanının
  kendi risk bölümü barındırma maliyetinin kaldığını yazıyor. Ücretsiz kademe
  yetmezse bu kural esner mi, yoksa mimari mi değişir

**Bitiş kriteri:** Karar dokümanı commit'li, iki soru cevaplanmış, `CLAUDE.md`
ve `docs/ROADMAP.md` MCP'yi anlatıyor.

---

## Aşama M1 — Barındırma ölçümü

Karar dokümanı bunu risk olarak işaretlemiş: "**Bunu erken test et**, mimariyi
etkiler". Yerleşim kararı verildi ama ayakta kalması bu ölçüme bağlı.

Ölçülecek somut şey: `validateScript()` `tsc`'yi **alt süreç** olarak
çalıştırıyor (`packages/validator/src/script.ts`, `spawn(process.execPath,
[tscBin(), …])`), her çağrıda `mkdtemp` ile yazılabilir bir geçici dizin açıyor
ve `data/<sürüm>/script-types/` altındaki `.d.ts` dosyalarını okuyor. Serverless
bir ortamda bu üçünün hiçbiri garanti değil.

- [ ] Dağıtılmış Vercel Node runtime'da `POST /api/review` gerçekten koşuyor mu.
  Uç nokta zaten var (`app/src/app/api/review/route.ts`, `runtime = "nodejs"`,
  `maxDuration = 60`) — ölçüm için yeni kod yazmaya gerek yok, sadece deploy
- [ ] Üç şey ayrı ayrı ölçülür, tek "çalıştı" cümlesi yetmez:
  - [ ] süreç spawn edilebiliyor mu
  - [ ] `os.tmpdir()` yazılabilir mi
  - [ ] `outputFileTracingIncludes` ile paketlenen `node_modules/typescript/**`
    ve `data/**` çalışma zamanında bulunuyor mu
- [ ] Düşerse: container tabanlı barındırmaya geçilir ve kök `CODECRAFT_ROOT`
  ortam değişkeniyle sabitlenir — `packages/knowledge/src/paths.ts` bunu zaten
  destekliyor, yukarı yürüyen kök arayışına güvenilmez
- [ ] Deploy hesabı gerekiyor (Vercel). Bağlantı kurulmadan bu aşama ölçülemez

**Bitiş kriteri:** Dağıtılmış bir uçta gerçek bir script doğrulaması gerçek
`tsc` çıktısı döndürüyor. Sonuç yeşil de olsa kırmızı da olsa buraya blokquote
olarak yazılır.

---

## Aşama M2 — `packages/mcp` iskeleti ve bağımlılık sınırı

- [ ] `packages/mcp` workspace'i — `package.json`, `exports: "./src/index.ts"`.
  Derleme adımı yok; depoda hiçbir paketin derleme adımı yok, Node `.ts`
  dosyalarını doğrudan çalıştırıyor
- [ ] `@modelcontextprotocol/sdk` bağımlılığı. Depoda şu an **hiç** MCP kodu
  veya bağımlılığı yok, sıfırdan başlanıyor
- [ ] **Bağımlılık sızıntısı.** Araçların ihtiyacı olan `review`,
  `checkFeasibility`, `buildContext` `@codecraft/core` içinde; ama core
  barrel'ı (`packages/core/src/index.ts`) `model.ts`'i de dışa açıyor ve o
  `ai` + `@ai-sdk/google`'ı çekiyor. MCP sunucusunun LLM SDK'sına ihtiyacı yok
  ve olmamalı — modeli kullanıcı getiriyor
  - Çözüm: core'a `@codecraft/core/server` alt yolu. `review.ts`,
    `feasibility.ts`, `context.ts`, `normalize.ts` dışa açılır; `model.ts` ve
    `generate.ts` açılmaz. `src/browser.ts` ile aynı dikiş, aynı gerekçe
- [ ] Testi `packages/core/test/layers.test.ts` kalıbıyla yazılır: **geçişli**
  import grafiği yürünür, `@codecraft/core/server`'dan `ai` veya `@ai-sdk/*`'a
  ulaşılamadığı ölçülür. Tek dosyanın kendi import satırlarına bakan test
  yetmez — o hata bir kez yapıldı ve iki sızıntıyı kaçırdı
  (arşiv, Aşama 4 Adım 1)

**Bitiş kriteri:** `npm run typecheck` exit 0, yeni katman testi yeşil,
`npm test` düşmüyor.

---

## Aşama M3 — Araçlar

Karar dokümanındaki altı araç. Hepsi salt okunur, hepsine `readOnlyHint`,
hepsinin açık bir başlığı var. Yazma işlemi yok.

| Araç | Sarmaladığı |
|---|---|
| `validate_json(içerik, tip, sürüm)` | `validateJson` — `packages/validator/src/json.ts` |
| `validate_script(kod, sürüm, kanal)` | `validateScript` — `packages/validator/src/script.ts` |
| `lookup_block(id, sürüm)` | `lookup` / `lookupAny` / `blockStates` — `packages/knowledge/src/lookup.ts` |
| `get_schema(tip, sürüm, yol?)` | `resolveType` / `listTypes` / `schemaFormatVersions` — `packages/validator/src/schema-map.ts` |
| `get_version_info()` | `resolveVersion` + `buildContext` — `packages/knowledge/src/version.ts`, `packages/core/src/context.ts` |
| `check_feasibility(niyet)` | `checkFeasibility` — `packages/core/src/feasibility.ts` |

Altısı da yazılmış ve testli fonksiyonlar. Bu sarmalama işi, sıfırdan iş değil.

- [ ] Altı aracın girdi şeması, başlığı ve `readOnlyHint`'i
- [ ] **Token sınırı bu aşamanın asıl işi.** Karar dokümanı bunu optimizasyon
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
- [ ] `get_schema` tasarımı: zorunlu alanlar + `format_version` için izin
  verilen değerler (`schemaFormatVersions`) + istenen alt yol (`yol?`
  parametresi). Tüm registry değil, hedefe yönelik sonuç
- [ ] Her araç çıktısına sert bayt tavanı ve kesildi bildirimi. Sessiz kesme
  yok — model neyin eksik olduğunu bilmeli
- [ ] `lookup_block` tek kimliğin sonucunu döndürür, indeksi değil. Mevcut
  `lookup()` zaten öyle çalışıyor, korunmalı
- [ ] Hata çıktısı düzleştirilmeden geçirilir. `json.ts`'teki `describe()` ve
  `checks.ts`'teki `Finding.evidence` zaten eyleme dönüştürülebilir mesaj
  üretiyor; arşivdeki Adım 3.5 ölçümü tam olarak bunun bir vakayı kurtardığını
  gösteriyor (`ore-gen-01`)

**Karar dokümanında olmayan iki araç önerisi — onay bekliyor:**

- [ ] `validate_command(satır, sürüm)` — `validateCommand`,
  `packages/validator/src/command.ts`. 83 komut, 270 aşırı yükleme, 225 enum.
  Yazıldı ve `CLAUDE.md`'de "yapıldı" diye işaretli; dışarı açılmaması kayıp
- [ ] `review_pack(dosyalar, sürüm)` — `review()`, `packages/core/src/review.ts`.
  Bütün doğrulayıcıları ve semantik kontrolleri bir pakete birden koşturan
  toplayıcı. Tek çağrıda en çok değer üreten araç bu;
  `app/src/app/api/review/route.ts` zaten aynı şekli kullanıyor

**Bitiş kriteri:** Her aracın girdi şeması, `readOnlyHint`'i ve bayt tavanı var;
en büyük şema tipi (`entities`) sınırın altında anlamlı bir yanıt döndürüyor —
ölçülerek.

---

## Aşama M4 — Transport ve rota

- [ ] **Streamable HTTP.** SSE Mart 2025 spesifikasyonunda kaldırıldı, yeni kod
  SSE ile yazılmaz
- [ ] `app/src/app/mcp/route.ts` — `runtime = "nodejs"`, `maxDuration`
  `validate_script` alt süreci için yükseltilmiş
- [ ] **Bilinen sürtünme:** MCP SDK'sının `StreamableHTTPServerTransport`'u Node
  `req`/`res` bekliyor, Next App Router ise Web `Request`/`Response` veriyor.
  Önce bir Web adaptörü araştırılır (SDK'nın kendi desteği veya hazır bir Next
  adaptörü); bulunamazsa araçlar salt okunur ve sunucu→istemci bildirimi
  olmadığı için **durumsuz** bir `POST /mcp` elle yazılır — `initialize`,
  `tools/list`, `tools/call`. Hangisi seçildiyse gerekçesi buraya yazılır
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
var), model ID'leri koda gömülmüyor, ücretli API / tier / hosting yok — bu
sonuncusu Aşama M0'da sorulacak.
