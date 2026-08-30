/**
 * Model üreticisi — Aşama 3.
 *
 * Gövdesi @codecraft/core'un üretim döngüsü: yapılabilirlik, sürüme kilitli
 * prompt, model, normalize, doğrulama, tek retry. Yani eval ölçtüğü şeyi
 * ürünün kendi yolundan geçirerek ölçüyor; ayrı bir "eval yolu" yok.
 *
 * Runner'ın geri kalanı değişmedi — arayüz Aşama 2.5'te bunun için kurulmuştu.
 *
 * ## Neden sürdürülebilir bir önbellek var
 *
 * Ücretsiz kademe **gün başına, model başına 20 istek** veriyor (30-08-2026'da
 * ölçüldü: `GenerateRequestsPerDayPerProjectPerModel-FreeTier`, değer 20).
 * 24 vakalık kapı, retry'larla 24–48 istek demek — tek günde bitmiyor.
 *
 * Bu yüzden her üretim `evals/output/model/<vaka-id>/` altına, yanına bir
 * **parmak izi** ile yazılıyor. `--reuse` verildiğinde parmak izi tutan vakalar
 * modele hiç gitmiyor, kapı birkaç güne yayılabiliyor.
 *
 * Parmak izi kritik: model kimliği, sistem prompt'u ve isteğin tamamı. Prompt
 * değişirse önbellek kendiliğinden geçersiz olur. Onsuz, iyileştirilmiş bir
 * prompt'un skoru eski çıktılarla ölçülür ve rapor yalan söylerdi.
 */
import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { dirname, join, posix, sep } from "node:path";
import { fileURLToPath } from "node:url";

import {
  buildContext,
  buildSystemPrompt,
  createModel,
  generate,
  loadConfig,
  CapacityError,
  review,
  type Config,
  type Context,
} from "@codecraft/core";

import { recordedGenerator } from "./recorded.ts";
import type { EvalCase, GeneratedFile, Generation, Generator } from "../types.ts";

export const MODEL_CACHE_DIR = fileURLToPath(new URL("../../output/model/", import.meta.url));

/** Önbellek girdisinin yanındaki üstveri. Dosya adı nokta ile başlıyor ki
 * üretilen paket ağacıyla karışmasın ve okuyucu onu dosya sanmasın. */
const META_FILE = ".codecraft-cache.json";

/** Tek denemenin özeti. Dosya içeriği değil, ne olduğu. */
type AttemptRecord = {
  /** 1 tabanlı. 2 varsa retry koşmuş demektir. */
  number: number;
  /** Doğrulama geçti mi. */
  ok: boolean;
  /** Düştüyse modele geri verilen hata metni. Geçtiyse boş. */
  report: string;
};

type CacheMeta = {
  /** Hangi model üretti. */
  model: string;
  /** Model + sistem prompt'u + istek. Biri değişirse önbellek geçersiz. */
  fingerprint: string;
  generatedAt: string;
  /**
   * Deneme geçmişi.
   *
   * Sonuç dosyaları yalnızca SON denemeyi taşıyor, yani retry'ın koşup
   * koşmadığı çıktıdan anlaşılmıyordu. Ürünün genel modellerden farkı tam da o
   * döngü (docs/ROADMAP.md) ve arayüz onu göstermek zorunda (docs/UI.md), o
   * yüzden burada kayda geçiyor.
   *
   * Eski önbellek girdilerinde yok: o koşularda kaydedilmiyordu.
   */
  attempts?: AttemptRecord[];
};

const sha256 = (value: string): string =>
  createHash("sha256").update(value, "utf8").digest("hex").slice(0, 16);

/**
 * Aynı vakanın aynı koşulda üretilmiş olup olmadığını belirleyen imza.
 *
 * Kurduğu bağlamı da geri veriyor: `generate()` bağlamı parametre olarak
 * alıyor, yani aynı vaka için ikinci kez kurulmasına gerek yok.
 */
async function fingerprintOf(
  testCase: EvalCase,
  config: Config,
): Promise<{ fingerprint: string; context: Context }> {
  // Bağlam kurmak yerel dosya okumaktan ibaret, model çağrısı yok.
  const context = await buildContext(testCase.request, { version: testCase.version });
  const system = buildSystemPrompt(context);
  const fingerprint = sha256(
    [`${config.provider}/${config.model}`, testCase.version, testCase.request, system].join("\n\u0000"),
  );
  return { fingerprint, context };
}

const toRelative = (root: string, path: string): string =>
  path.slice(root.length + 1).split(sep).join(posix.sep);

async function readTree(root: string, dir: string, out: GeneratedFile[]): Promise<void> {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    if (entry.name === META_FILE) continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      await readTree(root, path, out);
      continue;
    }
    out.push({ path: toRelative(root, path), content: await readFile(path, "utf8") });
  }
}

/** Parmak izi tutuyorsa önbellekteki çıktı, tutmuyorsa null. */
async function readCache(
  testCase: EvalCase,
  fingerprint: string,
): Promise<Generation | null> {
  const root = join(MODEL_CACHE_DIR, testCase.id);
  let meta: CacheMeta;
  try {
    meta = JSON.parse(await readFile(join(root, META_FILE), "utf8")) as CacheMeta;
  } catch {
    return null;
  }
  if (meta.fingerprint !== fingerprint) return null;

  const files: GeneratedFile[] = [];
  await readTree(root, root, files);
  if (files.length === 0) return null;

  files.sort((a, b) => (a.path < b.path ? -1 : 1));
  return { files };
}

/**
 * Önbelleği yazar. **Önce klasörü siler.**
 *
 * Silmemek ölçümü bozuyordu: model bir koşuda `BP/entities/player.json`
 * üretip sonraki koşuda script-only bir çözüm verdiğinde, eski dosya klasörde
 * kalıyor ve oynatma ikisini birden okuyor — **hiç var olmamış bir paket**
 * doğrulanıyor.
 *
 * 30-08-2026'da tam olarak bu oldu: `no-fall-damage-01` üretildiği koşuda
 * geçti, önbellekten oynatıldığı koşuda düştü. Aynı doğrulayıcı, aynı girdi
 * sanılan farklı içerik.
 *
 * `core/pack.ts` içindeki `writePack` bunu baştan doğru yapıyordu ("bayat
 * dosya kalmasın"); aynı kural buraya uygulanmamıştı.
 */
async function writeCache(
  testCase: EvalCase,
  generation: Generation,
  meta: CacheMeta,
): Promise<void> {
  const root = join(MODEL_CACHE_DIR, testCase.id);
  await rm(root, { recursive: true, force: true });
  for (const file of generation.files) {
    const target = join(root, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }
  await writeFile(join(root, META_FILE), `${JSON.stringify(meta, null, 2)}\n`, "utf8");
}

export type ModelGeneratorOptions = {
  /**
   * Parmak izi tutan vakaları önbellekten oynat, modele gitme.
   *
   * Ücretsiz kademede kapıyı birkaç güne yaymanın tek yolu. Kapalıyken her
   * vaka gerçekten modele gider.
   */
  reuse?: boolean;
};

export async function modelGenerator(options: ModelGeneratorOptions = {}): Promise<Generator> {
  const config: Config = await loadConfig();
  const reuse = options.reuse === true;
  // Tembel: yapılabilirlik engelleyen vakalar anahtar gerektirmez.
  let model: ReturnType<typeof createModel> | null = null;
  const getModel = (): ReturnType<typeof createModel> => (model ??= createModel(config));

  return {
    name: "model",
    provenance:
      `model: ${config.provider}/${config.model}, codecraft üretim döngüsü ` +
      "(yapılabilirlik → prompt → model → doğrulama → tek retry)" +
      (reuse
        ? " · --reuse açık: model kimliği ve sistem prompt'u aynı kalan vakalar " +
          "önbellekten oynatıldı, o vakalarda yeni çağrı yapılmadı"
        : ""),

    async generate(testCase: EvalCase): Promise<Generation> {
      const { fingerprint, context } = await fingerprintOf(testCase, config);

      if (reuse) {
        const cached = await readCache(testCase, fingerprint);
        if (cached !== null) {
          console.log(`      (önbellekten, çağrı yapılmadı)`);
          return cached;
        }
      }

      // Hız sınırlaması burada değil, callModel içinde: sağlayıcının sınırı
      // İSTEK başına ve retry yapan bir vaka iki istek atıyor.
      const attempts: AttemptRecord[] = [];
      const result = await generate(testCase.request, {
        config,
        // İmza için zaten kuruldu; ikinci kez kurmak aynı dosyaları okurdu.
        context,
        model: getModel,
        review,
        onAttempt: (attempt) => {
          attempts.push({
            number: attempt.number,
            ok: attempt.review.ok,
            report: attempt.review.report,
          });
        },
      });

      if (result.status === "infeasible") {
        // Yapılabilirlik katmanı engelledi ve model hiç çağrılmadı. Bu bir
        // paket çıktısı değil; sessizce boş dönmek yerine cevabı metin olarak
        // veriyoruz. Önbelleğe yazılmıyor: zaten istek harcamıyor.
        return {
          files: [
            {
              path: "answer.txt",
              content: `${result.feasibility.reason}\n\n${result.feasibility.alternative}\n`,
            },
          ],
          notes: `yapılabilirlik: ${result.feasibility.category}`,
        };
      }

      const generation: Generation = {
        files: result.files,
        ...(result.notes === undefined ? {} : { notes: result.notes }),
      };
      await writeCache(testCase, generation, {
        model: `${config.provider}/${config.model}`,
        fingerprint,
        generatedAt: new Date().toISOString(),
        attempts,
      });
      return generation;
    },
  };
}

/**
 * Önbelleğe alınmış model çıktısını olduğu gibi oynatır. İstek harcamaz.
 *
 * `--reuse`'dan farkı: parmak izine bakmaz, ne varsa oynatır. Prompt
 * değiştikten sonra eski çıktıyı görmek istendiğinde işe yarar, kapı ölçümü
 * için değil.
 */
export function cachedGenerator(): Generator {
  return recordedGenerator(
    MODEL_CACHE_DIR,
    "önbelleğe alınmış model çıktısı (evals/output/model/) — yeni çağrı yapılmadı, " +
      "parmak izi DOĞRULANMADI: prompt o günden beri değişmiş olabilir",
    "cached",
  );
}

export { CapacityError };
