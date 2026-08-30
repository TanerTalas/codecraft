/**
 * Vanilla doku anahtarları -> data/<sürüm>/textures.json
 *
 * Kaynak: Mojang/bedrock-samples, resource_pack/textures/{item,terrain}_texture.json.
 *
 * NEDEN VAR: `minecraft:icon` bir kaynak paketinde tanımlı dokuya işaret
 * ediyor. Kaynak paketi olmayınca oyun bunu uyarı değil HATA yazıyor
 * (`Missing referenced asset ruby`) ve item elde bomboş görünüyor —
 * docs/VALIDATION-LIMITS.md C sınıfı, gerçek oyunda ölçüldü.
 *
 * v1 kapsamı behavior pack (CLAUDE.md), yani kaynak paketi üretilmiyor. Karar:
 * model yalnızca ZATEN VAR OLAN bir vanilla anahtarına işaret edebilir. Bu
 * indeks o kararın veri ayağı; `checkAssets` ölçüyor, prompt önceden anlatıyor.
 *
 * Ham içerik pipeline/raw/ altında kalır ve git'e girmez — Minecraft EULA.
 * data/ altına sadece anahtar listesi yazılır.
 */
import { join } from "node:path";

import { runIfMain } from "./lib/cli.ts";
import { fetchText } from "./lib/fetch.ts";
import { DATA_DIR, RAW_DIR } from "./lib/paths.ts";
import { toJson, writeIfChanged } from "./lib/fs.ts";
import { BEDROCK_SAMPLES_RAW, resolveVersion } from "./lib/version.ts";

const TEXTURES_PATH = "resource_pack/textures";

/** Dosya adı -> indeksteki alan adı. */
const ATLASES = {
  item: "item_texture.json",
  terrain: "terrain_texture.json",
} as const;

export const TEXTURES_FILE = "textures.json";

type Atlas = keyof typeof ATLASES;

/**
 * Mojang bu iki dosyayı yorum satırıyla yayınlıyor, düz `JSON.parse` düşüyor.
 *
 * Ölçüldü (30-08-2026): her iki dosyada da yalnızca EN BAŞTA tek bir tam satır
 * `//` yorumu var, satır içi `//` hiç yok. O yüzden tam satır yorumları
 * atılıyor; genel bir JSONC ayrıştırıcısı yazılmıyor, çünkü satır içi `//`
 * bir URL'in ortasında da geçebilir ve sessizce veri bozardı.
 */
const stripLineComments = (text: string): string =>
  text
    .split("\n")
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");

type TextureAtlas = { texture_data?: Record<string, unknown> };

function toKeys(body: string, file: string): string[] {
  let parsed: TextureAtlas;
  try {
    parsed = JSON.parse(stripLineComments(body)) as TextureAtlas;
  } catch (error) {
    // Sessizce boş liste yazmak, doğrulamanın her anahtarı reddetmesine yol
    // açardı. Ayrıştırılamayan kaynak bir hatadır.
    throw new Error(`${file} ayrıştırılamadı: ${(error as Error).message}`);
  }

  const data = parsed.texture_data;
  if (data === undefined || Object.keys(data).length === 0) {
    throw new Error(`${file}: "texture_data" yok ya da boş — kaynağın biçimi değişmiş olabilir`);
  }

  return Object.keys(data).sort();
}

export type TexturesResult = { counts: Record<Atlas, number>; changed: boolean };

export async function collectTextures(version: string): Promise<TexturesResult> {
  const rawDir = join(RAW_DIR, "bedrock-samples", version);
  const index: Record<string, string[]> = {};
  const counts = {} as Record<Atlas, number>;

  for (const [atlas, file] of Object.entries(ATLASES) as [Atlas, string][]) {
    const body = await fetchText(`${BEDROCK_SAMPLES_RAW}/${TEXTURES_PATH}/${file}`);
    await writeIfChanged(join(rawDir, file), body);

    const keys = toKeys(body, file);
    index[atlas] = keys;
    counts[atlas] = keys.length;
    console.log(`  ${file}: ${keys.length} doku anahtarı`);
  }

  const changed = await writeIfChanged(join(DATA_DIR, version, TEXTURES_FILE), toJson(index));
  return { counts, changed };
}

runIfMain(import.meta.url, async () => {
  const { version } = await resolveVersion();
  console.log(`sürüm: ${version}`);
  await collectTextures(version);
});
