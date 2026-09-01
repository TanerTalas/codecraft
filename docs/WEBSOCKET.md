# WebSocket köprüsü (`/connect`)

Bedrock, `/connect` (alias `/wsserver`) ile oyunu dışarıdaki bir WebSocket
sunucusuna bağlayabiliyor. Üretilen otomasyon script'lerinin oyunla konuşma
yolu bu.

**Mojang bunu hiç belgelemedi.** İzlenecek resmi bir changelog yok ve her
sürümde sessizce kırılabilir. Bu doküman ne zaman, neyin ölçüldüğünü kaydeder;
bir sonraki sürümde aynı ölçüm tekrarlanır ve fark buradan okunur.

> ## ⚠ Bu kanal sohbetten DAHA GEVŞEK
>
> **Ölçüldü 01-09-2026, Bedrock 1.26.45.** WebSocket üzerinden gönderilen bir
> komut ile sohbete yazılan aynı komut **aynı ayrıştırıcıdan geçmiyor.**
>
> | Komut | ws | sohbet |
> |---|---|---|
> | `testforblock ~ ~-1 ~ minecraft:acacia_button 0` | ayrıştı | **HATA** |
> | `fill ~ ~ ~ ~ ~ ~ glass 0 outline` | ayrıştı | **HATA** |
> | `fill ~ ~ ~ ~ ~ ~ glass 0 hollow` | ayrıştı | **HATA** |
>
> Aynı oyun, aynı dünya, aynı oturum.
>
> **Sonuç: `ws:probe` ile "oyun kabul ediyor" diye bir kural yazılamaz.**
> Ölçüm sohbette tekrarlanmadan kurala dönüşmez. Bu şerh geçmişe de dönük —
> `docs/COMMANDS.md` içinde bu yüzden çürütülmüş bir ölçüm var: doğrulayıcı
> "eski veri değeri" biçimini kabul ediyordu, sohbet reddediyor, ve kullanıcı
> oyunda çalışmayan bir komut aldı.
>
> Alet atılmıyor — hâlâ tek otomatik ölçüm yolu ve seçici harfleri, blok durumu
> sözdizimi gibi kuralları doğru ölçtü. Yalnızca **tek başına yeterli değil**.
>
> Nasıl bulundu: `docs/mcp-kullanim.md`, senaryo 3.

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

## Ölçülen aksaklık: bozuk kapatma çerçevesi

**Bedrock, bağlantıyı kapatırken spec dışı bir kapatma çerçevesi gönderiyor:
status kodu `0`.** RFC 6455 bunu yasaklıyor ve `ws` paketi `RangeError:
Invalid WebSocket frame: invalid status code 0` ile reddediyor.

Sonucu şu: soket üzerinde `error` işleyicisi yoksa **Node süreci çöker.**
30-08-2026'da tam olarak bu oldu — `ws-probe.ts` bağlandı, oyun kapattı, işlem
işlenmemiş `error` olayında öldü ve o ana kadarki bütün ölçüm kayboldu.

Bu yola bağlanan her script'te iki işleyici zorunlu:

```ts
socket.on("error", ...);   // çökmeyi engeller
socket.on("close", ...);   // kısmi sonucu korur
```

İkisi de `ws-health.ts` ve `ws-probe.ts` içinde var. Yeni bir script yazılırsa
aynısı gerekir.

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
