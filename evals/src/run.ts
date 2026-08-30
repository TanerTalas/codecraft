/**
 * npm run eval — Aşama 2.5'in bitiş kriteri.
 *
 * Vakaları bir üreticiye gönderir, çıktıları validator'dan ve ek kontrollerden
 * geçirir, tablo basar ve evals/output/ altına HTML + JSON rapor yazar.
 *
 *   npm run eval                       kayıtlı çıktılarla koşar
 *   npm run eval -- --case=chain-mining-01   tek vaka
 *   npm run eval -- --gate             kapı sağlanmazsa exit 1
 *
 * Varsayılan çıkış kodu 0: eval bir çalışma yüzeyi, blokaj değil. Kapıyı
 * ölçmek isteyen --gate verir.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { GATE_REQUIRED, loadCases } from "./cases.ts";
import { evaluateCase, failedCase } from "./evaluate.ts";
import { recordedGenerator } from "./generators/recorded.ts";
import { status, toHtml, toJson } from "./report.ts";
import type { CaseResult, EvalCase, Generator, RunResult } from "./types.ts";

const OUTPUT_DIR = fileURLToPath(new URL("../output/", import.meta.url));

/** Aşama 3 buraya "model" ekleyecek; runner değişmeyecek. */
const GENERATORS: Record<string, () => Generator> = {
  recorded: recordedGenerator,
};

type Options = { generator: string; gate: boolean; only: string | null };

function parseArgs(argv: readonly string[]): Options {
  const options: Options = { generator: "recorded", gate: false, only: null };

  for (const arg of argv) {
    if (arg === "--gate") {
      options.gate = true;
    } else if (arg.startsWith("--generator=")) {
      options.generator = arg.slice("--generator=".length);
    } else if (arg.startsWith("--case=")) {
      options.only = arg.slice("--case=".length);
    } else {
      // Bilinmeyen bayrak sessizce yok sayılmaz: --gate yerine --gates yazan
      // biri kapının koştuğunu sanırdı.
      throw new Error(`Bilinmeyen argüman: "${arg}"`);
    }
  }

  return options;
}

const MARK: Record<ReturnType<typeof status>, string> = {
  geçti: "+",
  düştü: "-",
  ölçülemedi: "?",
};

function printCase(result: CaseResult): void {
  const state = status(result);
  const columns = [
    `  ${MARK[state]}`,
    result.case.id.padEnd(24),
    result.case.kind.padEnd(8),
    state === "ölçülemedi" ? "doğrulayıcı yok" : `doğrulama:${result.validation ? "+" : "-"}`,
    state === "ölçülemedi" ? "" : `kontrol:${result.checks.ok ? "+" : "-"}`,
  ];
  console.log(columns.join(" ").trimEnd());

  if (state !== "düştü") return;

  if (result.failure !== undefined) console.log(`      ${result.failure}`);
  for (const file of result.files) {
    for (const error of file.errors.slice(0, 3)) {
      console.log(`      ${file.path}  ${error}`);
    }
  }
  for (const finding of result.checks.findings) {
    if (finding.severity !== "error") continue;
    console.log(`      [${finding.check}] ${finding.message}`);
  }
}

async function runList(generator: Generator, cases: readonly EvalCase[]): Promise<CaseResult[]> {
  const results: CaseResult[] = [];
  for (const testCase of cases) {
    try {
      results.push(await evaluateCase(testCase, await generator.generate(testCase)));
    } catch (error) {
      results.push(failedCase(testCase, error));
    }
    printCase(results[results.length - 1] as CaseResult);
  }
  return results;
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2));

  const factory = GENERATORS[options.generator];
  if (factory === undefined) {
    throw new Error(
      `Bilinmeyen üretici: "${options.generator}". Tanınanlar: ${Object.keys(GENERATORS).join(", ")}`,
    );
  }
  const generator = factory();

  const cases = await loadCases();
  const pick = (list: EvalCase[]): EvalCase[] =>
    options.only === null ? list : list.filter((testCase) => testCase.id === options.only);

  const core = pick(cases.core);
  const extra = pick(cases.extra);
  if (core.length === 0 && extra.length === 0) {
    throw new Error(`Vaka bulunamadı: "${options.only}"`);
  }

  console.log(`üretici: ${generator.name}`);
  console.log(`kaynak:  ${generator.provenance}\n`);

  console.log("çekirdek — geçiş kapısı");
  const coreResults = await runList(generator, core);

  let extraResults: CaseResult[] = [];
  if (extra.length > 0) {
    console.log("\nek liste — kapıya sayılmaz");
    extraResults = await runList(generator, extra);
  }

  const passed = coreResults.filter((result) => result.ok).length;
  const run: RunResult = {
    generator: { name: generator.name, provenance: generator.provenance },
    startedAt: new Date().toISOString(),
    core: coreResults,
    extra: extraResults,
    gate: { total: coreResults.length, passed, required: GATE_REQUIRED },
  };

  await mkdir(OUTPUT_DIR, { recursive: true });
  const html = join(OUTPUT_DIR, "report.html");
  const json = join(OUTPUT_DIR, "report.json");
  await writeFile(html, toHtml(run), "utf8");
  await writeFile(json, toJson(run), "utf8");

  const short = options.only !== null;
  console.log(
    `\nçekirdek: ${passed}/${coreResults.length} geçti` +
      (short ? "" : ` (kapı ${GATE_REQUIRED})`),
  );
  if (extraResults.length > 0) {
    const measured = extraResults.filter((result) => result.measured).length;
    console.log(`ek liste: ${extraResults.length} vakanın ${measured} tanesi ölçülebildi`);
  }
  console.log(`rapor:    ${html}`);

  if (!options.gate) return;
  if (short) {
    throw new Error("--gate tek vakayla anlamsız, kapı çekirdek listenin tamamını ölçer");
  }
  if (passed < GATE_REQUIRED) {
    console.log(`\nkapı kapalı: ${GATE_REQUIRED - passed} vaka eksik`);
    process.exitCode = 1;
  }
}

await main();
