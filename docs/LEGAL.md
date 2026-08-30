# Legal metinler

> **Bunlar taslak, hukuki tavsiye değil.** Ücretli bir kademe açılmadan ya da
> repo halka açılmadan önce bir hukukçuya okutulmalı. Buradaki metinler
> ürünün **gerçekte ne yaptığına** göre yazıldı; ürün değişirse metin de
> değişmeli, tersi değil.

Aşama 4 arayüzü bu metinleri gösterecek. Kaynağı burası.

---

## 1. Gizlilik

### Kısa hâli (arayüzde görünen)

> CodeCraft hesap açmıyor, veritabanı tutmuyor ve senden kişisel bilgi
> istemiyor. API anahtarın tarayıcından çıkmıyor. İsteğin doğrudan senin
> seçtiğin yapay zeka sağlayıcısına gidiyor; biz onu görmüyoruz. Üretilen
> dosyalar doğrulanmak için sunucumuza gönderiliyor ve doğrulama bitince
> saklanmıyor. Geçmişin tarayıcında kalıyor.

### Uzun hâli

**Toplamadıklarımız.** Hesap yok, oturum yok, veritabanı yok. Ad, e-posta,
IP tabanlı profil, çerez tabanlı takip — hiçbiri yok. Bu bir tercih değil,
mimari kısıt: `CLAUDE.md` v1 için sıfır kişisel veri şartı koyuyor ve kod
buna göre yazıldı.

Sebebi açık: Minecraft kullanıcılarının önemli bir kısmı çocuk. Çocuk verisi
toplamak KVKK, GDPR ve COPPA altında ağır yükümlülük getirir. En güvenli yol
hiç toplamamak.

**API anahtarın.** Tarayıcında kalır ve sunucumuza **hiç uğramaz**. Model
çağrısı doğrudan senin tarayıcından sağlayıcıya gider. Anahtarı hiçbir log
satırına, hata mesajına veya rapora yazmıyoruz.

**İsteğin nereye gidiyor.** Yazdığın istek ve kurulan prompt, **senin seçtiğin
sağlayıcıya** (örneğin Google Gemini) gider. O noktadan sonra geçerli olan şey
o sağlayıcının kendi şartlarıdır, bizimki değil.

> **Ücretsiz kademelerde dikkat:** sağlayıcıların çoğu ücretsiz kullanımda
> gönderdiğin metni kendi modellerini geliştirmek için kullanabiliyor. Google
> bunu Gemini API şartlarında açıkça yazıyor. Ücretli kademede genelde
> kullanmıyorlar. Hangi şartın geçerli olduğu **senin hesabının kademesine**
> bağlı; biz tek bir garanti cümlesi kuramayız. Sağlayıcının şartlarını
> okumak sana düşüyor.

**Sunucumuza ne gidiyor.** Üretilen dosyalar — davranış paketi JSON'ları ve
script'ler — doğrulanmak için sunucumuza gönderilir. Şema doğrulaması ve
TypeScript derlemesi orada koşar; tarayıcıda koşturmak mümkün değil.

Bu dosyalar doğrulama bitince saklanmaz. İsteğin metni sunucuya gönderilmez.

**Geçmişin.** Tarayıcının yerel depolamasında durur. Sunucuya kopyalanmaz,
başka cihazına senkronlanmaz. Tarayıcı verisini temizlersen gider.

---

## 2. Sorumluluk reddi

### Kısa hâli

> Üretilen çıktı **dünyanda kalıcı değişiklik yapabilir ve veri kaybına yol
> açabilir.** Yüklemeden önce dünyanı yedekle. Doğrulamadan geçmiş olması
> oyunda doğru çalışacağı anlamına gelmez.

### Uzun hâli

**Yedek al.** Davranış paketleri bloklar ekler, varlıklar tanımlar ve dünya
üretimine karışır. Bir paketi yükleyip sonra kaldırmak, o paketin eklediği
içeriği barındıran bölgeleri bozabilir. Otomasyon script'leri dünya
klasörünü kopyalayabilir veya değiştirebilir.

**Test dünyası kullan.** Üretilen çıktıyı önce harcanabilir bir dünyada dene.

**"Doğrulandı" ne demek, ne demek değil.** Rozet şunu söylüyor: çıktı, o
sürümün şemalarına ve `@minecraft/server` tip tanımlarına karşı denetlendi ve
geçti.

Şunu **söylemiyor**: oyunda istediğini yapacak.

Bu bir tahmin değil, ölçüm. 30-08-2026'da doğrulamadan geçmiş bir paket gerçek
oyuna yüklendi ve **dört ayrı sınıf hata** çıktı — ayrıntı ve kanıt
`docs/VALIDATION-LIMITS.md` içinde. Bir kısmı o günden beri kapatıldı, ama
kapanmayanlar da var ve orada yazılı.

**Garanti yok.** Araç olduğu gibi sunuluyor. Çıktının doğruluğu, uygunluğu
veya bir amaca elverişliliği konusunda garanti verilmiyor. Kullanımından
doğan zarardan sorumluluk kabul edilmiyor.

---

## 3. Sunucu kuralları uyarısı

> Bu uyarı, oyun dışından çalışan otomasyon script'i üretildiğinde **çıktının
> yanında görünür olmalı.** Aşama 4 bunu görmezden gelinebilir bir dipnot
> yapmamalı.

### Metin

> **Bu script oyunu senin yerine oynuyor.** Sunucuların büyük çoğunluğu
> AFK makrolarını, otomatik balık tutmayı ve benzeri otomasyonu **yasaklar**
> — ceza genellikle kalıcı yasaklamadır. Realms ve halka açık sunucuların
> kendi kuralları var.
>
> Bunu yalnızca **kendi tek oyunculu dünyanda** kullan. Bir sunucuda
> kullanacaksan önce o sunucunun kurallarını oku; sorumluluk sana ait.

CodeCraft'ın v1 kapsamı zaten tek oyunculu PC (`CLAUDE.md`). Realms ve
sunucular kapsam dışında. Ama kullanıcının çıktıyı oraya taşımasını
engelleyemeyiz, o yüzden uyarı çıktının yanında duruyor.

---

## 4. Minecraft marka kuralları

### Zorunlu feragat

Mojang'ın kullanım kılavuzu, marka adını kullanan üçüncü taraf ürünlerin şu
biçimde bir feragat göstermesini şart koşuyor:

```
NOT AN OFFICIAL MINECRAFT PRODUCT.
NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
```

Türkçe arayüzde altına çeviri konabilir ama **İngilizce aslı kalmalı** —
şart koşulan biçim o.

Kaynak: [Minecraft Usage Guidelines](https://www.minecraft.net/en-us/usage-guidelines)

### Yerine getirilmesi gerekenler

| Kural | Bizdeki durum |
|---|---|
| Ürün adında "Minecraft" geçmemeli | **Uygun** — ad "CodeCraft" |
| Alan adında "Minecraft" geçmemeli | Alan adı alınırken dikkat edilecek |
| Resmi görünüm/onay izlenimi verilmemeli | Arayüz tasarımında Mojang logosu, resmi font ve blok dokusu kullanılmayacak |
| Feragat görünür olmalı | Ana sayfa altbilgisi ve "hakkında" bölümünde |

### Açık kalan

- **Ticari kullanım.** Ücretli bir kademe açılırsa kurallar sertleşiyor ve
  bu tablo yeniden okunmalı. v1'de ödeme yok (`CLAUDE.md`).
- **`Mojang/bedrock-samples` lisansı.** `LICENSE.md` var ve "(c) Mojang AB.
  All rights reserved" + Minecraft EULA diyor (30-08-2026'da doğrulandı).
  Şu an şemalar birebir commit ediliyor; **repo halka açılmadan önce bu karar
  yeniden değerlendirilmeli** (`docs/SOURCES.md`).

---

## Kaynak lisansları

`docs/SOURCES.md` tam listeyi tutuyor. Özet:

| Kaynak | Lisans | Bizdeki kullanım |
|---|---|---|
| `Mojang/bedrock-samples` | Minecraft EULA, tüm hakları saklı | Türetilmiş indeksler; ham içerik git dışında |
| `Blockception/Minecraft-bedrock-json-schemas` | BSD-3-Clause | Birebir kopya + `LICENSE` |
| `MicrosoftDocs/minecraft-creator` | CC-BY-4.0 | Atıf başlığıyla |
| `@minecraft/server` (npm) | MIT | Tip tanımları |
