# Anlık Karar Değişikliği: MCP Öncelikli

> Tarih: 31 Ağustos 2026
> Durum: Web arayüzü tasarımı **ertelendi**. Öncelik MCP sunucusuna kaydı.

---

## Kararın özeti

Web sitesi tasarımı sonraya bırakıldı. Yerine önce bir **MCP sunucusu** çıkarılacak.

Sunucu ilk olarak kendi Claude Pro hesabımda test edilecek. Çalıştığı doğrulandıktan sonra ucuz bir şekilde kâra dönüştürme yolu düşünülecek.

Web arayüzü iptal değil, ertelendi. MCP'den gelen kullanım verisi arayüz tasarımını da bilgilendirecek.

---

## Neden bu değişiklik

### 1. Ödeme ve anahtar sorunu ortadan kalkıyor

Daha önceki tıkanma noktası şuydu: kullanıcı Claude aboneliğiyle giriş yapamıyor, sadece API anahtarı kullanabiliyor, anahtar da para demek.

MCP bu sorunu yön değiştirerek çözüyor:

- **Yasak olan:** Benim sitem kullanıcının Claude aboneliğini harcıyor. Ben aracı oluyorum.
- **MCP:** Kullanıcı zaten Claude'un içinde, kendi aboneliğiyle, kendi arayüzünde. CodeCraft sadece Claude'un bağlandığı bir araç sunucusu. Çıkarım Anthropic'in kendi ürününde yapılıyor.

İkincisi protokolün var olma sebebi. Kullanım şartlarına aykırı değil.

### 2. Ürünün asıl değeri zaten LLM değildi

CodeCraft'ın değeri güncel veri ve doğrulama katmanında. MCP tam olarak o kısmı paketlemeye izin veriyor, modeli kullanıcı getiriyor.

Sonuç:
- Token maliyetim sıfır
- Kullanıcının ek maliyeti sıfır, zaten ödediği aboneliği kullanıyor
- BYOK sürtünmesi yok, anahtar yapıştırma adımı yok
- Arayüz yazmaya gerek yok

### 3. Zaten yazdığım kodun üstüne oturuyor

`validator` ve `knowledge` katmanları neredeyse doğrudan MCP aracına dönüşüyor. Sıfırdan iş değil, sarmalama işi.

### 4. Daha hızlı gerçek kullanıcıya ulaşıyorum

Arayüz yok, BYOK akışı yok, anahtar yönetimi yok. Ve ben kendi Pro hesabımla günlük kullanmaya başlarım, bu ürünü test etmenin en iyi yolu.

---

## Desteklenen platformlar

Uzak MCP kullanan özel bağlayıcılar Claude, Claude Desktop ve Cowork üzerinde Free, Pro, Max, Team ve Enterprise planlarında çalışıyor. Free hesaplar tek bağlayıcıyla sınırlı, Pro'da böyle bir kısıt yok.

Tek bir MCP sunucusu sadece Claude'a hizmet etmiyor. Nisan 2026 itibarıyla Claude'un tüm katmanları, ChatGPT (Plus, Pro, Business, Enterprise), Perplexity, Grok ve Mistral Le Chat MCP bağlantılarını destekliyor.

Yani bir kez yaz, birden fazla platforma ulaş.

---

## Açığa çıkarılacak araçlar

Mevcut katmanların doğrudan karşılığı:

```
validate_json(içerik, tip, sürüm)
validate_script(kod, apiSürümü)
lookup_block(id, sürüm)
get_schema(tip, sürüm)
get_version_info()
check_feasibility(niyet)
```

Hepsi salt okunur. Yazma işlemi yok, bu hem güvenlik hem onay akışı açısından işi kolaylaştırıyor.

---

## Teknik gereksinimler

| Konu | Gereksinim |
|---|---|
| Transport | Streamable HTTP. SSE Mart 2025 spesifikasyonunda kaldırıldı |
| Adres | İnternetten erişilebilir HTTPS, genelde `/mcp` ile biten |
| Erişilebilirlik | Bağlantı Anthropic'in bulut altyapısından kuruluyor. Localhost, VPN arkası veya firewall'lu sunucu **bağlanmaz** |
| Geliştirme | ngrok veya Cloudflare Tunnel ile tünel aç |
| Test | Ücretli hesaba gerek yok, sadece dağıtılmış sunucuyu Claude içinde test ederken lazım |
| Kullanıcı yolu | Customize > Connectors. Settings değil, eski rehberler yanlış yeri gösteriyor |

### Token sınırı (önemli)

Özel bağlayıcılar için yaklaşık 30.000 token, Claude.ai ve Desktop için kabaca 150.000 karakter sınırı var. Claude Code'da daha düşük.

Şema dosyaları bunu rahat aşar. **Araçlar tüm registry'yi değil, hedefe yönelik sonuç döndürmeli.** Bu bir optimizasyon değil, zorunluluk.

### Annotation

Her aracın açık bir başlığı ve doğru annotation'ı olmalı. Salt okunur araçlar için `readOnlyHint`. Hepsi salt okunur olduğu için kolay, ve kullanıcı deneyimini iyileştiriyor.

---

## Bilinen riskler

**Barındırma maliyeti kalıyor.** Token maliyeti sıfır ama sunucuyu birinin çalıştırması gerekiyor. Ücretsiz kademe muhtemelen yeter, ama `tsc` çalıştıran doğrulama için serverless yerine container tabanlı barındırma gerekebilir. **Bunu erken test et**, mimariyi etkiler.

**Kitle hâlâ teknik.** MCP bağlayıcı ekleyebilen bir Minecraft oyuncusu, API anahtarı alabilen bir oyuncudan çok daha fazla ama yine de genel kitle değil. MCP web sitesinin yerini almıyor, yanına ekleniyor.

**Free tier tek slot.** Ücretsiz kullanıcılar sadece bir bağlayıcı ekleyebiliyor. Yani onların o tek slotu için rekabet ediyorum. Pro kullanıcılarda bu sorun yok.

---

## Sonraki adımlar

1. MCP sunucusunu yaz, mevcut `validator` ve `knowledge` katmanlarını sarmala
2. Barındırmayı çöz, `tsc` çalıştırma sorununu erken test et
3. Kendi Claude Pro hesabımda bağla ve günlük kullan
4. Gerçek kullanımda hangi araçların işe yaradığını gözlemle
5. Kurulum dokümantasyonu yaz (Customize > Connectors yolu ile)
6. **Sonra:** kâra dönüştürme yolunu düşün
7. **Sonra:** web arayüzü tasarımına dön, MCP kullanım verisiyle bilgilenmiş olarak

---

## Ertelenen işler

- Web arayüzü tasarımı
- BYOK anahtar giriş akışı
- Sürüm seçici arayüzü
- Doğrulama rozeti (MCP'de araç çıktısının kendisi zaten bu işlevi görüyor)

Bunlar iptal değil. MCP oturduktan sonra geri dönülecek.

---

## Açık soru

MCP sunucusu ucuz bir şekilde nasıl kâra dönüştürülür. Şimdi karar verilmeyecek, çalıştığı doğrulandıktan sonra düşünülecek.