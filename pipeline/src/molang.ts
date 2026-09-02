/**
 * Mojang/bedrock-samples → data/<sürüm>/molang.json
 *
 * `metadata/molang_modules/mojang-molang-queries.json` Mojang'ın **makine
 * okunur** Molang tanımı: 315 sorgu ve 61 matematik fonksiyonu, her biri
 * argüman sayısı ve dönüş tipiyle.
 *
 * NEDEN VAR: Molang bugüne kadar hiç doğrulanmıyordu. Entity bileşenleri,
 * animasyon denetleyicileri ve render denetleyicileri Molang ifadelerini düz
 * string olarak taşıyor; JSON şeması bunların içine bakmıyor, `tsc` de görmez.
 * Yanlış yazılmış bir sorgu adı tam olarak CodeCraft'ın var olma sebebi olan
 * hata sınıfı: sessizce çalışmayan çıktı.
 *
 * Ham içerik pipeline/raw/ altında kalır ve git'e girmez — Minecraft EULA.
 * data/ altına türetilmiş indeks yazılır: açıklama metinleri atılır
 * (`commands.ts` ile aynı gerekçe, docs/SOURCES.md).
 *
 * Kaynaktan ölçülen üç şey (02-09-2026), üçü de doğrulayıcıyı etkiliyor:
 *
 * 1. Adlar `query.` ve `math.` önekli, başka önek yok. Küçük harfe
 *    indirildiğinde çakışma da yok (0 çakışma) — Molang zaten büyük/küçük
 *    harfe duyarsız (`metadata/doc_modules/molang.json`, "Case Sensitivity").
 * 2. `min_args` her kayıtta var; `max_args` 315 sorgunun 98'inde var.
 *    Yokluğu üst sınır olmadığı anlamına geliyor, min'e eşit olduğu değil —
 *    max taşıyan 98 kaydın 18'inde max != min, yani alan gerçekten üst sınır.
 * 3. `version_ranges` bazı sorgularda `last_version` taşıyor: o sorgu o
 *    sürümden sonra KALDIRILMIŞ. `until` alanı bunu saklıyor.
 */
import { join } from "node:path";

import { runIfMain } from "./lib/cli.ts";
import { fetchText } from "./lib/fetch.ts";
import { DATA_DIR, RAW_DIR } from "./lib/paths.ts";
import { toJson, writeIfChanged } from "./lib/fs.ts";
import { BEDROCK_SAMPLES_RAW, resolveVersion } from "./lib/version.ts";

const SOURCE_PATH = "metadata/molang_modules/mojang-molang-queries.json";
export const MOLANG_FILE = "molang.json";

/** Kaynaktaki ham şekil. Yalnızca okuduğumuz alanlar yazılı. */
type RawRange = { first_version?: string; last_version?: string; query_sets?: string[] };

type RawEntry = {
  name?: string;
  min_args?: number;
  max_args?: number;
  return_type?: string;
  version_ranges?: RawRange[];
};

type RawModule = {
  name?: string;
  module_type?: string;
  queries?: RawEntry[];
  math_functions?: RawEntry[];
};

/** Türetilen indeksin şekli. Doğrulayıcı bunu okur. */
export type MolangEntry = {
  /** En az kaç argüman. Kaynakta her kayıtta var. */
  min: number;
  /** En fazla kaç argüman. Yoksa üst sınır yok (değişken argümanlı). */
  max?: number;
  /** `float`, `bool`, `actor_array`… Matematik fonksiyonlarında yok. */
  returns?: string;
  /** `default`, `world_gen`, `tags`. Hangi bağlamda kullanılabildiği. */
  sets?: string[];
  /** Hangi sürümde geldiği. */
  since?: string;
  /** Doluysa sorgu bu sürümden sonra KALDIRILMIŞ. */
  until?: string;
};

export type MolangIndex = {
  /** Anahtar: `query.` öneki atılmış, küçük harfe indirilmiş ad. */
  queries: Record<string, MolangEntry>;
  /** Anahtar: `math.` öneki atılmış, küçük harfe indirilmiş ad. */
  math: Record<string, MolangEntry>;
};

/**
 * Molang'ın takma adları — `metadata/doc_modules/molang.json` → "Aliases" →
 * "Alias Mapping" tablosundan okundu (02-09-2026). Doğrulayıcı bunları
 * çözmezse `q.is_baby` yazan her geçerli ifadeyi "bilinmeyen sorgu" diye
 * raporlardı, yani uydurma hata üretirdi.
 *
 * Dört tanesinden yalnızca `query` bu indekste karşılığı olan namespace;
 * `variable`, `temp` ve `context` kullanıcı tanımlı, adları serbest.
 */
export const MOLANG_ALIASES: Readonly<Record<string, string>> = {
  c: "context",
  q: "query",
  t: "temp",
  v: "variable",
};

/** `query.above_top_solid` → `above_top_solid`. Önek yoksa hata. */
function stripPrefix(name: string, prefix: string, label: string): string {
  if (!name.startsWith(`${prefix}.`)) {
    throw new Error(`${label}: "${name}" beklenen "${prefix}." önekini taşımıyor — biçim değişmiş olabilir`);
  }
  return name.slice(prefix.length + 1).toLowerCase();
}

/**
 * Sürüm aralıklarını tek bir "ne zaman geldi / kaldırıldı mı" çiftine indirir.
 *
 * Bir sorgu birden fazla aralık taşıyabiliyor. Aralıklardan HERHANGİ BİRİ
 * `last_version` taşımıyorsa sorgu hâlâ geçerlidir — hepsinin bitmiş olması
 * gerekiyor ki "kaldırıldı" densin. Ters kurulsaydı hâlâ çalışan sorgulara
 * "kaldırıldı" denirdi.
 */
function toLifetime(ranges: readonly RawRange[]): { since?: string; until?: string; sets?: string[] } {
  const firsts = ranges.flatMap((range) => (range.first_version === undefined ? [] : [range.first_version]));
  const lasts = ranges.map((range) => range.last_version);
  const sets = [...new Set(ranges.flatMap((range) => range.query_sets ?? []))].sort();

  const out: { since?: string; until?: string; sets?: string[] } = {};
  if (firsts.length > 0) out.since = firsts.sort((a, b) => a.localeCompare(b, "en", { numeric: true }))[0];
  if (lasts.length > 0 && lasts.every((last) => last !== undefined)) {
    out.until = (lasts as string[]).sort((a, b) => b.localeCompare(a, "en", { numeric: true }))[0];
  }
  if (sets.length > 0) out.sets = sets;
  return out;
}

function toEntries(raw: readonly RawEntry[], prefix: string, label: string): Record<string, MolangEntry> {
  const out: Record<string, MolangEntry> = {};
  for (const entry of [...raw].sort((a, b) => ((a.name ?? "") < (b.name ?? "") ? -1 : 1))) {
    if (entry.name === undefined) throw new Error(`${label}: "name" alanı olmayan kayıt var`);
    if (entry.min_args === undefined) {
      throw new Error(`${label}: ${entry.name} "min_args" taşımıyor — biçim değişmiş olabilir`);
    }
    const key = stripPrefix(entry.name, prefix, label);
    if (out[key] !== undefined) throw new Error(`${label}: ${key} iki kez geçiyor`);

    const value: MolangEntry = { min: entry.min_args };
    if (entry.max_args !== undefined) value.max = entry.max_args;
    if (entry.return_type !== undefined) value.returns = entry.return_type;
    Object.assign(value, toLifetime(entry.version_ranges ?? []));
    out[key] = value;
  }
  return out;
}

export type MolangResult = {
  queries: number;
  math: number;
  /** Kaldırılmış sorgu sayısı — `until` taşıyanlar. */
  removed: number;
  changed: boolean;
};

export async function collectMolang(version: string): Promise<MolangResult> {
  const text = await fetchText(`${BEDROCK_SAMPLES_RAW}/${SOURCE_PATH}`);
  await writeIfChanged(join(RAW_DIR, "bedrock-samples", version, "mojang-molang-queries.json"), text);

  const module = JSON.parse(text) as RawModule;
  if (module.module_type !== "molang") {
    throw new Error(`${SOURCE_PATH}: module_type "${module.module_type}" — "molang" bekleniyordu`);
  }

  const index: MolangIndex = {
    queries: toEntries(module.queries ?? [], "query", "queries"),
    math: toEntries(module.math_functions ?? [], "math", "math_functions"),
  };

  if (Object.keys(index.queries).length === 0 || Object.keys(index.math).length === 0) {
    throw new Error(`${SOURCE_PATH}: sorgu veya matematik fonksiyonu boş çıktı — yol değişmiş olabilir`);
  }

  const changed = await writeIfChanged(join(DATA_DIR, version, MOLANG_FILE), toJson(index));
  return {
    queries: Object.keys(index.queries).length,
    math: Object.keys(index.math).length,
    removed: Object.values(index.queries).filter((entry) => entry.until !== undefined).length,
    changed,
  };
}

runIfMain(import.meta.url, async () => {
  const { version } = await resolveVersion();
  const result = await collectMolang(version);
  console.log(
    `molang -> data/${version}/${MOLANG_FILE} — ${result.queries} sorgu ` +
      `(${result.removed} kaldırılmış), ${result.math} matematik fonksiyonu, ` +
      `${result.changed ? "güncellendi" : "değişmedi"}`,
  );
});
