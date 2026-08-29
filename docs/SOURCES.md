# Veri Kaynakları

Projenin asıl değeri burada. Model değil, kürate edilmiş ve güncel tutulan veri.

## Kritik ayrım

Bu verileri **yeniden yayınlamak** ile onlardan **türetilmiş indeks üretmek** farklı şeyler. İkincisi güvenli. Pipeline ham içeriği dağıtmaz, kendi indekslerini üretir.

## Otomatik çekilenler (pipeline)

| Kaynak | Ne için | Lisans |
|---|---|---|
| `Mojang/bedrock-samples` | Blok, entity, item tanımları, paket yapısı | Minecraft EULA, yeniden dağıtma |
| `Blockception/Minecraft-bedrock-json-schemas` | JSON doğrulama şemaları | BSD-3-Clause, izin verici |
| `@minecraft/server` (npm) | Script tip tanımları | **MIT** (doğrulandı: `npm view @minecraft/server license`) |
| `MicrosoftDocs/minecraft-creator` | Sürüm notları, bileşen değişiklikleri | Repo lisansı kontrol edilecek |
| `bedrock-samples/metadata/json_schemas/` | Mojang'ın **kendi** JSON şemaları | Minecraft EULA (bedrock-samples içinde) |

**Çekme notları:**
- bedrock-samples: `main` dalı kararlı sürümü izler, `preview` haftalık. Yayınlar aksayabiliyor, tag'lerin düzenli geleceğini varsayma.
  - Doğrulandı (29-08-2026): kararlı seride tek tag var (`v1.26.40.05`), preview'de 20'den fazla. Tag'e değil `main` dalına bakılıyor.
- **Sürüm tespiti `version.json` ile yapılır.** Repo kökündeki 2 KB'lık bu dosya `latest.version` alanını verir (`1.26.40.5`). Repoyu klonlamaya gerek yok.
- Blockception: sürüm etiketleri geride kalabiliyor, `main` dalına bak.
- Sürüm yayınlarının "min" varyantı sadece metin dosyası içerir, ikili dosya yok. Pipeline için tercih edilir.
- bedrock-samples kökünde `LICENSE` dosyası **yok** (HTTP 404). EULA varsayımı geçerli, ham içerik `data/` altına kopyalanmaz.

## Şema kaynağı: Blockception mı, Mojang mı

`bedrock-samples/metadata/json_schemas/` altında Mojang'ın kendi şemaları duruyor —
`server/` içinde block, block_components, entity, item, item_components, biome, spawn,
world ve diğerleri. Yani Blockception tek seçenek değil.

Karar **Aşama 2'ye bırakıldı**. Validator'ın 20 fixture'ı hangisinin daha iyi tuttuğunu
gösterecek; tahminle seçilmeyecek. Pipeline ikisini de çeker, maliyeti düşük.

`CLAUDE.md`'nin "kendi JSON şemalarını yazma" kuralı iki seçenekte de korunuyor.

## Referans (otomatik çekilmez)

| Kaynak | Ne için |
|---|---|
| feedback.minecraft.net changelog | Sürüm takibi |
| minecraft.wiki | Boşluk doldurma, ticari kısıt olabilir |
| WebSocket protokol dokümantasyonu | Dış otomasyon, topluluk kaynağı |

## Dış otomasyon kütüphaneleri (üretilen script'lerde kullanılır)

- `bedrockpy` veya `py-mcws` — WebSocket bağlantısı
- `pydirectinput` — girdi simülasyonu (`pyautogui` oyunlarda çalışmaz)
- `opencv` — ekran okuma, gerekirse

## WebSocket hakkında uyarı

`/connect` ve `/wsserver` hiçbir zaman resmi olarak belgelenmedi ve bakımı yapılmıyor. Her sürümde kırılabilir ve izlenecek resmi changelog yok.

Gereksinimler: dünyada hileler açık (bağlantı kurmak için), Ayarlar > Genel > Profil altında "Require Encrypted Websockets" kapalı. Konsollarda çalışmaz.

Pipeline'a bir sağlık kontrolü eklenmeli: her sürümde bağlantının ve temel olayların hâlâ çalıştığını test et, kırıldığında bildir.