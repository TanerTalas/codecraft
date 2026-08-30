/**
 * Katman ayrımının testi.
 *
 * Mimari kural 2: üretim tarayıcıda, doğrulama sunucuda. Aşama 3 tek makinede
 * koşuyordu, o yüzden bu kural hiçbir şeyi kırmıyor — ve tam bu yüzden sessizce
 * ihlal edilebiliyor.
 *
 * ÖNCEKİ HÂLİ YETMİYORDU: yalnızca modülün KENDİ import satırlarına bakıyordu.
 * `generate.ts` node: bir şey import etmiyordu ama `./context.ts`'i değer
 * olarak import ediyordu, o da @codecraft/knowledge üzerinden node:fs çekiyordu.
 * Yani test yeşildi ve iddia yanlıştı; tarayıcı paketi node:fs isteyecekti.
 *
 * Bu yüzden test artık `src/browser.ts`'ten başlayıp import grafiğini GEÇİŞLİ
 * olarak yürüyor. Tek ölçüt: o giriş noktasından çalışma zamanında ulaşılan
 * hiçbir dosya Node'a ya da doğrulama paketlerine bağlanmayacak.
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import assert from "node:assert/strict";
import { test } from "node:test";

// pathname Windows'ta "/C:/..." veriyor; fileURLToPath doğru yolu verir.
const SRC = fileURLToPath(new URL("../src/", import.meta.url));

/**
 * Tarayıcıya girmesi yasak olan paketler.
 *
 * Yürüyücü yalnızca yerel `./*.ts` kenarlarını izliyor, paket sınırını
 * geçmiyor — yani node:fs'i @codecraft/knowledge'ın İÇİNDE göremez. Sızıntıyı
 * yakalayan şey bu liste: o paketlerin Node'a bağlı olduğu zaten biliniyor,
 * o yüzden adlarının grafikte görünmesi tek başına yeterli kanıt.
 *
 * Ölçüldü: `generate.ts` context.ts'i değer olarak import ederken bu test
 * kırmızı, `import type`'a çevrilince yeşil.
 */
const FORBIDDEN = ["@codecraft/validator", "@codecraft/knowledge"];

/** Node'a bağlı olması BEKLENEN modüller — gerekçesi her dosyanın başında yazılı. */
const NODE_BOUND = ["config.ts", "context.ts", "review.ts", "pack.ts", "cli.ts"];

/**
 * Bir dosyanın ÇALIŞMA ZAMANINDA çektiği import'lar.
 *
 * `import type` ve `type` nitelenmiş adlar dışarıda: onların çalışma zamanında
 * karşılığı yok, tarayıcıya kod taşımıyorlar. Ayrım tam da bu testin konusu —
 * `browser.ts` Context'i tip olarak alıyor, değer olarak değil.
 */
function runtimeImports(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(/^(?:import|export)\s+([^;]*?)\s*from\s+"([^"]+)"/gms)) {
    const clause = match[1] as string;
    const specifier = match[2] as string;
    if (/^type\b/.test(clause.trim())) continue;
    // `import { a, type B }` — hepsi tipse çalışma zamanı etkisi yok.
    const inner = clause.match(/\{([^}]*)\}/)?.[1];
    if (inner !== undefined && clause.trim().startsWith("{")) {
      const names = inner.split(",").map((n) => n.trim()).filter((n) => n.length > 0);
      if (names.length > 0 && names.every((n) => n.startsWith("type "))) continue;
    }
    out.push(specifier);
  }
  return out;
}

/** browser.ts'ten başlayıp yerel .ts kenarlarını izler. */
async function reachableFrom(entry: string): Promise<Map<string, string[]>> {
  const seen = new Map<string, string[]>();
  const queue = [entry];

  while (queue.length > 0) {
    const file = queue.pop() as string;
    if (seen.has(file)) continue;
    const source = await readFile(join(SRC, file), "utf8");
    const specifiers = runtimeImports(source);
    seen.set(file, specifiers);

    for (const specifier of specifiers) {
      if (!specifier.startsWith(".")) continue;
      const resolved = relative(SRC, join(SRC, dirname(file), specifier)).split("\\").join("/");
      queue.push(resolved);
    }
  }

  return seen;
}

test("tarayıcı giriş noktasından node: modülüne ulaşılamıyor", async () => {
  const graph = await reachableFrom("browser.ts");
  const offenders: string[] = [];

  for (const [file, specifiers] of graph) {
    for (const specifier of specifiers) {
      if (specifier.startsWith("node:")) offenders.push(`${file} -> ${specifier}`);
    }
  }

  assert.deepEqual(
    offenders,
    [],
    `browser.ts'ten node: modülüne ulaşılıyor:\n  ${offenders.join("\n  ")}\n` +
      "Tarayıcıda koşamaz (mimari kural 2).",
  );
});

test("tarayıcı giriş noktasından doğrulama paketlerine ulaşılamıyor", async () => {
  // ajv ve tsc sunucuda kalacak; tarayıcı review.ts arayüzünden geçmeli.
  const graph = await reachableFrom("browser.ts");
  const offenders: string[] = [];

  for (const [file, specifiers] of graph) {
    for (const specifier of specifiers) {
      if (FORBIDDEN.includes(specifier)) offenders.push(`${file} -> ${specifier}`);
    }
  }

  assert.deepEqual(offenders, [], `Doğrulama paketi tarayıcıya sızıyor:\n  ${offenders.join("\n  ")}`);
});

test("node'a bağlı modüller tarayıcı grafiğinde değil", async () => {
  const graph = await reachableFrom("browser.ts");
  const leaked = NODE_BOUND.filter((name) => graph.has(name));
  assert.deepEqual(
    leaked,
    [],
    `Node'a bağlı modül tarayıcı grafiğine girmiş: ${leaked.join(", ")}. ` +
      "Değer olarak değil, tip olarak import edilmeli.",
  );
});

test("her modül ya tarayıcı grafiğinde ya NODE_BOUND listesinde", async () => {
  // Yeni bir modül eklenip hiçbir yere yazılmazsa bu test söyler.
  const graph = await reachableFrom("browser.ts");
  const files = (await readdir(SRC)).filter((name) => name.endsWith(".ts"));
  const known = new Set([...graph.keys(), ...NODE_BOUND, "index.ts", "browser.ts"]);
  const unknown = files.filter((name) => !known.has(name));
  assert.deepEqual(
    unknown,
    [],
    `Sınıflandırılmamış modül: ${unknown.join(", ")}. browser.ts'ten ulaşılmalı ya da NODE_BOUND'a yazılmalı.`,
  );
});
