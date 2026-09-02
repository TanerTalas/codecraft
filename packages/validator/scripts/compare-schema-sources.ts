/**
 * Ölçüm script'i — ürün kodu değil.
 *
 * docs/SOURCES.md'nin "Şema kaynağı" kararı bu ölçümle
 * 2'ye bırakılmıştı. Bu script kararı tahminle değil ölçümle kapatmak için var:
 * aynı fixture'ları iki kaynağa da koşturur ve hangisinin neyi yakaladığını
 * tablo hâlinde basar.
 *
 * npm run validator:compare
 *
 * Mojang tarafının iki yapısal farkı var, tablo bunları da gösteriyor:
 *
 * 1. Kapsam. Mojang şemaları behavior pack dosya türlerinin bir kısmını hiç
 *    tanımlamıyor (tarif, diyalog, animasyon denetleyicisi, feature rules).
 * 2. Sarmalayıcı. Mojang şemaları dosyanın tamamını değil iç nesneyi tanımlıyor:
 *    "minecraft:block" değerini anlatan bir şema var ama {format_version,
 *    "minecraft:block": ...} dosyasını anlatan yok. Dosya düzeyinde doğrulama
 *    için o sarmalayıcıyı bizim yazmamız gerekirdi — CLAUDE.md "kendi JSON
 *    şemalarını yazma" diyor. Bu yüzden karşılaştırma iç nesne üzerinden yapılır
 *    ve aşağıdaki eşleme tablosu script içinde kalır, ürün yoluna girmez.
 */
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

import { Ajv, type AnySchema, type ValidateFunction } from "ajv";
import formats from "ajv-formats";
import { resolveVersion } from "@codecraft/knowledge";

import { validateJson } from "../src/index.ts";

const FIXTURES = fileURLToPath(new URL("../test/fixtures/", import.meta.url));

type Case = {
  id: string;
  file: string;
  type: string;
  expect: "pass" | "fail" | "gap";
  reason?: string;
  expectedPath?: string;
};

/**
 * Bizim doküman tipimiz -> Mojang şeması.
 * `dir` altındaki en yeni format_version klasörü seçilir.
 * `extract` verilmişse dosyanın o alanı doğrulanır, kökü değil.
 */
const MOJANG: Record<string, { dir: string; file: string; extract?: string }> = {
  "general/manifest": { dir: "client_server/packaging", file: "Manifest.json" },
  "behavior/blocks": { dir: "server/block", file: "Blocks.json", extract: "minecraft:block" },
  "behavior/items": { dir: "server/item", file: "ItemDocument.json", extract: "minecraft:item" },
  "behavior/entities": {
    dir: "server/entity",
    file: "ActorDocument.json",
    extract: "minecraft:entity",
  },
  "behavior/spawn_rules": {
    dir: "client_server/spawn",
    file: "Spawn Rules.json",
    extract: "minecraft:spawn_rules",
  },
};

const ajv = new Ajv({
  strict: false,
  allErrors: true,
  unicodeRegExp: false,
  logger: false,
});
formats.default(ajv);

/** Tüm Mojang şemalarını $id'leriyle kaydeder: göreli $ref'ler böyle çözülür. */
async function loadMojangSchemas(root: string): Promise<void> {
  const entries = await readdir(root, { recursive: true, withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const schema = JSON.parse(
      await readFile(join(entry.parentPath, entry.name), "utf8"),
    ) as AnySchema & { $id?: string };
    if (schema.$id === undefined) continue;
    if (ajv.getSchema(schema.$id) === undefined) ajv.addSchema(schema);
  }
}

/** Klasör adları format_version: en yenisi seçilir (1.26.20 > 1.21.110). */
async function newestFormatVersion(dir: string): Promise<string> {
  const entries = await readdir(dir, { withFileTypes: true });
  const versions = entries
    .filter((entry) => entry.isDirectory() && /^\d/.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
  const newest = versions.at(-1);
  if (newest === undefined) throw new Error(`${dir}: format_version klasörü yok`);
  return newest;
}

type Outcome = "geçti" | "yakalandı" | "kapsam dışı" | "sarmalayıcı dışı";

async function mojangOutcome(
  schemasRoot: string,
  testCase: Case,
  content: string,
): Promise<Outcome> {
  const mapping = MOJANG[testCase.type];
  if (mapping === undefined) return "kapsam dışı";

  // İç nesne doğrulanıyorsa sarmalayıcıdaki (format_version gibi) hatalar
  // Mojang'ın göremeyeceği yerde kalır. Bunu "geçti" diye yazmak yanıltıcı olurdu.
  if (mapping.extract !== undefined && testCase.expectedPath === "") return "sarmalayıcı dışı";

  const version = await newestFormatVersion(join(schemasRoot, mapping.dir));
  // $id dosya adındaki boşluğu yüzde kodlu tutuyor: "Spawn%20Rules.json".
  const id = `/${mapping.dir}/${version}/${encodeURIComponent(mapping.file)}`;
  const validate = ajv.getSchema(id) as ValidateFunction | undefined;
  if (validate === undefined) return "kapsam dışı";

  let value: unknown;
  try {
    value = JSON.parse(content);
  } catch {
    return "yakalandı"; // ayrıştırılamayan dosyayı iki kaynak da reddeder
  }

  if (mapping.extract !== undefined) {
    const inner = (value as Record<string, unknown>)[mapping.extract];
    if (inner === undefined) return "kapsam dışı"; // sarmalayıcı hatası, iç nesne yok
    value = inner;
  }

  return validate(value) === true ? "geçti" : "yakalandı";
}

async function main(): Promise<void> {
  const { dir, version } = await resolveVersion();
  const schemasRoot = join(dir, "schemas");
  await loadMojangSchemas(schemasRoot);

  const cases = JSON.parse(await readFile(join(FIXTURES, "cases.json"), "utf8")) as {
    core: Case[];
    extra: Case[];
  };
  const all = [...cases.core, ...cases.extra];

  console.log(`sürüm ${version}\n`);
  console.log("vaka".padEnd(38) + "beklenen".padEnd(12) + "blockception".padEnd(14) + "mojang");
  console.log("-".repeat(78));

  const tally = { blockception: 0, mojang: 0, outOfScope: 0 };

  for (const testCase of all) {
    const content = await readFile(join(FIXTURES, testCase.file), "utf8");
    const blockception = (await validateJson(content, testCase.type)).ok ? "geçti" : "yakalandı";
    const mojang = await mojangOutcome(schemasRoot, testCase, content);

    const wanted: Outcome = testCase.expect === "fail" ? "yakalandı" : "geçti";
    const comparable = mojang !== "kapsam dışı" && mojang !== "sarmalayıcı dışı";
    if (blockception === wanted) tally.blockception += 1;
    if (mojang === wanted) tally.mojang += 1;
    if (!comparable) tally.outOfScope += 1;

    const mark = (outcome: string): string =>
      outcome === wanted ? `${outcome} ✓` : `${outcome} ✗`;

    console.log(
      testCase.id.padEnd(38) +
        wanted.padEnd(12) +
        mark(blockception).padEnd(14) +
        (comparable ? mark(mojang) : mojang),
    );
  }

  const doc = Object.keys(MOJANG).length;
  console.log("-".repeat(78));
  const comparableCount = all.length - tally.outOfScope;
  console.log(
    `beklenen sonucu veren: blockception ${tally.blockception}/${all.length}, ` +
      `mojang ${tally.mojang}/${all.length} ` +
      `(karşılaştırılabilir ${comparableCount} vakada mojang ${tally.mojang}/${comparableCount})`,
  );
  console.log(
    `\nMojang doküman tipi kapsamı: fixture'ların kullandığı 8 tipten ${doc} tanesi. ` +
      "Tarif, diyalog, animasyon denetleyicisi ve feature rules için Mojang şeması yok.",
  );
  console.log(
    "Kapsanan 4 tipte de şema dosyayı değil iç nesneyi tanımlıyor; dosya düzeyinde\n" +
      "doğrulama için sarmalayıcıyı bizim yazmamız gerekirdi.",
  );
}

await main();
