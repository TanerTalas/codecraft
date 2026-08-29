/**
 * Mojang/bedrock-samples -> data/<sürüm>/
 *
 * Aşama 1'in ilk somut adımı (bkz. TODO.md). Sürümü tespit eder, vanilladata
 * modüllerini indirir ve onlardan kompakt lookup indeksleri türetir.
 *
 * Ham içerik pipeline/raw/ altında kalır ve git'e girmez — Minecraft EULA.
 * data/ altına sadece türetilmiş indeksler yazılır (docs/SOURCES.md).
 *
 * Çıktı deterministiktir: zaman damgası veya commit SHA yazılmaz. Böylece
 * günlük cron sadece veri gerçekten değiştiğinde diff görür.
 */
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "Mojang/bedrock-samples";
const REF = "main";
const RAW_BASE = `https://raw.githubusercontent.com/${REPO}/${REF}`;

const ROOT = fileURLToPath(new URL("../../", import.meta.url));
const RAW_DIR = join(ROOT, "pipeline", "raw", "bedrock-samples");
const DATA_DIR = join(ROOT, "data");

const MODULES = [
  "biomes", "blocks", "camera-presets", "cooldown-category", "dimensions",
  "effects", "enchantments", "entities", "features", "items",
  "potion-effects", "potion-types",
] as const;

/** Oyun sürümü beklenir (1.26.40.5). Pazarlama numarası (26.40) reddedilir. */
const VERSION_RE = /^\d+\.\d+\.\d+(?:\.\d+)?$/;

type BlockProperty = { name: string; type: string; values?: { value: unknown }[] };
type DataItem = { name?: string; properties?: { name: string }[] };
type VanillaModule = { data_items?: DataItem[]; block_properties?: BlockProperty[] };

const toJson = (value: unknown): string => `${JSON.stringify(value, null, 2)}\n`;

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText} — ${url}`);
  return res.text();
}

/** İçerik aynıysa dosyaya dokunmaz. Cron'un "değişiklik varsa commit et" davranışı buna dayanır. */
async function writeIfChanged(path: string, content: string): Promise<boolean> {
  try {
    if ((await readFile(path, "utf8")) === content) return false;
  } catch {
    // dosya henüz yok
  }
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, content, "utf8");
  return true;
}

async function resolveVersion(): Promise<{ version: string; date: string | null }> {
  const raw = await fetchText(`${RAW_BASE}/version.json`);
  const parsed = JSON.parse(raw) as { latest?: { version?: string; date?: string } };
  const version = parsed.latest?.version;
  if (!version) throw new Error("version.json içinde latest.version alanı yok");
  if (!VERSION_RE.test(version)) {
    throw new Error(
      `Beklenmeyen sürüm biçimi: "${version}". Oyun sürümü bekleniyor ` +
        "(1.26.40.5 gibi), pazarlama numarası değil (26.40).",
    );
  }
  return { version, date: parsed.latest?.date ?? null };
}

/** "1.26.40.5" -> [1, 26, 40]. manifest.json'daki min_engine_version biçimi. */
function toMinEngineVersion(version: string): [number, number, number] {
  const [major, minor, patch] = version.split(".").map(Number);
  if (major === undefined || minor === undefined || patch === undefined) {
    throw new Error(`Sürüm üç parçaya ayrılamadı: "${version}"`);
  }
  return [major, minor, patch];
}

function toIds(module: VanillaModule, label: string): string[] {
  const items = module.data_items ?? [];
  const names = items.flatMap((item) => (typeof item.name === "string" ? [item.name] : []));
  if (names.length !== items.length) {
    throw new Error(`${label}: ${items.length - names.length} data_item'da "name" alanı yok`);
  }
  return names.sort();
}

function toBlockProperties(module: VanillaModule): Record<string, { type: string; values: unknown[] }> {
  const out: Record<string, { type: string; values: unknown[] }> = {};
  const sorted = [...(module.block_properties ?? [])].sort((a, b) => (a.name < b.name ? -1 : 1));
  for (const property of sorted) {
    out[property.name] = { type: property.type, values: (property.values ?? []).map((v) => v.value) };
  }
  return out;
}

/** Hangi blok hangi durum adlarını taşıyor. Doğrulamanın asıl kullanacağı indeks. */
function toBlockStates(module: VanillaModule): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  const sorted = [...(module.data_items ?? [])].sort((a, b) => ((a.name ?? "") < (b.name ?? "") ? -1 : 1));
  for (const item of sorted) {
    if (item.name === undefined) continue;
    out[item.name] = (item.properties ?? []).map((p) => p.name).sort();
  }
  return out;
}

async function main(): Promise<void> {
  const { version, date } = await resolveVersion();
  console.log(`${REPO}@${REF} -> sürüm ${version}${date === null ? "" : ` (${date})`}`);

  const rawDir = join(RAW_DIR, version);
  const outDir = join(DATA_DIR, version);
  const counts: Record<string, number> = {};
  const changed: string[] = [];

  for (const name of MODULES) {
    const file = `mojang-${name}.json`;
    const text = await fetchText(`${RAW_BASE}/metadata/vanilladata_modules/${file}`);
    await writeIfChanged(join(rawDir, file), text); // ham kopya, git dışında

    const module = JSON.parse(text) as VanillaModule;
    const derived: Record<string, unknown> = { ids: toIds(module, file) };
    if (name === "blocks") {
      derived["properties"] = toBlockProperties(module);
      derived["states"] = toBlockStates(module);
    }
    counts[name] = (derived["ids"] as string[]).length;

    if (await writeIfChanged(join(outDir, `${name}.json`), toJson(derived))) changed.push(`${name}.json`);
  }

  const index = {
    version,
    minEngineVersion: toMinEngineVersion(version),
    releaseDate: date,
    source: { repo: REPO, ref: REF },
    counts,
  };
  if (await writeIfChanged(join(outDir, "index.json"), toJson(index))) changed.push("index.json");

  console.log(`data/${version}/ — ${changed.length === 0 ? "değişiklik yok" : `güncellendi: ${changed.join(", ")}`}`);
}

main().catch((error: unknown) => {
  console.error(`pipeline hatası: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
