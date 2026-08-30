/**
 * Sürüme kilitli bağlam toplama.
 *
 * Var olan lookup katmanından beslenir; yeni bir veri erişim yolu açılmaz
 * (@codecraft/knowledge ve @codecraft/validator zaten data/ üzerinde duruyor).
 * Vektör DB veya embedding yok — sürüm ve niyet belliyse hangi JSON'a
 * bakılacağı da belli (CLAUDE.md, "Yapılmayacaklar").
 *
 * Node'a bağlı olan tek üretim modülü burası ve review.ts. Döndürdüğü şey düz
 * veri: Aşama 4'te aynı nesne sunucudan gelecek, prompt.ts değişmeyecek
 * (CLAUDE.md, mimari kural 2).
 */
import { lookup, resolveVersion } from "@codecraft/knowledge";
import { listTypes, patternGuide, type PatternGuide } from "@codecraft/validator";

/** İstek metninde geçen bir kimliğin bu sürümdeki durumu. */
export type IdentityNote = {
  id: string;
  found: boolean;
  /** Hangi indekste bulundu: block · item · entity. Bulunamadıysa null. */
  kind: string | null;
};

export type Context = {
  /** data/ altındaki dört haneli sürüm: 1.26.40.5 */
  version: string;
  /** manifest'e yazılacak üç parçalı dizi: [1, 26, 40] */
  minEngineVersion: [number, number, number];
  /** format_version alanlarına yazılacak biçim: "1.26.40" */
  formatVersion: string;
  /** Modül adı -> kararlı sürüm. manifest dependencies buradan yazılır. */
  modules: Record<string, string>;
  /** Doğrulanabilen doküman tipleri (Blockception schema-map). */
  documentTypes: string[];
  /** Bilinen kalıplar — checks.ts ile aynı tablo. */
  patterns: PatternGuide[];
  /** İstekte geçen kimliklerin doğrulanmış durumu. Boş olabilir. */
  identities: IdentityNote[];
};

/** "codecraft:ruby" gibi namespace'li kimlikler. Metin içinde geçtiği hâliyle. */
const IDENTIFIER_RE = /\b[a-z][a-z0-9_]*:[a-z][a-z0-9_]*\b/g;

/**
 * İstekte açıkça yazılmış kimlikleri çıkarır ve lookup ile doğrular.
 *
 * Yalnızca minecraft: namespace'i aranır: başka bir namespace'i kullanıcının
 * kendi paketi tanımlayacak, onun "yok" olması hata değil.
 */
async function collectIdentities(request: string, version: string): Promise<IdentityNote[]> {
  const seen = new Set<string>();
  const notes: IdentityNote[] = [];

  for (const match of request.matchAll(IDENTIFIER_RE)) {
    const id = match[0];
    if (!id.startsWith("minecraft:") || seen.has(id)) continue;
    seen.add(id);
    const found = await lookup(id, { version });
    notes.push({ id, found: found.found, kind: found.kind });
  }

  return notes;
}

export type ContextOptions = {
  /** data/ içindeki sürüm. Verilmezse en yenisi. */
  version?: string;
};

export async function buildContext(
  request: string,
  options: ContextOptions = {},
): Promise<Context> {
  const { version, index } = await resolveVersion(options.version);

  const modules: Record<string, string> = {};
  for (const [name, available] of Object.entries(index.sources.scriptTypes.modules)) {
    if (available.stable !== null) modules[name] = available.stable;
  }

  return {
    version,
    minEngineVersion: index.minEngineVersion,
    formatVersion: index.minEngineVersion.join("."),
    modules,
    documentTypes: await listTypes(version),
    patterns: patternGuide(),
    identities: await collectIdentities(request, version),
  };
}
