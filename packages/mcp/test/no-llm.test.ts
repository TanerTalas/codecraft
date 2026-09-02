/**
 * Bu depo bir LLM SDK'sına bağlanmaz.
 *
 * ÖNCEKİ HÂLİ bir DİKİŞİ ölçüyordu: `packages/core` hem üretim döngüsünü hem
 * doğrulama yüzeyini taşıyordu, `ai` + `@ai-sdk/google` barrel'dan sızıyordu
 * ve iki ayrı `layers.test.ts` o sızıntıyı kapalı tutuyordu. Üretim döngüsü
 * silindi, dikiş de onunla gitti — ama ölçüm gitmedi, sadece iddiası
 * genişledi: artık sızacak bir yer yok, ve bu testin işi o cümleyi kanıtlamak.
 *
 * İki yerden birden bakıyor, çünkü biri diğerini kapsamıyor: bir paket
 * bağımlılığı bildirmeden de import edebilir (workspace kökündeki
 * node_modules'tan çözülür), ve bildirilmiş bir bağımlılık hiç import
 * edilmeden de ağaca girer.
 */
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

const REPO = fileURLToPath(new URL("../../../", import.meta.url));

/** Taranan workspace'ler. Kök package.json'ın kendisi de dahil. */
const MANIFESTS = [
  "package.json",
  "app/package.json",
  "pipeline/package.json",
  "packages/mcp/package.json",
  "packages/validator/package.json",
  "packages/knowledge/package.json",
];

/** Kaynak taranan dizinler. */
const SOURCE_ROOTS = [
  "packages/mcp/src",
  "packages/validator/src",
  "packages/knowledge/src",
  "pipeline/src",
  "app/src",
];

/** Yasaklı paket adı mı: `ai` ve `@ai-sdk/*`. */
const isLlmPackage = (name: string): boolean => name === "ai" || name.startsWith("@ai-sdk/");

async function tsFiles(dir: string, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) out.push(...(await tsFiles(join(dir, entry.name), `${name}/`)));
    else if (/\.tsx?$/.test(entry.name)) out.push(name);
  }
  return out;
}

test("hiçbir workspace bir LLM SDK'sı bildirmiyor", async () => {
  const offenders: string[] = [];

  for (const manifest of MANIFESTS) {
    const parsed: unknown = JSON.parse(await readFile(join(REPO, manifest), "utf8"));
    const pkg = parsed as Record<string, Record<string, string> | undefined>;
    for (const field of ["dependencies", "devDependencies", "peerDependencies"]) {
      for (const name of Object.keys(pkg[field] ?? {})) {
        if (isLlmPackage(name)) offenders.push(`${manifest} -> ${field}.${name}`);
      }
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `LLM SDK bağımlılığı bildirilmiş:\n  ${offenders.join("\n  ")}\n` +
      "Modeli kullanıcı getiriyor; sunucu doğrular, üretmez.",
  );
});

test("hiçbir kaynak dosya bir LLM SDK'sı import etmiyor", async () => {
  const scanned: string[] = [];
  const offenders: string[] = [];

  for (const root of SOURCE_ROOTS) {
    const dir = join(REPO, root);
    for (const file of await tsFiles(dir)) {
      const path = `${root}/${file}`;
      scanned.push(path);
      const source = await readFile(join(dir, file), "utf8");
      for (const match of source.matchAll(/(?:^|\s)from\s+"([^"]+)"/gm)) {
        const specifier = match[1] as string;
        if (isLlmPackage(specifier)) offenders.push(`${path} -> ${specifier}`);
      }
    }
  }

  // Boş tarama sessizce geçerdi; testin bir şey ölçtüğünü önce kanıtla.
  assert.ok(scanned.length > 20, `Yalnızca ${scanned.length} dosya tarandı, test ölçmüyor.`);

  assert.deepEqual(
    offenders,
    [],
    `Kaynak bir LLM SDK'sı import ediyor:\n  ${offenders.join("\n  ")}`,
  );
});
