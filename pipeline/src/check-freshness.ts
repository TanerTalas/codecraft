/**
 * Veri bayatlama kontrolü.
 *
 * Aşama 1'in bitiş kriterinin ölçülebilir yarısı: "veri bayatladığında bildirim
 * geliyor". Cron'un yeşil koşup veriyi geride bırakması mümkün — pipeline
 * patlamadan da bir adım sessizce atlanabilir. Bu script onu yakalar.
 *
 * Upstream sürümü ile data/ içindeki en yeni sürümü karşılaştırır ve
 * beklenen dosyaların gerçekten yerinde olduğunu doğrular. Fark varsa exit 1.
 */
import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { runIfMain } from "./lib/cli.ts";
import { DATA_DIR } from "./lib/paths.ts";
import { resolveVersion } from "./lib/version.ts";

const VERSION_DIR_RE = /^\d+\.\d+\.\d+(?:\.\d+)?$/;

type IndexFile = {
  version?: string;
  sources?: {
    mojangSchemas?: { path?: string; files?: number };
    blockception?: {
      path?: string;
      files?: number;
      compiled?: { path?: string; map?: string; files?: number };
    };
    scriptTypes?: { path?: string };
  };
};

async function countFiles(dir: string): Promise<number> {
  const entries = await readdir(dir, { recursive: true, withFileTypes: true });
  return entries.filter((entry) => entry.isFile()).length;
}

/** data/ içindeki sürüm klasörleri. blockception/ gibi diğer klasörler elenir. */
export async function listDataVersions(): Promise<string[]> {
  const entries = await readdir(DATA_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && VERSION_DIR_RE.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

export async function checkFreshness(): Promise<string[]> {
  const problems: string[] = [];
  const { version } = await resolveVersion();
  const versions = await listDataVersions();

  if (!versions.includes(version)) {
    problems.push(
      `upstream sürüm ${version} ama data/ içinde yok. Mevcut: ${versions.join(", ") || "hiç"}. ` +
        "Pipeline koşmamış veya yazamamış.",
    );
    return problems; // sonraki kontroller bu klasöre bakıyor, devam etmenin anlamı yok
  }

  const dir = join(DATA_DIR, version);
  let index: IndexFile;
  try {
    index = JSON.parse(await readFile(join(dir, "index.json"), "utf8")) as IndexFile;
  } catch {
    problems.push(`data/${version}/index.json okunamadı — pipeline yarım kalmış`);
    return problems;
  }

  if (index.version !== version) {
    problems.push(`data/${version}/index.json içindeki sürüm "${index.version}" — klasör adıyla uyuşmuyor`);
  }

  const { mojangSchemas, blockception, scriptTypes } = index.sources ?? {};

  for (const [label, source] of [
    ["mojang şemaları", mojangSchemas],
    ["blockception", blockception],
  ] as const) {
    if (source?.path === undefined || source.files === undefined) {
      problems.push(`index.json içinde ${label} kaydı eksik`);
      continue;
    }
    const path = join(dir, source.path);
    try {
      const actual = await countFiles(path);
      // Blockception klasöründe LICENSE de var, sayım ondan bir fazla olabilir.
      if (actual < source.files) {
        problems.push(`${label}: ${source.files} dosya bekleniyordu, ${actual} bulundu (${path})`);
      }
    } catch {
      problems.push(`${label}: klasör yok — ${path}`);
    }
  }

  // Doğrulamanın kullandığı küme. Kaynak şemalar yerinde olup derlenmiş olanlar
  // eksik kalırsa pipeline yeşil koşar ama validator hiçbir dosyayı doğrulayamaz.
  const compiled = blockception?.compiled;
  if (compiled?.path === undefined || compiled.files === undefined || compiled.map === undefined) {
    problems.push("index.json içinde blockception derlenmiş şema kaydı eksik");
  } else {
    try {
      const actual = await countFiles(join(dir, compiled.path));
      if (actual < compiled.files) {
        problems.push(
          `blockception derlenmiş: ${compiled.files} şema bekleniyordu, ${actual} bulundu`,
        );
      }
    } catch {
      problems.push(`blockception derlenmiş: klasör yok — ${join(dir, compiled.path)}`);
    }
    try {
      await access(join(dir, compiled.map));
    } catch {
      problems.push(`blockception tip haritası yok — ${join(dir, compiled.map)}`);
    }
  }

  if (scriptTypes?.path === undefined) {
    problems.push("index.json içinde script tipleri kaydı eksik");
  } else {
    try {
      await access(join(dir, scriptTypes.path));
    } catch {
      problems.push(`script tipleri: klasör yok — ${join(dir, scriptTypes.path)}`);
    }
  }

  return problems;
}

runIfMain(import.meta.url, async () => {
  const problems = await checkFreshness();
  if (problems.length === 0) {
    console.log("veri güncel");
    return;
  }
  console.error("VERİ BAYAT:");
  for (const problem of problems) console.error(`  - ${problem}`);
  process.exitCode = 1;
});
