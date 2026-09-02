/**
 * Ölçüm script'i — ürün kodu değil.
 *
 * `docs/SOURCES.md`'de "Mojang/bedrock-schemas incelenmedi" diye bir açık
 * madde duruyordu. Bu script onu tahminle değil ölçümle kapatmak için var:
 * `Mojang/bedrock-schemas` şemalarını çeker ve `validator:compare`'in
 * kullandığı AYNI 26 fixture'ı ona da koşturur.
 *
 *   npm run validator:bedrock-schemas
 *   PATCH=1 npm run validator:bedrock-schemas
 *
 * `PATCH=1`, upstream'in kırık `$ref`'inin giderilmiş olduğunu varsayar —
 * "bu düzelirse ne olur" sayısını ayrı görmek için.
 *
 * Ağ gerektirir ve CI'da koşmaz, `validator:compare` ile aynı sınıf.
 *
 * Sonuçlar ve karar: docs/SOURCES.md.
 */
import { readFile } from "node:fs/promises";
import { join, posix } from "node:path";
import { fileURLToPath } from "node:url";
import { Ajv, type AnySchema, type ValidateFunction } from "ajv";
import formats from "ajv-formats";
import { downloadPaths, fetchTree } from "../../../pipeline/src/lib/github.ts";

const FIX = fileURLToPath(new URL("../test/fixtures/", import.meta.url));

const tree = await fetchTree("Mojang/bedrock-schemas", "main");
const paths = tree
  .filter((e) => e.type === "blob" && e.path.startsWith("schemas/") && e.path.endsWith(".json"))
  .map((e) => e.path);
const raw = await downloadPaths("Mojang/bedrock-schemas", "main", [...paths, "catalog.json"]);
const catalog = JSON.parse(raw.get("catalog.json") as string) as {
  schemas: { name: string; fileMatch: string[]; url: string }[];
};

// --- kirik $ref taramasi ---
const have = new Set(paths);
const dangling = new Map<string, string[]>();
for (const p of paths) {
  const text = raw.get(p) as string;
  for (const match of text.matchAll(/"\$ref"\s*:\s*"([^"#][^"]*)"/g)) {
    const ref = (match[1] as string).split("#")[0] as string;
    if (ref === "") continue;
    const target = posix.normalize(posix.join(posix.dirname(p), ref));
    if (!have.has(target)) {
      const list = dangling.get(target) ?? [];
      list.push(p);
      dangling.set(target, list);
    }
  }
}
console.log(`sema dosyasi: ${paths.length}, catalog girisi: ${catalog.schemas.length}`);
console.log(`KIRIK $ref hedefi: ${dangling.size}`);
for (const [target, from] of dangling) {
  console.log(`   ${target}  <- ${from.length} dosya (or. ${from[0]})`);
}

const ajv = new Ajv({ allErrors: true, strict: false, validateSchema: false });
formats.default(ajv);
for (const p of paths) {
  const schema = JSON.parse(raw.get(p) as string) as Record<string, unknown>;
  schema["$id"] = p;
  ajv.addSchema(schema as AnySchema, p);
}
// PATCH=1 ile kosulursa upstream'in kirik ref'i giderilmis sayilir:
// schemas/common/expression.schema.json -> molang_expression.schema.json
// Amac "upstream bunu duzeltirse ne olur" sayisini olcmek.
if (process.env["PATCH"] === "1") {
  const alias = JSON.parse(raw.get("schemas/common/molang_expression.schema.json") as string) as Record<string, unknown>;
  alias["$id"] = "schemas/common/expression.schema.json";
  ajv.addSchema(alias as AnySchema, "schemas/common/expression.schema.json");
  console.log("[PATCH] kirik ref molang_expression.schema.json ile karsilandi");
}

// catalog'daki her index semasini derlemeyi dene
let compiled = 0;
const broken: string[] = [];
for (const entry of catalog.schemas) {
  const url = entry.url.replace(/^\.\//, "");
  try {
    ajv.getSchema(url);
    compiled++;
  } catch (error) {
    broken.push(`${entry.name} (${url}): ${(error as Error).message.slice(0, 70)}`);
  }
}
console.log(`\ncatalog semasi derlenen: ${compiled}/${catalog.schemas.length}`);
for (const b of broken) console.log("   X " + b);

function globToRe(glob: string): RegExp {
  let out = "";
  for (let i = 0; i < glob.length; i++) {
    const ch = glob[i] as string;
    if (ch === "*") {
      if (glob[i + 1] === "*") { i += 1;
        if (glob[i + 1] === "/") { i += 1; out += "(?:[^/]+/)*"; } else { out += ".*"; }
      } else { out += "[^/]*"; }
      continue;
    }
    out += /[a-zA-Z0-9_/-]/.test(ch) ? ch : "\\" + ch;
  }
  return new RegExp("^" + out + "$");
}
const pickSchema = (file: string): string | null => {
  for (const entry of catalog.schemas)
    for (const glob of entry.fileMatch) if (globToRe(glob).test(file)) return entry.url.replace(/^\.\//, "");
  return null;
};

type Case = { id: string; file: string; type: string; expect: "pass" | "fail" | "gap" };
const cases = JSON.parse(await readFile(join(FIX, "cases.json"), "utf8")) as { core: Case[]; extra: Case[] };
const all = [...cases.core, ...cases.extra];
// cases.json type'i "behavior/blocks" gibi; klasor adi ikinci segment.
// "behavior/animation_controllers/animation_controller" ucuncu segment tasiyor
// ve .pop() tekil hali veriyordu - bu iki fixture'a HAKSIZ "kapsam disi"
// yaziliyordu, duzeltildi.
const FOLDER: Record<string, string> = {};
const folderOf = (type: string): string => FOLDER[type] ?? (type.split("/")[1] ?? type);

let hit = 0, outOfScope = 0, crashed = 0;
const rows: string[] = [];
for (const c of all) {
  const content = await readFile(join(FIX, c.file), "utf8");
  const folder = folderOf(c.type);
  const name = c.file.split("/").pop() as string;
  const url = pickSchema(`BP/${folder}/${name}`) ?? pickSchema(`RP/${folder}/${name}`);
  const wanted = c.expect === "fail" ? "yakalandi" : "gecti";
  if (url === null) { outOfScope++; rows.push(`${c.id.padEnd(38)}${wanted.padEnd(12)}kapsam disi`); continue; }
  let validate: ValidateFunction | undefined;
  try { validate = ajv.getSchema(url) as ValidateFunction | undefined; }
  catch { crashed++; rows.push(`${c.id.padEnd(38)}${wanted.padEnd(12)}SEMA DERLENMEDI (kirik ref)`); continue; }
  if (validate === undefined) { outOfScope++; rows.push(`${c.id.padEnd(38)}${wanted.padEnd(12)}sema yok`); continue; }
  let value: unknown;
  try { value = JSON.parse(content); } catch { if (wanted === "yakalandi") hit++; rows.push(`${c.id.padEnd(38)}${wanted.padEnd(12)}yakalandi OK`); continue; }
  const got = validate(value) === true ? "gecti" : "yakalandi";
  if (got === wanted) hit++;
  rows.push(`${c.id.padEnd(38)}${wanted.padEnd(12)}${got}${got === wanted ? " OK" : " X"}`);
}
console.log("\n" + "vaka".padEnd(38) + "beklenen".padEnd(12) + "bedrock-schemas");
console.log("-".repeat(76));
for (const r of rows) console.log(r);
console.log(`\nbeklenen sonucu veren: ${hit}/${all.length} (kapsam disi ${outOfScope}, sema derlenmedi ${crashed})`);
