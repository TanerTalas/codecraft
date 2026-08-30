/**
 * Örnek çıktıları künyesiyle derler -> app/src/examples/examples.json
 *
 * NEDEN VAR: arayüzün `/ornekler` sayfası, anahtarı olmayan kullanıcının ürünü
 * çalışırken görmesi için (docs/UI.md). Ama gösterilecek veri hiçbir yerde
 * commit edilmiş hâlde durmuyordu:
 *
 *   evals/recorded/   elle yazıldı, model çıktısı DEĞİL, üstelik beşi bilerek
 *                     bozuk — kendi README'si söylüyor. Kullanılamaz.
 *   evals/output/     gerçek model çıktısı ama .gitignore'da.
 *
 * Bu script ikincisinden seçilmiş vakaları alıp künyeleriyle birlikte
 * commit edilebilir tek bir dosyaya yazıyor.
 *
 * KÜNYE ZORUNLU. docs/ROADMAP.md "skor her zaman model adıyla birlikte
 * kaydedilir" diyor; aynı kural buraya da geçerli. Örnek sayfası hangi modelin
 * hangi tarihte ürettiğini söylemek zorunda, yoksa elle yazılmış bir çıktıdan
 * ayırt edilemez.
 *
 * ROZET UYDURULMUYOR: her örnek, üretildiği gün ne dediğine bakılmaksızın
 * BUGÜNKÜ `review()`'dan geçiriliyor ve sonuç neyse o yazılıyor. Doğrulayıcı
 * sıkılaştığında eski bir örnek düşerse bunu görmek istiyoruz.
 */
import { readFile, readdir, mkdir, writeFile } from "node:fs/promises";
import { join, posix, sep } from "node:path";
import { fileURLToPath } from "node:url";

import { checkFeasibility, review, type Review } from "@codecraft/core";
import { resolveVersion } from "@codecraft/knowledge";

import { loadCases } from "./cases.ts";
import { MODEL_CACHE_DIR } from "./generators/model.ts";
import type { EvalCase, GeneratedFile } from "./types.ts";

const OUT_FILE = fileURLToPath(new URL("../../app/src/examples/examples.json", import.meta.url));
const META_FILE = ".codecraft-cache.json";

/**
 * Galeriye girecek vakalar, gösterilecek sırayla.
 *
 * Elle seçiliyor: hepsini basmak galeriyi birbirine benzer on iki script
 * vakasıyla doldururdu. Seçim çeşitliliğe göre — script, blok, item, tarif.
 */
const SHOWCASE = [
  "chain-mining-01",
  "custom-block-01",
  "custom-item-01",
  "no-fall-damage-01",
  "recipe-vanilla-01",
  // En sonda ve bilerek: tekrar deneme döngüsünü gösteren tek gerçek kayıt.
  // Birinci denemede ÜÇ ayrı hata vardı (fazla alan, geçersiz enum, olmayan
  // doku anahtarı), ikinci deneme üçünü de düzeltti ve geçti. Ürünün genel
  // modellerden farkı tam olarak bu döngü (docs/ROADMAP.md).
  "ore-gen-01",
] as const;

/**
 * Yapılabilirlik örneği. Model HİÇ çağrılmıyor, o yüzden önbellekte karşılığı
 * yok ve burada canlı üretiliyor — kota harcamıyor, uydurma da değil.
 */
const INFEASIBLE_REQUEST = "Fareme basılı tutmuş gibi otomatik kazsın";

/** Tek denemenin özeti — arayüz retry akışını bundan çiziyor. */
type AttemptRecord = {
  number: number;
  ok: boolean;
  report: string;
};

type Provenance = {
  /** "google/gemini-3.6-flash" · yapılabilirlik örneğinde null */
  model: string | null;
  /** ISO tarih. Model çağrılmadıysa null. */
  generatedAt: string | null;
  /**
   * Deneme geçmişi. İki kayıt varsa retry koşmuş.
   *
   * `null` "retry koşmadı" DEMEK DEĞİL — o koşuda kaydedilmemiş demek.
   * Arayüz ikisini karıştırmamalı (docs/UI.md, rozetin "ölçülemedi" hâliyle
   * aynı mantık).
   */
  attempts: AttemptRecord[] | null;
};

type Example = {
  id: string;
  request: string;
  kind: string;
  /** Kullanıcıya gösterilen üç parçalı oyun sürümü: 1.26.40 */
  version: string;
  provenance: Provenance;
  /** Rozetin hangi hâli gösterileceği. */
  status: "gecti" | "dustu" | "olculemedi" | "yapilamaz";
  files: GeneratedFile[];
  review: Review | null;
  /** Yalnızca yapılabilirlik örneğinde dolu. */
  feasibility: {
    category: string;
    reason: string;
    evidence: string;
    alternative: string;
  } | null;
};

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

async function readProvenance(dir: string): Promise<Provenance> {
  const raw = JSON.parse(await readFile(join(dir, META_FILE), "utf8")) as {
    model?: string;
    generatedAt?: string;
    attempts?: AttemptRecord[];
  };

  if (raw.model === undefined || raw.generatedAt === undefined) {
    // Künyesiz bir çıktı yayınlanmaz: elle yazılmış bir dosyadan ayırt
    // edilemez hâle gelir.
    throw new Error(`${dir}: künye eksik (model / generatedAt)`);
  }

  return {
    model: raw.model,
    generatedAt: raw.generatedAt,
    attempts: raw.attempts ?? null,
  };
}

const statusOf = (result: Review): Example["status"] =>
  !result.measured ? "olculemedi" : result.ok ? "gecti" : "dustu";

async function buildFromCache(testCase: EvalCase): Promise<Example> {
  const dir = join(MODEL_CACHE_DIR, testCase.id);

  const files: GeneratedFile[] = [];
  await readTree(dir, dir, files);
  if (files.length === 0) throw new Error(`${testCase.id}: önbellekte dosya yok`);

  const { version } = await resolveVersion(testCase.version);
  const result = await review(files, version);

  return {
    id: testCase.id,
    request: testCase.request,
    kind: testCase.kind,
    version: testCase.version,
    provenance: await readProvenance(dir),
    status: statusOf(result),
    files: files.sort((a, b) => (a.path < b.path ? -1 : 1)),
    review: result,
    feasibility: null,
  };
}

/** Yapılabilirlik kapısı: model kurulmuyor, anahtar bile gerekmiyor. */
function buildInfeasible(version: string): Example {
  const result = checkFeasibility(INFEASIBLE_REQUEST);
  if (!result.blocked) {
    // Kural değişmiş demektir; sessizce boş örnek yazmak yerine duruyoruz.
    throw new Error(`"${INFEASIBLE_REQUEST}" artık engellenmiyor — örnek geçersiz`);
  }

  return {
    id: "yapilamaz-girdi-simulasyonu",
    request: INFEASIBLE_REQUEST,
    kind: "yapilamaz",
    version,
    // Model hiç kurulmadı: yapılabilirlik kapısı önce koşuyor.
    provenance: { model: null, generatedAt: null, attempts: null },
    status: "yapilamaz",
    files: [],
    review: null,
    feasibility: {
      category: result.category,
      reason: result.reason,
      evidence: result.evidence,
      alternative: result.alternative,
    },
  };
}

export async function buildExamples(): Promise<Example[]> {
  const { core } = await loadCases();
  const byId = new Map(core.map((testCase) => [testCase.id, testCase]));

  const examples: Example[] = [];

  for (const id of SHOWCASE) {
    const testCase = byId.get(id);
    if (testCase === undefined) throw new Error(`${id}: cases.json içinde yok`);
    const example = await buildFromCache(testCase);
    const attempts = example.provenance.attempts;
    const deneme =
      attempts === null ? "deneme geçmişi yok" : `${attempts.length} deneme`;
    console.log(
      `  ${example.status.padEnd(11)} ${id.padEnd(20)} ${example.files.length} dosya  ` +
        `${deneme.padEnd(20)} ${example.provenance.model}`,
    );
    examples.push(example);
  }

  const version = examples[0]?.version ?? "1.26.40";
  const infeasible = buildInfeasible(version);
  console.log(`  ${infeasible.status.padEnd(11)} ${infeasible.id.padEnd(20)} model çağrılmadı`);
  examples.push(infeasible);

  return examples;
}

async function main(): Promise<void> {
  console.log(`önbellek: ${MODEL_CACHE_DIR}\n`);
  const examples = await buildExamples();

  const payload = {
    $aciklama:
      "Gerçek model çıktıları, künyeleriyle. evals/src/build-examples.ts üretiyor, " +
      "elle düzenlenmez. Rozetler bugünkü review() ile hesaplandı.",
    builtAt: new Date().toISOString(),
    examples,
  };

  await mkdir(join(OUT_FILE, ".."), { recursive: true });
  await writeFile(OUT_FILE, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  const passed = examples.filter((example) => example.status === "gecti").length;
  console.log(`\n${examples.length} örnek yazıldı (${passed} geçti) -> ${OUT_FILE}`);
}

await main();
