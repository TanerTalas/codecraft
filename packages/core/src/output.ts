/**
 * Model çıktı sözleşmesi.
 *
 * Yapılandırılmış çıktı kullanılıyor: serbest metinden kod blokları ayıklamak
 * kendi başına bir hata sınıfı üretir ve o sınıfın doğrulamayla hiç ilgisi yok.
 *
 * Şekil, evals/src/types.ts içindeki Generation ile birebir eşleşiyor — eval
 * üreticisi böylece ince kalıyor.
 *
 * Saf modül: ağ yok, dosya yok (CLAUDE.md, mimari kural 2).
 */
import { z } from "zod";

/** Paket içi yol biçimi. Ayraç posix, mutlak yol ve .. yok. */
const PACK_PATH = z
  .string()
  .min(1)
  .regex(
    /^(?!\/)(?!.*\.\.)[A-Za-z0-9_./-]+$/,
    "Paket köküne göreli bir yol olmalı: mutlak yol, '..' ve ters bölü kabul edilmiyor",
  );

export const generatedFileSchema = z.object({
  path: PACK_PATH,
  content: z.string(),
});

export const generationSchema = z.object({
  /**
   * Çıktının türü. evals/src/types.ts'deki EvalKind ile aynı küme:
   * script ve json bugün otomatik ölçülebiliyor, command ve python ölçülemiyor.
   */
  kind: z.enum(["script", "json", "command", "python"]),
  files: z.array(generatedFileSchema).min(1),
  /** Kullanıcıya gösterilecek kısa açıklama. Rapora ve terminale basılır. */
  notes: z.string().optional(),
});

export type GeneratedFile = z.infer<typeof generatedFileSchema>;
export type Generation = z.infer<typeof generationSchema>;

/** Modelin uyacağı dosya yerleşimi. Prompt ve doğrulama aynı metni kullanır. */
export const LAYOUT = [
  "Davranış paketi dosyaları BP/ altına: BP/manifest.json, BP/blocks/<ad>.json,",
  "BP/items/<ad>.json, BP/entities/<ad>.json, BP/recipes/<ad>.json,",
  "BP/features/<ad>.json, BP/feature_rules/<ad>.json, BP/spawn_rules/<ad>.json,",
  "BP/scripts/main.js",
  "Tek bir komut isteniyorsa: answer.txt (tek satır, başında / ile)",
  "Oyun dışından çalışan otomasyon script'i: automation/<ad>.py",
].join("\n");
