/**
 * Bağımlılık sınırının testi (Aşama M2).
 *
 * ÖLÇÜLEN TEK ŞEY: `packages/mcp/src/**` içinden çıplak `@codecraft/core`
 * (barrel) import edilmiyor, yalnızca `@codecraft/core/server`.
 *
 * Neden ayrı bir test — core tarafındaki `layers.test.ts` server.ts girişinden
 * LLM SDK'sına ulaşılmadığını ölçüyor, ama mcp'nin o girişi KULLANDIĞINI
 * ölçmüyor. Tek satırlık bir hata (`from "@codecraft/core"`) sızıntıyı geri
 * getirir ve dikişin kendisi hâlâ yeşil kalır. Bu boşluğu kapatan test bu.
 *
 * Yürüyücü yerine düz tarama: sınır paket adının kendisinde, grafikte değil.
 * `packages/core/test/layers.test.ts`'in runtimeImports kalıbı aynen kullanıldı
 * — `verbatimModuleSyntax: true` `import type`'ı yazılı olmaya zorluyor, yani
 * metin çalışma zamanının sadık kaydı.
 */
import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

const SRC = fileURLToPath(new URL("../src/", import.meta.url));

/** Çıplak barrel. Alt yol (`@codecraft/core/server`) serbest. */
const FORBIDDEN = ["@codecraft/core"];

/** Bir dosyanın çalışma zamanında çektiği import'lar. Tipler hariç. */
function runtimeImports(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(/^(?:import|export)\s+([^;]*?)\s*from\s+"([^"]+)"/gms)) {
    const clause = match[1] as string;
    const specifier = match[2] as string;
    if (/^type\b/.test(clause.trim())) continue;
    const inner = clause.match(/\{([^}]*)\}/)?.[1];
    if (inner !== undefined && clause.trim().startsWith("{")) {
      const names = inner.split(",").map((n) => n.trim()).filter((n) => n.length > 0);
      if (names.length > 0 && names.every((n) => n.startsWith("type "))) continue;
    }
    out.push(specifier);
  }
  return out;
}

/** src/ altındaki bütün .ts dosyaları, alt dizinler dahil (tools/ var). */
async function sourceFiles(dir = SRC, prefix = ""): Promise<string[]> {
  const out: string[] = [];
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const name = `${prefix}${entry.name}`;
    if (entry.isDirectory()) out.push(...(await sourceFiles(join(dir, entry.name), `${name}/`)));
    else if (entry.name.endsWith(".ts")) out.push(name);
  }
  return out;
}

test("mcp kaynakları core barrel'ını import etmiyor", async () => {
  const files = await sourceFiles();
  // Boş tarama sessizce geçerdi; testin bir şey ölçtüğünü önce kanıtla.
  assert.ok(files.length > 0, "packages/mcp/src altında hiç .ts yok, test ölçmüyor.");

  const offenders: string[] = [];
  for (const file of files) {
    for (const specifier of runtimeImports(await readFile(join(SRC, file), "utf8"))) {
      if (FORBIDDEN.includes(specifier)) offenders.push(`${file} -> ${specifier}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `MCP kaynağı core barrel'ını import ediyor:\n  ${offenders.join("\n  ")}\n` +
      "Barrel model.ts'i açıyor, o da ai + @ai-sdk/google'ı çekiyor. " +
      "@codecraft/core/server kullanılmalı (mimari kural 2).",
  );
});

test("core'a bağlanan en az bir dosya var", async () => {
  // Yukarıdaki test hiç core kullanılmasa da yeşil kalırdı. Bu onu tamamlıyor:
  // alt yol gerçekten kullanılıyor mu.
  const files = await sourceFiles();
  const users: string[] = [];
  for (const file of files) {
    for (const specifier of runtimeImports(await readFile(join(SRC, file), "utf8"))) {
      if (specifier === "@codecraft/core/server") users.push(file);
    }
  }
  assert.ok(users.length > 0, "Hiçbir dosya @codecraft/core/server'dan import etmiyor.");
});
