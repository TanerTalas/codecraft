# CodeCraft

> **Bu doküman canlı.** Buradaki yapı ve isimlendirmeler öneri niteliğinde,
> kural değil. Daha iyi bir yaklaşım varsa öner ve gerekçesini söyle. Kod ile
> bu doküman çeliştiğinde kodu değil dokümanı güncelle.
>
> Değiştirilemez olanlar sadece "Değişmezler" başlığı altındaki maddeler.
> Onları değiştirmek istiyorsan önce sor.

Minecraft Bedrock için **doğrulama ve veri sorgulama araçları sunan bir MCP
sunucusu.** Modeli kullanıcı getiriyor — kendi Claude istemcisinde, kendi
aboneliğiyle. CodeCraft araya girmiyor, üretmiyor; ürettirilen şeyin gerçekten
çalışıp çalışmayacağını ölçüyor.

Var olma sebebi tek cümle: **Bedrock'ta yanlış hatırlanan bir alan adı sessizce
çalışmayan çıktı üretir.** Genel bir model `format_version`'ı uydurur, olmayan
bir `minecraft:` kimliğine referans verir, `@minecraft/server`'da bulunmayan
bir API çağırır — ve hiçbiri hata vermez, oyuna yüklenene kadar. Araçlar bu
boşluğu kapatıyor: değerler sürüme kilitli veriden okunuyor, çıktı resmi
şemaya ve `tsc`'ye karşı gerçekten doğrulanıyor.

## İki bileşen

1. **MCP sunucusu.** Dokuz salt okunur araç. Bugünkü tek çalışan parça.
2. **Kullanım sitesi.** MCP'nin nasıl kurulup kullanılacağını anlatan web
   sayfası ya da sayfaları. **Henüz üretilmedi** — tasarım ve içerik ayrı bir
   süreçte ele alınacak. Bugün `app/` yalnızca MCP ucunun barındığı yer.

## Katmanlar

Klasör adları bugünkü hâli; ad değiştirmek serbest, katman sınırını
bulanıklaştırmak değil.

| Katman | Bugün nerede | İşi |
|---|---|---|
| MCP araç katmanı | `packages/mcp/` | Araç yüzeyi, açıklamalar, HTTP transport. Araçların gövdesi `src/bedrock/` altında |
| Doğrulama | `packages/validator/` | Şema (ajv), script (`tsc`), komut sözdizimi, Python sözdizimi, şemanın yakalayamadığı semantik kontroller |
| Veri erişimi | `packages/knowledge/` | `data/` üzerinde lookup. Sürüm çözümü, kimlik arama, blok durumları |
| Veri indeksleri | `data/` | Üretilen indeksler, oyun sürümüne göre klasörlenmiş |
| Veri boru hattı | `pipeline/` | Kaynakları çekip indeks üreten script'ler + günlük cron |
| Site | `app/` | Bugün yalnızca `app/src/app/mcp/route.ts` — ince kabuk |

Bağımlılık yönü tek taraflı: `mcp → validator → knowledge → data`. Ters yönde
import yok.

## Sürüm numaralandırma (dikkat)

Bedrock'ta **beş** ayrı sürüm biçimi dolaşıyor ve sürekli karıştırılıyor.
`get_version_info` aracının döndürdüğü değerlerin anlamı bu tablo:

| Numara | Örnek | Nerede kullanılır |
|---|---|---|
| Pazarlama numarası | `26.40` | Sadece duyurularda. **Hiçbir dosyaya yazılmaz** |
| Oyun / veri sürümü | `1.26.40.5` | `data/` klasör adı, veri indeksleri. Kaynağı `bedrock-samples/version.json` |
| `min_engine_version` | `[1, 26, 40]` | `manifest.json`. Üç parçalı dizi, dördüncü hane düşer |
| `@minecraft/server` modül sürümü | `2.9.0` | `manifest.json` → `dependencies` |
| `format_version` | `1.21.100`, `1.13.0`, `2` | İçerik dosyaları. **Oyun sürümüyle ilgisi yok** |

**`format_version` bunlardan tamamen ayrı bir eksen** ve en çok can yakan
karışıklık burada. O, dosya tipinin **kendi şema sürümü**: blok `1.21.100`,
feature rule `1.13.0`, spawn rule `1.8.0`, manifest `2`. Oyun sürümü değişince
değişmez; o dosya biçiminin şeması değiştiğinde değişir.

> Bu satır bir kez yanlış yazılmıştı ("`format_version` ve `min_engine_version`
> alanlarına her zaman 1.26.xx yazılır"). Niyeti "pazarlama numarasını yazma"
> idi ama kural gibi okundu, model uydu ve şema reddetti. Doğru değerler
> hatırlanmaz, **şemadan okunur** — `get_schema` ve `get_version_info` tam
> bunun için var.

Dördüncü satır en çok tuzak olan yer: `@minecraft/server` npm'de kendi
semver'iyle yayınlanıyor ve oyun sürümü prerelease etiketinin **içine gömülü**
geliyor:

```
2.9.0                              kararlı modül sürümü (npm "latest")
2.11.0-beta.1.26.50-preview.27     modül 2.11.0, oyun 1.26.50-preview.27
```

Yani modül `2.x`, oyun `1.26.x`. Biri diğerinin yerine yazılırsa paket sessizce
yüklenmez. Modül sürümü ile oyun sürümü asla birbirinin yerine kullanılmaz.

## Stack

- TypeScript. Derleme adımı yok — Node `.ts` dosyalarını doğrudan koşuyor,
  göreli import'larda `.ts` uzantısı zorunlu. `tsc` sadece tip kontrolü için
- JSON doğrulama: `ajv`
- Script doğrulama: `typescript` derleyicisi (alt süreç)
- MCP: `@modelcontextprotocol/sdk`, durumsuz Streamable HTTP
- Barındırma: Vercel Node runtime, ücretsiz kademe
- Veri pipeline: Node script'leri + GitHub Actions (günlük cron)

Python bir alt süreç olarak açılıyor: `validate_python` sözdizimini gerçek
yorumlayıcıyla ölçüyor. Yorumlayıcı yoksa o ayak atlanıyor ve çıktıda
söyleniyor — sessizce "ok" dönmüyor (`packages/validator/src/python.ts`).

## Değişmezler

Bunları değiştirmek istiyorsan önce sor.

1. **Doğrulama katmanı LLM çağırmaz.** `packages/validator` saf
   fonksiyonlardan oluşur. Depo genelinde hiçbir paket bir LLM SDK'sına
   bağlanmaz — modeli kullanıcı getiriyor, sunucu doğrular, üretmez. Kural laf
   olarak değil ölçüyle duruyor: `packages/mcp/test/no-llm.test.ts`.
2. **Uç salt okunur.** Dokuz aracın dokuzu da `readOnlyHint`. Sunucu hiçbir şey
   yazmıyor, hiçbir yere veri göndermiyor, kullanıcı verisi tutmuyor.
3. **`data/` git içinde durur.** Veritabanı yok, dosya olarak tutulur ve
   versiyonlanır.
4. **Ücretsiz kademe bir kısıt değil, gereksinim.** Bütçe yok. İstek limiti ve
   fonksiyon süresi tasarıma girer; ölçülmeden "yetmez" denmez.
5. **Ham kaynak verisi repoya girmez.** `bedrock-samples` içeriği Minecraft
   EULA'ya tabi. Sadece ondan türetilen indeksler commit edilir, ham içerik
   geri sunulmaz (`docs/SOURCES.md`).

## Yapılmayacaklar

| Yapma | Neden |
|---|---|
| Vektör DB, embedding, RAG altyapısı | Veri yapılandırılmış ve küçük. Sürüm ve niyet belliyse hangi JSON'un gideceği de belli |
| Kullanıcı hesabı, oturum, veritabanı | Sıfır kişisel veri. Uç kimlik doğrulaması olmadan, salt okunur duruyor |
| Kendi JSON şemalarını yazmak | Blockception zaten yazmış, BSD-3-Clause |
| Model ID'lerini koda gömmek | Bu depoda model çağrısı yok; bir gün gerekirse yapılandırmadan okunur |
| Ücretli API, tier veya hosting kullanmak | Bütçe yok, MCP sunucusunun barındırılması da dahil |

## Esnek olduğu bilinen kararlar

Bunlar bugünkü hâl, gerekçesi geçerli olduğu sürece. Daha iyisi varsa değiştir:

- Paket sınırları ve klasör adları. Araç gövdesinin `packages/mcp/src/bedrock/`
  altında durması bir yerleşim tercihi, mimari şart değil
- Araç sayısı ve isimleri
- `data/` altındaki indekslerin biçimi
- Transport'un bir Next rotası olarak durması (`app/src/app/mcp/route.ts`)

## Takıldığında dur ve sor

Emin olmadığın veya erişemediğin bir şeyle karşılaştığında tahmin etme,
uydurma, etrafından dolaşma. **Dur ve kullanıcıya sor.**

| Durum | Örnek |
|---|---|
| Erişim gerekiyor | Bir siteye giriş yapılamıyor, hesap açılması gerekiyor (GitHub, Vercel), API anahtarı yok veya süresi dolmuş |
| Ödeme veya lisans gerekiyor | Minecraft Bedrock lisansı, ücretli tier, alan adı |
| Bilgi doğrulanamıyor | Bir sürüm numarası, API adı veya alan adı kaynağa karşı kontrol edilemiyor |
| İşlem geri alınması zor | Force push, dal silme, dışarıya yayınlama, üçüncü taraf servise veri gönderme |
| Kural esnetilmesi gerekiyor | "Değişmezler" veya "Yapılmayacaklar" tablosuna aykırı bir şey yapmak gerekiyor |

Doğrulanamayan bilgi maddesi bu projede özellikle önemli: aracın var olma
sebebi tam olarak o hata, kendi kodunda da aynısını yapma.

### Nasıl sorulur

- Ne denendiğini, tam olarak neye takıldığını ve varsa hata mesajını yaz.
- Kullanıcının ne yapması gerektiğini tek adımda söyle.
- Terminalde bir komut çalıştırması gerekiyorsa `! komut` biçiminde ver, çıktı
  doğrudan oturuma düşer.
- **Cevabı beklerken o soruya bağlı olmayan işleri bitir.** Bütün işi durdurma,
  sadece bağımlı olan parçayı beklet.

### Yapılmayacak olan

- "Muhtemelen şöyledir" deyip devam etmek
- Sahte veya örnek veriyle ilerleyip gerçekmiş gibi raporlamak
- Erişilemeyen adımı sessizce atlayıp "tamamlandı" demek

Atlanan bir adım varsa açıkça yazılır. Yarım iş, yanlış tamamlanmış işten iyidir.

## Ölçüm yazma kuralı

Bu depoda "çalışıyor" ve "ölçüldü" ayrı şeyler. Bir iddia ancak ölçüldüğünde
yazılır, ve nasıl ölçüldüğü yanına yazılır — tarihiyle birlikte. Yanlış çıkan
bir ölçüm silinmez, üstü çizilir ve nereye gittiği yazılır.

Kod yorumlarındaki "ölçüldü (tarih)" satırları bu yüzden var ve silinmemeliler:
her biri bir kez gerçekten patlamış bir şeyin kaydı.

## Ayrıntı

- Veri kaynakları ve lisansları: `docs/SOURCES.md`
- MCP sunucusu, uç ve kurulum: `docs/MCP.md`
- Araçların gerçek kullanımı, ölçüm günlüğü: `docs/mcp-kullanim.md`
- Komut doğrulama ve kapsamı: `docs/COMMANDS.md`
- Doğrulamanın yakalayamadıkları: `docs/VALIDATION-LIMITS.md`
- WebSocket köprüsü ve ölçümü: `docs/WEBSOCKET.md`

## Git kuralları

Repo **private**. Yine de gizli bilgi asla commit edilmez, private olması bir
güvenlik önlemi değil.

### Commit sıklığı

Her tamamlanan değişiklikten sonra commit at. Birden fazla işi tek commit'te
toplama, ama yarım kalmış bir değişikliği de commit etme. Bir commit tek bir
mantıksal iş olsun.

### Commit mesajı formatı

```
type(scope): kısa özet

- yapılan değişiklik
- yapılan değişiklik
```

| Tip | Ne zaman |
|---|---|
| `feat` | Yeni özellik |
| `fix` | Hata düzeltme |
| `refactor` | Davranış değişmeden kod düzenleme |
| `style` | Biçim, boşluk, isimlendirme |
| `docs` | Dokümantasyon |
| `test` | Test ekleme veya düzeltme |
| `chore` | Bağımlılık, yapılandırma, pipeline |
| `data` | Üretilen veri indekslerinin güncellenmesi |

Kurallar:
- Özet satırı 72 karakteri geçmesin
- Özet satırında nokta kullanma
- Emir kipi kullan ("add", "fix", "remove"), geçmiş zaman değil
- Scope opsiyonel ama varsa tutarlı olsun
- Gövde satırları `-` ile başlasın

### .gitignore

Aşağıdakiler `.gitignore` içinde olmalı ve yeni bir hassas dosya türü ortaya
çıktığında listeye eklenmeli:

**Kimlik bilgileri ve gizli veri**
```
.env
.env.*
*.key
*.pem
secrets/
config.local.*
```

**Bağımlılık ve derleme çıktısı**
```
node_modules/
.next/
dist/
build/
*.tsbuildinfo
```

**Ham kaynak verisi**
```
pipeline/cache/
pipeline/raw/
```
Bu önemli. `bedrock-samples` içeriği Minecraft EULA'ya tabi, ham hâli repoya
girmez. Sadece ondan türetilen indeksler commit edilir.

**Yerel test dosyaları**
```
test-worlds/
*.mcpack
*.mcaddon
.DS_Store
*.log
```

Bir dosyanın hassas olup olmadığından emin değilsen commit etme, önce sor.
