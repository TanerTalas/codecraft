/**
 * Molang ifadelerinde sorgu ve matematik fonksiyonu doğrulaması.
 *
 * NEDEN VAR: Molang, entity bileşenlerinde, animasyon ve render
 * denetleyicilerinde düz string olarak duruyor. JSON şeması stringin İÇİNE
 * bakmıyor, `tsc` de görmüyor — yani `query.is_babyy` yazan bir dosya
 * doğrulamanın her ayağından geçiyor ve oyunda sessizce çalışmıyor. Tam
 * olarak CodeCraft'ın var olma sebebi olan hata sınıfı.
 *
 * TAM BİR MOLANG AYRIŞTIRICISI DEĞİL ve olmaya çalışmıyor. Ölçtüğü iki şey
 * var, üçüncüsünü uydurmuyor:
 *
 *   1. `query.`/`q.` ve `math.` adları bu sürümde gerçekten var mı
 *   2. Argüman sayısı kaynağın verdiği min/max aralığında mı
 *
 * Operatör önceliği, tip uyumu, `->` zinciri, `loop`/`for_each` gövdesi
 * ölçülmüyor. Ölçülmemiş kural kodlanmıyor (CLAUDE.md).
 *
 * KAYNAKTAN OKUNAN İKİ KURAL (02-09-2026, metadata/doc_modules/molang.json):
 *
 *   - **Büyük/küçük harfe duyarsız.** "All things in Molang are
 *     case-INsensitive, with the exception of strings". Karşılaştırma bu
 *     yüzden küçük harf üzerinden yapılıyor.
 *   - **Takma adlar var:** `q.` → `query.`, `v.` → `variable.`,
 *     `t.` → `temp.`, `c.` → `context.` ("Aliases" → "Alias Mapping").
 *     `q.is_baby` geçerli bir ifade; çözülmeseydi doğrulayıcı her birine
 *     uydurma hata üretirdi.
 *
 * `variable.`/`temp.`/`context.` ve takma adları DOĞRULANMIYOR: adları
 * kullanıcı tanımlı, kapalı bir küme yok. Onlara "bilinmiyor" demek uydurma
 * hata olurdu.
 *
 * HEPSİ WARNING, HİÇBİRİ ERROR — ve bu bilinçli. Bu sınıf henüz gerçek oyunda
 * ölçülmedi (docs/VALIDATION-LIMITS.md'deki A-E sınıflarının hepsinin
 * ContentLog kanıtı var, bunun yok). Ayrıca veri sürümü kurulu oyunun
 * gerisinde kalabiliyor (docs/SOURCES.md, "Çekme notları"): yeni eklenmiş bir
 * sorguya "yok" demek yanlış pozitif olurdu ve yanlış pozitif bu depoda
 * pahalı sayılıyor — aracın kendi hataları modele "bu aracın hatalarını yok
 * say" öğretiyor (docs/VALIDATION-LIMITS.md C, 01-09-2026).
 *
 * Error'a yükseltmek için gereken şey belli: oyunda bir ölçüm.
 */
import { molangIndex, type MolangEntry, type MolangIndex } from "@codecraft/knowledge";

/** Doğrulanan iki namespace. Diğerleri kullanıcı tanımlı, kapalı küme yok. */
const NAMESPACE: Readonly<Record<string, "queries" | "math">> = {
  query: "queries",
  q: "queries",
  math: "math",
};

/**
 * Bir çağrının kaynak metindeki hâli.
 *
 * `args` null ise parantez hiç yok. Molang'da argümansız sorgu parantezsiz
 * yazılıyor ("If a query function takes no arguments, do not use
 * parentheses" — doc_modules/molang.json, "Query Functions"), yani parantez
 * yokluğu sıfır argüman demek, eksik bilgi değil.
 */
export type MolangCall = {
  /** Kaynakta yazıldığı hâl: `q`, `query` ya da `math`. */
  prefix: string;
  /** Önek atılmış, küçük harfe indirilmiş ad. */
  name: string;
  /** Kaynakta yazıldığı hâl — mesajda bunu gösteriyoruz. */
  raw: string;
  args: number;
  /** İfade içindeki başlangıç konumu. */
  index: number;
};

export type MolangFinding = {
  kind: "unknown-query" | "unknown-math" | "removed-query" | "arity";
  call: MolangCall;
  message: string;
};

export type MolangResult = {
  /** Bulgu yoksa true. Bulguların hepsi warning, bkz. dosya başlığı. */
  ok: boolean;
  findings: MolangFinding[];
  /** Bulunan bütün çağrılar — bulgu üretmeyenler dahil. */
  calls: MolangCall[];
};

export type MolangOptions = { version?: string; index?: MolangIndex };

/**
 * `math.max(1, q.life_time)` içindeki argümanları sayar.
 *
 * `from` açılış parantezinin konumu. Tek tırnaklı string'in içindeki virgül
 * ve parantez sayılmıyor — Molang'da string tek tırnaklı ve içinde virgül
 * geçebiliyor.
 *
 * Parantez kapanmadan metin biterse null döner: yarım bir ifadeye argüman
 * sayısı uydurmak yerine o çağrı atlanıyor.
 */
function countArgs(text: string, from: number): { args: number; end: number } | null {
  let depth = 0;
  let inString = false;
  let args = 0;
  let sawContent = false;

  for (let i = from; i < text.length; i++) {
    const char = text[i];

    if (inString) {
      if (char === "'") inString = false;
      continue;
    }
    if (char === "'") {
      inString = true;
      sawContent = true;
      continue;
    }

    if (char === "(" || char === "[") {
      depth += 1;
      continue;
    }
    if (char === ")" || char === "]") {
      depth -= 1;
      if (depth === 0) return { args: sawContent ? args + 1 : 0, end: i };
      continue;
    }
    if (char === "," && depth === 1) {
      args += 1;
      continue;
    }
    if (char !== undefined && char.trim() !== "") sawContent = true;
  }

  return null; // parantez kapanmadı
}

/**
 * İfadedeki `query.`/`q.`/`math.` çağrılarını bulur.
 *
 * `\b` öneki "faq.x" gibi metinlerin `q.` sanılmasını engelliyor: oradaki `q`
 * sözcük sınırında değil.
 */
export function scanMolang(expression: string): MolangCall[] {
  const pattern = /\b(query|q|math)\s*\.\s*([A-Za-z_][A-Za-z_0-9]*)/gi;
  const calls: MolangCall[] = [];

  for (const match of expression.matchAll(pattern)) {
    const prefix = (match[1] ?? "").toLowerCase();
    const name = (match[2] ?? "").toLowerCase();
    const index = match.index ?? 0;

    // Parantez varsa argümanları say, yoksa argümansız çağrı.
    const after = index + match[0].length;
    const rest = expression.slice(after);
    const paren = rest.search(/\S/);
    let args = 0;
    if (paren !== -1 && rest[paren] === "(") {
      const counted = countArgs(expression, after + paren);
      if (counted === null) continue; // yarım ifade, uydurma sayı üretme
      args = counted.args;
    }

    calls.push({ prefix, name, raw: match[0], args, index });
  }

  return calls;
}

/** `min`/`max` aralığını insan diline çevirir. */
function arityText(entry: MolangEntry): string {
  if (entry.max === undefined) return `en az ${entry.min}`;
  if (entry.max === entry.min) return `tam ${entry.min}`;
  return `${entry.min}-${entry.max}`;
}

/**
 * Bu ada en yakın birkaç isim.
 *
 * `checks.ts`'teki `nearestKeys` ile aynı gerekçe: "bu sorgu yok" demek
 * modele ne yazacağını söylemiyor. Parça bazlı eşleşme, skor eşitse
 * alfabetik — aynı girdi her koşuda aynı öneriyi versin.
 */
function nearestNames(name: string, pool: Iterable<string>, limit = 3): string[] {
  const parts = name.split("_").filter((part) => part.length > 2);
  if (parts.length === 0) return [];

  const scored: { name: string; score: number }[] = [];
  for (const candidate of pool) {
    const score = parts.filter((part) => candidate.includes(part)).length;
    if (score > 0) scored.push({ name: candidate, score });
  }
  scored.sort((a, b) => b.score - a.score || (a.name < b.name ? -1 : 1));
  return scored.slice(0, limit).map((entry) => entry.name);
}

/** Bir Molang ifadesini bu sürümün sorgu ve fonksiyon kümesine karşı ölçer. */
export async function validateMolang(
  expression: string,
  options: MolangOptions = {},
): Promise<MolangResult> {
  const calls = scanMolang(expression);
  if (calls.length === 0) return { ok: true, findings: [], calls };

  const index = options.index ?? (await molangIndex({ version: options.version }));
  const findings: MolangFinding[] = [];

  for (const call of calls) {
    const bucket = NAMESPACE[call.prefix];
    if (bucket === undefined) continue;

    const table = index[bucket];
    const entry = table[call.name];

    if (entry === undefined) {
      const near = nearestNames(call.name, Object.keys(table));
      const label = bucket === "math" ? "matematik fonksiyonu" : "sorgu";
      findings.push({
        kind: bucket === "math" ? "unknown-math" : "unknown-query",
        call,
        message:
          `${label} "${call.raw}" bu sürümde tanımlı değil` +
          (near.length === 0
            ? ""
            : `. Yakın adlar: ${near.map((n) => `${call.prefix}.${n}`).join(", ")}`),
      });
      continue;
    }

    if (entry.until !== undefined) {
      findings.push({
        kind: "removed-query",
        call,
        message: `"${call.raw}" ${entry.until} sürümünden sonra kaldırılmış`,
      });
    }

    const tooFew = call.args < entry.min;
    const tooMany = entry.max !== undefined && call.args > entry.max;
    if (tooFew || tooMany) {
      findings.push({
        kind: "arity",
        call,
        message:
          `"${call.raw}" ${arityText(entry)} argüman alır, ${call.args} verilmiş`,
      });
    }
  }

  return { ok: findings.length === 0, findings, calls };
}
