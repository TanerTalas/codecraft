# Kullanım sitesi — içerik ve sayfa yapısı

Bu doküman **yalnızca içeriği** tanımlıyor: kaç sayfa var, her sayfada hangi
bölümler var, her bölüm hangi bilgiyi taşıyor. Tasarıma dair hiçbir şey
içermiyor — renk, tipografi, düzen, bileşen, görsel dil, animasyon: hiçbiri
burada yok ve bilerek yok.

Her bölümün altında **kaynak** satırı var: o bilginin depoda nerede yazılı
olduğu. Site metni yazılırken olgular oradan okunacak, hatırlanmayacak. Bu
projede bir iddia ancak ölçüldüyse yazılır.

## Dil kararı: İngilizce (04-09-2026, KAPANDI)

~~Site metni tek dilde olacak ve bu karar verilmedi.~~ Karar verildi:
**İngilizce.** Gerekçe değişmedi — depo public, MCP ucu herkese açık, bağlanan
model global, `README.md` ve `NOTICE` zaten İngilizce.

Türkçe seçilseydi marka feragatinin İngilizce aslı yine korunmak zorundaydı
(aşağıda, "Altbilgi"). Bugün zaten öyle duruyor.

Aşağıdaki bölüm adları Türkçe yazıldı çünkü bu doküman geliştirici tarafında
duruyor; site hangi dilde olacaksa metin o dilde yazılacak.

## Sayfa sayısı: 4

| # | Sayfa | Kimin için | Cevapladığı soru |
|---|---|---|---|
| 1 | Ana sayfa | Siteye ilk gelen | Bu ne, neden var, işime yarar mı |
| 2 | Kurulum | İkna olmuş, denemek isteyen | Nasıl bağlarım, çalıştığını nasıl anlarım |
| 3 | Araçlar | Kullanmaya başlamış | Hangi araç ne yapıyor, ne zaman çağrılıyor |
| 4 | Sınırlar ve veri | Güvenip güvenmeyeceğini tartan | Neyi yakalamıyor, veri nereden geliyor, kim tutuyor |

**Neden 4:** üç sayfa yetmiyor, çünkü "neyi yakalamıyor" bilgisi ana sayfaya
sıkıştırılırsa ya kayboluyor ya da ana sayfayı savunmacı yapıyor. Beş sayfa ise
4'ü ikiye bölmek demek (sınırlar ayrı, veri ve lisans ayrı) ve bugünkü içerik
hacmi bunu gerektirmiyor.

**Bölme tetiği:** 4. sayfa tek başına takip edilemeyecek kadar uzarsa ya da
lisans tablosu büyürse "Sınırlar" ile "Veri ve lisanslar" ayrılır, site 5 sayfa
olur.

---

# Sayfa 1 — Ana sayfa

## 1.1 Ne olduğu

Tek cümlelik tanım ve onu açan iki cümle.

- CodeCraft, Minecraft Bedrock için **doğrulama ve veri sorgulama araçları
  sunan bir MCP sunucusu**.
- **Modeli kullanıcı getiriyor** — kendi Claude istemcisinde, kendi
  aboneliğiyle. CodeCraft araya girmiyor, içerik üretmiyor.
- Yaptığı tek şey: üretilen şeyin gerçekten çalışıp çalışmayacağını ölçmek.

Kaynak: `CLAUDE.md`, giriş bölümü.

## 1.2 Çözdüğü problem

Bu bölüm ürünün var olma sebebi ve somut olmalı — soyut "yapay zekâ hata yapar"
cümlesi değil, Bedrock'a özgü **sessiz** başarısızlık.

Anlatılacak mekanizma: genel bir model `format_version` uydurur, olmayan bir
`minecraft:` kimliğine referans verir, `@minecraft/server`'da bulunmayan bir API
çağırır — ve **hiçbiri hata vermez, oyuna yüklenene kadar.**

Kullanılabilecek gerçek örnekler; dördü de ölçüldü, uydurma değil:

| Örnek | Ne oldu |
|---|---|
| `"format_version": "1.26.40"` yazıldı | Şema reddetti: spawn rule yalnızca 1.8.0 / 1.10.0 / 1.12.0 kabul ediyor |
| Feature rule dosyasının adı kimlikle uyuşmuyordu | Oyun reddetti: "Feature rule identifier 'ruby_ore_feature' does not match filename 'ruby_ore'" |
| Tarif `unlock` alanı taşımıyordu | Oyun tarifi hiç yüklemedi: "1.20+ Recipes require unlock data" |
| `query.is_babyy` yazıldı | Blok tanımının tamamı düştü, blok oyuna hiç kaydolmadı |

Kaynak: `CLAUDE.md` "Sürüm numaralandırma", `docs/VALIDATION-LIMITS.md`
sınıf B, F, H.

## 1.3 Nasıl çalışıyor

Üç adımlık akış, teknik ama kısa:

1. Kullanıcı MCP ucunu kendi Claude istemcisine ekliyor.
2. Model bir Bedrock işi yaparken araçları kendiliğinden çağırıyor: hangi alan
   zorunlu, hangi kimlik var, bu satır geçerli mi.
3. Üretilen dosyalar resmi şemaya, komut dizinine ve gerçek `tsc`'ye karşı
   doğrulanıyor.

Vurgulanacak ayrım: **değerler sürüme kilitli veriden okunuyor, hatırlanmıyor.**

Kaynak: `docs/MCP.md`, `packages/mcp/src/server.ts` (sunucu yönergesi).

## 1.4 Neyi garanti ediyor, neyi etmiyor

Ana sayfada kısa tutulur, 4. sayfaya bağlanır. Yazılması gereken tek cümle:
doğrulayıcı **oyunun reddedeceği şeyleri** yakalıyor, "istediğin gibi
çalışacak" demiyor.

Kaynak: `docs/VALIDATION-LIMITS.md`, sınıf D.

## 1.5 Hızlı kurulum

Üç adım ve uç adresi. Detay 2. sayfada.

- Uç: `https://codecraft-ashy-seven.vercel.app/mcp`
- Claude'da **Customize > Connectors** (Settings değil) → özel bağlayıcı → adres
- Bağlandığında **9 araç** görünmeli, dokuzu da salt okunur

Kaynak: `docs/mcp-kullanim.md`, "Tekrar üretmek için".

## 1.6 Araçlar özeti

Dokuz aracın adı ve tek satırlık işi; detay 3. sayfada. Vurgulanacak: **dokuzu
da salt okunur**, sunucu hiçbir şey yazmıyor.

| Araç | Tek satırda |
|---|---|
| `check_feasibility` | Bu istek Bedrock'ta yapılabilir mi; yapılamıyorsa neden ve alternatifi ne |
| `get_version_info` | Hangi sürüm numarası nereye yazılır |
| `get_schema` | Bu dosya tipinde hangi alanlar zorunlu, hangi `format_version` geçerli |
| `lookup_id` | Bu `minecraft:` kimliği bu sürümde var mı, tipi ne, blok durumları neler |
| `validate_json` | Dosya resmi şemaya uyuyor mu |
| `validate_command` | Bu komut satırı geçerli mi, hile gerektiriyor mu |
| `validate_script` | Script gerçek `tsc` ile ve gerçek `@minecraft/server` tipleriyle derleniyor mu |
| `validate_python` | Oyun dışında koşan otomasyon script'i ve içindeki komutlar geçerli mi |
| `review_pack` | Paketin tamamı: her dosyaya doğru doğrulayıcı, artı şemanın yapısal olarak göremediği kontroller |

Kaynak: araçların kendi `description` metinleri, `packages/mcp/src/tools/`.

## 1.7 Gizlilik ve güven

Kısa ve iddiasız, madde madde:

- Kimlik doğrulaması yok, hesap yok, oturum yok.
- Kullanıcı verisi saklanmıyor; sunucu durumsuz, her istekte yok ediliyor.
- Dokuz aracın dokuzu salt okunur; sunucu hiçbir yere veri göndermiyor.
- Doğrulama katmanı hiçbir LLM'e bağlanmıyor — bu bir söz değil, testle
  ölçülüyor.
- Kaynak kodu açık, Apache-2.0.

Kaynak: `CLAUDE.md` "Değişmezler", `packages/mcp/test/no-llm.test.ts`, `LICENSE`.

## 1.8 Kapanış yönlendirmesi

Kurulum sayfasına ve depoya iki yönlendirme. Yeni bilgi taşımaz.

---

# Sayfa 2 — Kurulum

## 2.1 Gereksinimler

- Özel MCP bağlayıcısı eklenebilen bir Claude istemcisi.
- Ölçülmüş istemciler: **Claude masaüstü uygulaması (Pro hesabı)** ve **Claude
  Code'un kendi MCP istemcisi**. Başka istemci denenmedi — "hepsinde çalışır"
  yazılmayacak.
- Minecraft Bedrock lisansı yalnızca **çıktıyı oyunda denemek** için gerekli;
  araçları kullanmak için gerekmiyor.

Kaynak: `docs/mcp-kullanim.md`, "Nasıl ölçülecek" ve "İkinci ölçüm kümesi".

## 2.2 Adımlar

Numaralı, kısa, her adımda ne görüleceği yazılı:

1. Claude'da **Customize > Connectors** açılır. Settings değil — bu ayrım
   gerçek kullanımda karıştırıldı.
2. Özel bağlayıcı eklenir, adres girilir:
   `https://codecraft-ashy-seven.vercel.app/mcp`
3. Kaydedilir; araç izinleri ekranında araçlar listelenir.

## 2.3 Çalıştığını nasıl anlarsın

Doğrulama listesi. Üçü de ölçülmüş gözlem:

- **9 araç** listelenmeli.
- İstemci hepsini salt okunur olarak sınıflandırmalı; Claude masaüstünde
  "read only tools" ibaresiyle görünüyor.
- Araç başlıkları görünmeli, örnek: "Can Bedrock do this",
  "Schema summary for a document type".

Kaynak: `docs/mcp-kullanim.md`, "Bağlayıcı bağlandı".

## 2.4 İlk deneme

Kullanıcının yazabileceği bir istek cümlesi ve **beklenen davranış**: model
araç adını telaffuz etmeden, kendiliğinden araçları çağırmalı.

Kullanılabilecek gerçek senaryo cümleleri; dördü de ölçüldü:

- "Muhafız yaratığı gece yüzeyde doğsun"
- "Kırdığım bloğun aynı türden komşularını da kırsın"
- "Etrafıma on çarpı on camdan bir kutu yap"
- "Ben klavyeye dokunmadan otomatik balık tutsun" — bu istek **bloklanıyor** ve
  gerekçesiyle alternatif öneriliyor. İyi bir ilk deneme, çünkü aracın "hayır"
  diyebildiğini gösteriyor.

İstek dilinin serbest olduğu yazılabilir: `check_feasibility` girdiyi Türkçe de
İngilizce de tanıyor, cevabı her zaman İngilizce.

Kaynak: `docs/mcp-kullanim.md`, senaryo günlükleri.

## 2.5 Beklenen ve hata olmayan üç şey

Sorun gidermenin en değerli kısmı bu; üçü de "bozuk değil" diye işaretlenmeli:

| Görülen | Açıklama |
|---|---|
| `GET /mcp` **405** dönüyor | Spec, SSE sunmayan sunucunun 405 dönmesine izin veriyor |
| OAuth keşif uçları yok | Uç kimlik doğrulamasız, bilerek |
| Sunucu sürümü istemci arayüzünde hiç görünmüyor | Uzak bağlayıcı proxy'leniyor, istemci `initialize` cevabını göstermiyor. Ölçüldü |

Kaynak: `docs/mcp-kullanim.md`, "Tekrar üretmek için".

## 2.6 Sorun giderme

- Araçlar listelenmiyorsa: adresin sonundaki `/mcp` kontrol edilir.
- Bir çağrı bağlantı hatasıyla düşerse: tekrar denenir. Gerçek kullanımda üç
  çağrının geçici transport hatasıyla düştüğü, aynı yükün tekrarında geçtiği
  ölçüldü; sebep sunucuda değil.
- Araç izinleri "her seferinde sor"da bırakılabilir. Sunucuda log yok, onay
  istemi hangi aracın hangi argümanla çağrıldığını gösteren tek kayıt.

Kaynak: `docs/mcp-kullanim.md`, "Gözlem 3".

---

# Sayfa 3 — Araçlar

## 3.1 Çağrı sırası

Sunucunun modele verdiği yönergedeki sıra, insan diliyle:

1. `check_feasibility` — Bedrock bunu yapabiliyor mu.
2. `get_version_info` ve `get_schema` — hangi alanlar zorunlu, hangi
   `format_version`.
3. Dosyalar yazıldıktan sonra `review_pack`.

Kaynak: `packages/mcp/src/server.ts`, `instructions`.

## 3.2 Sürüm numaraları — beş ayrı şey

Sitenin en öğretici parçası; `get_version_info`'nun ne döndürdüğünü de
açıklıyor. Tablo olduğu gibi kullanılabilir:

| Numara | Örnek | Nerede kullanılır |
|---|---|---|
| Pazarlama numarası | `26.40` | Sadece duyurularda, hiçbir dosyaya yazılmaz |
| Oyun / veri sürümü | `1.26.40.5` | Veri indeksleri |
| `min_engine_version` | `[1, 26, 40]` | `manifest.json`, üç parçalı dizi |
| `@minecraft/server` modül sürümü | `2.9.0` | `manifest.json` → `dependencies` |
| `format_version` | `1.21.100`, `1.13.0`, `2` | İçerik dosyaları |

Vurgulanacak iki tuzak:

- **`format_version` oyun sürümü değil**, o dosya tipinin kendi şema sürümü:
  blok `1.21.100`, feature rule `1.13.0`, spawn rule `1.8.0`, manifest `2`.
- Modül sürümü `2.x`, oyun sürümü `1.26.x`. Prerelease etiketinde oyun sürümü
  modül sürümünün **içine gömülü** geliyor: `2.11.0-beta.1.26.50-preview.27`.

Kaynak: `CLAUDE.md`, "Sürüm numaralandırma".

## 3.3 – 3.11 Araç kartları (dokuz adet)

Her araç için aynı şablon:

- **Ne sorar** — tek cümle.
- **Girdi** — alanlar, hangileri zorunlu.
- **Çıktı** — dönen alanlar, örnek bir cevapla.
- **Ne zaman çağrılır** — akıştaki yeri.
- **Hangi hatayı önler** — mümkünse ölçülmüş gerçek bir vaka.

Araç başına sitede mutlaka geçmesi gerekenler:

| Araç | Atlanmaması gereken |
|---|---|
| `check_feasibility` | Girdi dil bağımsız, çıktı İngilizce. Bloklanan sınıflar: girdi simülasyonu, dosya sistemi erişimi, ağ erişimi. Blok cevabı gerekçe + kanıt + **alternatif** taşıyor |
| `get_version_info` | Dönen `format_version` listesi ölçümle daraltılmış olabilir; `get_schema` ham şema enum'unu verir. İkisi farklı görünürse sebebi bu |
| `get_schema` | Ham şema **döndürmez**, özet verir. Kalabalık düğümlerde daralır ve neyi kısalttığını söyler; `path` ile alt düğüme inilir |
| `lookup_id` | Blok için geçerli blok durumlarını ve aldıkları değerleri de döndürür. Namespace'siz ad `minecraft:` sayılır |
| `validate_json` | Hata mesajı JSON pointer + ihlal edilen kural + okunabilir metin taşıyor; beklenmeyen alan adları ve geçerli enum değerleri mesaja giriyor |
| `validate_command` | `execute ... run <komut>` zinciri çözülüyor, içteki komut da doğrulanıyor. Hile gerektirip gerektirmediğini söylüyor |
| `validate_script` | Gerçek TypeScript derleyicisi, gerçek `@minecraft/server` tipleri. Hangi modül sürümüne karşı derlendiği cevapta yazıyor |
| `validate_python` | Üç eksen: Python sözdizimi, gömülü komutlar, `/connect` zarfı. **Barındırılan uçta Python yorumlayıcısı yok**, sözdizimi ekseni atlanıyor ve `syntaxChecked: false` diye söyleniyor — `ok:true` tek başına sözdiziminin geçerli olduğu anlamına gelmiyor |
| `review_pack` | Son adım. Şemanın yapısal olarak göremediği kontrolleri de koşuyor: kimlik tutarlılığı, dosya adı kuralları, manifest modül tipi, doku anahtarları, bileşen adları, Molang sorguları, loot ve takas tablosu yolları |

Kaynak: araçların kendi `description` metinleri (`packages/mcp/src/tools/`),
`docs/MCP.md`.

---

# Sayfa 4 — Sınırlar ve veri

## 4.1 Neyi yakalamıyor

Sitenin dürüstlük bölümü; gizlenmemeli. Sınıflar sadeleştirilerek anlatılır:

- **Geçerli ama amaçlanmayan.** Dosya doğru, davranış yanlış. Örnek: `worldLoad`
  olayında oyuncuya mesaj göndermek — olay tetikleniyor ama o anda mesajı
  alacak oyuncu yok. Hiçbir şema bunu yakalayamaz.
- **Bağlam.** Var olan bir Molang sorgusu yanlış bağlamda kullanılırsa oyun
  reddediyor; kontrol yalnızca sorgunun **var olup olmadığına** bakıyor.
- **Sessiz başarısızlık.** Olmayan bir loot tablosuna işaret eden entity
  yükleniyor, doğuyor, ölüyor; oyun hiçbir şey yazmıyor, sadece hiçbir şey
  düşmüyor. Ölçüldü.
- **Denenmemiş doküman tipleri.** Oyunda doğrulanan paket 13 dosya taşıyordu
  ve 11 doküman tipine dokunuyordu; tanınan tip sayısı 60.

Kaynak: `docs/VALIDATION-LIMITS.md`.

## 4.2 Neyin ölçüldüğü

Bu proje "çalışıyor" ile "ölçüldü"yü ayırıyor; site de bunu söylemeli.
Yazılabilecek ölçümler:

- Doğrulayıcının **error** bulguları ile oyunun `ContentLog` hataları bir test
  paketinde aynı kümede birleşti: ikisi de boş.
- Bilinmeyen Molang sorgusu oyunda blok tanımının tamamını düşürüyor; ölçüm
  yapıldıktan sonra kontrol error'a yükseltildi.
- Bilinmeyen bileşen adı da aynı şekilde reddediliyor ama kontrol **warning**
  kaldı, çünkü kaynak listede ölçülmüş 126 adlık bir boşluk vardı. Boşluk
  kapatıldı, severity kararı ayrıca ele alınacak.

Anlatılacak ilke: **bir kural ölçülmeden kodlanmıyor, ölçülen her şey tarihiyle
yazılıyor.**

Kaynak: `docs/VALIDATION-LIMITS.md`, `docs/mcp-kullanim.md`.

## 4.3 Veri nereden geliyor

Kaynak tablosu, lisanslarıyla. Kritik ayrım açıkça yazılmalı: **yeniden yayın
değil, türetilmiş olgu.** Ham içerik sunulmuyor; "bu id var", "bu alan zorunlu"
gibi olgular indeksleniyor.

| Kaynak | Ne için | Lisans |
|---|---|---|
| `Mojang/bedrock-samples` | Blok, entity ve item kimlikleri; komut grameri; Molang sorguları; bileşen adları; şemalar | Minecraft EULA — **yalnızca türetilmiş indeks** |
| `Blockception/Minecraft-bedrock-json-schemas` | JSON doğrulamasının kullandığı şemalar | BSD-3-Clause, **atıf zorunlu** |
| `@minecraft/*` npm paketleri | Script tip tanımları | MIT, Microsoft |
| `MicrosoftDocs/minecraft-creator` | Sürüm notları | CC-BY-4.0 |

Kaynak: `docs/SOURCES.md`, `THIRD-PARTY-NOTICES.md`.

## 4.4 Veri ne kadar taze

- Veri indeksleri günlük olarak otomatik güncelleniyor.
- Zamanlanmış koşu 05:00 UTC'ye ayarlı ama ölçüldü: gerçek başlangıç ortalama
  ~5 saat geç. Yani veri en fazla **1 gün + ~5 saat** eski olabiliyor.
- Veri oyun sürümüne göre klasörleniyor; araçlar hangi sürümü kullandığını
  cevapta söylüyor.

Kaynak: `docs/SOURCES.md`, "Cron 05:00 UTC'de koşmuyor".

## 4.5 Barındırma ve gizlilik

- Ücretsiz kademede barındırılıyor; bu bir kısıt değil, tasarım gereği.
- Uçta hız sınırı yok ve bu açıkça yazılıyor.
- Sunucuda **araç kullanım logu tutulmuyor**; sunucu durumsuz.
- Kişisel veri toplanmıyor, hesap yok.

Kaynak: `docs/MCP.md` "Açık kalan", `CLAUDE.md` "Değişmezler".

## 4.6 Kaynak kodu ve katkı

Depo bağlantısı, lisans (Apache-2.0), sorun bildirme yolu. Ölçüm günlüklerinin
depoda açık durduğu söylenebilir — iddiaların doğrulanabilir olması bu projede
bir özellik.

---

# Altbilgi (her sayfada)

## Marka feragati — zorunlu

Mojang'ın kullanım kılavuzu şart koşuyor. **İngilizce aslı korunacak**, sitenin
dili Türkçe olsa bile:

```
NOT AN OFFICIAL MINECRAFT PRODUCT.
NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
```

Altına çeviri konabilir, aslının yerine geçemez.

Kaynak: `docs/SOURCES.md` "Minecraft marka kuralları",
[Minecraft Usage Guidelines](https://www.minecraft.net/en-us/usage-guidelines).

## Atıflar

- Şemalar: Blockception Ltd, BSD-3-Clause (atıf zorunlu).
- Script tipleri: Microsoft, MIT.
- Sürüm notları: Microsoft, CC-BY-4.0.
- CodeCraft: Apache-2.0.

## Bağlantılar

Depo, lisans, üçüncü taraf künyesi.

---

# Yazılmayacaklar

Bunlar içerik kuralı, tasarım kuralı değil:

| Yazma | Neden |
|---|---|
| "Hatasız çıktı garantisi", "%100 doğru" | Ölçülmedi ve ölçülemez; D sınıfı tanımı gereği yakalanmıyor |
| Ürün adında veya alan adında "Minecraft" | Marka kuralı ihlali |
| Mojang logosu, resmi font, blok dokusu ya da onay izlenimi | Marka kuralı ihlali |
| "Bütün MCP istemcilerinde çalışır" | Yalnızca iki istemci ölçüldü |
| Hız, gecikme veya kullanıcı sayısı iddiası | Ölçülmedi |
| Ham Mojang şeması ya da ham vanilla dosya içeriği | EULA; yalnızca türetilmiş olgu yayınlanıyor |
| Kullanıcıdan e-posta, hesap veya ödeme isteyen herhangi bir akış | Sunucu salt okunur ve kişisel veri tutmuyor |

---

# Uygulama ve ölçüm günlüğü

Site 04-09-2026'da üretildi. Tasarım kaynağı `docs/CodeCraft Site.dc.html`
(Claude Design canvas), kod `app/src/`. Bu bölüm neyin ölçüldüğünü ve neyin
ÖLÇÜLMEDİĞİNİ yazıyor.

## Ölçüldü (04-09-2026)

### Tarayıcı robotu ne görüyor

Tasarım dört sayfayı tek URL'de React durumuyla değiştiriyordu. Kullanıcı
kararı SPA olmaması yönündeydi (gerekçe: sitenin Google ve yapay zekâlar
tarafından okunabilir olması). Dört gerçek rotaya geçildi ve **durumda saklı
metnin statik HTML'e gerçekten düştüğü** ölçüldü.

Yöntem: `next build` + `next start`, `curl` ile alınan HTML'den RSC flight
script'leri (`<script>…</script>`) çıkarıldı, kalan DOM'da sayıldı.

| Ne | Beklenen | Ölçülen |
|---|---|---|
| `/tools` DOM boyutu (script'siz) | — | 19.336 bayt (ham HTML 50.835) |
| `<details>` araç kartı | 9 | **9** |
| Kart gövdesindeki not (`tcard-note`) | 9 | **9** |
| Sürüm paneli (`role="tabpanel"`) | 5 | **5** |
| Bunlardan gizli olan (`hidden`) | 4 | **4** |
| `syntaxChecked` (kapalı kart içinde) | 1 | **1** |
| `2.11.0-beta.1.26.50-preview.27` | 1 | **1** |
| Beş sürüm örneği (`26.40`, `1.26.40.5`, `[1, 26, 40]`, `2.9.0`, `1.21.100`) | 5/5 | **5/5** |
| `/` araç satırı | 9 | **9** |
| `/limits` kaynak satırı | 4 | **4** |

Tasarımın SPA hâlinde bu sayıların hepsi 0 olurdu: dokuz aracın `when`/`note`
metni `sc-if t.open` arkasındaydı, beş sürüm panelinden dördü hiç render
edilmiyordu.

`/`, `/setup`, `/tools`, `/limits`, `/robots.txt`, `/sitemap.xml`,
`/llms.txt`, `/icon.svg` — sekizi de **200**. Dört sayfa `next build`
çıktısında `○ (Static)`.

### MCP ucu bozulmadı

`npm run mcp:probe -- http://localhost:3000/mcp` → **HEPSİ YEŞİL**.
Dokuz araç listeleniyor, dokuzu da `readOnlyHint`, GET ve DELETE 405.

### Üstbilgi kontrastı

Tasarımdaki alt yazı `#efe6d6` üzerine `#8d8577` = **2.9:1**, WCAG AA eşiği
4.5:1. Bant `#6f685c`'ye koyulaştırıldı → **4.4:1**. `#8d8577` başka iki
yerde (adım kartları, kaynak kutusu) aynen duruyor; oralarda metin `#f7f1e6`
ve kontrast zaten yeterliydi.

## Ölçüldü (04-09-2026) — responsive davranış

İlk turda ölçülememişti (tarayıcı eklentisi bağlı değildi) ve "ölçülmedi"
diye yazılmıştı. Eklenti bağlandıktan sonra ölçüldü.

Yöntem: sayfa hedef genişlikte bir `<iframe>` içine yükleniyor — iframe'in
kendi viewport'u olduğu için medya sorguları gerçekten tetikleniyor — ve
`documentElement.scrollWidth <= innerWidth` kontrol ediliyor. Taşma varsa
`getBoundingClientRect().right > innerWidth` olan en geniş öğe raporlanıyor.

**Kapalı hâl — 5 genişlik × 4 rota = 20 ölçüm, 20'si de temiz:**

| Genişlik | scrollWidth | Sonuç |
|---|---|---|
| 1440px | 1425 | 4/4 rota OK |
| 1024px | 1009 | 4/4 rota OK |
| 768px | 753 | 4/4 rota OK |
| 390px | 375 | 4/4 rota OK |
| 320px | 305 | 4/4 rota OK |

(Aradaki 15px kaydırma çubuğu.)

**Açık hâl** — kapalı ölçüm yetmez, `<details>` açılınca da taşmamalı.
`/tools` sayfasında dokuz kart açılıp beş sürüm sekmesi tek tek gezilerek:

| Genişlik | Açık kart | Görünür not | Temiz sekme | En geniş scrollWidth |
|---|---|---|---|---|
| 1440px | 9/9 | 9/9 | 5/5 | 1425 |
| 768px | 9/9 | 9/9 | 5/5 | 753 |
| 390px | 9/9 | 9/9 | 5/5 | 375 |
| 320px | 9/9 | 9/9 | 5/5 | 305 |

Görsel olarak da doğrulandı: 3 sütunlu kaynak tablosu 390px'te üç satıra
iniyor ve `Blockception/Minecraft-bedrock-json-schemas` satır kırıyor;
`VALIDATE` rozeti iki panel arasında yataya dönüyor; üstbilgi uç adresi iki
satıra sarıyor; nav sekmeleri iki sıraya iniyor.

### Tasarımla yan yana karşılaştırma

Tasarım dosyası (`docs/CodeCraft Site.dc.html`) ve uygulanan site aynı anda,
ikisi de 1120px viewport'lu iframe'lerde açılıp karşılaştırıldı. Bölüm bölüm
örtüşüyor: kahraman ızgarası, dört stat kutusu, iki kod paneli ve dikey
`VALIDATE` rozeti, dört satırlık hata tablosu, üç adım kartı, `note` şeridi,
iki kart, dokuz araç satırı.

**Görülen tek fark, bilerek yapılan tek sapma:** üstbilgi bandı. Tasarımda
`#8d8577`, sitede `#6f685c` (kontrast kararı, aşağıda).

760px'te ikisi ayrışıyor ve bu da beklenen: tasarımın kırılma noktası yok, o
genişlikte iki sütunu sıkıştırıyor; site tek sütuna iniyor.

### İki taşma statik analizde bulundu, tarayıcıdan ÖNCE düzeltildi

Bunlar tarayıcı ölçümünden önce statik CSS analiziyle yakalandı; yukarıdaki
20/20 sonucu düzeltilmiş hâlin ölçümü:

- `.cards2` `minmax(300px, 1fr)` taban istiyordu, 320px ekranda kap 284px.
  Bütün `auto-fit` ızgaraları `minmax(min(<px>, 100%), 1fr)` yapıldı.
- `Blockception/Minecraft-bedrock-json-schemas` inline `code` içinde
  bölünmüyordu, 13px'te ~328px sürüyordu. `code { overflow-wrap: anywhere }`
  eklendi.

## Ölçüldü (04-09-2026) — JavaScript'siz kullanım

Ham HTML'de (JavaScript çalıştırılmadan, `curl` çıktısı):

- `<details>` 9, `<summary>` 9 — dokuz araç kartı da native, JavaScript
  gerekmiyor.
- `href="/setup"`, `href="/tools"`, `href="/limits"` — her biri 2 kez
  (üstbilgi sekmesi + sayfa içi bağlantı). Gezinme gerçek `<a href>`.

Çalışmayan tek şey kopyala düğmesi ve sürüm sekmesi; ikisinin de metni
görünür kalıyor.

## Ölçülmedi — açık kalan

- **Gerçek cihazda denenmedi.** Ölçüm masaüstü Chrome'da, iframe viewport'uyla
  yapıldı. Dokunmatik hedef boyutları ve iOS Safari davranışı denenmedi.
- **Üretim dağıtımı görülmedi.** Ölçümlerin hepsi `next start` ile yerelde.
