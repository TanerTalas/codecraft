// @codecraft/evals — Asama 2.5 (bkz. TODO.md)
//
// Vakalari bir ureticiye gonderir, ciktilari validator'dan ve ek kontrollerden
// gecirir, tablo basar ve evals/output/ altina HTML + JSON rapor yazar.
// Rapor git'e girmez: model cevaplarini ve istek metinlerini icerir.
//
// Uretici takilabilir: 2.5'te elle yazilmis kayit, Asama 3'te model. Runner
// ikisini de ayni arayuzden gorur.

export { CASES_FILE, GATE_REQUIRED, MEASURABLE, loadCases } from "./cases.ts";
export { evaluateCase, failedCase } from "./evaluate.ts";
export { RECORDED_DIR, recordedGenerator } from "./generators/recorded.ts";
export { status, toHtml, toJson } from "./report.ts";
export type {
  CaseResult,
  EvalCase,
  EvalCases,
  EvalKind,
  FileResult,
  GeneratedFile,
  Generation,
  Generator,
  RunResult,
} from "./types.ts";
