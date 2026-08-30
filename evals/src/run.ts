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

import { CapacityError } from "@codecraft/core";

import { GATE_REQUIRED, loadCases } from "./cases.ts";
import { evaluateCase, failedCase } from "./evaluate.ts";
import { cachedGenerator, modelGenerator } from "./generators/model.ts";
import { recordedGenerator } from "./generators/recorded.ts";
import { fileValidated, status, toHtml, toJson } from "./report.ts";
import type { CaseResult, EvalCase, Generator, RunResult } from "./types.ts";

const OUTPUT_DIR = fileURLToPath(new URL("../output/", import.meta.url));

/**
 * Üreticiler. Arayüz Aşama 2.5'te takılabilir kurulmuştu; Aşama 3 yalnızca bu
 * tabloya iki satır ekledi, runner'ın geri kalanı değişmedi.
 *
 *   recorded  elle yazılmış kayıt — model çıktısı değil
 *   model     gerçek üretim döngüsü, istek harcar
 *   cached    son model koşusunun önbelleği, istek harcamaz
 */
const GENERATORS: Record<string, (options: Options) => Generator | Promise<Generator>> = {
  recorded: () => recordedGenerator(),
  model: (options) => modelGenerator({ reuse: options.reuse }),
  cached: () => cachedGenerator(),
};

/** Hangi listeler koşacak. Kapı yalnızca "core"u sayar. */
const LISTS = ["core", "extra", "all"] as const;
type ListName = (typeof LISTS)[number];

type Options = {
  generator: string;
  gate: boolean;
  only: string | null;
  reuse: boolean;
  list: ListName;
};

function parseArgs(argv: readonly string[]): Options {
  const options: Options = {
    generator: "recorded",
    gate: false,
    only: null,
    reuse: false,
    list: "all",
  };

  for (const arg of argv) {
    if (arg === "--gate") {
      options.gate = true;
    } else if (arg === "--reuse") {
      options.reuse = true;
    } else if (arg.startsWith("--generator=")) {
      options.generator = arg.slice("--generator=".length);
    } else if (arg.startsWith("--list=")) {
      const value = arg.slice("--list=".length);
      if (!LISTS.includes(value as ListName)) {
        throw new Error(`Bilinmeyen liste: "${value}". Tanınanlar: ${LISTS.join(", ")}`);
      }
      options.list = value as ListName;
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
    state === "ölçülemedi"
      ? "doğrulayıcı yok"
      : fileValidated(result)
        ? `doğrulama:${result.validation ? "+" : "-"}`
        : "doğrulama:yok",
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
      const failed = failedCase(testCase, error);
      // Limit hatası model başarısızlığı değil: ayrı işaretleniyor ki
      // skor yanlış okunmasın (ücretsiz kademede olağan bir durum).
      if (error instanceof CapacityError) failed.limited = true;
      results.push(failed);
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
  const generator = await factory(options);

  const cases = await loadCases();
  const pick = (list: EvalCase[]): EvalCase[] =>
    options.only === null ? list : list.filter((testCase) => testCase.id === options.only);

  // Ek liste kapıya sayılmıyor ama model üreticisinde istek harcıyor. Ücretsiz
  // kademede günlük kota model başına 20 istek, yani 4 ek vaka bütçenin
  // beşte biri — kapı ölçülürken --list=core ile atlanabilsin.
  const core = options.list === "extra" ? [] : pick(cases.core);
  const extra = options.list === "core" ? [] : pick(cases.extra);
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
  const limited = [...coreResults, ...extraResults].filter(
    (result) => result.limited === true,
  ).length;
  const run: RunResult = {
    generator: { name: generator.name, provenance: generator.provenance },
    startedAt: new Date().toISOString(),
    core: coreResults,
    extra: extraResults,
    gate: { total: coreResults.length, passed, required: GATE_REQUIRED },
    limited,
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
  if (limited > 0) {
    console.log(
      `limit:    ${limited} vaka istek limitinden tamamlanamadı — bu skor ` +
        "model başarımını göstermiyor, koşuyu tekrarla",
    );
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
