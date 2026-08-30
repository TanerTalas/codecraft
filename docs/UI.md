# CodeCraft — Arayüz tasarım brief'i

> Bu dosya bir tasarım aracına olduğu gibi yapıştırılmak üzere yazıldı.
> Kendi kendine yeter: depoyu bilmeyen biri de okuyup tasarlayabilir.
>
> Kaynak kararlar `docs/LEGAL.md`, `docs/ROADMAP.md` ve `CLAUDE.md` içinde.
> Çelişki olursa onlar geçerli.

---

## Ürün ne yapıyor

CodeCraft, **Minecraft Bedrock** için komut, davranış paketi (behavior pack) ve
otomasyon script'i üreten bir yapay zeka aracı. Kullanıcı isteğini oyuncu
diliyle yazıyor ("kırdığım bloğun aynı türden komşularını da kırsın"), araç
çalışan dosyaları üretiyor.

Genel bir sohbet arayüzünden **iki farkı** var ve arayüzün bütün işi bu iki
farkı görünür kılmak:

1. **Çıktı gerçekten doğrulanıyor.** Üretilen JSON resmi şemalara, üretilen
   script `@minecraft/server` tip tanımlarına karşı denetleniyor. Sonuç bir
   rozetle gösteriliyor.
2. **Doğrulama düşerse hata modele geri veriliyor ve bir kez daha deneniyor.**
   Bu döngü kullanıcıya gösterilmeli, gizlenmemeli.

Bunlar gösterilmezse ürün sıradan bir sohbet penceresine benzer ve var olma
sebebi görünmez olur.

**Hedef kitle:** Minecraft oynayan, eklenti yapmak isteyen ama JSON şeması ve
TypeScript API'si bilmeyen kişiler. Önemli bir kısmı genç. Dil **Türkçe**.

---

## Ton ve görsel yön

Bu bir **geliştirici aracı**, bir oyun değil. Sakin, okunur, yoğun bilgi
taşıyabilen bir arayüz. Kod blokları, dosya adları ve hata mesajları birinci
sınıf içerik — kenara sıkıştırılmamalı.

Ürün "doğruluk" satıyor. Görsel dil de bunu desteklemeli: net durum
göstergeleri, kanıt gösterme alışkanlığı, abartısız renk.

### Kesin yasaklar — esnetilemez

Minecraft marka kurallarından geliyor, tercih değil:

- **Mojang / Minecraft logosu kullanılamaz**
- **Minecraft'ın resmi fontu kullanılamaz** (blok/piksel font dahil)
- **Oyundan alınmış blok dokusu, karakter veya ekran görüntüsü kullanılamaz**
- Resmi bir ürün ya da onaylı bir iş izlenimi verilemez

Yani "Minecraft'ımsı" bir görünüm **hedeflenmemeli**. Piksel estetiği, çim
bloğu yeşili, taş dokusu — hiçbiri.

Ürün adı **CodeCraft**. İçinde "Minecraft" geçmiyor ve geçmemeli.

---

## Sayfa haritası

Altı rota. Hiçbiri giriş istemiyor.

| Rota | Ne |
|---|---|
| `/` | Çalışma alanı — asıl ürün |
| `/ornekler` | Örnek galerisi |
| `/ornekler/<id>` | Tek örneğin tam görünümü |
| `/gizlilik` | Gizlilik metni |
| `/sorumluluk` | Sorumluluk reddi |
| `/hakkinda` | Hakkında + marka feragati + lisanslar |

Artı bir `404` sayfası (sade olabilir).

### Hesap yok

Giriş, kayıt, profil, avatar, "şifremi unuttum" — **hiçbiri yok ve
tasarlanmayacak.** Ürün hiç kişisel veri toplamıyor: hesap sistemi yok,
veritabanı yok. Sebebi kitlenin büyük kısmının çocuk olması ve çocuk verisinin
KVKK/GDPR/COPPA yükümlülüğü getirmesi.

Hesabın yerini **API anahtarı** tutuyor. Kullanıcı kendi anahtarını giriyor,
anahtar tarayıcısından çıkmıyor. Üst barda avatar yerine **anahtar durumu**
göstergesi var.

---

## 1. `/` — Çalışma alanı

Kalıcı üç bölgeli düzen.

```
┌──────────────┬─────────────────────────────────────────────┐
│              │  CodeCraft      1.26.40 ▾      ⬤ anahtar    │  ← üst bar
│   Geçmiş     ├─────────────────────────────────────────────┤
│              │                                             │
│  · zincir…   │            ANA ALAN                         │
│  · yakut…    │      (on ayrı duruma göre değişir)          │
│  · düşme…    │                                             │
│              │                                             │
│  [temizle]   │                                             │
├──────────────┴─────────────────────────────────────────────┤
│  Gizlilik · Sorumluluk · Hakkında     NOT AN OFFICIAL…      │  ← altbilgi
└────────────────────────────────────────────────────────────┘
```

### Üst bar

| Öğe | Davranış |
|---|---|
| Ad | "CodeCraft". Logo tasarlanacaksa yukarıdaki yasaklara uymalı |
| **Sürüm seçici** | Oyun sürümü, örn. `1.26.40`. Seçim kalıcı (tarayıcıda saklanır). **Bugün listede tek sürüm var**, ama tasarım çok seçenekli açılır liste olarak yapılmalı |
| **Anahtar durumu** | İki hâl: **anahtar yok** (dikkat çeken, tıklamaya davet eden) · **anahtar var** (sakin, yanında seçili model adı). Tıklayınca anahtar paneli açılır |

### Sol panel — geçmiş

- Geçmiş istekler, yenisi üstte. Tarayıcıda saklanıyor, sunucuya gitmiyor
- Her satır: isteğin ilk satırı + küçük durum işareti (geçti / düştü / ölçülemedi)
- Altta **"Geçmişi temizle"**
- Boşken tek satırlık bir açıklama
- Dar ekranda gizlenip açılabilir olmalı

### Ana alan — çizilecek on durum

**Tasarımın asıl yükü burada.** Her biri ayrı bir ekran hâli:

| # | Durum | Ne görünüyor |
|---|---|---|
| 1 | **Boş, anahtar yok** | Ürün ne yapıyor (3 kısa madde) + istek girişi + 3 örnek kartı |
| 2 | **Yazmaya başladı, anahtar yok** | Anahtar paneli açılır. **Yazdığı metin kaybolmaz** |
| 3 | **Hazır** | İstek girişi + "ne yazabilirim" ipuçları |
| 4 | **Yapılabilirlik engeli** | İstek platformda mümkün değil. Gerekçe + kanıt + alternatif. **Hata değil, doğru cevap — kırmızı olmamalı** |
| 5 | **Üretiliyor (1. deneme)** | Üç adım sırayla: bağlam alınıyor → model yazıyor → doğrulanıyor |
| 6 | **1. deneme düştü, tekrar deniyor** | **Gizlenmeyecek.** Hangi hatanın modele geri verildiği görünür |
| 7 | **Geçti** | Yeşil rozet + çıktı paneli |
| 8 | **İki deneme de düştü** | Kırmızı rozet + dosya dosya hata listesi + ne yapılabileceği |
| 9 | **Ölçülemedi** | Nötr rozet. Bazı çıktı türlerinin otomatik doğrulayıcısı yok |
| 10 | **Sağlayıcı hatası** | Dört ayrı mesaj (aşağıda) |

Dördüncü ve altıncı durum ürünün karakterini taşıyor. İkisi de **iyi haber
gibi** tasarlanmalı: biri "seni boşuna uğraştırmadım", diğeri "hatayı ben
yakaladım ve düzelttirdim".

### Doğrulama rozeti — üç hâl

Ürünün en görünür öğesi. Üç hâl **görsel olarak net ayrılmalı**, özellikle
"geçti" ile "ölçülemedi" birbirine benzememeli:

| Hâl | Metin |
|---|---|
| Geçti | `1.26.40 şemasına karşı doğrulandı` |
| Düştü | `Doğrulamadan geçmedi` |
| Ölçülemedi | `Bu çıktı otomatik doğrulanamıyor` |

Rozetin yanında **her zaman** küçük bir bağlantı: **"Bu ne demek?"** →
`/sorumluluk` sayfasının ilgili bölümüne gider. Rozet "oyunda istediğini
yapacak" demiyor ve bunu kendisi söylemeli.

### Çıktı paneli — üç varyant

Üretilen şeyin türüne göre değişiyor.

**A · Davranış paketi** (en sık)

- Birincil düğme: **`⬇ paket.mcpack indir`** — çift tıklayınca oyun kendi kuruyor
- Yanında küçük uyarı: yedek alma notu
- Açılır bölüm: **"Elle kurmak istersen"** — adım adım klasör talimatı
- Altında dosya ağacı; her dosya kod bloğu + **kopyala** düğmesi

**B · Tek komut**

- Tek satır komut, büyük punto, kolay seçilebilir, kopyala düğmesi
- İndirme yok

**C · Otomasyon script'i (Python)**

- Kod bloğu + kopyala
- **Zorunlu:** sunucu kuralları uyarısı çıktının **yanında, görünür bir kutu**
  olarak. Altbilgiye ya da dipnota konulamaz. Metni aşağıdaki bölümde

### Çıktı panelinde ayrıca

- **Bulgular listesi.** Her bulgu: mesaj + **kanıt** (hangi ölçüme dayandığı).
  Kanıtı göstermek ürünün karakteri, gizlenmemeli. `hata` ve `uyarı` görsel
  olarak ayrılmalı
- **Modelin notu** — çıktının kısa açıklaması
- **Doku notu** — özel item/blok üretildiyse çıkan bilgi kutusu (metni aşağıda)

### Anahtar paneli

Sayfa değil, çalışma alanında açılan panel.

| Öğe | Not |
|---|---|
| Anahtar alanı | Gizli giriş. Üstünde "tarayıcından çıkmıyor" güvencesi |
| **"Nasıl alırım?"** | Adım adım, kısa. Ücretsiz, kart istemiyor, bir dakika sürüyor |
| Model menüsü | Anahtar girilince dolar |
| Anahtarı sil | Tek düğme |

**Model menüsü için önemli tasarım kararı:** sağlayıcı **39 model** döndürüyor
ve çoğu bu iş için çalışmıyor (sesli okuma modelleri, ücretsiz kotası olmayan
modeller). Ham 39 satırlık liste kullanıcıya çoğunlukla bozuk seçenek sunar.

→ **Önerilen model en üstte ve önceden seçili, geri kalanı katlanmış** bir
liste olarak tasarlanmalı. Varsayılan: `gemini-3.6-flash`.

---

## 2. `/ornekler` ve `/ornekler/<id>`

Anahtarı olmayan kişinin ürünü **çalışırken görmesi** için. Kayıt duvarı yok,
kimse ürünü görmeden kaybedilmemeli.

**Galeri sayfası:** kart listesi. Her kart: isteğin metni, çıktı türü, durum
rozeti.

**Detay sayfası:** çalışma alanının "geçti" hâlinin birebir aynısı — istek,
üretim adımları, rozet, dosyalar. Fark: salt okunur ve üstünde küçük bir künye:
**hangi modelle, hangi tarihte üretildiği.** Bu künye zorunlu; örnekler gerçek
ölçülmüş çıktılar ve öyle sunulmalı.

En az bir örnek **tekrar deneme akışını** göstermeli (1. deneme düştü → hata
modele geri verildi → 2. deneme geçti). En az biri **yapılabilirlik engelini**
göstermeli. İkisi de statik ekran görüntüsüyle anlatılamayan davranışlar.

Her detay sayfasında "Bunu kendin dene" çağrısı → `/`.

**Veri hazır:** `app/src/examples/examples.json`. `npm run examples:build` üretiyor,
elle düzenlenmiyor. Her kayıtta istek, üretilen dosyalar, doğrulama sonucu,
künye (model + tarih) ve varsa deneme geçmişi duruyor. Bugün yedi örnek var:
beşi geçen, biri düşen (tekrar deneme akışını gösteren), biri yapılabilirlik
engeli.

`provenance.attempts` alanı `null` ise **"tekrar denenmedi" demek değil** —
o koşuda kaydedilmemiş demek. Arayüz ikisini karıştırmamalı; rozetin
"ölçülemedi" hâliyle aynı mantık.

---

## 3. Legal sayfalar

Üçü de tek sütun okuma metni. Tasarım yükü düşük ama **atlanamazlar**.

| Rota | Başlıklar |
|---|---|
| `/gizlilik` | Toplamadıklarımız · API anahtarın · İsteğin nereye gidiyor · Sunucumuza ne gidiyor · Geçmişin |
| `/sorumluluk` | Yedek al · Test dünyası kullan · **"Doğrulandı" ne demek, ne demek değil** · Garanti yok |
| `/hakkinda` | Ürün ne yapıyor · Marka feragati · **Kaynaklar ve lisanslar** |

İki ek gereklilik:

- `/gizlilik` sayfasında da bir **"Geçmişi temizle"** düğmesi olmalı
- `/hakkinda` sayfasındaki lisans/atıf bölümü **hukuki zorunluluk**, dekoratif
  değil. Kullanılan açık kaynak şemaların telif bildirimi ve dokümantasyon
  atfı burada görünür olmak zorunda

### Altbilgi — her sayfada

Bağlantılar: **Gizlilik · Sorumluluk · Hakkında**

Ve marka feragati. **İngilizce aslı zorunlu**, birebir bu biçimde:

```
NOT AN OFFICIAL MINECRAFT PRODUCT.
NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
```

Altına küçük punto Türkçe çeviri konabilir, ama İngilizce aslı kalmalı.

---

## Hazır metinler

Bunlar uydurulmayacak, olduğu gibi kullanılacak.

### Anahtar panelinde (gizlilik özeti)

> CodeCraft hesap açmıyor, veritabanı tutmuyor ve senden kişisel bilgi
> istemiyor. API anahtarın tarayıcından çıkmıyor. İsteğin doğrudan senin
> seçtiğin yapay zeka sağlayıcısına gidiyor; biz onu görmüyoruz. Üretilen
> dosyalar doğrulanmak için sunucumuza gönderiliyor ve doğrulama bitince
> saklanmıyor. Geçmişin tarayıcında kalıyor.

### İndirme düğmesinin yanında (sorumluluk özeti)

> Üretilen çıktı **dünyanda kalıcı değişiklik yapabilir ve veri kaybına yol
> açabilir.** Yüklemeden önce dünyanı yedekle. Doğrulamadan geçmiş olması
> oyunda doğru çalışacağı anlamına gelmez.

### Python çıktısının yanında — zorunlu uyarı kutusu

> **Bu script oyunu senin yerine oynuyor.** Sunucuların büyük çoğunluğu
> AFK makrolarını, otomatik balık tutmayı ve benzeri otomasyonu **yasaklar**
> — ceza genellikle kalıcı yasaklamadır. Realms ve halka açık sunucuların
> kendi kuralları var.
>
> Bunu yalnızca **kendi tek oyunculu dünyanda** kullan. Bir sunucuda
> kullanacaksan önce o sunucunun kurallarını oku; sorumluluk sana ait.

### Özel item/blok üretildiğinde — doku notu

> Özel görsel için kendi kaynak paketini yazman gerekir. Şu an var olan bir
> oyun dokusu ödünç alınıyor, yani item'ın kendine ait bir görseli olmayacak.

### Sağlayıcı hata mesajları — dördü ayrı

| Ne oldu | Kullanıcıya ne denir |
|---|---|
| Anahtar reddedildi | Anahtar kabul edilmedi. Eski biçimde bir anahtarsa artık geçerli değil; sağlayıcının konsolundan yeni bir tane al |
| Kota doldu | Günlük ya da dakikalık kotan doldu. Biraz bekleyip tekrar dene |
| Sağlayıcı meşgul | Seçtiğin model şu an aşırı yüklü. Birazdan tekrar dene ya da başka bir model seç |
| Bağlantı yok | Sağlayıcıya bağlanılamadı. İnternet bağlantını kontrol et |

---

## Ayrıntılar

- **Duyarlı (responsive).** Masaüstü birincil. Dar ekranda sol panel gizlenip
  açılabilir olmalı; kod blokları ve dosya adları **yatay kaydırılabilir**
  olmalı, sayfanın kendisi yatay kaymamalı
- **Tema.** Açık ve koyu tema birlikte düşünülmeli. Kod blokları ve durum
  renkleri iki temada da okunur kalmalı
- **Uzun içerik.** Üretilen dosyalar yüzlerce satır olabiliyor; kod blokları
  katlanabilir ya da sınırlı yükseklikte olmalı
- **Erişilebilirlik.** Durum yalnızca renkle anlatılmamalı — rozetlerde ve
  bulgularda metin ya da simge de olmalı. Kullanıcıların bir kısmı genç ve
  ekranı küçük

---

## Tasarlanmayacaklar

- Giriş, kayıt, profil, avatar, hesap menüsü
- Ödeme, plan, fiyatlandırma sayfası
- Bildirim merkezi, sosyal özellikler, paylaşım akışı
- Sunucu tarafı ekranları — doğrulama arka planda çalışıyor, ayrı bir ekranı yok
