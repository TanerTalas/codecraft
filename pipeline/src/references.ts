/**
 * Mojang/bedrock-samples → data/<sürüm>/particles.json + references.json
 *
 * Kimliği olan ama bugüne kadar hiçbir indekste bulunmayan dört küme:
 * parçacıklar, ses olayları, müzik olayları ve loot/trade tablo YOLLARI.
 *
 * NEDEN VAR — iki ayrı sebep, ikisi de ölçüldü (02-09-2026):
 *
 * 1. **Yanlış pozitif düzeltmesi.** `checkCommandIdentities` komut metnindeki
 *    her `minecraft:` kimliğini `lookupAny` ile arıyor. Parçacıklar hiçbir
 *    indekste yoktu, yani `/particle minecraft:heart_particle` gibi TAMAMEN
 *    GEÇERLİ bir komut "1.26.40.5 sürümünde yok" diye ERROR alıyordu.
 *    `particles.json` bu yüzden ayrı bir kimlik indeksi olarak yazılıyor ve
 *    `ALL_KINDS` içine giriyor — mevcut arama onu kendiliğinden buluyor.
 *
 * 2. **Kapanmayan referans sınıfı.** `minecraft:loot` ve `minecraft:trade_table`
 *    bir dosya YOLUNA işaret ediyor ("loot_tables/entities/cow.json"), kimliğe
 *    değil. Şema yolun biçimine bakıyor, işaret ettiği dosyanın var olup
 *    olmadığına değil — docs/VALIDATION-LIMITS.md A ile aynı yapı.
 *
 * PARÇACIK KİMLİĞİ DOSYA ADINDAN TÜRETİLEMİYOR — ölçüldü, varsayılmadı:
 *
 *   arrowspell.json   -> minecraft:arrow_spell_emitter
 *   balloon_gas.json  -> minecraft:balloon_gas_particle
 *
 * Bu yüzden 189 dosyanın hepsi tek tek okunuyor. Aynı ders doku atlasında da
 * çıkmıştı (docs/VALIDATION-LIMITS.md C, %13/%40 bulgusu): kimlikten ad
 * türetme kuralı yazmak, kuralı modele uydurtmak demek.
 *
 * Ham içerik pipeline/raw/ altında kalır ve git'e girmez — Minecraft EULA.
 */
import { join } from "node:path";

import { runIfMain } from "./lib/cli.ts";
import { fetchText } from "./lib/fetch.ts";
import { downloadPaths, fetchTree } from "./lib/github.ts";
import { DATA_DIR, RAW_DIR } from "./lib/paths.ts";
import { toJson, writeIfChanged } from "./lib/fs.ts";
import { stripLineComments } from "./textures.ts";
import {
  BEDROCK_SAMPLES_RAW,
  BEDROCK_SAMPLES_REF,
  BEDROCK_SAMPLES_REPO,
  resolveVersion,
} from "./lib/version.ts";

const PARTICLES_PREFIX = "resource_pack/particles/";
const LOOT_PREFIX = "behavior_pack/loot_tables/";
const TRADING_PREFIX = "behavior_pack/trading/";
const SOUNDS_PATH = "resource_pack/sounds/sound_definitions.json";
const MUSIC_PATH = "resource_pack/sounds/music_definitions.json";

export const PARTICLES_FILE = "particles.json";
export const REFERENCES_FILE = "references.json";

type ParticleFile = { particle_effect?: { description?: { identifier?: string } } };
type SoundDefinitions = { sound_definitions?: Record<string, unknown> };

/**
 * Referans indeksinin şekli.
 *
 * Yollar repo köküne değil PAKET köküne göreli tutuluyor
 * ("loot_tables/entities/cow.json"), çünkü içerik dosyalarında da öyle
 * yazılıyor. Karşılaştırma başka türlü her seferinde önek kırpmayı gerektirirdi.
 */
export type ReferenceIndex = {
  /** `sound_definitions.json` anahtarları: "ambient.basalt_deltas.mood". */
  sounds: string[];
  /** `music_definitions.json` kök anahtarları: "cherry_grove", "menu". */
  music: string[];
  /** "loot_tables/entities/cow.json" */
  lootTables: string[];
  /** "trading/armorer_trades.json" */
  tradeTables: string[];
};

/** Ağaçtaki bir önek altındaki .json yolları, paket köküne göreli. */
function pathsUnder(
  tree: readonly { path: string; type: string }[],
  prefix: string,
  strip: string,
): string[] {
  return tree
    .filter((entry) => entry.type === "blob" && entry.path.startsWith(prefix))
    .filter((entry) => entry.path.endsWith(".json"))
    .map((entry) => entry.path.slice(strip.length))
    .sort();
}

export type ReferencesResult = {
  particles: number;
  sounds: number;
  music: number;
  lootTables: number;
  tradeTables: number;
  changed: string[];
};

export async function collectReferences(version: string): Promise<ReferencesResult> {
  const tree = await fetchTree(BEDROCK_SAMPLES_REPO, BEDROCK_SAMPLES_REF);
  const rawDir = join(RAW_DIR, "bedrock-samples", version);
  const outDir = join(DATA_DIR, version);
  const changed: string[] = [];

  // --- parçacıklar: kimlik dosyanın İÇİNDE, adından türetilemiyor ---
  const particlePaths = tree
    .filter((entry) => entry.type === "blob" && entry.path.startsWith(PARTICLES_PREFIX))
    .filter((entry) => entry.path.endsWith(".json"))
    .map((entry) => entry.path)
    .sort();

  if (particlePaths.length === 0) {
    throw new Error(`${PARTICLES_PREFIX}: dosya yok — yol değişmiş olabilir`);
  }

  const downloaded = await downloadPaths(BEDROCK_SAMPLES_REPO, BEDROCK_SAMPLES_REF, particlePaths);
  const particles: string[] = [];
  for (const [path, content] of downloaded) {
    // 189 dosyanın 1'i tam satır `//` yorumu taşıyor (guardian_water_move.json)
    // ve düz JSON.parse orada düşüyor. Sayım textures.ts'in başlığında.
    let parsed: ParticleFile;
    try {
      parsed = JSON.parse(stripLineComments(content)) as ParticleFile;
    } catch (error) {
      // Hangi dosyanın düştüğünü söylemeyen bir hata, 189 dosya içinde
      // aramaya zorlar. Bir kez yaşandı, mesaj o yüzden yolu taşıyor.
      throw new Error(`${path}: ayrıştırılamadı — ${error instanceof Error ? error.message : error}`);
    }
    const id = parsed.particle_effect?.description?.identifier;
    if (typeof id !== "string") {
      throw new Error(`${path}: particle_effect.description.identifier yok — biçim değişmiş olabilir`);
    }
    particles.push(id);
  }
  particles.sort();

  // Aynı biçim: diğer kimlik indeksleri de { ids: [...] } yazıyor, böylece
  // lookup/lookupAny hiçbir özel durum bilmeden okuyabiliyor.
  if (await writeIfChanged(join(outDir, PARTICLES_FILE), toJson({ ids: particles }))) {
    changed.push(PARTICLES_FILE);
  }

  // --- ses ve müzik olayları ---
  const soundsText = await fetchText(`${BEDROCK_SAMPLES_RAW}/${SOUNDS_PATH}`);
  await writeIfChanged(join(rawDir, "sound_definitions.json"), soundsText);
  const soundsRaw = JSON.parse(soundsText) as SoundDefinitions;
  const sounds = Object.keys(soundsRaw.sound_definitions ?? {}).sort();
  if (sounds.length === 0) {
    throw new Error(`${SOUNDS_PATH}: sound_definitions boş — biçim değişmiş olabilir`);
  }

  const musicText = await fetchText(`${BEDROCK_SAMPLES_RAW}/${MUSIC_PATH}`);
  await writeIfChanged(join(rawDir, "music_definitions.json"), musicText);
  // Bu dosyada sarmalayıcı anahtar YOK: kök anahtarların kendisi olay adları
  // ("cherry_grove", "menu"). sound_definitions.json ile aynı biçimde
  // olduğunu varsaymak boş liste üretirdi — ölçülerek görüldü (02-09-2026).
  const music = Object.keys(JSON.parse(musicText) as Record<string, unknown>).sort();

  // --- loot ve trade tablo yolları ---
  const lootTables = pathsUnder(tree, LOOT_PREFIX, "behavior_pack/");
  const tradeTables = pathsUnder(tree, TRADING_PREFIX, "behavior_pack/");
  if (lootTables.length === 0 || tradeTables.length === 0) {
    throw new Error("loot_tables veya trading altında dosya yok — yol değişmiş olabilir");
  }

  const references: ReferenceIndex = { sounds, music, lootTables, tradeTables };
  if (await writeIfChanged(join(outDir, REFERENCES_FILE), toJson(references))) {
    changed.push(REFERENCES_FILE);
  }

  return {
    particles: particles.length,
    sounds: sounds.length,
    music: music.length,
    lootTables: lootTables.length,
    tradeTables: tradeTables.length,
    changed,
  };
}

runIfMain(import.meta.url, async () => {
  const { version } = await resolveVersion();
  const result = await collectReferences(version);
  console.log(
    `referanslar -> data/${version}/ — ${result.particles} parçacık, ${result.sounds} ses, ` +
      `${result.music} müzik, ${result.lootTables} loot, ${result.tradeTables} trade tablosu` +
      ` (${result.changed.length} dosya güncellendi)`,
  );
});
