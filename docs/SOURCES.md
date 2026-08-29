# Veri Kaynakları

Projenin asıl değeri burada. Model değil, kürate edilmiş ve güncel tutulan veri.

## Kritik ayrım

Bu verileri **yeniden yayınlamak** ile onlardan **türetilmiş indeks üretmek** farklı şeyler. İkincisi güvenli. Pipeline ham içeriği dağıtmaz, kendi indekslerini üretir.

## Otomatik çekilenler (pipeline)

| Kaynak | Ne için | Lisans |
|---|---|---|
| `Mojang/bedrock-samples` | Blok, entity, item tanımları, paket yapısı | Minecraft EULA, yeniden dağıtma |
| `Blockception/Minecraft-bedrock-json-schemas` | JSON doğrulama şemaları | BSD-3-Clause, izin verici |
| `@minecraft/server` (npm) | Script tip tanımları | Paket lisansı kontrol edilecek |
| `MicrosoftDocs/minecraft-creator` | Sürüm notları, bileşen değişiklikleri | Repo lisansı kontrol edilecek |

**Çekme notları:**
- bedrock-samples: `main` dalı kararlı sürümü izler, `preview` haftalık. Yayınlar aksayabiliyor, tag'lerin düzenli geleceğini varsayma.
- Blockception: sürüm etiketleri geride kalabiliyor, `main` dalına bak.
- Sürüm yayınlarının "min" varyantı sadece metin dosyası içerir, ikili dosya yok. Pipeline için tercih edilir.

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