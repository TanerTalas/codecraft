/**
 * Katman ayrımının testi.
 *
 * Mimari kural 2: üretim tarayıcıda, doğrulama sunucuda. Aşama 3 tek makinede
 * koşuyor, o yüzden bu kural bugün hiçbir şeyi kırmıyor — ve tam bu yüzden
 * sessizce ihlal edilebilir. Test, üretim yolundaki modüllere node: bağımlılığı
 * sızdığı anda kırmızıya döner; Aşama 4 baştan refactor olmasın.
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";

// pathname Windows'ta "/C:/..." veriyor; fileURLToPath doğru yolu verir.
const SRC = fileURLToPath(new URL("../src/", import.meta.url));

/** Tarayıcıda da koşacak modüller. */
const PURE = [
  "errors.ts",
  "feasibility.ts",
  "generate.ts",
  "model.ts",
  "normalize.ts",
  "output.ts",
  "prompt.ts",
];

/** Node'a bağlı olması BEKLENEN modüller — gerekçesi dosyanın başında yazılı. */
const NODE_BOUND = ["config.ts", "context.ts", "review.ts", "pack.ts", "cli.ts"];

const importsOf = (source: string): string[] =>
  [...source.matchAll(/^import[^;]*?from\s+"([^"]+)"/gm)].map((match) => match[1] as string);

test("üretim yolundaki modüller node: modülü import etmiyor", async () => {
  for (const name of PURE) {
    const source = await readFile(join(SRC, name), "utf8");
    const nodeImports = importsOf(source).filter((path) => path.startsWith("node:"));
    assert.deepEqual(
      nodeImports,
      [],
      `${name} node: modülü import ediyor (${nodeImports.join(", ")}) — ` +
        "Aşama 4'te tarayıcıda koşamaz",
    );
  }
});

test("üretim yolu doğrulama paketlerine doğrudan bağlanmıyor", async () => {
  // review.ts arayüzü üzerinden gidilmeli: ajv ve tsc sunucuda kalacak.
  for (const name of PURE) {
    const source = await readFile(join(SRC, name), "utf8");
    const value = importsOf(source).filter((path) => path === "@codecraft/validator");
    assert.deepEqual(value, [], `${name} validator'ı doğrudan import ediyor`);
  }
});

test("node'a bağlı modüller listede kayıtlı", async () => {
  // Yeni bir modül eklenip listelerin hiçbirine yazılmazsa bu test söyler.
  const files = (await readdir(SRC)).filter((name) => name.endsWith(".ts"));
  const known = new Set([...PURE, ...NODE_BOUND, "index.ts"]);
  const unknown = files.filter((name) => !known.has(name));
  assert.deepEqual(
    unknown,
    [],
    `Sınıflandırılmamış modül: ${unknown.join(", ")}. PURE veya NODE_BOUND listesine ekle.`,
  );
});
