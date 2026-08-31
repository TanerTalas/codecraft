# CodeCraft Yol Haritası

Sıralamayı bozma, her aşama öncekinin üstüne oturuyor.
Mimari kurallar ve stack için `CLAUDE.md` dosyasına bak.

> **Yön değişikliği, 31-08-2026.** Geçiş kapısından sonra sıra web arayüzüne
> değil, bir **MCP sunucusuna** geçti. Gerekçesi aşağıda "Aşama M" bölümünde,
> kararın kendisi `docs/anlik_karar_degisikligi.md` içinde.
>
> Aşama 4 numarasını koruyor ama **ertelendi** — arşiv ve kod yorumları o
> numaraya gönderme yapıyor, yeniden numaralandırmak onları kırardı. Yürütme
> sırası: kapı → **M** → 4.
>
> Yürütülebilir liste kökteki `TODO.md`. Aşama 1–4'ün işaretlenmiş hâli
> `docs/ileride-donulecek-todo.md` içinde.

---

## Aşama 1: Veri pipeline'ı

Node script'i yazılacak:

1. bedrock-samples `main` dalını çek
2. Blockception şemalarını çek (`main` dalı, tag değil)
3. npm'den `@minecraft/server` tip tanımlarını indir
4. Sürüm numarasını tespit et
5. Hepsini `data/<sürüm>/` altına yaz

GitHub Actions ile günlük koştur, değişiklik varsa commit et.

**Bitiş kriteri:** Repo her sabah otomatik güncelleniyor ve veri bayatlarsa bildirim geliyor.

**Not:** Kaynakların çekilme detayları ve bilinen aksaklıklar için `docs/SOURCES.md`.

---

## Aşama 2: Validator paketi

LLM yok, arayüz yok. Sadece saf fonksiyonlar:

- `validateJson(içerik, tip, sürüm)` — Blockception şemasına karşı
- `validateScript(kod, apiSürümü)` — tip tanımlarına karşı
- `lookup(blokId, sürüm)` — geçerli mi

**Test:** Bilerek doğru on dosya, bilerek bozuk on dosya. Hepsi doğru sonuç veriyorsa hazır.

Gerçek oyun testinden sonra üç kontrol daha eklendi — şemanın ve `tsc`'nin
yapısal olarak yakalayamadığı sınıflar için (`docs/VALIDATION-LIMITS.md`):

- `checkIdentities(dosyalar, sürüm)` — referans verilen kimlik gerçekten var mı
- `checkFileNames(dosyalar)` — dosya adı ile identifier arasındaki kural
- `checkPatterns(kod)` — geçerli ama amaçlanmayan kod kalıpları

Üçü de saf fonksiyon. Eval runner'ı ve Aşama 3'ün üretim döngüsü aynı
fonksiyonları çağırır, mantık tek yerde durur.

Bu aşama LLM'den önce geliyor çünkü validator çalışmazsa ürün de çalışmaz. En riskli parçayı en ucuz şekilde test etmiş oluyorsun.

---

## Aşama 2.5: Eval altyapısı

`evals/cases/cases.json`, içinde 20 gerçek istek ve beklenen sonuçları. Alan
adları İngilizce, içerik Türkçe — `packages/validator/test/fixtures/cases.json`
ile aynı düzen: `core` ölçüt, `extra` ölçüm.

```json
{
  "id": "chain-mining-01",
  "request": "Kırdığım bloğun aynı türden komşularını da kırsın",
  "version": "1.26.40",
  "kind": "script",
  "expect": { "validation": "pass", "checks": [] }
}
```

`expect.checks` şemanın ve tsc'nin yakalayamadığı ek kontrolleri seçer:
`identity`, `filename`, `pattern:<ad>`. Sadece "validator geçti" ölçütü
"geçerli ama amaçlanmayan" sınıfını görünmez bırakırdı
(`docs/VALIDATION-LIMITS.md` D), o yüzden üç vaka doğrudan onu hedefliyor.

`npm run eval` ile koşan bir runner. Vakaları bir **üreticiye** gönderir,
çıktıları validator'dan geçirir, tablo basar. Üretici takılabilir: 2.5'te elle
yazılmış kayıt (`evals/recorded/`), Aşama 3'te model. Böylece tezgâh model
katmanı yazılmadan ölçülebilir oluyor. Raporun ve terminalin başlığında
çıktının nereden geldiği yazar — kayıtlı çıktı model sonucu gibi görünmez.

Runner'a basit bir HTML rapor çıktısı ekle. Tasarım yok, sadece tablo: istek,
üretilen çıktı, doğrulama sonucu, hata mesajı. Yanına makine okunur bir JSON
rapor da yazılır, iki koşu arasındaki fark alınabilsin diye. Aşama 3 boyunca
ana çalışma yüzeyi bu olacak.

---

## Aşama 3: LLM katmanı, CLI olarak

Terminalden çalışan bir komut. Akış:

1. Kullanıcı isteği gelir
2. İlgili veriyi topla
3. Sürüme kilitli prompt kur
4. Modele gönder
5. Çıktıyı validator'dan geçir
6. Hata varsa hatayı da vererek bir kez daha dene

O tek retry döngüsü ürünün kalite farkını yaratan şey. Genel modeller bunu yapmıyor.

CLI ile başlamanın sebebi: çekirdek döngüyü arayüz yazmadan test edebilmek. Burada onlarca istek deneyip prompt iyileştirilecek, bunu tarayıcıda yapmak çok yavaş.

Çekirdek paket ayrımı için `CLAUDE.md` içindeki mimari kurallara bak. CLI ince bir kabuk olmalı.

Sağlayıcı **Google Gemini, ücretsiz kademe** — projede ücretli API
kullanılmıyor. Sağlayıcı `codecraft.config.json`'dan okunuyor, değiştirmek tek
satır. Ücretsiz kademenin istek limiti bir tasarım kısıtı: eval vakalar arası
bekliyor, limitten düşen vaka ayrı işaretleniyor, ve model çıktısı
önbelleğe alınıp `--generator=cached` ile tekrar oynatılabiliyor.

---

## GEÇİŞ KAPISI

**20'de 18 doğrulamadan geçiyor.**

Bu sayıya ulaşmadan arayüze geçilmez.

Skor model kalitesine duyarlı, o yüzden **her zaman model adıyla birlikte**
kaydedilir. Ücretsiz bir modelle kapının altında kalmak tek başına "prompt
kötü" demek değil; hangi vakaların hangi sebeple düştüğü ayrıştırılır.

Sayının anlamlı olması için kapıya sayılan 20 vaka bugün otomatik ölçülebilen
tiplerden oluşur: `script` (tsc) ve `json` (ajv). Komut ve Python çıktılarının
doğrulayıcısı yok — altyapıda Python çalıştırılmıyor.
Komut tarafı Aşama 3'te kazanıldı (`docs/COMMANDS.md`) ama kapı listesi
sabit kaldı: ölçüt değiştirilmiyor. O vakalar `extra` listesinde
durur, ölçülür ama sayılmaz. Erteleme gerekçeleri
`docs/ileride-donulecek-todo.md` Aşama 2.5 bölümünde.

Ölçüt `npm run eval -- --gate`: kapı sağlanmazsa `exit 1`.

Claude Code'un "her şey çalışıyor" demesini bekleme, o cümleyi bu teste dönüştür. Bir ajan ancak tanımlı bir ölçüte göre "tamamlandı" diyebilir. Ölçüt yoksa yarım çalışan bir şey için de aynı cümleyi kurar.

Kapıya ulaşılmadığında ne üzerinde çalışılacağı da belli olur, çünkü hangi vakaların patladığı görülür.

---

## Aşama M: MCP sunucusu

Kapıdan sonra gelen aşama bu. Kendi ekseninde numaralandı çünkü Aşama 4'ün
numarası arşivde ve kod yorumlarında geçiyor, kaydırmak onları kırardı.

### Neden arayüzden önce

Tıkanma noktası şuydu: kullanıcı Claude aboneliğiyle giriş yapamıyor, sadece
API anahtarı kullanabiliyor, anahtar da para demek. Aşama 4 bu yüzden BYOK ile
çıkmak zorundaydı ve BYOK, oyuncu kitlesi için gerçek bir sürtünme.

MCP sorunu çözmüyor, **yön değiştiriyor**:

| | |
|---|---|
| Yasak olan | Benim sitem kullanıcının Claude aboneliğini harcıyor, ben aracı oluyorum |
| MCP | Kullanıcı zaten Claude'un içinde, kendi aboneliğiyle. CodeCraft sadece bağlanılan bir araç sunucusu, çıkarım Anthropic'in kendi ürününde |

İkincisi protokolün var olma sebebi.

### Ürünün değeri zaten LLM değildi

CodeCraft'ın farkı güncel veri ve doğrulama katmanında; model herkeste aynı.
MCP tam olarak o katmanı paketlemeye izin veriyor, modeli kullanıcı getiriyor.
Sonucu: token maliyeti sıfır, kullanıcının ek maliyeti sıfır, anahtar yapıştırma
adımı yok, arayüz yazmaya gerek yok.

Ve bu sıfırdan iş değil. `packages/validator` ve `packages/knowledge` zaten saf
fonksiyonlardan oluşuyor (mimari kural 3), araca dönüşmeleri sarmalama işi.

### Açığa çıkarılacak araçlar

```
validate_json(içerik, tip, sürüm)
validate_script(kod, apiSürümü)
lookup_block(id, sürüm)
get_schema(tip, sürüm)
get_version_info()
check_feasibility(niyet)
```

Hepsi salt okunur ve hepsine `readOnlyHint` konuyor. Yazma işlemi olmaması hem
güvenliği hem onay akışını basitleştiriyor.

### Kısıtlar

**Transport Streamable HTTP.** SSE Mart 2025 spesifikasyonunda kaldırıldı.
Sunucu internetten erişilebilir bir HTTPS ucu olmak zorunda — bağlantı
Anthropic'in bulut altyapısından kuruluyor, localhost veya firewall arkası
bağlanmaz. Geliştirme sırasında tünel gerekiyor.

**Token sınırı bir tasarım kısıtı, optimizasyon değil.** Özel bağlayıcılar için
yaklaşık 30.000 token. `data/` içindeki indeksler ve derlenmiş şemalar bunu
rahat aşıyor — en büyüğü yarım megabaytın üstünde. Yani araçlar tüm registry'yi
değil **hedefe yönelik sonuç** döndürmek zorunda. Bu, Aşama 2'nin "lookup tek
kimliğin sonucunu döndürür" kararının aynısı, yeni bir yerde.

**Bir kez yaz, birden fazla platforma ulaş.** MCP bağlayıcıları yalnızca
Claude'da değil; sunucu tek, istemci çok.

### Bilinen riskler

**Barındırma maliyeti kalıyor.** Token maliyeti sıfır ama sunucuyu birinin
çalıştırması gerekiyor, ve doğrulama `tsc`'yi alt süreç olarak koşuyor.
Serverless bunu koşturamazsa container tabanlı barındırma gerekir. Bu ölçüm
erken yapılır çünkü mimariyi etkiler. Ücretsiz kademe yetmezse `CLAUDE.md`'nin
"ücretli hosting yok" maddesiyle çelişir — o zaman durulup sorulur.

**Kitle hâlâ teknik.** MCP bağlayıcı ekleyebilen oyuncu, API anahtarı alabilen
oyuncudan çok daha fazla ama yine de genel kitle değil. MCP web arayüzünün
yerini almıyor, önüne geçiyor.

**Bitiş kriteri:** Sunucu dağıtılmış, kendi Claude hesabıma bağlı, ve gerçek bir
Bedrock isteği baştan sona MCP üzerinden doğrulanmış çıktı üretiyor.

---

## Aşama 4: Web arayüzü

> **Ertelendi (31-08-2026), iptal değil.** Aşama M'den sonraya bırakıldı.
> MCP'den gelen gerçek kullanım verisi hangi araçların işe yaradığını
> gösterecek, arayüz tasarımı o veriyle bilgilenmiş olarak yazılacak.
> Doğrulama rozeti maddesinin karşılığı MCP'de zaten var: araç çıktısının
> kendisi rozetin işlevini görüyor. Tasarım brief'i `docs/UI.md`.

- Kalıcı sürüm seçici
- Sohbet alanı
- Kod bloğu ve kopyala butonu
- **Doğrulama rozeti** — "1.26.40 şemasına karşı doğrulandı"
- BYOK anahtar girişi
- Anahtar girildiğinde test çağrısı yap, model listesini çekip menüyü doldur, hata gelirse net mesaj göster

Doğrulama rozetini atlamak yok. Tek görünür fark o, ve kullanıcıya neden genel bir sohbet arayüzü yerine bunu kullandığını anlatan tek şey.

---

## Ek katman: niyet ve yapılabilirlik eşlemesi

Kullanıcı isteğini oyuncu diliyle söylüyor, platform bambaşka bir şey sunuyor. Aradaki çeviriyi yapmayan bir araç uydurulmuş API'ler üretir.

Örnek: "fareme basılı tutmuş gibi otomatik kazsın" isteği behavior pack script'i ile yapılamaz, çünkü `@minecraft/server` oyuncu girdisini simüle edemez. Doğru cevap ya zincirleme kazma ya da dışarıdan çalışan bir script.

Model çıktısı doğrulamaya girmeden önce bir yapılabilirlik kontrolü olmalı. İstek platformun izin vermediği bir kategoriye giriyorsa (girdi simülasyonu, dosya sistemi erişimi, ağ isteği) doğrudan alternatif önerilir.

Bu kontrol LLM gerektirmiyor, kalıp eşlemesiyle yapılır. Hem token tasarrufu sağlar hem de en sık hatayı baştan keser.

---

## İlk somut adım

Aşama 1'in en küçük parçası: bedrock-samples'ı çekip sürüm numarasını çıkaran ve `data/` altına yazan tek bir script. Yüz satırı geçmez ve projenin en riskli varsayımını doğrular.

O çalıştığında gerisi mekanik iş.

---

## Özet sıralama

1. Veri pipeline'ı
2. Validator
3. Eval altyapısı ve HTML rapor
4. CLI, çekirdek paket ayrımıyla
5. **Geçiş kapısı: 20'de 18**
6. MCP sunucusu
7. Web arayüzü — ertelendi, MCP oturunca dönülecek