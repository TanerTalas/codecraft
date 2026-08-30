/**
 * CLI — ince kabuk. Bütün mantık bu paketin diğer modüllerinde
 * (CLAUDE.md, mimari kural 1).
 *
 *   npm run codecraft -- "Kırdığım bloğun komşularını da kırsın"
 *   npm run codecraft -- "..." --version=1.26.40 --out=./out/zincir --install
 *   npm run codecraft -- --models        anahtarın gördüğü modelleri listeler
 *
 * CLI ile başlamanın sebebi: çekirdek döngüyü arayüz yazmadan test edebilmek.
 */
import { join } from "node:path";

import { ROOT } from "@codecraft/knowledge";

import { loadConfig } from "./config.ts";
import { buildContext } from "./context.ts";
import { UserError } from "./errors.ts";
import { generate } from "./generate.ts";
import { createModel, listModels } from "./model.ts";
import { installPack, writePack } from "./pack.ts";
import { review } from "./review.ts";

type Options = {
  request: string | null;
  version: string | undefined;
  out: string | null;
  install: boolean;
  models: boolean;
};

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    request: null,
    version: undefined,
    out: null,
    install: false,
    models: false,
  };

  for (const arg of argv) {
    if (arg === "--install") options.install = true;
    else if (arg === "--models") options.models = true;
    else if (arg.startsWith("--version=")) options.version = arg.slice("--version=".length);
    else if (arg.startsWith("--out=")) options.out = arg.slice("--out=".length);
    else if (arg.startsWith("--")) {
      // Bilinmeyen bayrak sessizce yok sayılmaz: --instal yazan biri paketin
      // kurulduğunu sanırdı (evals/src/run.ts'deki aynı ilke).
      throw new UserError(`Bilinmeyen argüman: "${arg}"`);
    } else if (options.request === null) options.request = arg;
    else throw new UserError(`Fazladan argüman: "${arg}". İstek tek bir metin olmalı.`);
  }

  return options;
}

/** "Kırdığım bloğun komşuları" -> "kirdigim-blogun-komsulari" */
function slug(request: string): string {
  const map: Record<string, string> = {
    ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u",
  };
  return (
    request
      .toLowerCase()
      .replace(/[çğıöşü]/g, (char) => map[char] as string)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "paket"
  );
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));
  const config = await loadConfig();

  if (options.models) {
    const models = await listModels(config);
    console.log(`sağlayıcı: ${config.provider}`);
    console.log(`yapılandırmadaki model: ${config.model}\n`);
    for (const model of models) console.log(`  ${model}`);
    console.log(
      `\n${models.length} model. Seçtiğini codecraft.config.json içindeki ` +
        '"model" alanına yaz.',
    );
    return;
  }

  if (options.request === null) {
    throw new Error(
      'İstek verilmedi. Örnek:\n  npm run codecraft -- "Düşerken hasar almayayım"',
    );
  }

  const request = options.request;

  console.log(`model:   ${config.provider}/${config.model}`);
  console.log(`istek:   ${request}\n`);

  const result = await generate(request, {
    config,
    // Tembel: yapılabilirlik engellerse ne bağlam kurulur ne anahtar istenir.
    context: () => buildContext(request, { version: options.version }),
    model: () => createModel(config),
    review,
    onAttempt: (attempt) => {
      const state = attempt.review.ok ? "geçti" : "düştü";
      console.log(`deneme ${attempt.number}: ${state}`);
      for (const fix of attempt.fixes) {
        console.log(`  düzeltildi: ${fix.from} -> ${fix.to}`);
        console.log(`              ${fix.reason}`);
      }
      if (!attempt.review.ok) {
        for (const line of attempt.review.report.split("\n")) console.log(`  ${line}`);
      }
    },
  });

  if (result.status === "infeasible") {
    const { feasibility } = result;
    console.log(`Bu istek behavior pack script'i ile yapılamaz (${feasibility.category}).\n`);
    console.log(feasibility.reason);
    console.log(`\nKanıt: ${feasibility.evidence}`);
    console.log(`\nAlternatif: ${feasibility.alternative}`);
    // Yapılamayan bir istek hata değil, doğru cevap. Çıkış kodu 0.
    return;
  }

  console.log(`\nsürüm:   ${result.context.version}`);
  console.log(`deneme:  ${result.attempts.length}`);
  console.log(`sonuç:   ${result.ok ? "doğrulamadan geçti" : "doğrulamadan geçemedi"}`);

  for (const file of result.review.files) {
    console.log(`  ${file.ok ? "+" : "-"} ${file.path}  (${file.validator}: ${file.detail})`);
  }
  for (const finding of result.review.findings) {
    if (finding.severity !== "error") console.log(`  ! ${finding.check}: ${finding.message}`);
  }

  if (result.notes !== undefined) console.log(`\nnot: ${result.notes}`);

  const outDir = options.out ?? join(ROOT, "out", slug(options.request));
  await writePack(outDir, result.files);
  console.log(`\nyazıldı: ${outDir}`);

  if (options.install) {
    const hasPack = result.files.some((file) => file.path.startsWith("BP/"));
    if (!hasPack) {
      console.log("kurulmadı: çıktıda BP/ klasörü yok, kurulacak bir paket üretilmedi");
    } else {
      console.log(`kuruldu: ${await installPack(outDir, `codecraft-${slug(options.request)}`)}`);
    }
  } else {
    console.log("oyuna kurmak için: --install");
  }

  if (!result.ok) process.exitCode = 1;
}

try {
  await main();
} catch (error) {
  // Beklenen, eyleme dönük hatalar sade basılır: yığın izi talimatı gömer.
  // Geri kalan her şey olduğu gibi yükselir ki gerçek kusurlar saklanmasın.
  if (error instanceof UserError) {
    console.error(error.message);
    process.exitCode = 1;
  } else {
    throw error;
  }
}
