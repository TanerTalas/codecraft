# Proje Fikri Değişikliği

Bu dosya bir direktiftir, bir öneri değil. Aşağıdakileri olduğu gibi uygula.

---

## 1. Ne değişti

Bu proje bugüne kadar bir **Minecraft coding AI assistant** olarak tasarlandı. Bu fikir artık yok. Tamamen iptal edildi.

Projenin yeni ve tek kapsamı:

1. **MCP sunucusu** (Minecraft Bedrock Edition için komut/behavior pack doğrulama ve veri sorgulama araçları)
2. **MCP'nin nasıl kullanılacağını anlatan bir web sayfası veya sayfalar**

Başka hiçbir şey yok. AI asistanı yok, sohbet arayüzü yok, model çağrısı yok, BYOK yok, API anahtarı yönetimi yok.

---

## 2. Silme talimatı

Eski fikre ait her şey **silinecek**.

Bunlar geçerli değildir ve yapılmayacaktır:

- Dosyayı `deprecated`, `legacy`, `old`, `archive`, `_backup` gibi klasörlere taşımak
- Dosyanın başına "bu artık kullanılmıyor" notu eklemek
- İçeriği yorum satırına almak
- Dosyayı bırakıp içeriğini güncellemek
- "İleride lazım olabilir" gerekçesiyle saklamak

Dosya silinir. Git geçmişi zaten kaydı tutuyor, ayrıca bir yedek gerekmiyor.

### Silinecekler

**Bilinen dosyalar:**

- `CLAUDE.md`
- `docs/ROADMAP.md`
- `docs/SOURCES.md`
- Eski fikre ait tüm diğer `.md` dosyaları

**Kod tarafında, eski asistan fikrine ait olan her şey:**

- Sohbet / konuşma arayüzü bileşenleri
- Model sağlayıcı entegrasyonları ve AI SDK kullanımı
- API anahtarı girişi, saklanması, doğrulanması ile ilgili her şey
- Prompt şablonları, sistem promptları, konuşma durumu yönetimi
- Bu fikre hizmet eden route'lar, sayfalar, tipler ve yardımcı fonksiyonlar

### Silinmeyecekler

Bunlara dokunma:

- MCP sunucusunun kendisi ve araçları
- Veri kaynaklarını çekip indeksleyen boru hattı
- `package.json`, `tsconfig.json`, Vercel yapılandırması, `.gitignore`, lint/format ayarları
- **Üçüncü taraf lisans ve atıf dosyaları.** Blockception şemaları BSD-3-Clause ile geliyor ve telif bildiriminin korunması lisans şartıdır. Toplu silme sırasında bunları kaybetme.

### Silme sırası

Silmeden önce, silinecek dosyaların tam listesini çıkar ve göster. Onay aldıktan sonra hepsini tek seferde sil. Kısmi silme yapma, "şunu da silelim mi" diye tek tek sorma.

---

## 3. Silme sonrası yapılacaklar

### CLAUDE.md sıfırdan yazılacak

Eski `CLAUDE.md` silinecek ve yerine yenisi **boş sayfadan** yazılacak. Eskisini düzenleme, eskisinden bölüm taşıma.

Yeni `CLAUDE.md` yazarken:

- Mantıksal katman sınırlarını tanımla (MCP araç katmanı, doğrulama katmanı, veri indeksleri, site).
- Klasör ve dosya isimlerini sabitleme. İsimlendirme kararını kendi takdirine bırak.
- Kuralları esnek yaz. Değişebilecek kararların yanına bunun güncellenebilir olduğunu belirt.
- Sadece bu iki bileşenden bahset: MCP sunucusu ve tanıtım sitesi.

### docs/SOURCES.md sıfırdan yazılacak

Veri kaynakları bilgisi hâlâ gerekli, ama eski dosya taşınmayacak. Silinecek ve yeni projenin kapsamına göre sıfırdan yazılacak. İçermesi gerekenler:

- `Mojang/bedrock-samples` — açık lisanslı **değildir**. Minecraft EULA'sına tabidir, tüm hakları saklıdır. Ham dosyalar dağıtılamaz veya servis edilemez. Yalnızca türetilmiş olgular (ID varlığı, alan adları, sürüm numaraları) indekslenir; ham içerik geri sunulmaz.
- `Mojang/bedrock-schemas` — resmi şema deposu, incelenecek.
- `Blockception/Minecraft-bedrock-json-schemas` — BSD-3-Clause, atıf zorunlu.
- `@minecraft/server` npm tip tanımları
- `MicrosoftDocs/minecraft-creator`

### ROADMAP

Eski yol haritası silinecek. Yeni bir yol haritası **şimdi yazılmayacak**. Yön netleştikten sonra ayrıca ele alınacak.

---

## 4. Site hakkında

Projenin ikinci bileşeni, MCP'nin nasıl kullanılacağını anlatan bir web sayfası veya sayfalardır.

**Bu aşamada site için hiçbir şey üretme.** Sayfa yapısı, içerik, bileşen, tasarım, kopya metin, hiçbiri. Tasarım ve içerik ayrı bir süreçte ele alınacak.

Şimdilik tek yapılacak şey: sitenin bu projenin bir parçası olduğunu `CLAUDE.md` içinde bir satırla belirtmek.

---

## 5. Özet

| | |
|---|---|
| Eski kapsam | Minecraft coding AI assistant |
| Yeni kapsam | MCP sunucusu + kullanım sitesi |
| Eski dosyalara ne olacak | Silinecek |
| Arşivlenecek mi | Hayır |
| Not bırakılacak mı | Hayır |