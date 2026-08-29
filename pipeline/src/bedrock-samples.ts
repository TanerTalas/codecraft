/**
 * Mojang/bedrock-samples -> data/<sürüm>/
 *
 * vanilladata modüllerini indirir ve onlardan kompakt lookup indeksleri türetir
 * (blok, item, entity, biome kimlikleri ve blok durumları).
 *
 * Ham içerik pipeline/raw/ altında kalır ve git'e girmez — Minecraft EULA.
 * data/ altına sadece türetilmiş indeksler yazılır (docs/SOURCES.md).
 */
import { join } from "node:path";

import { runIfMain } from "./lib/cli.ts";
import { fetchText } from "./lib/fetch.ts";
import { DATA_DIR, RAW_DIR } from "./lib/paths.ts";
import { toJson, writeIfChanged } from "./lib/fs.ts";
import { BEDROCK_SAMPLES_RAW, resolveVersion } from "./lib/version.ts";

const MODULES = [
  "biomes", "blocks", "camera-presets", "cooldown-category", "dimensions",
  "effects", "enchantments", "entities", "features", "items",
  "potion-effects", "potion-types",
] as const;

type BlockProperty = { name: string; type: string; values?: { value: unknown }[] };
type DataItem = { name?: string; properties?: { name: string }[] };
type VanillaModule = { data_items?: DataItem[]; block_properties?: BlockProperty[] };

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

export type VanillaDataResult = { counts: Record<string, number>; changed: string[] };

export async function collectVanillaData(version: string): Promise<VanillaDataResult> {
  const rawDir = join(RAW_DIR, "bedrock-samples", version);
  const outDir = join(DATA_DIR, version);
  const counts: Record<string, number> = {};
  const changed: string[] = [];

  for (const name of MODULES) {
    const file = `mojang-${name}.json`;
    const text = await fetchText(`${BEDROCK_SAMPLES_RAW}/metadata/vanilladata_modules/${file}`);
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

  return { counts, changed };
}

runIfMain(import.meta.url, async () => {
  const { version, date } = await resolveVersion();
  console.log(`bedrock-samples -> sürüm ${version}${date === null ? "" : ` (${date})`}`);
  const { counts, changed } = await collectVanillaData(version);
  console.log(`  ${Object.keys(counts).length} modül, ${changed.length} dosya güncellendi`);
});
