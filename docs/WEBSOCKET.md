# WebSocket köprüsü (`/connect`)

Bedrock, `/connect` (alias `/wsserver`) ile oyunu dışarıdaki bir WebSocket
sunucusuna bağlayabiliyor. Üretilen otomasyon script'lerinin oyunla konuşma
yolu bu.

**Mojang bunu hiç belgelemedi.** İzlenecek resmi bir changelog yok ve her
sürümde sessizce kırılabilir. Bu doküman ne zaman, neyin ölçüldüğünü kaydeder;
bir sonraki sürümde aynı ölçüm tekrarlanır ve fark buradan okunur.

## Nasıl koşulur

```
npm run ws:health
```

CI'da koşamaz — çalışan bir Minecraft istemcisi gerekiyor. Script bir sunucu
açar ve yazılacak komutu ekrana basar. Oyunda:

```
/connect localhost:19131
```

Sonra bir mesaj yaz, bir blok kır, bir blok koy, biraz yürü. Script 45 saniye
dinleyip rapor basar.

Bayraklar: `--port=<n>`, `--wait=<saniye>`.

## Oyun tarafı ön koşullar

Üçü de ölçülerek bulundu (30-08-2026): `/connect` ilk denemede
`Websocket server request rejected, go to settings to enable` verdi.

| Koşul | Nerede |
|---|---|
| **Require Encrypted Websockets** kapalı olmalı | Ayarlar → Genel → Profil |
| Dünyada **hileler** açık olmalı | Dünya ayarları |
| UWP/Mağaza sürümünde loopback izni | Yönetici komut isteminde `CheckNetIsolation LoopbackExempt -a -n=microsoft.minecraftuwp_8wekyb3d8bbwe` |

Sunucumuz düz `ws://` konuşuyor, `wss://` değil — ilk madde bu yüzden zorunlu.

Üçüncü madde bu makinede **gerekmedi**: kurulum yeni düzende
(`%APPDATA%\Minecraft Bedrock\`), UWP AppContainer altında değil.

## Ölçüm — 30-08-2026, Bedrock 1.26.x

| Ne | Sonuç |
|---|---|
| Bağlantı | **kuruldu** |
| Komut isteği → cevabı | **geldi** — `time query daytime` → `statusCode=0`, "Daytime is 17839" |
| `BlockBroken` | **geldi** |
| `BlockPlaced` | **geldi** |
| `PlayerTravelled` | **geldi** |
| `PlayerMessage` | gelmedi — **ölçülmedi sayılır**, oyunda sohbete mesaj yazıldığı doğrulanmadı |

Yani bugün protokolün şu hâli çalışıyor:

```json
{
  "header": {
    "version": 1,
    "requestId": "<uuid>",
    "messageType": "commandRequest",
    "messagePurpose": "subscribe" | "commandRequest"
  },
  "body": { "eventName": "BlockBroken" }
}
```

Gelen olaylar `header.messagePurpose === "event"` ve `header.eventName` taşıyor;
komut cevapları `messagePurpose === "commandResponse"` ve `body.statusCode`.

Bu şekil belgelenmiş bir sözleşme değil, topluluk kullanımından geliyordu —
yukarıdaki koşu onu doğruladı. Kod bu yüzden gevşek okuyor: beklenmeyen bir
mesaj sessizce yutulmuyor, "çözümlenemeyen" olarak raporlanıyor.

## Kırıldığında ne yapılacak

`npm run ws:health` şunlardan birini derse protokol değişmiş olabilir:

- **"bağlantı kuruldu ama ne komut cevabı ne olay geldi"** → `messagePurpose`
  veya `messageType` değerleri değişmiş olabilir. Script `exit 1` verir.
- **çözümlenemeyen mesajlar listelendi** → yeni bir mesaj şekli var, okunup
  buraya yazılmalı.
- **bağlantı hiç kurulmadı** → protokol hakkında sonuç **çıkarılamaz**. Önce
  yukarıdaki üç ön koşul kontrol edilir; script bunu açıkça söyler.

Kırılma doğrulanırsa: bu doküman güncellenir, `TODO.md`'ye kayıt düşülür ve
üretilen Python otomasyon script'lerinin bu yola bağlı olanları gözden geçirilir
(`docs/VALIDATION-LIMITS.md` mantığı: ölçülmemiş şey kural olmaz).
