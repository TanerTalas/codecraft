/**
 * Dağıtılmış /mcp ucunu ölçen script (Aşama M4'ün bitiş kriteri).
 *
 *   npm run mcp:probe -- https://<host>/mcp
 *
 * Varsayılan `http://localhost:3000/mcp`. Yerel koşu bitiş kriteri SAYILMAZ —
 * bağlantıyı Anthropic'in bulut altyapısı kuruyor, localhost'a bağlanamıyor.
 * Yerel koşunun ölçtüğü tek şey Next'in rotayı gerçekten bağladığı.
 *
 * NEDEN AYRI BİR SCRIPT: `test/http.test.ts` protokolü ölçüyor ama süreç
 * içinde. Serverless'ta cevaplanmamış soru protokol değil BARINDIRMA: /mcp
 * kendi fonksiyon paketini alıyor (Next izlemeyi rota başına yapıyor), yani
 * M1'de /api/review için ölçülen yeşil buraya taşınmıyor. `validate_script`
 * alt süreç açıyor, geçici dizin yazıyor ve data/ okuyor; üçünün de o pakette
 * çalıştığı yalnızca uçta ölçülebilir.
 *
 * BOZUK PAYLOAD BİLEREK: yalnızca `ok:true` görmek, sessizce hiçbir şey
 * derlemeyen bir yoldan da gelebilirdi. M1'in kendi dersi bu.
 */
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

import { BYTE_LIMIT } from "../src/limit.ts";

const url = process.argv[2] ?? "http://localhost:3000/mcp";

/** Kaldırılmış API. 2.x'te `Dimension.runCommandAsync` yok. */
const BROKEN_SCRIPT = `import { world } from "@minecraft/server";
world.getDimension("overworld").runCommandAsync("say hi");
`;

const VALID_SCRIPT = `import { world } from "@minecraft/server";
world.afterEvents.playerBreakBlock.subscribe((event) => {
  world.sendMessage(event.player.name);
});
`;

let failures = 0;

function check(ok: boolean, label: string, detail: string): void {
  if (!ok) failures += 1;
  console.log(`${ok ? "  OK  " : "  KIRIK"} ${label}${detail ? ` — ${detail}` : ""}`);
}

/** Araç sonucunun metin gövdesi ve baytı. */
function body(result: unknown): { text: string; bytes: number } {
  // callTool'un dönüş tipi bir birleşim (eski uyumluluk şekli de var), o yüzden
  // tools.test.ts'teki kalıbın aynısı: alanı okurken daralt.
  const content = (result as { content?: { type: string; text?: string }[] }).content;
  const text = content?.[0]?.text ?? "";
  return { text, bytes: Buffer.byteLength(text, "utf8") };
}

async function timed<T>(fn: () => Promise<T>): Promise<[T, number]> {
  const started = Date.now();
  return [await fn(), Date.now() - started];
}

console.log(`uç: ${url}\n`);

const client = new Client({ name: "codecraft-probe", version: "0.0.0" });
const [, handshakeMs] = await timed(() =>
  client.connect(new StreamableHTTPClientTransport(new URL(url))),
);
console.log(`bağlantı (initialize)            ${handshakeMs} ms`);

try {
  // 1 — araç listesi. Soğuk ve sıcak ayrı ölçülüyor: ilk istek fonksiyonu
  // uyandırıyor, ikincisi gerçek gecikmeyi gösteriyor.
  const [listed, coldMs] = await timed(() => client.listTools());
  const [, warmMs] = await timed(() => client.listTools());
  const listBytes = Buffer.byteLength(JSON.stringify(listed.tools), "utf8");
  console.log(`tools/list                       ${coldMs} ms (soğuk), ${warmMs} ms (sıcak), ${listBytes} bayt`);
  check(listed.tools.length === 8, "tools/list sekiz araç döndürüyor", `${listed.tools.length} araç`);
  check(
    listed.tools.every((tool) => tool.annotations?.readOnlyHint === true),
    "hepsi readOnlyHint taşıyor",
    "",
  );

  // 2 — ASIL ÖLÇÜM. tsc bu fonksiyon paketinde koşuyor mu, ve gerçek bir tanı
  // mı dönüyor. Yalnızca bu madde M1'in yeşilini /mcp için tekrar ediyor.
  const [broken, brokenMs] = await timed(() =>
    client.callTool({ name: "validate_script", arguments: { code: BROKEN_SCRIPT } }),
  );
  const brokenBody = body(broken);
  console.log(`validate_script (bozuk)          ${brokenMs} ms, ${brokenBody.bytes} bayt`);
  check(
    brokenBody.text.includes("runCommandAsync") && /TS\d{4}/.test(brokenBody.text),
    "kaldırılmış API gerçek tsc tanısı döndürüyor",
    brokenBody.text.slice(0, 160),
  );

  const [valid, validMs] = await timed(() =>
    client.callTool({ name: "validate_script", arguments: { code: VALID_SCRIPT } }),
  );
  const validBody = body(valid);
  console.log(`validate_script (geçerli)        ${validMs} ms, ${validBody.bytes} bayt`);
  check(validBody.text.includes('"ok":true'), "geçerli script temiz geçiyor", validBody.text.slice(0, 160));

  // 3 — data/ o pakette bulunuyor mu, ve bayt tavanı uçta da tutuyor mu.
  const [schema, schemaMs] = await timed(() =>
    client.callTool({
      name: "get_schema",
      arguments: { type: "behavior/entities/entities", path: "minecraft:entity/components" },
    }),
  );
  const schemaBody = body(schema);
  console.log(`get_schema (en kalabalık düğüm)  ${schemaMs} ms, ${schemaBody.bytes} bayt`);
  check(schemaBody.bytes <= BYTE_LIMIT, `tavanın altında (${BYTE_LIMIT})`, `${schemaBody.bytes} bayt`);
  check(!schemaBody.text.includes("[KESİLDİ]"), "sert kesmeye yakalanmıyor", "");

  const [version] = await timed(() => client.callTool({ name: "get_version_info", arguments: {} }));
  const versionText = body(version).text;
  check(/"version":"1\.\d+\./.test(versionText), "get_version_info gerçek sürüm döndürüyor", versionText.slice(0, 80));
} finally {
  await client.close();
}

// 4 — POST dışındaki yöntemler akış açmadan kapanıyor mu. SDK istemcisi
// bunları göndermiyor, o yüzden düz fetch.
for (const method of ["GET", "DELETE"] as const) {
  const response = await fetch(url, { method, headers: { accept: "text/event-stream" } });
  const text = await response.text();
  check(
    response.status === 405 && text.trimStart().startsWith("{"),
    `${method} 405 ve JSON döndürüyor`,
    `${response.status} ${text.slice(0, 80)}`,
  );
}

console.log(failures === 0 ? "\nHEPSİ YEŞİL" : `\n${failures} KONTROL KIRIK`);
process.exitCode = failures === 0 ? 0 : 1;
