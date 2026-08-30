/**
 * Oyuna komut gönderip cevabını okuyan ölçüm aracı.
 *
 * Amacı tek: **elle liste yazmak yerine ölçmek.** Komut doğrulayıcısında
 * (`docs/COMMANDS.md`) bazı kurallar "geçerli değerlerin listesi Mojang'ın
 * tanımında yok" diye açık bırakıldı. Bu script o listeyi oyunun kendisinden
 * çıkarıyor.
 *
 * CI'da koşamaz — çalışan bir Minecraft istemcisi gerekiyor:
 *
 *   npm run ws:probe
 *
 * Sonra oyunda `/connect localhost:19131` yazılır.
 *
 * Gönderilen komutlar **dünyayı değiştirmiyor**: hepsi ya sorgu ya da kasten
 * geçersiz. Yine de yaratıcı modda, harcanabilir bir dünyada koşulmalı.
 */
import { randomUUID } from "node:crypto";

import { WebSocketServer, type WebSocket } from "ws";

import { runIfMain } from "./lib/cli.ts";

const PORT = Number(process.argv.find((a) => a.startsWith("--port="))?.slice(7) ?? 19131);
const WAIT_MS =
  Number(process.argv.find((a) => a.startsWith("--wait="))?.slice(7) ?? 300) * 1000;
/** Komutlar arası bekleme. Oyun ard arda gelen isteklerde cevap düşürebiliyor. */
const GAP_MS = 250;
/** Tek komutun cevabı için beklenen süre. */
const ANSWER_MS = 5000;

type Expectation = "parses" | "syntax-error";

type Probe = {
  /** Neyi ölçüyoruz. */
  question: string;
  command: string;
  /**
   * Beklenen sonuç — ölçüm bunu doğrular ya da çürütür.
   *
   * `parses`: oyun komutu AYRIŞTIRABİLDİ mi. Çalışıp bir şey yapması değil;
   * ölçülen şey sözdizimi.
   */
  expect: Expectation;
};

/**
 * Sözdizimi hatasının durum kodu — ölçülerek bulundu (30-08-2026).
 *
 * İlk turda "negatif kod = hata" varsayılmıştı ve bu yanlış sonuca götürdü:
 * `fill ... minecraft:air 0 replace` `-2147352576` ("0 blocks filled") döndü,
 * yani KOMUT AYRIŞTIRILDI ama hiçbir bloğu değiştirmedi.
 *
 *   -2147483648  Syntax error: Unexpected "@z": at "testfor >>@z<<"
 *   -2147352576  0 blocks filled          (ayrıştırıldı, sonuç boş)
 *             0  Found Lyliahh            (ayrıştırıldı, başarılı)
 *
 * "Çalıştı mı" ile "ayrıştırıldı mı" karıştırılırsa doğrulayıcıya yanlış
 * kural yazılır.
 */
const SYNTAX_ERROR_STATUS = -2147483648;

/**
 * Ölçülecek sorular.
 *
 * Her satırın bir gerekçesi var; "olsa iyi olur" komutu yok. Beklenti sütunu
 * bizim varsayımımız — ölçüm onu çürütürse doğrulayıcı düzeltilir, ölçüm değil.
 */
const PROBES: Probe[] = [
  // Temel: bağlantının ve ayrıştırıcının çalıştığını doğrular.
  { question: "temel (testfor @s)", command: "testfor @s", expect: "parses" },

  // --- AÇIK SORU: blok durumu sözdiziminin gerçek biçimi ---
  //
  // 2. turda İKİ biçim de reddedildi ve değer geçerliydi, yani reddedilen
  // biçimin kendisi:
  //
  //   ["facing_direction"=0]   → Unexpected "="
  //   [facing_direction=0]     → Unexpected "facing_direction"
  //
  // Tırnaklı ad "[" sonrasında kabul ediliyor, ardındaki "=" edilmiyor.
  // Aday biçimler tek tek deneniyor. Hepsi düşerse sonuç da bir sonuçtur:
  // testforblock bu parametreyi gerçekte desteklemiyor demektir.
  {
    question: "ayraç iki nokta",
    command: 'testforblock ~ ~-1 ~ minecraft:acacia_button ["facing_direction":0]',
    expect: "parses",
  },
  {
    question: "blok adına bitişik",
    command: 'testforblock ~ ~-1 ~ minecraft:acacia_button["facing_direction"=0]',
    expect: "parses",
  },
  {
    question: "yalnızca ad, değersiz",
    command: 'testforblock ~ ~-1 ~ minecraft:acacia_button ["facing_direction"]',
    expect: "parses",
  },
  {
    question: "boş dizi",
    command: "testforblock ~ ~-1 ~ minecraft:acacia_button []",
    expect: "parses",
  },
  {
    question: "eski veri değeri (int)",
    command: "testforblock ~ ~-1 ~ minecraft:acacia_button 0",
    expect: "parses",
  },
  {
    question: "durum: bool blok (open_bit)",
    command: 'testforblock ~ ~-1 ~ minecraft:acacia_door ["open_bit"=true]',
    expect: "parses",
  },
  {
    question: "durum: string (cardinal_direction)",
    command: 'testforblock ~ ~-1 ~ minecraft:acacia_door ["minecraft:cardinal_direction"="north"]',
    expect: "parses",
  },
];

const send = (socket: WebSocket, commandLine: string): void => {
  socket.send(
    JSON.stringify({
      header: {
        version: 1,
        requestId: randomUUID(),
        messageType: "commandRequest",
        messagePurpose: "commandRequest",
      },
      body: { origin: { type: "player" }, commandLine, version: 1 },
    }),
  );
};

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Üç durum, iki değil.
 *
 * "Cevap gelmedi" bir ÖLÇÜM DEĞİL. Onu sözdizimi hatası saymak, bağlantı
 * koptuğunda doğrulayıcıya yanlış kural yazdırırdı — ilk 2. tur denemesinde
 * tam olarak öyle raporlandı ve yanıltıcıydı.
 */
type Verdict = "parsed" | "syntax-error" | "no-answer";

type Outcome = { probe: Probe; verdict: Verdict; status: number | null; text: string };

const LABEL: Record<Verdict, string> = {
  parsed: "ayrıştı",
  "syntax-error": "SÖZDİZİMİ HATASI",
  "no-answer": "cevap yok",
};

/** Ölçüm beklentiyi çürüttü mü. Ölçülemeyen soru çürütmez. */
const contradicts = (outcome: Outcome): boolean =>
  outcome.verdict !== "no-answer" &&
  outcome.verdict !== (outcome.probe.expect === "parses" ? "parsed" : "syntax-error");

const RECONNECT_HELP = [
  "Bağlantı komutlara cevap vermeden koptu. Ölçülen kalıp şu: oyunu açtıktan",
  "sonraki İLK /connect çalışıyor, sonrakiler anında kopuyor — oyun önceki",
  "bağlantıyı temizlemiyor gibi görünüyor.",
  "",
  "Denenecekler, sırayla:",
  "  1. Oyunda  /wsserver out  yazıp bağlantıyı kapat, sonra tekrar /connect",
  "  2. Dünyadan çık, tekrar gir, sonra /connect",
  "  3. Oyunu kapatıp aç",
].join("\n");

async function run(): Promise<void> {
  const server = new WebSocketServer({
    port: PORT,
    // Bedrock'ın WebSocket uygulaması belgelenmemiş ve zaten spec ihlali
    // yapıyor (kapatma çerçevesinde status 0). Sıkıştırma uzantısı pazarlığı
    // fazladan bir değişken; kapatarak eleniyor.
    perMessageDeflate: false,
  });
  const results: Outcome[] = [];
  /** Bağlantı koptuysa sebebi. Dolduğunda ölçüm durur ve kısmi sonuç basılır. */
  let dropped: string | null = null;

  const socket = await new Promise<WebSocket>((resolve, reject) => {
    const timer = setTimeout(() => {
      server.close();
      reject(new Error(`${WAIT_MS / 1000} saniyede bağlantı gelmedi`));
    }, WAIT_MS);

    console.log(`WebSocket sunucusu dinliyor: ws://localhost:${PORT}\n`);
    console.log("Oyunda YARATICI modda, harcanabilir bir dünyada şunu yaz:\n");
    console.log(`  /connect localhost:${PORT}\n`);
    console.log(`${PROBES.length} komut gönderilecek, hiçbiri dünyayı değiştirmiyor.\n`);

    server.on("connection", (ws) => {
      clearTimeout(timer);
      resolve(ws);
    });
    server.on("error", reject);
  });

  /**
   * Soket hatası süreci ÖLDÜRMEMELİ.
   *
   * Bedrock bağlantıyı kapatırken spec dışı bir kapatma çerçevesi gönderiyor
   * (status kodu 0; RFC 6455 bunu yasaklıyor) ve `ws` bunu `RangeError` ile
   * reddediyor. İşleyici olmadan Node işlenmemiş 'error' olayında çöküyor.
   */
  socket.on("error", (error) => {
    dropped ??= error.message;
  });
  socket.on("close", (code) => {
    dropped ??= `oyun bağlantıyı kapattı (kod ${code})`;
  });

  console.log("bağlantı kuruldu, ölçüm başlıyor\n");

  for (const probe of PROBES) {
    if (dropped !== null) break;

    const outcome = await new Promise<Outcome>((resolve) => {
      const timer = setTimeout(
        () => resolve({ probe, verdict: "no-answer", status: null, text: "" }),
        ANSWER_MS,
      );

      const onMessage = (data: Buffer): void => {
        const message = JSON.parse(data.toString()) as {
          header?: { messagePurpose?: string };
          body?: { statusCode?: number; statusMessage?: string };
        };
        if (message.header?.messagePurpose !== "commandResponse") return;

        clearTimeout(timer);
        socket.off("message", onMessage);
        const status = message.body?.statusCode ?? null;
        resolve({
          probe,
          // Ölçtüğümüz şey "çalıştı mı" değil, "AYRIŞTIRILDI mı".
          verdict: status === SYNTAX_ERROR_STATUS ? "syntax-error" : "parsed",
          status,
          text: message.body?.statusMessage ?? "",
        });
      };

      socket.on("message", onMessage);
      send(socket, probe.command);
    });

    results.push(outcome);
    console.log(
      `${contradicts(outcome) ? "!" : " "} ${probe.question.padEnd(32)} ` +
        `${LABEL[outcome.verdict].padEnd(17)} (${outcome.status ?? "-"}) ` +
        outcome.text.slice(0, 56),
    );
    await sleep(GAP_MS);
  }

  const measured = results.filter((r) => r.verdict !== "no-answer");
  console.log("\n--- özet ---");

  if (dropped !== null) {
    console.log(`bağlantı koptu: ${dropped}`);
    console.log(`${measured.length}/${PROBES.length} soru ölçülebildi\n`);
  }

  if (measured.length === 0) {
    console.log(RECONNECT_HELP);
    process.exitCode = 1;
    socket.close();
    server.close();
    return;
  }

  const surprises = measured.filter(contradicts);
  if (surprises.length === 0) {
    console.log(
      `Ölçülen ${measured.length} sorunun hepsi beklentiyle uyuştu — ` +
        "doğrulayıcı oyunla aynı fikirde.",
    );
  } else {
    console.log(`${surprises.length} ölçüm beklentiyi ÇÜRÜTTÜ — doğrulayıcı düzeltilmeli:\n`);
    for (const s of surprises) {
      console.log(`  ${s.probe.question}`);
      console.log(`    komut:    ${s.probe.command}`);
      console.log(`    beklenen: ${s.probe.expect === "parses" ? "ayrışır" : "sözdizimi hatası"}`);
      console.log(`    ölçülen:  ${LABEL[s.verdict]} (${s.status ?? "-"}) ${s.text}`);
    }
    process.exitCode = 1;
  }

  if (measured.length < PROBES.length) {
    console.log(`\n${PROBES.length - measured.length} soru ölçülemedi.\n`);
    console.log(RECONNECT_HELP);
  }

  socket.close();
  server.close();
}

runIfMain(import.meta.url, run);
