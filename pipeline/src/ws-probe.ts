/**
 * Oyuna komut gönderip cevabını okuyan ölçüm aracı.
 *
 * Amacı tek: **elle liste yazmak yerine ölçmek.** Komut doğrulayıcısında
 * (`docs/COMMANDS.md`) iki boşluk "geçerli değerlerin listesi Mojang'ın
 * tanımında yok" diye açık bırakıldı. Bu script o listeyi oyunun kendisinden
 * çıkarıyor: komutu gönderir, `statusCode` okur, sonucu tablo hâlinde basar.
 *
 * CI'da koşamaz — çalışan bir Minecraft istemcisi gerekiyor:
 *
 *   npm run ws:probe
 *
 * Sonra oyunda `/connect localhost:19131` yazılır.
 *
 * Gönderilen komutlar **dünyayı değiştirmiyor**: hepsi ya sorgu ya da
 * kasten geçersiz. Yine de yaratıcı modda, harcanabilir bir dünyada koşulmalı.
 */
import { randomUUID } from "node:crypto";

import { WebSocketServer, type WebSocket } from "ws";

import { runIfMain } from "./lib/cli.ts";

const PORT = Number(process.argv.find((a) => a.startsWith("--port="))?.slice(7) ?? 19131);
const WAIT_MS =
  Number(process.argv.find((a) => a.startsWith("--wait="))?.slice(7) ?? 300) * 1000;
/** Komutlar arası bekleme. Oyun ard arda gelen isteklerde cevap düşürebiliyor. */
const GAP_MS = 250;

type Probe = {
  /** Neyi ölçüyoruz. */
  question: string;
  command: string;
  /**
   * Beklenen sonuç — ölçüm bunu doğrular ya da çürütür.
   *
   * `parses`: oyun komutu AYRIŞTIRABİLDİ mi. Çalışıp bir şey yapması değil;
   * biz sözdizimi ölçüyoruz.
   */
  expect: "parses" | "syntax-error";
};

/**
 * Sözdizimi hatasının durum kodu — ölçülerek bulundu (30-08-2026).
 *
 * İlk turda "negatif kod = hata" varsayılmıştı ve bu yanlış sonuca götürdü:
 * `fill ... minecraft:air 0 replace` `-2147352576` ("0 blocks filled") döndü,
 * yani KOMUT AYRIŞTIRILDI ama hiçbir bloğu değiştirmedi. Ayrıştırılamayan
 * komutlar ayrı bir kod veriyor:
 *
 *   -2147483648  Syntax error: Unexpected "@z": at "testfor >>@z<<"
 *   -2147352576  0 blocks filled          (ayrıştırıldı, sonuç boş)
 *             0  Found Lyliahh            (ayrıştırıldı, başarılı)
 *
 * Bu ayrım kritik: "çalıştı mı" ile "ayrıştırıldı mı" karıştırılırsa
 * doğrulayıcıya yanlış kural yazılır.
 */
const SYNTAX_ERROR_STATUS = -2147483648;

/**
 * Ölçülecek sorular.
 *
 * Her satırın bir gerekçesi var; "olsa iyi olur" komutu yok. Beklenti
 * sütunu bizim varsayımımız — ölçüm onu çürütürse doğrulayıcı düzeltilir,
 * ölçüm değil.
 */
const PROBES: Probe[] = [
  // --- 1. tur teyidi: seçici harfleri (ölçüldü, doğrulayıcıya girdi) ---
  { question: "seçici @s", command: "testfor @s", expect: "parses" },
  { question: "seçici @z (geçersiz)", command: "testfor @z", expect: "syntax-error" },

  // --- AÇIK SORU 1: fill'in eski <data> argümanı ---
  // 1. turda ikisi de -2147352576 ("0 blocks filled") döndü, yani ikisi de
  // AYRIŞTIRILDI. Doğrulayıcı ise eski biçimi reddediyor — yanlış pozitif
  // şüphesi. Ayrıştırılamayan bir değerle karşılaştırarak kesinleştiriyoruz.
  {
    question: "fill eski <data> (0)",
    command: "fill ~ ~ ~ ~ ~ ~ minecraft:air 0 replace",
    expect: "parses",
  },
  {
    question: "fill saçma değer (BOGUS)",
    command: "fill ~ ~ ~ ~ ~ ~ minecraft:air BOGUS replace",
    expect: "syntax-error",
  },
  {
    question: "fill data'sız (modern biçim)",
    command: "fill ~ ~ ~ ~ ~ ~ minecraft:air replace",
    expect: "parses",
  },

  // --- AÇIK SORU 2: blok durumu sözdizimi ---
  // 1. turda ["facing_direction"=99] "Syntax error: Unexpected \"=\"" verdi.
  // Değer aralık dışıydı ama hata SÖZDİZİMİ hatasıydı — yani biçimin kendisi
  // mi reddedildi, değer mi? Geçerli bir değerle ayırt ediliyor.
  {
    question: "blok durumu, GEÇERLİ değer",
    command: 'testforblock ~ ~-1 ~ minecraft:acacia_button ["facing_direction"=0]',
    expect: "parses",
  },
  {
    question: "blok durumu, tırnaksız ad",
    command: "testforblock ~ ~-1 ~ minecraft:acacia_button [facing_direction=0]",
    expect: "parses",
  },
  {
    question: "blok durumu, aralık dışı değer",
    command: 'testforblock ~ ~-1 ~ minecraft:acacia_button ["facing_direction"=99]',
    expect: "syntax-error",
  },
  {
    question: "testforblock durumsuz (temel)",
    command: "testforblock ~ ~-1 ~ minecraft:air",
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

type Outcome = { probe: Probe; ok: boolean; status: number | null; text: string };

async function run(): Promise<void> {
  const server = new WebSocketServer({ port: PORT });
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
   * reddediyor. İşleyici olmadan Node işlenmemiş 'error' olayında çöküyor —
   * ilk gerçek koşuda tam olarak bu oldu ve bütün ölçüm kayboldu.
   *
   * Şimdi kopma kaydediliyor, o ana kadarki sonuçlar korunuyor.
   */
  socket.on("error", (error) => {
    dropped = error.message;
  });
  socket.on("close", (code) => {
    dropped ??= `oyun bağlantıyı kapattı (kod ${code})`;
  });

  console.log("bağlantı kuruldu, ölçüm başlıyor\n");

  for (const probe of PROBES) {
    if (dropped !== null) break;
    const outcome = await new Promise<Outcome>((resolve) => {
      const timer = setTimeout(
        () => resolve({ probe, ok: false, status: null, text: "cevap gelmedi" }),
        5000,
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
          ok: status !== SYNTAX_ERROR_STATUS,
          status,
          text: message.body?.statusMessage ?? "",
        });
      };

      socket.on("message", onMessage);
      send(socket, probe.command);
    });

    results.push(outcome);
    const mark = outcome.ok === (probe.expect === "parses") ? " " : "!";
    console.log(
      `${mark} ${probe.question.padEnd(34)} ${outcome.ok ? "ayrıştı" : "SÖZDİZİMİ HATASI"} ` +
        `(${outcome.status ?? "-"}) ${outcome.text.slice(0, 60)}`,
    );
    await sleep(GAP_MS);
  }

  console.log("\n--- özet ---");

  if (dropped !== null) {
    console.log(`Bağlantı ölçüm bitmeden koptu: ${dropped}`);
    console.log(`${results.length}/${PROBES.length} soru ölçülebildi.\n`);
  }

  if (results.length === 0) {
    console.log(
      "Hiçbir ölçüm alınamadı. Oyunda dünya açık kaldı mı, /connect yazıldıktan\n" +
        "sonra dünyadan çıkılmadı mı kontrol et.",
    );
    process.exitCode = 1;
    socket.close();
    server.close();
    return;
  }

  const surprises = results.filter((r) => r.ok !== (r.probe.expect === "parses"));
  if (surprises.length === 0) {
    console.log(
      `Ölçülen ${results.length} sorunun hepsi beklentiyle uyuştu — ` +
        "doğrulayıcı oyunla aynı fikirde.",
    );
  } else {
    console.log(`${surprises.length} ölçüm beklentiyi ÇÜRÜTTÜ — doğrulayıcı düzeltilmeli:\n`);
    for (const s of surprises) {
      console.log(`  ${s.probe.question}`);
      console.log(`    komut:    ${s.probe.command}`);
      console.log(`    beklenen: ${s.probe.expect === "parses" ? "ayrışır" : "sözdizimi hatası"}`);
      console.log(
        `    ölçülen:  ${s.ok ? "ayrıştı" : "sözdizimi hatası"} (${s.status ?? "-"}) ${s.text}`,
      );
    }
    process.exitCode = 1;
  }

  socket.close();
  server.close();
}

runIfMain(import.meta.url, run);
