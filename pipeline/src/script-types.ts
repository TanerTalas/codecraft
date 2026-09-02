/**
 * @minecraft/* tip tanımları -> data/<sürüm>/script-types/
 *
 * Buradaki tek zor iş, oyun sürümü ile npm modül sürümünü doğru eşlemek.
 * CLAUDE.md'nin sürüm tablosundaki dördüncü satır: modül kendi semver'iyle
 * yayınlanıyor (2.9.0), oyun sürümü prerelease etiketinin içine gömülü geliyor
 * (2.10.0-beta.1.26.40-stable). Biri diğerinin yerine yazılırsa paket sessizce
 * yüklenmez.
 *
 * Eşleme tahminle değil, iki kaynağın kesişimiyle yapılıyor:
 *
 * 1. Mojang'ın kendi reposu hangi modül sürümlerinin bu oyun sürümünde var
 *    olduğunu söylüyor — metadata/script_modules/@minecraft/<paket>_<sürüm>.json
 * 2. npm o sürümün gerçekten yayınlanmış olduğunu doğruluyor
 *
 * İkisi kesişmezse script durur. Yakın bir sürüme düşmek yok: yanlış modül
 * sürümü tam olarak CodeCraft'ın önlemek için var olduğu hata sınıfı.
 *
 * Paketler MIT (npm view @minecraft/server license), yeniden dağıtım serbest.
 * Ancak paketler lisans metnini ve telif satırını yayınlamıyor — tarball'da
 * sadece package.json, README ve index.d.ts var. Telif sahibi uydurulmuyor:
 * lisans beyanının kendisi (package.json) çıktıyla birlikte taşınıyor ve
 * NOTICE.md kaynağın ne olduğunu kayda geçiriyor.
 */
import { join } from "node:path";
import { createHash } from "node:crypto";

import { runIfMain } from "./lib/cli.ts";
import { fetchBytes, fetchJson } from "./lib/fetch.ts";
import { fetchTree } from "./lib/github.ts";
import { DATA_DIR } from "./lib/paths.ts";
import { writeTree } from "./lib/fs.ts";
import { extractTarGz } from "./lib/tar.ts";
import {
  BEDROCK_SAMPLES_REF,
  BEDROCK_SAMPLES_REPO,
  resolveVersion,
  toShortVersion,
} from "./lib/version.ts";

const MODULE_PREFIX = "metadata/script_modules/@minecraft/";

/**
 * Hangi npm paketi, bedrock-samples'ta hangi dosya adıyla listeleniyor.
 * Mojang tip bilgisini "-bindings" ekli dosyalarda tutuyor, npm paket adında ek yok.
 */
const PACKAGES = [
  // @minecraft/common olmadan diğer ikisi derlenmiyor: index.d.ts dosyaları
  // doğrudan ondan import ediyor. tsc sarmalayıcısı için zorunlu.
  { npm: "@minecraft/common", metadata: "common" },
  { npm: "@minecraft/server", metadata: "server-bindings" },
  { npm: "@minecraft/server-ui", metadata: "server-ui-bindings" },
  // Aşağıdaki altısı 02-09-2026'da eklendi. Öncesinde bunlardan birini import
  // eden bir script `validate_script`'te "Cannot find module" ile düşüyordu —
  // yani araç var olan bir API'ye "yok" diyordu, tam olarak önlemek için var
  // olduğu hata sınıfı.
  //
  // Dosya adı eşlemesi ilk üçünden FARKLI: Mojang tip bilgisini `server` ve
  // `server-ui` için "-bindings" ekli dosyalarda tutuyor, bu altısı için
  // eklemiyor. Ağaçtan doğrulandı, tahmin edilmedi.
  //
  // Altısı da npm'de YALNIZCA beta olarak yayınlanıyor ve bedrock-samples da
  // yalnızca `<ad>_1.0.0-beta.json` listeliyor (ölçüldü 02-09-2026). Yani
  // kararlı kanalda görünmemeleri bir eksiklik değil, kaynağın söylediği şey.
  { npm: "@minecraft/server-gametest", metadata: "server-gametest" },
  { npm: "@minecraft/server-net", metadata: "server-net" },
  { npm: "@minecraft/server-admin", metadata: "server-admin" },
  { npm: "@minecraft/server-graphics", metadata: "server-graphics" },
  { npm: "@minecraft/diagnostics", metadata: "diagnostics" },
  { npm: "@minecraft/debug-utilities", metadata: "debug-utilities" },
] as const;

type NpmPackument = {
  versions?: Record<string, { dist?: { tarball?: string; integrity?: string } }>;
};

export type ModuleVersions = { stable: string | null; beta: string | null };
type NoticeEntry = { npm: string; moduleVersion: string; npmVersion: string; license: string };
export type ScriptTypesResult = {
  modules: Record<string, ModuleVersions>;
  written: string[];
  deleted: string[];
};

/** "2.9.0" / "2.10.0-beta" -> karşılaştırılabilir sayı dizisi. */
function compareVersions(a: string, b: string): number {
  const parts = (v: string): number[] => v.split("-")[0]?.split(".").map(Number) ?? [];
  const [pa, pb] = [parts(a), parts(b)];
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** bedrock-samples'ın listelediği modül sürümleri: en yüksek kararlı ve en yüksek beta. */
function pickModuleVersions(paths: readonly string[], metadataName: string): ModuleVersions {
  const found: string[] = [];
  for (const path of paths) {
    const name = path.slice(MODULE_PREFIX.length);
    const match = new RegExp(`^${metadataName}_(.+)\\.json$`).exec(name);
    if (match?.[1] !== undefined) found.push(match[1]);
  }
  if (found.length === 0) {
    throw new Error(`${metadataName}: bedrock-samples içinde modül dosyası yok — yol değişmiş olabilir`);
  }

  const sorted = [...found].sort(compareVersions);
  const stable = sorted.filter((v) => !v.includes("-")).at(-1) ?? null;
  const beta = sorted.filter((v) => v.endsWith("-beta")).at(-1) ?? null;

  // Kararlı sürümün YOKLUĞU bir hata değil — 02-09-2026'da eklenen altı modül
  // (server-net, server-admin, gametest, graphics, diagnostics,
  // debug-utilities) yalnızca beta olarak yayınlanıyor. Önce burada throw
  // vardı ve o altısı eklendiği anda pipeline'ı durdururdu.
  //
  // İkisinin birden yokluğu hâlâ hata: o zaman dosya adı biçimi değişmiş
  // demektir ve sessizce atlamak veriyi eksik bırakırdı.
  if (stable === null && beta === null) {
    throw new Error(
      `${metadataName}: ne kararlı ne beta sürüm çözülebildi, bulunanlar: ${sorted.join(", ")}`,
    );
  }
  return { stable, beta };
}

/**
 * Modül sürümünü npm'de gerçekten yayınlanmış bir sürüme bağlar.
 *
 * Kararlı sürüm birebir eşleşir ("2.9.0"). Beta npm'de oyun sürümü gömülü olarak
 * duruyor: "2.10.0-beta" + oyun 1.26.40 -> "2.10.0-beta.1.26.40-stable".
 */
function resolveNpmVersion(
  packument: NpmPackument,
  moduleVersion: string,
  gameVersion: string,
  npmName: string,
): string {
  const available = Object.keys(packument.versions ?? {});

  if (!moduleVersion.includes("-")) {
    if (!available.includes(moduleVersion)) {
      throw new Error(`${npmName}: bedrock-samples ${moduleVersion} diyor ama npm'de böyle bir sürüm yok`);
    }
    return moduleVersion;
  }

  const short = toShortVersion(gameVersion);
  const wanted = `${moduleVersion}.${short}-stable`;
  if (available.includes(wanted)) return wanted;

  const alternatives = available.filter((v) => v.startsWith(`${moduleVersion}.${short}`));
  throw new Error(
    `${npmName}: oyun ${short} için ${moduleVersion} sürümü npm'de bulunamadı ` +
      `(${wanted} arandı). Aynı önekle bulunanlar: ${alternatives.join(", ") || "yok"}`,
  );
}

async function downloadPackage(
  packument: NpmPackument,
  npmVersion: string,
  npmName: string,
): Promise<Map<string, Buffer>> {
  const dist = packument.versions?.[npmVersion]?.dist;
  if (dist?.tarball === undefined) throw new Error(`${npmName}@${npmVersion}: tarball adresi yok`);

  const archive = await fetchBytes(dist.tarball);

  // npm'in verdiği integrity ile doğrula — indirilen paketin beklenen paket
  // olduğunu teyit eden tek ucuz kontrol.
  if (dist.integrity !== undefined) {
    const [algorithm, expected] = dist.integrity.split("-");
    if (algorithm !== undefined && expected !== undefined) {
      const actual = createHash(algorithm).update(archive).digest("base64");
      if (actual !== expected) {
        throw new Error(`${npmName}@${npmVersion}: integrity uyuşmadı, indirme bozuk`);
      }
    }
  }

  const files = new Map<string, Buffer>();
  for (const [path, content] of extractTarGz(archive)) {
    const name = path.replace(/^package\//, "");
    // package.json lisans beyanının kaynağı, LICENSE ise paket onu yayınlarsa.
    if (name === "index.d.ts" || name === "LICENSE" || name === "package.json") {
      files.set(name, content);
    }
  }
  if (!files.has("index.d.ts")) {
    throw new Error(`${npmName}@${npmVersion}: paket içinde index.d.ts yok`);
  }
  return files;
}

/** Kaynak künyesi. Deterministik — sadece çözümlenen sürümler değişince değişir. */
function renderNotice(entries: readonly NoticeEntry[]): string {
  const rows = entries
    .map((e) => `| \`${e.npm}\` | ${e.moduleVersion} | \`${e.npmVersion}\` | ${e.license} |`)
    .join("\n");
  return [
    "# script-types kaynak künyesi",
    "",
    "Bu klasördeki `index.d.ts` dosyaları npm'den olduğu gibi alınmıştır.",
    "Dosya elle düzenlenmez, `pipeline/src/script-types.ts` üretir.",
    "",
    "| Paket | Modül sürümü | npm sürümü | Lisans (package.json beyanı) |",
    "|---|---|---|---|",
    rows,
    "",
    "Klasör adları **modül** sürümüdür, oyun sürümü değil (bkz. `CLAUDE.md`",
    "sürüm tablosu). npm sürümü sütunu, beta kanalında oyun sürümünün etikete",
    "gömülü hâlini gösterir.",
    "",
    "Paketler MIT olduklarını `package.json` içinde beyan ediyor ama lisans",
    "metnini ve telif satırını tarball'a koymuyorlar. Beyanın kendisi kanıt",
    "olarak her sürüm klasöründe `package.json` ile birlikte duruyor.",
    "",
  ].join("\n");
}

export async function collectScriptTypes(gameVersion: string): Promise<ScriptTypesResult> {
  const tree = await fetchTree(BEDROCK_SAMPLES_REPO, BEDROCK_SAMPLES_REF);
  const modulePaths = tree
    .filter((entry) => entry.type === "blob" && entry.path.startsWith(MODULE_PREFIX))
    .map((entry) => entry.path);

  const files = new Map<string, Buffer>();
  const modules: Record<string, ModuleVersions> = {};
  const notice: NoticeEntry[] = [];

  for (const { npm, metadata } of PACKAGES) {
    const packument = await fetchJson<NpmPackument>(`https://registry.npmjs.org/${npm}`);
    const picked = pickModuleVersions(modulePaths, metadata);
    const resolved: ModuleVersions = { stable: picked.stable, beta: picked.beta };

    for (const channel of ["stable", "beta"] as const) {
      const moduleVersion = picked[channel];
      if (moduleVersion === null) continue;
      const npmVersion = resolveNpmVersion(packument, moduleVersion, gameVersion, npm);
      const downloaded = await downloadPackage(packument, npmVersion, npm);
      for (const [name, content] of downloaded) {
        // Klasör adı modül sürümü — oyun sürümüyle karışmasın diye npm'in tam
        // etiketi değil, bedrock-samples'ın kullandığı sade biçim yazılır.
        files.set(`${npm}/${moduleVersion}/${name}`, content);
      }
      const declared = JSON.parse(String(downloaded.get("package.json") ?? "{}")) as {
        license?: string;
      };
      notice.push({
        npm,
        moduleVersion,
        npmVersion,
        license: declared.license ?? "beyan yok",
      });
    }
    modules[npm] = resolved;
  }

  files.set("NOTICE.md", Buffer.from(renderNotice(notice), "utf8"));

  const { written, deleted } = await writeTree(join(DATA_DIR, gameVersion, "script-types"), files);
  return { modules, written, deleted };
}

runIfMain(import.meta.url, async () => {
  const { version } = await resolveVersion();
  const result = await collectScriptTypes(version);
  for (const [npm, versions] of Object.entries(result.modules)) {
    console.log(
      `  ${npm}: kararlı ${versions.stable ?? "yok"}, beta ${versions.beta ?? "yok"}`,
    );
  }
  console.log(
    `script tipleri -> data/${version}/script-types/ — ` +
      `${result.written.length} yazıldı, ${result.deleted.length} silindi`,
  );
});
