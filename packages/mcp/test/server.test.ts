/**
 * Sunucunun uçtan uca testi.
 *
 * NEDEN GERÇEK BİR İSTEMCİ: M2'nin yazılı bitiş kriteri "typecheck exit 0,
 * testler yeşil" idi ve o kriter hiçbir şey KOŞMADAN da karşılanır. Boş bir
 * iskelet de yeşil görünürdü. Bu dosya kriteri ölçülebilir yapıyor: SDK'nın
 * kendi InMemoryTransport'uyla gerçek bir MCP istemcisi bağlanıyor, gerçek
 * `tools/list` ve `tools/call` gidiyor.
 *
 * Ölçülen üç şey:
 *   1. SDK bu repoda ayağa kalkıyor mu (Node .ts doğrudan çalıştırma, zod 4,
 *      strict nodenext, erasableSyntaxOnly)
 *   2. Araç listeleniyor mu ve annotation'ı yerinde mi (readOnlyHint —
 *      karar dokümanının açık gereksinimi)
 *   3. Araç ÇAĞRILDIĞINDA gerçek data/ verisi dönüyor mu
 *
 * Üçüncüsü kritik: yalnızca "hata atmadı" görmek, sessizce boş dönen bir
 * yoldan da gelebilirdi. O yüzden dönen sürüm resolveVersion ile
 * karşılaştırılıyor — aynı veriye ikinci bir yoldan bakılıyor.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { resolveVersion } from "@codecraft/knowledge";

import { SERVER_VERSION, createServer } from "../src/server.ts";

/** Bağlı bir istemci döndürür. Kapatma sorumluluğu çağırana ait. */
async function connect(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([createServer().connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

test("tools/list get_version_info'yu salt okunur olarak veriyor", async () => {
  const client = await connect();
  try {
    const { tools } = await client.listTools();
    const tool = tools.find((candidate) => candidate.name === "get_version_info");

    assert.ok(tool, `get_version_info listelenmedi. Gelenler: ${tools.map((t) => t.name).join(", ")}`);
    assert.equal(tool.annotations?.readOnlyHint, true, "readOnlyHint eksik (karar dokümanı gereği).");
    // title Tool'un üst düzey alanı, annotations'ın içinde DEĞİL — ikisi de
    // spec'te var ve karıştırılıyor. Ölçüldü: SDK 1.30.0 üst düzeyde veriyor.
    assert.ok(tool.title, "Aracın açık bir başlığı yok (karar dokümanı gereği).");
    // Sürüm alanı opsiyonel: sürüm bilmeden de çağrılabilmeli.
    assert.deepEqual(tool.inputSchema.required ?? [], []);
  } finally {
    await client.close();
  }
});

test("tools/call data/ altındaki gerçek sürümü döndürüyor", async () => {
  const client = await connect();
  try {
    const result = await client.callTool({ name: "get_version_info", arguments: {} });
    assert.notEqual(result.isError, true, `Araç hata döndürdü: ${JSON.stringify(result.content)}`);

    const content = result.content as { type: string; text: string }[];
    assert.equal(content[0]?.type, "text");
    const context = JSON.parse(content[0]?.text as string) as {
      version: string;
      minEngineVersion: [number, number, number];
      formatVersions: Record<string, string[]>;
    };

    // İkinci yol: aynı veriye MCP'den değil, doğrudan knowledge katmanından bak.
    const { version } = await resolveVersion();
    assert.equal(context.version, version);

    // min_engine_version üç parçalı dizi, dördüncü hane düşer (CLAUDE.md).
    assert.equal(context.minEngineVersion.length, 3);
    // format_version ayrı bir eksen: oyun sürümü değil, tipin kendi şema sürümü.
    assert.deepEqual(context.formatVersions["behavior/spawn_rules/spawn_rules"], ["1.8.0"]);
  } finally {
    await client.close();
  }
});

test("tools/call verilen sürümü kullanıyor", async () => {
  const client = await connect();
  try {
    const { version } = await resolveVersion();
    // Üç haneli önek: resolveVersion prefix eşlemesi yapıyor, dört haneye çözmeli.
    const prefix = version.split(".").slice(0, 3).join(".");
    const result = await client.callTool({
      name: "get_version_info",
      arguments: { version: prefix },
    });

    const content = result.content as { type: string; text: string }[];
    const context = JSON.parse(content[0]?.text as string) as { version: string };
    assert.equal(context.version, version);
  } finally {
    await client.close();
  }
});

test("geçersiz sürüm sessizce en yeniye düşmüyor", async () => {
  // Pazarlama numarası (26.40) hiçbir dosyaya yazılmaz ve burada da kabul
  // edilmemeli. Sessizce en yeni sürüme düşmek, modele yanlış bir sürümle
  // çalıştığını hiç söylemezdi.
  const client = await connect();
  try {
    const result = await client.callTool({ name: "get_version_info", arguments: { version: "26.40" } });
    assert.equal(result.isError, true, "Pazarlama numarası hata döndürmedi.");
  } finally {
    await client.close();
  }
});

test("sunucu sürümü package.json ile aynı ve istemciye ulaşıyor", async () => {
  // İki dize iki ayrı dosyada elle tutuluyor; ilk hâlinde bu "gereksiz"
  // diye test edilmemişti ve ayrışmaları sessizdi. Ayrışma kullanıcıya kadar
  // gider: bağlayıcıyı ekleyen kişi bu sürümü ekranında görüyor.
  const manifest = JSON.parse(
    readFileSync(new URL("../package.json", import.meta.url), "utf8"),
  ) as { version: string };

  assert.equal(
    SERVER_VERSION,
    manifest.version,
    "server.ts ile package.json'ın sürümü ayrışmış.",
  );

  // İkinci yol: dizeyi karşılaştırmak, onun initialize cevabına GERÇEKTEN
  // konduğunu söylemiyor. Bağlanıp istemcinin ne gördüğüne bakılıyor.
  const client = await connect();
  try {
    assert.deepEqual(client.getServerVersion(), {
      name: "codecraft",
      version: SERVER_VERSION,
    });
  } finally {
    await client.close();
  }
});
