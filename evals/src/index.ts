// @codecraft/evals — Asama 2.5 (bkz. TODO.md)
//
// 20 istegi bir ureticiye gonderir, ciktilari validator'dan gecirir, tablo ve
// HTML rapor basar. Rapor evals/output/ altina yazilir, git'e girmez.
//
// Uretici takilabilir: 2.5'te elle yazilmis kayit, Asama 3'te model.

export { CASES_FILE, GATE_REQUIRED, MEASURABLE, loadCases } from "./cases.ts";
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
