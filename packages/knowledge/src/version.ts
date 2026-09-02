/**
 * Sürüm çözümleme.
 *
 * Bedrock'ta beş ayrı sürüm biçimi dolaşıyor (CLAUDE.md). Burada konuşulan
 * her zaman oyun/veri sürümü: data/ altındaki klasör adı, 1.26.40.5 gibi.
 *
 * İstek üç parçalı da gelebilir: çağıran "1.26.40" der, klasör adı ise
 * 1.26.40.5 — arada dördüncü hane
 * var. Önek eşleşmesiyle çözülür, tahminle değil: 1.26.4 hiçbir şeye eşleşmez,
 * 1.26.40 sadece 1.26.40.x klasörlerine eşleşir.
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

import { DATA_DIR } from "./paths.ts";

const VERSION_DIR_RE = /^\d+\.\d+\.\d+(?:\.\d+)?$/;

/** index.json'ın okuduğumuz alanları. Pipeline daha fazlasını yazıyor. */
export type DataIndex = {
  version: string;
  minEngineVersion: [number, number, number];
  releaseDate: string | null;
  counts: Record<string, number>;
  sources: {
    blockception: {
      path: string;
      files: number;
      compiled: { path: string; map: string; files: number; missing: string[] };
    };
    scriptTypes: {
      path: string;
      modules: Record<string, { stable: string | null; beta: string | null }>;
    };
    /**
     * Ham şemalar git'te DEĞİL — pipeline/raw/ altında, .gitignore içinde
     * (02-09-2026, repo public yapıldı; EULA). Burada duran tek şey ondan
     * türetilen indeksin adı ve kaç dosyadan türetildiği.
     */
    mojangSchemas: { index: string; files: number };
    /**
     * Molang sorgu ve matematik fonksiyonu indeksi.
     *
     * Opsiyonel: bu adım eklenmeden önce üretilmiş sürüm klasörleri hâlâ
     * okunabilmeli.
     */
    molang?: { file: string; queries: number; math: number; removed: number };
    /**
     * Parçacık kimlikleri ve yol/nokta-adı taşıyan referans kümeleri.
     *
     * Opsiyonel: bu adım eklenmeden önce üretilmiş sürüm klasörleri hâlâ
     * okunabilmeli.
     */
    /**
     * Mojang dokümantasyonundan türetilen bileşen adları ve afterEvent sırası.
     * Opsiyonel: eski sürüm klasörleri hâlâ okunabilmeli.
     */
    components?: { file: string; counts: Record<string, number> };
    eventOrder?: { file: string; versions: number };
    references?: {
      particles: { file: string; count: number };
      file: string;
      sounds: number;
      music: number;
      lootTables: number;
      tradeTables: number;
    };
    /**
     * Mojang'ın makine okunur komut tanımından türetilen indeks.
     *
     * Opsiyonel: pipeline bu adımı kazanmadan önce üretilmiş sürüm klasörleri
     * hâlâ okunabilmeli, yoksa eski veriyle çalışan her şey kırılırdı.
     */
    commands?: {
      file: string;
      commands: number;
      overloads: number;
      enums: number;
      /** Enum tablosunda karşılığı olmayan, elle ayrıştırılan tipler. */
      structuralTypes: string[];
    };
  };
};

export type DataVersion = {
  /** data/ altındaki klasör adı: 1.26.40.5 */
  version: string;
  /** Klasörün mutlak yolu. */
  dir: string;
  index: DataIndex;
};

/**
 * data/ içindeki sürüm klasörleri, eskiden yeniye.
 * blockception/ gibi sürüm olmayan klasörler elenir.
 */
export async function listDataVersions(): Promise<string[]> {
  const entries = await readdir(DATA_DIR, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory() && VERSION_DIR_RE.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b, "en", { numeric: true }));
}

/** "1.26.40" -> "1.26.40.5" eşleşir; "1.26.4" -> eşleşmez. */
const isPrefixOf = (requested: string, candidate: string): boolean => {
  const parts = requested.split(".");
  const target = candidate.split(".");
  return parts.length <= target.length && parts.every((part, i) => part === target[i]);
};

const cache = new Map<string, DataVersion>();

/**
 * İstenen sürümü data/ içinden çözer. İstek verilmezse en yenisi seçilir.
 * Eşleşme yoksa hata: yakın bir sürüme düşmek yok (docs/SOURCES.md'nin
 * pipeline için koyduğu kuralın aynısı).
 */
export async function resolveVersion(requested?: string): Promise<DataVersion> {
  const versions = await listDataVersions();
  if (versions.length === 0) {
    throw new Error("data/ içinde hiç sürüm klasörü yok — pipeline koşmamış");
  }

  let version: string;
  if (requested === undefined) {
    version = versions.at(-1) as string;
  } else {
    if (!VERSION_DIR_RE.test(requested)) {
      throw new Error(
        `Geçersiz sürüm biçimi: "${requested}". Oyun sürümü bekleniyor ` +
          "(1.26.40 veya 1.26.40.5), pazarlama numarası değil (26.40).",
      );
    }
    const matches = versions.filter((candidate) => isPrefixOf(requested, candidate));
    if (matches.length === 0) {
      throw new Error(
        `Sürüm "${requested}" data/ içinde yok. Mevcut: ${versions.join(", ")}`,
      );
    }
    version = matches.at(-1) as string;
  }

  const cached = cache.get(version);
  if (cached !== undefined) return cached;

  const dir = join(DATA_DIR, version);
  const index = JSON.parse(await readFile(join(dir, "index.json"), "utf8")) as DataIndex;
  if (index.version !== version) {
    throw new Error(
      `data/${version}/index.json içindeki sürüm "${index.version}" — klasör adıyla uyuşmuyor`,
    );
  }

  const resolved: DataVersion = { version, dir, index };
  cache.set(version, resolved);
  return resolved;
}
