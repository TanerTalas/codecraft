/**
 * Veri bayatlama kontrolü.
 *
 * Boru hattının ölçülebilir yarısı: "veri bayatladığında bildirim
 * geliyor". Cron'un yeşil koşup veriyi geride bırakması mümkün — pipeline
 * patlamadan da bir adım sessizce atlanabilir. Bu script onu yakalar.
 *
 * Upstream sürümü ile data/ içindeki en yeni sürümü karşılaştırır ve
 * beklenen dosyaların gerçekten yerinde olduğunu doğrular. Fark varsa exit 1.
 */
import { access, readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { listDataVersions } from "@codecraft/knowledge";

import { runIfMain } from "./lib/cli.ts";
import { DATA_DIR } from "./lib/paths.ts";
import { resolveVersion } from "./lib/version.ts";

type IndexFile = {
  version?: string;
  sources?: {
    mojangSchemas?: { index?: string; files?: number };
    molang?: { file?: string; queries?: number; math?: number };
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

  const { mojangSchemas, molang, blockception, scriptTypes } = index.sources ?? {};

  if (blockception?.path === undefined || blockception.files === undefined) {
    problems.push("index.json içinde blockception kaydı eksik");
  } else {
    const path = join(dir, blockception.path);
    try {
      const actual = await countFiles(path);
      // Blockception klasöründe LICENSE de var, sayım ondan bir fazla olabilir.
      if (actual < blockception.files) {
        problems.push(
          `blockception: ${blockception.files} dosya bekleniyordu, ${actual} bulundu (${path})`,
        );
      }
    } catch {
      problems.push(`blockception: klasör yok — ${path}`);
    }
  }

  // Mojang şemalarının KENDİSİ artık data/ altında değil (pipeline/raw/,
  // .gitignore — repo public, EULA). Doğrulanabilen tek şey ondan türetilen
  // indeks; klasör sayımı yapılamaz çünkü CI'da temiz bir checkout'ta ham
  // klasör hiç yoktur.
  if (mojangSchemas?.index === undefined || mojangSchemas.files === undefined) {
    problems.push("index.json içinde mojang şemaları kaydı eksik");
  } else {
    try {
      await access(join(dir, mojangSchemas.index));
    } catch {
      problems.push(`mojang şema indeksi yok — ${join(dir, mojangSchemas.index)}`);
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

  // Molang indeksi: yeni bir dogrulama ekseni, sessizce eksik kalmamali.
  if (molang?.file === undefined || molang.queries === undefined) {
    problems.push("index.json içinde molang kaydı eksik");
  } else {
    try {
      await access(join(dir, molang.file));
    } catch {
      problems.push(`molang indeksi yok — ${join(dir, molang.file)}`);
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
