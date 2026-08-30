/**
 * HTML ve JSON rapor.
 *
 * Tasarım yok (docs/ROADMAP.md), okunabilirlik var: uzun hata listeleri vaka
 * başına <details> içinde açılır, yoksa tablo ezilir. Bağımlılık ve derleme
 * adımı yok — tek self-contained dosya yazılır.
 *
 * JSON rapor makine okunur karşılığı: Aşama 3'te iki koşu arasındaki farkı
 * almak için.
 *
 * Rapor evals/output/ altına yazılır ve .gitignore içindedir — model cevapları
 * ve istek metinleri commit edilmez.
 */
import type { CaseResult, RunResult } from "./types.ts";

const escape = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");

/**
 * Şema veya tsc gerçekten koştu mu.
 *
 * "ölçüldü" ile "doğrulandı" ayrı: komut vakalarında hiçbir dosya
 * doğrulayıcıdan geçmiyor ama kimlik kontrolü koşuyor. İkisini birleştirmek
 * raporun "doğrulama:+" demesine ve olmayan bir doğrulamayı iddia etmesine
 * yol açardı.
 */
export const fileValidated = (result: CaseResult): boolean =>
  result.files.some((file) => file.validator !== "atlandı");

/** Vakanın tek kelimelik durumu — terminal ve HTML aynı kelimeleri kullanır. */
export function status(result: CaseResult): "geçti" | "düştü" | "ölçülemedi" {
  if (result.failure !== undefined) return "düştü";
  if (!result.measured) return "ölçülemedi";
  return result.ok ? "geçti" : "düştü";
}

function detailsHtml(result: CaseResult): string {
  const lines: string[] = [];

  if (result.failure !== undefined) {
    lines.push(`<p class="err">${escape(result.failure)}</p>`);
  }

  for (const file of result.files) {
    const mark = file.validator === "atlandı" ? "·" : file.ok ? "+" : "−";
    lines.push(
      `<p class="file">${mark} <code>${escape(file.path)}</code> ` +
        `<span class="dim">${escape(file.detail)}</span></p>`,
    );
    if (file.errors.length === 0) continue;
    lines.push(
      `<ul class="err">${file.errors.map((error) => `<li>${escape(error)}</li>`).join("")}</ul>`,
    );
  }

  for (const finding of result.checks.findings) {
    const cls = finding.severity === "error" ? "err" : "warn";
    lines.push(
      `<p class="${cls}">[${escape(finding.check)}] ` +
        `${escape(finding.path ?? "")} ${escape(finding.message)}<br>` +
        `<span class="dim">kanıt: ${escape(finding.evidence)}</span></p>`,
    );
  }

  if (lines.length === 0) lines.push('<p class="dim">bulgu yok</p>');
  return lines.join("\n");
}

function rowHtml(result: CaseResult): string {
  const state = status(result);
  const files = result.files.map((file) => file.path).join(", ") || "—";
  const checks = result.case.expect.checks.join(", ") || "—";

  return [
    `<tr class="${state === "geçti" ? "ok" : state === "düştü" ? "bad" : "skip"}">`,
    `<td><code>${escape(result.case.id)}</code></td>`,
    `<td>${escape(result.case.request)}</td>`,
    `<td>${escape(result.case.kind)}</td>`,
    `<td><span class="dim">${escape(files)}</span></td>`,
    `<td><span class="dim">${escape(checks)}</span></td>`,
    `<td>${state}</td>`,
    "</tr>",
    '<tr class="detail"><td colspan="6"><details><summary>ayrıntı</summary>',
    detailsHtml(result),
    "</details></td></tr>",
  ].join("\n");
}

const tableHtml = (title: string, results: CaseResult[]): string =>
  [
    `<h2>${escape(title)}</h2>`,
    "<table>",
    "<thead><tr><th>vaka</th><th>istek</th><th>tip</th><th>dosyalar</th><th>kontroller</th><th>sonuç</th></tr></thead>",
    "<tbody>",
    results.map(rowHtml).join("\n"),
    "</tbody></table>",
  ].join("\n");

const STYLE = `
body { font: 14px/1.5 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;
       margin: 2rem auto; max-width: 70rem; padding: 0 1rem; }
h1 { font-size: 1.3rem; margin-bottom: .2rem; }
h2 { font-size: 1.05rem; margin-top: 2rem; }
.head { color: #444; margin: 0 0 .2rem; }
.warnbox { background: #fffbe6; border: 1px solid #e6d48a; padding: .6rem .8rem;
           margin: 1rem 0; }
.score { font-size: 1.1rem; margin: 1rem 0; }
table { border-collapse: collapse; width: 100%; }
th, td { text-align: left; padding: .3rem .5rem; border-bottom: 1px solid #eee;
         vertical-align: top; }
th { border-bottom: 2px solid #ccc; }
tr.ok td:last-child { color: #1a7f37; }
tr.bad td:last-child { color: #b42318; }
tr.skip td:last-child { color: #8a6d00; }
tr.detail td { border-bottom: 2px solid #eee; }
summary { cursor: pointer; color: #555; }
.dim { color: #777; }
.err { color: #b42318; }
.warn { color: #8a6d00; }
.file { margin: .4rem 0 .1rem; }
ul { margin: .1rem 0 .4rem 1.2rem; padding: 0; }
code { background: #f4f4f4; padding: 0 .2rem; }
@media (prefers-color-scheme: dark) {
  body { background: #16181d; color: #e6e6e6; }
  .head, .dim, summary { color: #9aa0a6; }
  th, td { border-color: #2a2d33; }
  th { border-bottom-color: #444; }
  code { background: #24262c; }
  .warnbox { background: #2a2513; border-color: #5c5222; }
  tr.ok td:last-child { color: #57d97e; }
  tr.bad td:last-child { color: #ff7b72; }
  tr.skip td:last-child { color: #d8b32b; }
  .err { color: #ff7b72; }
  .warn { color: #d8b32b; }
}
`;

export function toHtml(run: RunResult): string {
  const { gate, generator } = run;

  return `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>CodeCraft eval raporu</title>
<style>${STYLE}</style>
</head>
<body>
<h1>CodeCraft eval raporu</h1>
<p class="head">üretici: <strong>${escape(generator.name)}</strong></p>
<p class="head">${escape(generator.provenance)}</p>
<p class="head">koşu: ${escape(run.startedAt)}</p>

<div class="warnbox">
Bu tablodaki çıktılar <strong>${escape(generator.provenance)}</strong>.
Kaynağı okumadan sonuçları model başarımı gibi yorumlama.
</div>

<p class="score">Geçiş kapısı: <strong>${gate.passed}/${gate.total}</strong>
geçti, gereken ${gate.required}
${gate.passed >= gate.required ? "— kapı açık" : `— ${gate.required - gate.passed} eksik`}</p>

${tableHtml("Çekirdek — geçiş kapısı", run.core)}
${run.extra.length > 0 ? tableHtml("Ek liste — kapıya sayılmaz", run.extra) : ""}

<p class="dim">Ölçüt ve gerekçe: docs/ROADMAP.md · doğrulamanın sınırları:
docs/VALIDATION-LIMITS.md</p>
</body>
</html>
`;
}

export const toJson = (run: RunResult): string => `${JSON.stringify(run, null, 2)}\n`;
