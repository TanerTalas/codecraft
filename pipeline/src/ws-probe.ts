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

/**
 * ⚠ BU ALET SOHBETİ ÖLÇMÜYOR.
 *
 * Ölçüldü 01-09-2026 (Bedrock 1.26.45): WebSocket kanalı sohbetten DAHA GEVŞEK.
 * Aynı komut burada ayrışıp sohbette sözdizimi hatası verebiliyor — üç örneği
 * aşağıdaki "eski veri değeri" ölçümlerinde duruyor.
 *
 * Yani buradaki "ayrıştı" sonucu **ws kanalının gerçeği**, oyuncunun gerçeği
 * değil. Bir kural yazmadan önce sohbette elle tekrarla.
 * Ayrıntı: docs/WEBSOCKET.md, docs/COMMANDS.md.
 */

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

  // --- CEVAPLANDI: blok durumu sözdizimi ["ad":değer] ---
  //
  // Bunlar 30-08-2026'da birer HİPOTEZDİ ve expect alanları "ayrışır" diye
  // yazılmıştı. Cevap bulundu, parseBlockStates'e işlendi, ama expect alanları
  // güncellenmedi ve dosya bir yıl boyunca yanlış alarm verecekti.
  //
  // 01-09-2026'da tekrar ölçüldü (Bedrock 1.26.45) ve tablo kesinleşti:
  //
  //   ["facing_direction":0]    ayrıştı      iki nokta DOĞRU ayraç
  //   []                        ayrıştı      boş dizi geçerli
  //   ["facing_direction"=0]    HATA         Unexpected "="
  //   ["facing_direction"]      HATA         Unexpected "]" — değer zorunlu
  //   ["open_bit"=true]         HATA         Unexpected "="
  //   ["…cardinal_direction"="north"]  HATA  Unexpected "="
  //
  // Doğrulayıcı altısında da oyunla aynı şeyi söylüyor (ölçüldü). Beklentiler
  // artık ölçülen sonuca göre yazılı; biri değişirse oyun değişmiş demektir.
  {
    question: "ayraç iki nokta",
    command: 'testforblock ~ ~-1 ~ minecraft:acacia_button ["facing_direction":0]',
    expect: "parses",
  },
  {
    question: "blok adına bitişik + eşittir",
    command: 'testforblock ~ ~-1 ~ minecraft:acacia_button["facing_direction"=0]',
    expect: "syntax-error",
  },
  {
    question: "yalnızca ad, değersiz",
    command: 'testforblock ~ ~-1 ~ minecraft:acacia_button ["facing_direction"]',
    expect: "syntax-error",
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
    question: "durum: bool, eşittir ayracı",
    command: 'testforblock ~ ~-1 ~ minecraft:acacia_door ["open_bit"=true]',
    expect: "syntax-error",
  },
  {
    question: "durum: string, eşittir ayracı",
    command: 'testforblock ~ ~-1 ~ minecraft:acacia_door ["minecraft:cardinal_direction"="north"]',
    expect: "syntax-error",
  },

  // --- AÇIK SORU: eski veri değeri (int) HANGİ komutlarda kabul ediliyor ---
  //
  // 01-09-2026, docs/mcp-kullanim.md senaryo 3: kullanıcı oyunda ölçtü ve doğrulayıcının
  // GEÇİRDİĞİ bir komut düştü — yanlış negatif:
  //
  //   /fill ~-5 ~-1 ~-5 ~4 ~8 ~4 glass 0 outline
  //   Syntax error: Unexpected "0": at " ~4 glass >>0<< outline"
  //
  // Oysa checkBlockStates() int'i BİLEREK kabul ediyor ve gerekçesi ölçülmüş
  // bir sonuç (30-08-2026). Ama o ölçüm testforblock üzerindeydi; kaçamak
  // BLOCK_STATE_ARRAY kullanan BEŞ komuda birden uygulanıyor (clone, execute,
  // fill, setblock, testforblock). Genelleme fazla geniş olabilir.
  //
  // Üç hipotez, üçünü ayıracak ölçüm:
  //   H1 sürüm değişti, int artık hiçbir yerde kabul edilmiyor
  //   H2 komuta bağlı — testforblock kabul ediyor, fill etmiyor
  //   H3 FILLMODE'a bağlı — "replace" kabul ediyor, "hollow"/"outline" etmiyor
  //
  // Bloklar bilerek "air" ve tek bloklu bölge: sözdizimi ölçülüyor, blok
  // kimliği değil, ve dünya değişmiyor.
  {
    question: "int: testforblock (30-08 ölçümünün tekrarı)",
    command: "testforblock ~ ~-1 ~ minecraft:acacia_button 0",
    expect: "parses",
  },
  {
    question: "int: fill + replace (kod yorumunun iddiası)",
    command: "fill ~ ~ ~ ~ ~ ~ minecraft:air 0 replace",
    expect: "parses",
  },
  {
    question: "int: fill + hollow",
    command: "fill ~ ~ ~ ~ ~ ~ minecraft:air 0 hollow",
    expect: "parses", // ws kabul ediyor, SOHBET ETMİYOR
  },
  {
    question: "int: fill + outline (kullanıcının düşen biçimi)",
    command: "fill ~ ~ ~ ~ ~ ~ minecraft:air 0 outline",
    expect: "parses", // ws kabul ediyor, SOHBET ETMİYOR
  },
  {
    question: "int: fill, namespace'siz blok",
    command: "fill ~ ~ ~ ~ ~ ~ air 0 hollow",
    expect: "parses", // ws kabul ediyor, SOHBET ETMİYOR
  },
  {
    question: "int: setblock + replace",
    command: "setblock ~ ~ ~ minecraft:air 0 replace",
    expect: "parses",
  },
  {
    question: "kontrol: fill + hollow, int YOK (doğru modern biçim)",
    command: "fill ~ ~ ~ ~ ~ ~ minecraft:air hollow",
    expect: "parses",
  },

  // --- 2. TUR: geriye tek değişken kaldı, BLOK ---
  //
  // 1. tur üç hipotezi de çürüttü (01-09-2026, Bedrock 1.26.45):
  //
  //   testforblock … acacia_button 0        ayrıştı
  //   fill … minecraft:air 0 replace        ayrıştı
  //   fill … minecraft:air 0 hollow         ayrıştı   ← beklenen: hata
  //   fill … minecraft:air 0 outline        ayrıştı   ← beklenen: hata
  //   fill … air 0 hollow                   ayrıştı   ← beklenen: hata
  //   setblock … minecraft:air 0 replace    ayrıştı
  //
  // Yani sürüm de (H1), komut da (H2), doldurma modu da (H3) değil. Ama
  // kullanıcının oyunda düşen komutu buydu:
  //
  //   /fill ~-5 ~-1 ~-5 ~4 ~8 ~4 glass 0 outline
  //   Syntax error: Unexpected "0": at " ~4 glass >>0<< outline"
  //
  // Aynı mod, aynı int, farklı BLOK. H4: eski veri değeri bloğa bağlı —
  // "air" kabul ediliyor, "glass" edilmiyor. Aşağısı onu ölçüyor.
  //
  // Bölge yine tek bloklu: 1x1x1'de hollow/outline "0 blocks filled" veriyor
  // (1. turda ölçüldü), yani glass yazılsa bile dünyaya blok konmuyor.
  {
    question: "H4 int: fill + glass + hollow",
    command: "fill ~ ~ ~ ~ ~ ~ minecraft:glass 0 hollow",
    expect: "parses", // ws kabul ediyor, SOHBET ETMİYOR
  },
  {
    question: "H4 int: fill + glass + outline (kullanıcının biçimi)",
    command: "fill ~ ~ ~ ~ ~ ~ glass 0 outline",
    expect: "parses", // ws kabul ediyor, SOHBET ETMİYOR
  },
  {
    question: "H4 int: fill + stone + hollow (üçüncü blok)",
    command: "fill ~ ~ ~ ~ ~ ~ minecraft:stone 0 hollow",
    expect: "parses", // ws kabul ediyor, SOHBET ETMİYOR
  },
  {
    question: "H4 kontrol: fill + glass, int YOK",
    command: "fill ~ ~ ~ ~ ~ ~ minecraft:glass hollow",
    expect: "parses",
  },
  {
    question: "H4 int: testforblock + glass",
    command: "testforblock ~ ~-1 ~ minecraft:glass 0",
    expect: "parses",
  },
  {
    question: "H5 bölge büyüklüğü: air, 3x1x3, kafa üstü",
    command: "fill ~-1 ~2 ~-1 ~1 ~2 ~1 minecraft:air 0 outline",
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

  // Kapanış açıkça duyuruluyor. Script bitince sunucu kapanıyor ve oyun bunu
  // "Could not connect to the server" diye gösteriyor — başarılı bitişin
  // görüntüsü, başarısızlığın değil. Bu satır olmadan ölçüm başarılı olsa bile
  // kullanıcı ekranında hata görüp koşunun düştüğünü sanıyor (30-08-2026'da
  // tam olarak böyle oldu).
  console.log(
    '\nÖlçüm bitti, sunucu kapanıyor. Oyunda "Could not connect to the server"\n' +
      "görmen NORMAL — bağlantıyı biz kapattık.",
  );

  socket.close();
  server.close();
}

runIfMain(import.meta.url, run);
