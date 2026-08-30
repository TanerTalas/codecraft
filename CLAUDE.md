# CodeCraft

> **Bu doküman canlı.** Buradaki yapı ve isimlendirmeler öneri niteliğinde, kural değil. Daha iyi bir yaklaşım varsa öner ve gerekçesini söyle. Kod ile bu doküman çeliştiğinde kodu değil dokümanı güncelle.
>
> Değiştirilemez olanlar sadece "Mimari kurallar" ve "Yapılmayacaklar" başlıkları altındaki maddeler. Onları değiştirmek istiyorsan önce sor.

Minecraft Bedrock için komut, behavior pack ve otomasyon script'i üreten yapay zeka asistanı. Kullanıcı oyuncu diliyle isteğini söyler, araç doğrulanmış çıktı verir.

Genel modellerden iki farkı var: sürekli güncellenen resmi veri kaynaklarına bağlı olması, ve ürettiği çıktıyı şemaya karşı gerçekten doğrulaması.

## v1 kapsamı

**İçeride:** Bedrock Edition, PC, tek oyunculu. Komut ve behavior pack üretimi, çıktı doğrulama, dışarıdan çalışan otomasyon script'leri.

**Dışarıda:** Java Edition, Bedrock dışı platformlar, Realms ve sunucular, kullanıcı hesabı sistemi, ödeme.

## Sürüm numaralandırma (dikkat)

Bedrock'ta **dört** ayrı sürüm biçimi dolaşıyor ve sürekli karıştırılıyor:

| Numara | Örnek | Nerede kullanılır |
|---|---|---|
| Pazarlama numarası | `26.40` | Sadece duyurularda. **Hiçbir dosyaya yazılmaz** |
| Oyun / veri sürümü | `1.26.40.5` | `data/` klasör adı, veri indeksleri. Kaynağı `bedrock-samples/version.json` |
| `min_engine_version` | `[1, 26, 40]` | `manifest.json`. Üç parçalı dizi, dördüncü hane düşer |
| `@minecraft/server` modül sürümü | `2.9.0` | `manifest.json` → `dependencies` |

`format_version` ve `min_engine_version` alanlarına **her zaman** `1.26.xx` biçimi
yazılır. Pazarlama numarasını dosyaya yazma.

Dördüncü satır en çok tuzak olan yer: `@minecraft/server` npm'de kendi semver'iyle
yayınlanıyor ve oyun sürümü prerelease etiketinin **içine gömülü** geliyor:

```
2.9.0                              kararlı modül sürümü (npm "latest")
2.11.0-beta.1.26.50-preview.27     modül 2.11.0, oyun 1.26.50-preview.27
```

Yani modül `2.x`, oyun `1.26.x`. Biri diğerinin yerine yazılırsa paket sessizce
yüklenmez. Modül sürümü ile oyun sürümü asla birbirinin yerine kullanılmaz.

## Stack

- TypeScript (zorunlu, script doğrulaması `tsc` ile yapılıyor)
- Veri pipeline: Node script'leri + GitHub Actions
- JSON doğrulama: `ajv`
- Script doğrulama: `typescript` derleyicisi
- Arayüz: Next.js + Tailwind
- LLM soyutlaması: Vercel AI SDK
- Hosting: Vercel veya Cloudflare, ücretsiz kademe

Python sadece **üretilen** otomasyon script'lerinin dili. Altyapıda Python çalıştırılmıyor.

## Repo yapısı

```
data/                 # üretilen indeksler, sürüme göre (1.26.40/ gibi)
pipeline/             # veri toplayıcı script'ler
packages/core/        # üretim döngüsü, CLI ve web ortak kullanır
packages/validator/   # doğrulama, saf TS, LLM yok
packages/knowledge/   # lookup katmanı
evals/                # test vakaları ve runner
app/                  # Next.js
.github/workflows/    # günlük cron
```

## Mimari kurallar

1. **Çekirdek mantık `packages/core` içinde.** CLI ve web arayüzü ince kabuklar. Mantığı arayüz koduna gömme.
2. **Üretim tarayıcıda, doğrulama sunucuda.** LLM çağrısı kullanıcının anahtarıyla client tarafında yapılır, anahtar sunucuya hiç uğramaz. `tsc` ve şema doğrulaması sunucuda.
3. **Validator LLM'siz.** `packages/validator` saf fonksiyonlardan oluşur, hiçbir model çağrısı yapmaz.
4. **`data/` git içinde durur.** Veritabanı yok, dosya olarak tutulur ve versiyonlanır.

## Yapılmayacaklar

| Yapma | Neden |
|---|---|
| Vektör DB, embedding, RAG altyapısı | Veri yapılandırılmış ve küçük. Sürüm ve niyet belliyse hangi JSON'un gideceği de belli |
| Kullanıcı hesabı, oturum, veritabanı | v1'de sıfır kişisel veri. Anahtar tarayıcıda, geçmiş yerelde |
| Kendi JSON şemalarını yazmak | Blockception zaten yazmış, BSD-3-Clause |
| Model ID'lerini koda gömmek | Yapılandırmadan oku, ekosistem sık değişiyor |
| Komut sözdizimi doğrulayıcısı (v1'de) | En zahmetli parça, v1 onsuz da anlamlı |

## Takıldığında dur ve sor

Emin olmadığın veya erişemediğin bir şeyle karşılaştığında tahmin etme, uydurma, etrafından dolaşma. **Dur ve kullanıcıya sor.**

Mutlaka sorulacak durumlar:

| Durum | Örnek |
|---|---|
| Erişim gerekiyor | Bir siteye giriş yapılamıyor, hesap açılması gerekiyor (GitHub, Vercel, Cloudflare, sağlayıcı konsolları), API anahtarı yok veya süresi dolmuş |
| Ödeme veya lisans gerekiyor | Minecraft Bedrock lisansı, ücretli tier, alan adı |
| Bilgi doğrulanamıyor | Bir sürüm numarası, API adı veya alan adı kaynağa karşı kontrol edilemiyor |
| İşlem geri alınması zor | Force push, dal silme, dışarıya yayınlama, üçüncü taraf servise veri gönderme |
| Kural esnetilmesi gerekiyor | "Mimari kurallar" veya "Yapılmayacaklar" tablosuna aykırı bir şey yapmak gerekiyor |

Doğrulanamayan bilgi maddesi bu projede özellikle önemli: Bedrock'ta yanlış hatırlanan bir alan adı sessizce çalışmayan çıktı üretir. CodeCraft'ın var olma sebebi tam olarak bu hata, o yüzden kendi kodunda da aynı hatayı yapma.

### Nasıl sorulur

- Ne denendiğini, tam olarak neye takıldığını ve varsa hata mesajını yaz.
- Kullanıcının ne yapması gerektiğini tek adımda söyle.
- Terminalde bir komut çalıştırması gerekiyorsa `! komut` biçiminde ver, çıktı doğrudan oturuma düşer.
- **Cevabı beklerken o soruya bağlı olmayan işleri bitir.** Bütün işi durdurma, sadece bağımlı olan parçayı beklet.

### Yapılmayacak olan

- "Muhtemelen şöyledir" deyip devam etmek
- Sahte veya örnek veriyle ilerleyip gerçekmiş gibi raporlamak
- Erişilemeyen adımı sessizce atlayıp "tamamlandı" demek

Atlanan bir adım varsa açıkça yazılır. Yarım iş, yanlış tamamlanmış işten iyidir.

## Ayrıntı

- Veri kaynakları ve lisansları: `docs/SOURCES.md`
- Aşamalar ve geçiş kapısı: `docs/ROADMAP.md`
- Doğrulamanın yakalayamadıkları: `docs/VALIDATION-LIMITS.md`

## Git kuralları

Repo **private**. Yine de gizli bilgi asla commit edilmez, private olması bir güvenlik önlemi değil.

### Commit sıklığı

Her tamamlanan değişiklikten sonra commit at. Birden fazla işi tek commit'te toplama, ama yarım kalmış bir değişikliği de commit etme. Bir commit tek bir mantıksal iş olsun.

### Commit mesajı formatı

```
type(scope): kısa özet

- yapılan değişiklik
- yapılan değişiklik
```

Kullanılacak tipler:

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

Örnek:

```
feat(validator): add script type checking

- add tsc wrapper for @minecraft/server validation
- add version resolution from data directory
- add error formatting for CLI output
```

Kurallar:
- Özet satırı 72 karakteri geçmesin
- Özet satırında nokta kullanma
- Emir kipi kullan ("add", "fix", "remove"), geçmiş zaman değil
- Scope opsiyonel ama varsa tutarlı olsun
- Gövde satırları `-` ile başlasın

### .gitignore

Aşağıdakiler baştan `.gitignore` içinde olmalı ve yeni bir hassas dosya türü ortaya çıktığında listeye eklenmeli:

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

**Eval ve test çıktıları**
```
evals/output/
evals/*.html
*.log
```
Eval çıktıları model cevaplarını ve muhtemelen istek metinlerini içerir, commit edilmez.

**Ham kaynak verisi**
```
pipeline/cache/
pipeline/raw/
```
Bu önemli. bedrock-samples içeriği Minecraft EULA'ya tabi, ham hali repoya girmez. Sadece ondan türetilen indeksler commit edilir.

**Yerel test dosyaları**
```
test-worlds/
*.mcpack
*.mcaddon
.DS_Store
```

Bir dosyanın hassas olup olduğundan emin değilsen commit etme, önce sor.