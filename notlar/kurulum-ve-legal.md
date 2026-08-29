# CodeCraft - Kişisel Notlar

Bu dosya Claude Code için değil. Kurulum, iş kararları ve araştırma listesi.

---

## Yapay zeka sağlayıcıları

Kullanıcı kendi anahtarını getirecek (BYOK). Aşağıdakiler geliştirme ve test içindir.

| Sağlayıcı | Durum | Kullanım |
|---|---|---|
| Google AI Studio (Gemini) | Kartsız, ücretsiz kota | Birincil aday |
| Groq | Kartsız, hızlı | Hafif sorgular |
| Anthropic Console (Claude) | Ücretli | Ağır kod üretimi |
| OpenAI | Ücretli | Opsiyonel |
| OpenRouter | Tek anahtar, çok model | Yedekleme zinciri |

**Bilinmesi gereken:**
- Kullanıcı Claude.ai veya Gemini aboneliğiyle giriş yapamaz. Her iki sağlayıcı da bunu yasaklıyor. Sadece Console veya AI Studio anahtarı.
- Google AI Studio anahtarı kart istemiyor, kullanıcı bir dakikada alabilir.
- Eylül 2026'da Gemini API standart anahtarları reddedecek. Yeni oluşturulan anahtarlar zaten auth key, sorun sadece eski anahtar yapıştıran kullanıcıda. Anahtar doğrulama akışı bunu yakalayacak şekilde kurulmalı.
- Ücretsiz tier'lar promptları eğitim için kullanabiliyor. CodeCraft'ta kişisel veri olmadığı için bu kabul edilebilir, ama gizlilik metninde yazılmalı.

**Kullanım planı:**
- Varsayılan mod: kendi anahtarımla, günde 5 mesaj gibi sıkı kota. Kullanıcı hiçbir şey yapmadan denesin.
- Sınırsız mod: kullanıcı kendi anahtarını girer.
- Sırayı ters kurma. İlk ekranda anahtar istersen kullanıcıların çoğunu ürünü görmeden kaybedersin.

---

## Altyapı hesapları

- [ ] GitHub hesabı (repo ve Actions)
- [ ] Hosting: Vercel veya Cloudflare, ücretsiz kademe
- [ ] Alan adı (yıllık küçük maliyet)
- [ ] Hata takibi ve analitik (opsiyonel, ücretsiz kademeler var)

---

## Test ortamı

Atlanması kolay ama zorunlu.

- [ ] **Minecraft Bedrock lisansı, Windows.** Üretilen çıktının gerçekten çalıştığını doğrulamanın başka yolu yok. Ücretli.
- [ ] Node.js
- [ ] Python 3.10 üstü (üretilen script'leri test etmek için)
- [ ] Opsiyonel: Bedrock Dedicated Server, otomatik test için

---

## Legal başlıklar

Şimdi çözülmeyecek, listede tutulacak.

1. **Minecraft EULA ve marka kuralları.** İsimlendirme, resmi bağlantı izlenimi vermeme.
2. **Veri kaynaklarının lisansları.** Özellikle ticari kullanım kısıtı olanlar. Ücretli bir tier açılırsa bağlayıcı hale gelir.
   - bedrock-samples: Minecraft EULA'ya tabi. Ham içerik yeniden dağıtılmayacak.
   - Blockception: BSD-3-Clause, izin verici.
   - Diğerleri kontrol edilecek.
3. **Sağlayıcı kullanım şartları.** Çıktı sahipliği ve rakip ürün geliştirme maddeleri.
4. **Gizlilik metni.** Kullanıcı promptları üçüncü taraflara gidiyor. İşlenme şartları kullanıcının kendi hesap tier'ına bağlı, yani tek bir garanti cümlesi kurulamaz.
5. **Çocuk verisi.** Minecraft kitlesi büyük ölçüde çocuk. Veri toplanıyorsa KVKK, GDPR ve COPPA devreye girer.
   - **Karar alındı:** v1'de hiç kişisel veri toplanmayacak, hesap sistemi kurulmayacak. Bu karar `CLAUDE.md` içinde mimari kısıt olarak yazılı.
6. **Sorumluluk reddi.** Üretilen çıktı kullanıcının dünyasında veri kaybına yol açabilir. Kullanım şartlarında netleştirilecek.
7. **Sunucu kuralları uyarısı.** AFK otomasyon çıktılarında görünür not olmalı. Tek oyunculu hedeflense de kullanıcı çıktıyı sunucuda kullanabilir.

---

## Rekabet araştırması

Benzer bir araç var mı, varsa ne yapıyor ve neyi yapamıyor.

İngilizce terimlerle de aranacak:
```
minecraft ai assistant
minecraft addon generator
ai minecraft command generator
minecraft datapack ai
minecraft bedrock ai tool
```

---

## Kaynak arama sorguları

### Google

**Yapısal veri ve şema**
```
minecraft bedrock json schema github
bedrock addon validator github
minecraft bedrock behavior pack schema validation
bedrock.dev documentation
bedrock wiki addon documentation
```

**Script API**
```
minecraft bedrock script api documentation
@minecraft/server changelog
minecraft scriptapi docs unofficial
minecraft bedrock script api version history
```

**Komut sözdizimi**
```
minecraft bedrock command syntax reference
bedrock mcfunction language server
minecraft bedrock command list json
```

**Dış otomasyon ve WebSocket**
```
minecraft bedrock websocket event names list
minecraft bedrock websocket protocol documentation
minecraft bedrock python automation
```

**Topluluk**
```
bedrock oss discord
minecraft bedrock addon development discord
bedrock addons community wiki
```

### GitHub (Recently updated ile sırala)

```
minecraft bedrock schema
minecraft bedrock addon tools
minecraft bedrock parser
minecraft bedrock typescript types
topic:minecraft-bedrock
topic:minecraft-addon
```

Ayrıca `Mojang`, `MicrosoftDocs` ve `bedrock-ws` organizasyonlarının tüm repolarına bak.

### npm

`@minecraft` ile başlayan tüm paketler. Tip tanımlarının hangi sürümde ne değiştiğini oradan izle.

### YouTube

Resmi kaynak: Minecraft Creator Channel. Ama 26.40 için video yayınlanmadı, yani akış kesintili, tek kaynak olamaz.

```
minecraft bedrock addon tutorial 2026
minecraft bedrock script api tutorial
minecraft bedrock behavior pack tutorial
minecraft bedrock websocket python
minecraft bedrock creator update
```

Tarih filtresi kullan. Bedrock'ta iki yıllık video çoğu zaman yanıltıcı.

---

## Kaynak değerlendirme kontrol listesi

Her yeni kaynak için o anda not al:

- [ ] Son commit tarihi (altı aydan eskiyse şüpheli)
- [ ] Sürüm etiketleri güncel mi (main güncel ama tag eski olabilir)
- [ ] Otomatik mi güncelleniyor (Actions varsa değerli, elle ise kırılgan)
- [ ] Resmi mi topluluk mu
- [ ] Lisansı ne
- [ ] Makine okunur mu, yoksa sadece referans mı