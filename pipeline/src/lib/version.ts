/**
 * Sürüm tespiti. Kaynak: bedrock-samples kökündeki version.json (2 KB) —
 * repoyu klonlamaya gerek yok (docs/SOURCES.md).
 *
 * Bedrock'ta dört ayrı sürüm biçimi dolaşıyor (CLAUDE.md). Burada üretilen
 * her zaman oyun/veri sürümüdür: 1.26.40.5. Pazarlama numarası (26.40) değil.
 */
import { fetchJson } from "./fetch.ts";

export const BEDROCK_SAMPLES_REPO = "Mojang/bedrock-samples";
export const BEDROCK_SAMPLES_REF = "main";
export const BEDROCK_SAMPLES_RAW =
  `https://raw.githubusercontent.com/${BEDROCK_SAMPLES_REPO}/${BEDROCK_SAMPLES_REF}`;

/** Oyun sürümü beklenir (1.26.40.5). Pazarlama numarası (26.40) reddedilir. */
const VERSION_RE = /^\d+\.\d+\.\d+(?:\.\d+)?$/;

export type Version = { version: string; date: string | null };

export async function resolveVersion(): Promise<Version> {
  const parsed = await fetchJson<{ latest?: { version?: string; date?: string } }>(
    `${BEDROCK_SAMPLES_RAW}/version.json`,
  );
  const version = parsed.latest?.version;
  if (version === undefined) throw new Error("version.json içinde latest.version alanı yok");
  if (!VERSION_RE.test(version)) {
    throw new Error(
      `Beklenmeyen sürüm biçimi: "${version}". Oyun sürümü bekleniyor ` +
        "(1.26.40.5 gibi), pazarlama numarası değil (26.40).",
    );
  }
  return { version, date: parsed.latest?.date ?? null };
}

/** "1.26.40.5" -> [1, 26, 40]. manifest.json'daki min_engine_version biçimi. */
export function toMinEngineVersion(version: string): [number, number, number] {
  const [major, minor, patch] = version.split(".").map(Number);
  if (major === undefined || minor === undefined || patch === undefined) {
    throw new Error(`Sürüm üç parçaya ayrılamadı: "${version}"`);
  }
  return [major, minor, patch];
}

/** "1.26.40.5" -> "1.26.40". Sürüm notu dosya adları üç parçalı. */
export const toShortVersion = (version: string): string => toMinEngineVersion(version).join(".");
