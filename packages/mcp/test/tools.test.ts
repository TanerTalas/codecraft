/**
 * Sekiz aracın uçtan uca testi.
 *
 * M2'nin server.test.ts kalıbı: gerçek InMemoryTransport, gerçek tools/list ve
 * tools/call, gerçek data/. Mock yok — araç ne döndürüyorsa o ölçülüyor.
 *
 * ÜÇ ŞEY ÖLÇÜLÜYOR:
 *
 *   1. Sekiz araç da listeleniyor, hepsinde readOnlyHint ve title var.
 *   2. Her araç bozuk bir girdiye EYLEME DÖNÜŞTÜRÜLEBİLİR cevap veriyor.
 *      Yalnızca "hata atmadı" görmek yetmez: sessizce hiçbir şey doğrulamayan
 *      bir yol da öyle görünürdü. M1'de aynı tuzak validate_script için
 *      ölçülmüştü, o yüzden burada da bozuk girdiyle koşuluyor.
 *   3. Hiçbir çıktı bayt tavanını aşmıyor.
 */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { BYTE_LIMIT, byteLength } from "../src/limit.ts";
import { createServer, tools } from "../src/server.ts";

async function connect(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([createServer().connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

/** Aracı çağırır, metin gövdesini ve hata bayrağını verir. */
async function call(
  client: Client,
  name: string,
  args: Record<string, unknown>,
): Promise<{ text: string; isError: boolean }> {
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as { type: string; text: string }[];
  return { text: content[0]?.text ?? "", isError: result.isError === true };
}

const fixture = async (name: string): Promise<string> =>
  readFile(fileURLToPath(new URL(`../../validator/test/fixtures/${name}`, import.meta.url)), "utf8");

test("kayıtlı araçların hepsi listeleniyor ve hepsi salt okunur", async () => {
  const client = await connect();
  try {
    const listed = (await client.listTools()).tools;

    // Kayıtlı liste ile listelenen liste aynı olmalı — "kaydedildi ama
    // listelenmiyor" hatası burada yakalanır.
    assert.deepEqual(
      listed.map((tool) => tool.name).sort(),
      tools.map((tool) => tool.name).sort(),
    );

    for (const tool of listed) {
      assert.equal(tool.annotations?.readOnlyHint, true, `${tool.name}: readOnlyHint yok`);
      // title Tool'un ÜST DÜZEY alanı, annotations'ın içinde değil. İkisi de
      // spec'te var ve M2'de bir kez karıştırıldı.
      assert.ok(tool.title, `${tool.name}: title yok`);
      assert.ok(tool.description, `${tool.name}: açıklama yok`);
    }
  } finally {
    await client.close();
  }
});

test("tools/list araç tanımı bütçesinin çok altında", async () => {
  // Karar dokümanının andığı ~30.000 token sınırı araç TANIMLARI için.
  // Sekiz aracın toplamı ölçülüyor; sınıra yaklaşırsa bu test söyler.
  const client = await connect();
  try {
    const bytes = byteLength((await client.listTools()).tools);
    // ~30.000 token kabaca 100.000+ bayt; 40.000 rahat bir erken uyarı eşiği.
    assert.ok(bytes < 40_000, `tools/list şişti: ${bytes} B`);
  } finally {
    await client.close();
  }
});

test("check_feasibility yapılamayanı gerekçesiyle reddediyor", async () => {
  const client = await connect();
  try {
    const { text } = await call(client, "check_feasibility", {
      request: "oyuncu adına fareyi otomatik tıklat",
    });
    const result = JSON.parse(text) as { blocked: boolean; alternative?: string };
    assert.equal(result.blocked, true);
    // Sadece "olmaz" demek yetmez, alternatif de gelmeli.
    assert.ok(result.alternative, "Engellendi ama alternatif önerilmedi");

    const ok = JSON.parse((await call(client, "check_feasibility", { request: "kırmızı bir blok ekle" })).text) as {
      blocked: boolean;
    };
    assert.equal(ok.blocked, false);
  } finally {
    await client.close();
  }
});

test("lookup_id türü kendi buluyor, blokta durumları da veriyor", async () => {
  const client = await connect();
  try {
    // Blok değil, varlık. lookup_block olsaydı bu sorulamazdı.
    const blaze = JSON.parse((await call(client, "lookup_id", { id: "blaze" })).text) as {
      found: boolean;
      kind: string;
      id: string;
    };
    assert.equal(blaze.found, true);
    assert.equal(blaze.kind, "entity");
    assert.equal(blaze.id, "minecraft:blaze", "Namespace eklenmedi");

    const stairs = JSON.parse((await call(client, "lookup_id", { id: "oak_stairs" })).text) as {
      kind: string;
      states: Record<string, unknown>;
    };
    assert.equal(stairs.kind, "block");
    assert.ok(Object.keys(stairs.states).length > 0, "Blok durumları boş");

    const missing = JSON.parse((await call(client, "lookup_id", { id: "minecraft:yokboyleblok" })).text) as {
      found: boolean;
    };
    assert.equal(missing.found, false);
  } finally {
    await client.close();
  }
});

test("get_schema kökte tam, kalabalık düğümde daralmış, tavanın altında", async () => {
  const client = await connect();
  try {
    const root = await call(client, "get_schema", { type: "behavior/spawn_rules" });
    const parsedRoot = JSON.parse(root.text) as { detail: string; formatVersions: string[] };
    assert.equal(parsedRoot.detail, "full");
    // format_version oyun sürümü DEĞİL — spawn rules yalnızca bunları kabul ediyor.
    assert.deepEqual(parsedRoot.formatVersions, ["1.10.0", "1.12.0", "1.8.0"]);

    const big = await call(client, "get_schema", {
      type: "behavior/entities",
      path: "minecraft:entity/components",
    });
    assert.ok(byteLength(big.text) <= BYTE_LIMIT, `Tavan aşıldı: ${byteLength(big.text)} B`);
    const parsedBig = JSON.parse(big.text) as { detail: string; truncated?: string; properties: unknown[] };
    assert.notEqual(parsedBig.detail, "full", "390 alanlı düğüm daralmadı");
    assert.ok(parsedBig.truncated, "Daraldı ama söylemedi — sessiz kesme");
    assert.equal(parsedBig.properties.length, 390, "Ad listesinden alan düşmüş");
  } finally {
    await client.close();
  }
});

test("get_schema çözülemeyen yolda eyleme dönüştürülebilir hata veriyor", async () => {
  const client = await connect();
  try {
    const { text, isError } = await call(client, "get_schema", {
      type: "behavior/blocks",
      path: "minecraft:block/yokboylealan",
    });
    assert.equal(isError, true);
    // "Bulunamadı" yetmez; orada NE olduğu yazmalı ki model düzeltebilsin.
    assert.match(text, /Fields available there:.*components/s);
  } finally {
    await client.close();
  }
});

test("validate_json bozuk dosyada JSON pointer'lı hata döndürüyor", async () => {
  const client = await connect();
  try {
    const { text } = await call(client, "validate_json", {
      content: await fixture("invalid/manifest-bad-uuid.json"),
      type: "general/manifest",
    });
    const result = JSON.parse(text) as { ok: boolean; errors: { path: string; message: string }[] };
    assert.equal(result.ok, false);
    assert.ok(result.errors.length > 0, "Bozuk dosya hatasız geçti");
    // Hata düzleştirilmemiş olmalı: yol ayrı alanda.
    assert.ok(result.errors[0]?.path !== undefined, "JSON pointer düzleştirilmiş");

    const valid = JSON.parse(
      (
        await call(client, "validate_json", {
          content: await fixture("valid/manifest-behavior-pack.json"),
          type: "general/manifest",
        })
      ).text,
    ) as { ok: boolean };
    assert.equal(valid.ok, true, "Geçerli dosya reddedildi");
  } finally {
    await client.close();
  }
});

test("validate_json çözülemeyen tipte araç hatası veriyor", async () => {
  // Kullanıcı içeriğinin geçersiz olması ok:false; TİPİN çözülememesi ise
  // doğrulamanın hiç koşmadığı anlamına geliyor ve hata olarak çıkmalı.
  const client = await connect();
  try {
    const { isError } = await call(client, "validate_json", { content: "{}", type: "yok/boyle/tip" });
    assert.equal(isError, true);
  } finally {
    await client.close();
  }
});

test("validate_command eksik argümanı yakalıyor ve kullanımı gösteriyor", async () => {
  const client = await connect();
  try {
    const bad = JSON.parse((await call(client, "validate_command", { line: "/execute" })).text) as {
      ok: boolean;
      usage: string[];
      requiresCheats: boolean;
    };
    assert.equal(bad.ok, false);
    assert.ok(bad.usage.length > 0, "Eşleşme yok ama kullanım gösterilmedi");
    assert.equal(bad.requiresCheats, true);

    const good = JSON.parse((await call(client, "validate_command", { line: "/give @p diamond 1" })).text) as {
      ok: boolean;
    };
    assert.equal(good.ok, true);
  } finally {
    await client.close();
  }
});

/**
 * KAPATILAN BOŞLUK (02-09-2026).
 *
 * Burada `execute ... run <komut>` zincirlemesinin YANLIŞ POZİTİF verdiğini
 * sabitleyen bir test duruyordu: doğrulayıcı `run` sonrasındaki gerçek komutu
 * "fazladan argüman" sayıyordu, yani geçerli bir komutu geçersiz raporluyordu.
 * Düzeltilince o test tasarlandığı gibi kırmızıya döndü ve yerini bunlar aldı.
 *
 * Tek bir "artık geçiyor" testi yetmez: özyineleme her şeyi kabul ederek de
 * yeşil görünürdü. O yüzden zincirin İÇİNDEKİ hatanın hâlâ yakalandığı ayrıca
 * ölçülüyor.
 */
test("execute zincirlemesi çözülüyor, gövdesi de doğrulanıyor", async () => {
  const client = await connect();
  try {
    const check = async (line: string) =>
      JSON.parse((await call(client, "validate_command", { line })).text) as {
        ok: boolean;
        errors: { kind: string; message: string; index: number | null }[];
      };

    // Geçerli zincirler: tek seviye, iki seviye, ve iç içe execute.
    for (const line of [
      "/execute as @a run say hi",
      "/execute as @a at @s run say hi",
      "/execute run say hi",
      "/execute as @a run execute at @s run say hi",
    ]) {
      assert.equal((await check(line)).ok, true, `${line} geçerli olmalıydı`);
    }

    // Zincirin gövdesi gerçekten doğrulanıyor mu — "her şeyi kabul et" değil.
    const unknown = await check("/execute as @a run uydurmakomut");
    assert.equal(unknown.ok, false, "zincir gövdesi doğrulanmıyor");
    assert.equal(unknown.errors[0]?.kind, "unknown-command");
    // index gövdedeki jetonu göstermeli, `run`u değil. Kaydırma yanlışsa
    // kullanıcıya yanlış argüman gösterilir ve bunu başka hiçbir test ölçmüyor.
    assert.equal(unknown.errors[0]?.index, 4);

    // `run` sonrası boş: bugün eksik argüman. ESKİDEN ok=true dönüyordu ve
    // docs/COMMANDS.md bunu doğru davranış diye gösteriyordu — veri aksini
    // söylüyor, 18. aşırı yüklemede `command` zorunlu.
    const dangling = await check("/execute as @a run");
    assert.equal(dangling.ok, false, "run sonrası boş kabul ediliyor");
    assert.equal(dangling.errors[0]?.kind, "arity");
  } finally {
    await client.close();
  }
});

test("validate_script kaldırılmış API'yi gerçek tsc tanısıyla reddediyor", async () => {
  const client = await connect();
  try {
    // runCommandAsync @minecraft/server 2.x'te kaldırıldı. M1'de dağıtılmış
    // uçta da bu payload ölçülmüştü.
    const { text } = await call(client, "validate_script", {
      code: 'import { world } from "@minecraft/server";\nworld.getDimension("overworld").runCommandAsync("say hi");\n',
    });
    const result = JSON.parse(text) as { ok: boolean; errors: { code: string; message: string }[] };
    assert.equal(result.ok, false);
    assert.ok(
      result.errors.some((error) => error.message.includes("runCommandAsync")),
      `Tanı beklenen API'yi anmıyor: ${JSON.stringify(result.errors)}`,
    );

    const good = JSON.parse(
      (
        await call(client, "validate_script", {
          code: 'import { world } from "@minecraft/server";\nworld.afterEvents.playerBreakBlock.subscribe(() => {});\n',
        })
      ).text,
    ) as { ok: boolean };
    assert.equal(good.ok, true, "Geçerli script reddedildi");
  } finally {
    await client.close();
  }
});

test("review_pack bütün dosyaları tek çağrıda doğruluyor", async () => {
  const client = await connect();
  try {
    const files = [
      { path: "behavior_packs/x/manifest.json", content: await fixture("valid/manifest-behavior-pack.json") },
      { path: "behavior_packs/x/blocks/ruby_ore.json", content: await fixture("valid/block-ruby-ore.json") },
    ];
    const result = JSON.parse((await call(client, "review_pack", { files })).text) as {
      measured: boolean;
      files: { path: string; validator: string }[];
    };
    assert.equal(result.measured, true, "Hiçbir dosya ölçülemedi");
    assert.equal(result.files.length, 2);
    // Sürüm verilmedi; undefined sızmamalı, çözülmüş olmalı.
    assert.ok(result.files.every((file) => file.validator !== "skipped"), "Dosyalar atlandı");
  } finally {
    await client.close();
  }
});

test("hiçbir aracın çıktısı bayt tavanını aşmıyor", async () => {
  const client = await connect();
  try {
    const calls: [string, Record<string, unknown>][] = [
      ["check_feasibility", { request: "ağdan veri çek" }],
      ["get_version_info", {}],
      ["get_schema", { type: "behavior/entities", path: "minecraft:entity/components" }],
      ["lookup_id", { id: "oak_stairs" }],
      ["validate_command", { line: "/execute" }],
    ];
    for (const [name, args] of calls) {
      const { text } = await call(client, name, args);
      assert.ok(byteLength(text) <= BYTE_LIMIT, `${name} tavanı aştı: ${byteLength(text)} B`);
      // Tavan uygulandıysa kesme bildirimi olurdu; burada hiçbiri kesilmemeli.
      assert.doesNotMatch(text, /\[KESİLDİ\]/, `${name} kesildi`);
    }
  } finally {
    await client.close();
  }
});
