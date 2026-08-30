/**
 * WebSocket sağlık kontrolü — Aşama 1'den Aşama 3'e taşındı (TODO.md).
 *
 * `/connect` ve `/wsserver` Mojang tarafından **hiç belgelenmedi**: izlenecek
 * resmi bir changelog yok ve her sürümde sessizce kırılabilir. Üretilen
 * otomasyon script'leri buna bağlı, o yüzden kırıldığını fark etmek gerekiyor.
 *
 * CI'da koşamaz — çalışan bir Minecraft istemcisi gerekiyor. Elle koşulur:
 *
 *   npm run ws:health
 *
 * Sonra oyunda ekrana basılan `/connect ...` komutu yazılır.
 *
 * ÖNEMLİ: Aşağıdaki protokol şekli (header/body, messagePurpose: "subscribe")
 * belgelenmiş bir kaynaktan değil, topluluk kullanımından geliyor. Bu script'in
 * amacı tam olarak onu DOĞRULAMAK. Bir şey gelmezse "protokol değişmiş
 * olabilir" denir — çalışıyormuş gibi raporlanmaz.
 */
import { randomUUID } from "node:crypto";

import { WebSocketServer, type WebSocket } from "ws";

const PORT = Number(process.argv.find((a) => a.startsWith("--port="))?.slice(7) ?? 19131);
/** Bağlantı beklerken ne kadar durulacağı. */
const CONNECT_TIMEOUT_MS = Number(
  process.argv.find((a) => a.startsWith("--wait="))?.slice(7) ?? 300,
) * 1000;
/** Bağlandıktan sonra olay beklenecek süre. */
const LISTEN_MS = 45_000;

/**
 * Abone olunacak olaylar. İsimler topluluk kaynaklı; hangisinin bu sürümde
 * hâlâ var olduğu bu koşuyla ölçülüyor.
 */
const EVENTS = ["PlayerMessage", "BlockBroken", "BlockPlaced", "PlayerTravelled"];

type Header = {
  version: number;
  requestId: string;
  messageType: string;
  messagePurpose: string;
};

const subscribe = (eventName: string): string =>
  JSON.stringify({
    header: {
      version: 1,
      requestId: randomUUID(),
      messageType: "commandRequest",
      messagePurpose: "subscribe",
    } satisfies Header,
    body: { eventName },
  });

const command = (commandLine: string): string =>
  JSON.stringify({
    header: {
      version: 1,
      requestId: randomUUID(),
      messageType: "commandRequest",
      messagePurpose: "commandRequest",
    } satisfies Header,
    body: { origin: { type: "player" }, commandLine, version: 1 },
  });

/** Ölçülen şeyler. Hepsi başta false — kanıt gelmeden true yazılmaz. */
const seen = {
  connected: false,
  commandResponded: false,
  events: new Set<string>(),
  unknown: [] as string[],
};

function onMessage(raw: string): void {
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    seen.unknown.push(`JSON değil: ${raw.slice(0, 120)}`);
    return;
  }

  // Gelen mesajın şekli belgelenmemiş: header'da eventName gibi alanlar
  // topluluk kullanımından biliniyor, sözleşme değil. Bu yüzden Header'ın
  // kendisiyle değil, gevşek bir okumayla çözümleniyor.
  const message = parsed as {
    header?: Partial<Header> & { eventName?: string };
    body?: Record<string, unknown>;
  };
  const purpose = message.header?.messagePurpose;
  const eventName = message.header?.eventName;

  if (purpose === "commandResponse") {
    seen.commandResponded = true;
    const status = message.body?.["statusCode"];
    const text = message.body?.["statusMessage"] ?? message.body?.["message"] ?? "";
    console.log(`  komut cevabı  statusCode=${String(status)}  ${String(text).slice(0, 80)}`);
    return;
  }

  if (purpose === "event" && eventName !== undefined) {
    if (!seen.events.has(eventName)) {
      seen.events.add(eventName);
      console.log(`  olay geldi    ${eventName}`);
    }
    return;
  }

  seen.unknown.push(`messagePurpose=${String(purpose)} ${raw.slice(0, 120)}`);
}

function report(): void {
  console.log("\n--- sonuç ---");
  console.log(`bağlantı        ${seen.connected ? "kuruldu" : "KURULMADI"}`);
  console.log(`komut cevabı    ${seen.commandResponded ? "geldi" : "GELMEDİ"}`);
  console.log(
    `olaylar         ${seen.events.size > 0 ? [...seen.events].join(", ") : "HİÇBİRİ GELMEDİ"}`,
  );

  const missing = EVENTS.filter((name) => !seen.events.has(name));
  if (seen.connected && missing.length > 0) {
    console.log(`gelmeyenler     ${missing.join(", ")}`);
    console.log(
      "                (oyunda o eylemi yapmadıysan bu normal — ölçüm ancak\n" +
        "                 eylem denendiyse anlamlı)",
    );
  }

  if (seen.unknown.length > 0) {
    console.log(`\nçözümlenemeyen ${seen.unknown.length} mesaj:`);
    for (const line of seen.unknown.slice(0, 5)) console.log(`  ${line}`);
  }

  if (!seen.connected) {
    console.log(
      "\nBağlantı hiç kurulmadı. Olası sebepler: /connect yazılmadı, port\n" +
        "farklı, ya da güvenlik duvarı engelledi. Protokolün kırıldığı sonucu\n" +
        "ÇIKARILAMAZ — bağlantı denenmemiş olabilir.",
    );
    process.exitCode = 1;
    return;
  }

  if (!seen.commandResponded && seen.events.size === 0) {
    console.log(
      "\nBağlantı kuruldu ama ne komut cevabı ne olay geldi. Protokol şekli\n" +
        "değişmiş olabilir. Bu, üretilen otomasyon script'lerini etkiler —\n" +
        "docs/ ve TODO.md güncellenmeli.",
    );
    process.exitCode = 1;
  }
}

const server = new WebSocketServer({
    port: PORT,
    // Bedrock'ın WebSocket uygulaması belgelenmemiş ve zaten spec ihlali
    // yapıyor (kapatma çerçevesinde status 0). Sıkıştırma uzantısı pazarlığı
    // fazladan bir değişken; kapatarak eleniyor.
    perMessageDeflate: false,
  });

const connectTimer = setTimeout(() => {
  console.log(`\n${CONNECT_TIMEOUT_MS / 1000} saniyede bağlantı gelmedi.`);
  report();
  server.close();
}, CONNECT_TIMEOUT_MS);

server.on("listening", () => {
  console.log(`WebSocket sunucusu dinliyor: ws://localhost:${PORT}\n`);
  console.log("Şimdi Minecraft'ta bir dünya aç ve sohbete şunu yaz:\n");
  console.log(`  /connect localhost:${PORT}\n`);
  console.log("Bağlandıktan sonra: bir mesaj yaz, bir blok kır, bir blok koy.");
  console.log(`Bağlantı beklenecek süre: ${CONNECT_TIMEOUT_MS / 1000} sn\n`);
});

server.on("connection", (socket: WebSocket) => {
  clearTimeout(connectTimer);
  seen.connected = true;
  console.log("bağlantı kuruldu\n");

  for (const eventName of EVENTS) socket.send(subscribe(eventName));
  // Zararsız bir sorgu: dünyayı değiştirmez, sadece cevap dönüp dönmediğini ölçer.
  socket.send(command("time query daytime"));

  socket.on("message", (data) => onMessage(data.toString()));
  socket.on("error", (error) => console.log(`  soket hatası  ${error.message}`));

  setTimeout(() => {
    report();
    // Kapanış duyurulmadan yapılırsa oyun "Could not connect to the server"
    // gösteriyor ve başarılı koşu başarısız sanılıyor.
    console.log(
      '
Ölçüm bitti, sunucu kapanıyor. Oyunda "Could not connect to the server"
' +
        "görmen NORMAL — bağlantıyı biz kapattık.",
    );
    socket.close();
    server.close();
  }, LISTEN_MS);
});

server.on("error", (error) => {
  console.error(`Sunucu başlatılamadı: ${error.message}`);
  process.exitCode = 1;
});
