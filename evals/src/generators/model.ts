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
  CapacityError,
  review,
  type Config,
} from "@codecraft/core";

import { recordedGenerator } from "./recorded.ts";
import type { EvalCase, Generation, Generator } from "../types.ts";

export const MODEL_CACHE_DIR = fileURLToPath(new URL("../../output/model/", import.meta.url));

async function writeCache(testCase: EvalCase, generation: Generation): Promise<void> {
  for (const file of generation.files) {
    const target = join(MODEL_CACHE_DIR, testCase.id, file.path);
    await mkdir(dirname(target), { recursive: true });
    await writeFile(target, file.content, "utf8");
  }
}

export async function modelGenerator(): Promise<Generator> {
  const config: Config = await loadConfig();
  // Tembel: yapılabilirlik engelleyen vakalar anahtar gerektirmez.
  let model: ReturnType<typeof createModel> | null = null;
  const getModel = (): ReturnType<typeof createModel> => (model ??= createModel(config));

  return {
    name: "model",
    provenance:
      `model: ${config.provider}/${config.model}, codecraft üretim döngüsü ` +
      "(yapılabilirlik → prompt → model → doğrulama → tek retry)",

    async generate(testCase: EvalCase): Promise<Generation> {
      // Hız sınırlaması burada değil, callModel içinde: sağlayıcının sınırı
      // İSTEK başına ve retry yapan bir vaka iki istek atıyor. Vaka başına
      // beklemek ilk kapı koşusunda kotayı deldi (dakikada 20 istek).
      const result = await generate(testCase.request, {
        config,
        model: getModel,
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

export { CapacityError };
