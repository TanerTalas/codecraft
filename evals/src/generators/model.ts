/**
 * Model üreticisi — Aşama 3.
 *
 * Gövdesi @codecraft/core'un üretim döngüsü: yapılabilirlik, sürüme kilitli
 * prompt, model, normalize, doğrulama, tek retry. Yani eval ölçtüğü şeyi
 * ürünün kendi yolundan geçirerek ölçüyor; ayrı bir "eval yolu" yok.
 *
 * Runner'ın geri kalanı değişmedi — arayüz Aşama 2.5'te bunun için kurulmuştu.
 *
 * Her üretim evals/output/model/<vaka-id>/ altına yazılır. Sonraki koşular
 * `--generator=cached` ile o klasörü oynatır ve hiç istek harcamaz; ücretsiz
 * kademede bu konfor değil, koşulabilirlik şartı.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  createModel,
  generate,
  loadConfig,
  RateLimitError,
  review,
  type Config,
} from "@codecraft/core";

import { recordedGenerator } from "./recorded.ts";
import type { EvalCase, Generation, Generator } from "../types.ts";

export const MODEL_CACHE_DIR = fileURLToPath(new URL("../../output/model/", import.meta.url));

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

async function writeCache(testCase: EvalCase, generation: Generation): Promise<void> {
  for (const file of generation.files) {
    const target = join(MODEL_CACHE_DIR, testCase.id, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }
}

export async function modelGenerator(): Promise<Generator> {
  const config: Config = await loadConfig();
  const model = createModel(config);
  let first = true;

  return {
    name: "model",
    provenance:
      `model: ${config.provider}/${config.model}, codecraft üretim döngüsü ` +
      "(yapılabilirlik → prompt → model → doğrulama → tek retry)",

    async generate(testCase: EvalCase): Promise<Generation> {
      // Vakalar arası bekleme: ücretsiz kademede dakikalık istek sınırı var.
      // SDK'nın geri çekilmesi limite GİRDİKTEN sonra devreye giriyor, bu ise
      // limite hiç girmemek için. İlk vakadan önce beklemek anlamsız.
      if (!first) await sleep(config.requestDelayMs);
      first = false;

      const result = await generate(testCase.request, {
        config,
        model,
        review,
        version: testCase.version,
      });

      if (result.status === "infeasible") {
        // Yapılabilirlik katmanı engelledi. Bu bir çıktı değil, o yüzden
        // vaka "ölçülemedi" tarafına düşsün diye tek bir metin dosyası
        // döndürülüyor — sessizce boş çıktı verilmiyor.
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
      await writeCache(testCase, generation);
      return generation;
    },
  };
}

/** Önbelleğe alınmış model çıktısını oynatır. İstek harcamaz. */
export function cachedGenerator(): Generator {
  return recordedGenerator(
    MODEL_CACHE_DIR,
    "önbelleğe alınmış model çıktısı (evals/output/model/) — yeni çağrı yapılmadı",
    "cached",
  );
}

export { RateLimitError };
