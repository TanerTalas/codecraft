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
import {
  listTypes,
  patternGuide,
  schemaFormatVersions,
  type PatternGuide,
} from "@codecraft/validator";

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
  /**
   * Oyun sürümünün üç parçalı metin hâli: "1.26.40".
   *
   * ADI ÖNEMLİ: bu `format_version` DEĞİL. İlk hâlinde `formatVersion`
   * deniyordu ve prompt'a "format_version her zaman 1.26.xx" diye geçti;
   * model uydu, şema reddetti (kapı koşusu, spawn-rule-01). İki kavram ayrı:
   * bu oyun sürümü, o dosya tipinin şema sürümü.
   */
  engineVersion: string;
  /** Modül adı -> kararlı sürüm. manifest dependencies buradan yazılır. */
  modules: Record<string, string>;
  /** Doğrulanabilen doküman tipleri (Blockception schema-map). */
  documentTypes: string[];
  /** Bilinen kalıplar — checks.ts ile aynı tablo. */
  patterns: PatternGuide[];
  /**
   * Doküman tipi -> kabul edilen `format_version` değerleri.
   *
   * İki kaynaktan birleşiyor: şemaların kısıtladıkları (veriden okunuyor) ve
   * gerçek oyunda yüklendiği ölçülmüş fixture değerleri. Şema çoğu tipte bu
   * alanı kısıtlamıyor, o yüzden ikincisi olmadan liste yarım kalırdı.
   */
  formatVersions: Record<string, string[]>;
  /** İstekte geçen kimliklerin doğrulanmış durumu. Boş olabilir. */
  identities: IdentityNote[];
};

/**
 * Gerçek oyunda yüklendiği ÖLÇÜLMÜŞ `format_version` değerleri.
 *
 * Şemaların çoğu bu alanı kısıtlamıyor, yani şemadan okunamıyor. Buradaki
 * değerler `packages/validator/test/fixtures/valid/` altındaki dosyalardan
 * geliyor ve o dosyalardan üretilen paket 30-08-2026'da Bedrock 1.26.45'e
 * yüklendi, oyun kabul etti (docs/VALIDATION-LIMITS.md "Nasıl ölçüldü").
 *
 * Yani tahmin değil, oyunda çalıştığı görülmüş değerler. Ölçülmemiş bir tip
 * buraya yazılmaz — model o tipte kendi bildiğini yazar ve şema karar verir.
 */
const MEASURED_FORMAT_VERSIONS: Record<string, string[]> = {
  "behavior/blocks/blocks": ["1.21.100"],
  "behavior/items/items": ["1.21.100"],
  "behavior/entities/entities": ["1.21.100"],
  "behavior/recipes/recipes": ["1.21.100"],
  "behavior/feature_rules/feature_rules": ["1.13.0"],
  "behavior/spawn_rules/spawn_rules": ["1.8.0"],
  "behavior/dialogue/dialogue": ["1.17.0"],
  "behavior/animation_controllers/animation_controllers": ["1.10.0"],
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

/**
 * Şemadan gelen kısıt ile ölçülmüş değerleri birleştirir.
 *
 * Şema bir tipi kısıtlıyorsa ölçülmüş değer o kümeye süzülür — ölçüm şemayı
 * daraltabilir, genişletemez. Şema kısıtlamıyorsa ölçülmüş değer olduğu gibi
 * geçer, çünkü tek kaynak o.
 */
function mergeFormatVersions(fromSchema: Record<string, string[]>): Record<string, string[]> {
  const out: Record<string, string[]> = { ...fromSchema };

  for (const [type, measured] of Object.entries(MEASURED_FORMAT_VERSIONS)) {
    const allowed = fromSchema[type];
    if (allowed === undefined) {
      out[type] = measured;
      continue;
    }
    const kept = measured.filter((value) => allowed.includes(value));
    if (kept.length > 0) out[type] = kept;
  }

  return out;
}

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
    engineVersion: index.minEngineVersion.join("."),
    modules,
    documentTypes: await listTypes(version),
    patterns: patternGuide(),
    // Şema kısıtı önce, ölçülmüş değer sonra: ölçüm şemayı daraltabilir ama
    // şemanın reddedeceği bir değeri asla eklememeli.
    formatVersions: mergeFormatVersions(await schemaFormatVersions(version)),
    identities: await collectIdentities(request, version),
  };
}
