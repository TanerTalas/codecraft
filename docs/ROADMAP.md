# CodeCraft Yol Haritası

Sıralamayı bozma, her aşama öncekinin üstüne oturuyor.
Mimari kurallar ve stack için `CLAUDE.md` dosyasına bak.

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

---

## GEÇİŞ KAPISI

**20'de 18 doğrulamadan geçiyor.**

Bu sayıya ulaşmadan arayüze geçilmez.

Sayının anlamlı olması için kapıya sayılan 20 vaka bugün otomatik ölçülebilen
tiplerden oluşur: `script` (tsc) ve `json` (ajv). Komut ve Python çıktılarının
doğrulayıcısı yok — komut sözdizimi doğrulayıcısı v1 kapsamı dışında
(`CLAUDE.md`) ve altyapıda Python çalıştırılmıyor. O vakalar `extra` listesinde
durur, ölçülür ama sayılmaz. Erteleme gerekçeleri `TODO.md` Aşama 2.5 bölümünde.

Ölçüt `npm run eval -- --gate`: kapı sağlanmazsa `exit 1`.

Claude Code'un "her şey çalışıyor" demesini bekleme, o cümleyi bu teste dönüştür. Bir ajan ancak tanımlı bir ölçüte göre "tamamlandı" diyebilir. Ölçüt yoksa yarım çalışan bir şey için de aynı cümleyi kurar.

Kapıya ulaşılmadığında ne üzerinde çalışılacağı da belli olur, çünkü hangi vakaların patladığı görülür.

---

## Aşama 4: Web arayüzü

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
6. Web arayüzü