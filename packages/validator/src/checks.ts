/**
 * Şemanın ve tsc'nin yapısal olarak yakalayamadığı kontroller.
 * Saf fonksiyonlar, model çağrısı yok (CLAUDE.md, mimari kural 3).
 *
 * Var olma sebebi ölçüm: 30-08-2026'da doğrulamayı geçmiş bir paket oyuna
 * yüklendi ve dört sınıf hata çıktı (docs/VALIDATION-LIMITS.md). Üçü burada
 * kontrol ediliyor:
 *
 *   checkIdentities  A · referans verilen kimlik gerçekten var mı
 *   checkFileNames   B · dosya adı ile içerik arasındaki kural
 *   checkPatterns    D · geçerli ama amaçlanmayan kod kalıpları
 *
 * C sınıfı (asset referansı) burada yok: kaynak paketi üretmek bir kapsam
 * kararı, doğrulama sorunu değil (docs/VALIDATION-LIMITS.md C).
 *
 * Hepsi `review_pack` tarafından çağrılır ve tek tek de kullanılabilir —
 * mantık tek yerde durur.
 */
import { basename } from "node:path";

import {
  lookup,
  lookupAny,
  molangIndex,
  normalizeId,
  componentIndex,
  referenceSet,
  textureKeys,
  type ComponentIndex,
  type ReferenceKind,
} from "@codecraft/knowledge";

import { validateMolang } from "./molang.ts";
import type { TextureAtlas } from "@codecraft/knowledge";

/** Üretilen paketin tek dosyası. path paket köküne göreli: "recipes/ruby.json". */
export type PackFile = {
  path: string;
  content: string;
};

export type Finding = {
  /** Hangi kontrol: "identity" · "filename" · "pattern:<ad>" */
  check: string;
  /** error sonucu düşürür, warning düşürmez. */
  severity: "error" | "warning";
  /** Bulgunun çıktığı paket içi dosya yolu. */
  path?: string;
  message: string;
  /** Kuralın kanıtı — hangi ölçüme dayanıyor. */
  evidence: string;
};

export type CheckResult = {
  ok: boolean;
  findings: Finding[];
};

const LIMITS = "docs/VALIDATION-LIMITS.md";

const toResult = (findings: Finding[]): CheckResult => ({
  ok: findings.every((finding) => finding.severity !== "error"),
  findings,
});

// --------------------------------------------------------------------------
// A · kimlik referansları
// --------------------------------------------------------------------------

/**
 * Kimlik kümeleri ayrı tutulur çünkü aynı metin farklı kümelerde farklı şey
 * demek: "codecraft:ruby_block" hem tarifin kendi kimliği hem de tarifin
 * sonucundaki item olabilir, ve tarifin kimliği item'ı var etmez. Oyun tam
 * bu yüzden hata verdi (docs/VALIDATION-LIMITS.md A).
 */
type DeclaredKind = "thing" | "feature" | "recipe";

/** Referansın hangi kümede aranacağı. */
type RefKind = "thing" | "entity" | "feature";

type Reference = {
  id: string;
  kind: RefKind;
  path: string;
  /** Referansın JSON içindeki yeri, hata mesajında gösterilir. */
  where: string;
};

/** Root anahtarı -> ne tanımlıyor. */
const DECLARES: Record<string, DeclaredKind> = {
  "minecraft:block": "thing",
  "minecraft:item": "thing",
  "minecraft:entity": "thing",
};

/**
 * Feature dosyalarının root anahtarı sabit değil, tipine göre değişiyor
 * (minecraft:ore_feature, minecraft:scatter_feature, minecraft:aggregate_feature…).
 * feature_rules bunun dışında: o bir kural, feature değil.
 */
const isFeatureRoot = (key: string): boolean =>
  key.startsWith("minecraft:") && key.endsWith("_feature") && key !== "minecraft:feature_rules";

const isRecipeRoot = (key: string): boolean => key.startsWith("minecraft:recipe_");

type JsonObject = Record<string, unknown>;

const asObject = (value: unknown): JsonObject | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as JsonObject)
    : null;

const asString = (value: unknown): string | null => (typeof value === "string" ? value : null);

/** "minecraft:planks:2" -> "minecraft:planks". İki parçalıysa dokunulmaz. */
function trimData(id: string): string {
  const parts = id.split(":");
  return parts.length > 2 ? parts.slice(0, 2).join(":") : id;
}

/**
 * Item referansı üç biçimde geliyor: düz metin, {item}, ya da ikisinin dizisi.
 * {tag: …} atlanıyor — etiket indeksimiz yok, uydurma kontrol yapılmaz.
 *
 * Eski biçim "minecraft:planks:2" gibi veri değeri de taşıyabiliyor; üçüncü
 * parça atılır, kimlik ilk iki parçadır.
 */
function collectItemIds(value: unknown, where: string, out: { id: string; where: string }[]): void {
  if (Array.isArray(value)) {
    value.forEach((entry, i) => collectItemIds(entry, `${where}/${i}`, out));
    return;
  }

  const direct = asString(value);
  if (direct !== null) {
    out.push({ id: trimData(direct), where });
    return;
  }

  const object = asObject(value);
  if (object === null) return;
  if (object["tag"] !== undefined) return;

  const item = asString(object["item"]);
  if (item !== null) out.push({ id: trimData(item), where: `${where}/item` });
}

/**
 * Bir tarif dosyasının referans verdiği item'lar. Alan adları tarif tipine göre
 * değişiyor: shaped "key", shapeless "ingredients", furnace "input"/"output",
 * brewing ayrıca "reagent".
 */
function collectRecipeRefs(body: JsonObject, root: string, path: string, out: Reference[]): void {
  const push = (value: unknown, field: string): void => {
    const found: { id: string; where: string }[] = [];
    collectItemIds(value, `/${root}/${field}`, found);
    for (const { id, where } of found) out.push({ id, kind: "thing", path, where });
  };

  push(body["result"], "result");
  push(body["ingredients"], "ingredients");
  push(body["input"], "input");
  push(body["output"], "output");
  push(body["reagent"], "reagent");

  const key = asObject(body["key"]);
  if (key !== null) {
    for (const [slot, value] of Object.entries(key)) push(value, `key/${slot}`);
  }
}

type ParsedFile = { file: PackFile; root: string; body: JsonObject };
type ParsedDocument = { file: PackFile; value: unknown };

/**
 * JSON dosyalarını ayrıştırır ve dosyanın TAMAMINI verir.
 *
 * `parseJsonFiles` bunun üstüne kök anahtarlara bölüyor; kimlik ve doku
 * kontrolleri öyle çalışıyor. Molang kontrolü ise bölünmemiş belgeye ihtiyaç
 * duyuyor: bir Molang ifadesi kökte duran bir string olabilir ve kök
 * anahtarlara bölme onu düşürürdü (02-09-2026'da test yakaladı).
 */
function parseJsonDocuments(files: readonly PackFile[]): {
  documents: ParsedDocument[];
  findings: Finding[];
} {
  const documents: ParsedDocument[] = [];
  const findings: Finding[] = [];

  for (const file of files) {
    if (!file.path.endsWith(".json")) continue;

    try {
      documents.push({ file, value: JSON.parse(file.content) });
    } catch {
      findings.push({
        check: "identity",
        severity: "warning",
        path: file.path,
        message: "JSON could not be parsed, so this check did not run on the file",
        evidence: "validateJson reports the same error in detail",
      });
    }
  }

  return { documents, findings };
}

/** JSON dosyalarını kök anahtarlarına böler. Ayrıştırılamayan uyarı üretir. */
function parseJsonFiles(files: readonly PackFile[]): {
  parsed: ParsedFile[];
  findings: Finding[];
} {
  const { documents, findings } = parseJsonDocuments(files);
  const parsed: ParsedFile[] = [];

  for (const { file, value } of documents) {
    const object = asObject(value);
    if (object === null) continue;

    for (const [root, body] of Object.entries(object)) {
      const bodyObject = asObject(body);
      if (bodyObject !== null) parsed.push({ file, root, body: bodyObject });
    }
  }

  return { parsed, findings };
}

const identifierOf = (body: JsonObject): string | null =>
  asString(asObject(body["description"])?.["identifier"]);

export type IdentityOptions = {
  /** data/ içindeki sürüm. Verilmezse en yenisi. */
  version?: string;
};

/**
 * A sınıfı: referans verilen kimlik gerçekten var mı.
 *
 * İki kaynak var ve ikisi de kesin:
 *
 *   Paketin kendi tanımladıkları  Dosyalardan çıkarılır, tam liste.
 *   Vanilla kimlikler             data/<sürüm>/ indeksleri, lookup ile.
 *
 * Kural namespace'e göre ayrılıyor çünkü kesinlik oradan geliyor:
 *
 *   minecraft: dışı namespace  Onu ancak paketin kendisi tanımlayabilir.
 *                              Tanımlı değilse kesinlikle hata.
 *   minecraft: namespace'i     blok/item/entity indeksleri tam, lookup karar verir.
 *
 * Tek boşluk vanilla feature'lar: data/<sürüm>/features.json yapı (structure)
 * feature'larını tutuyor (17 kayıt), ore/scatter gibi yerleştirme feature'larını
 * değil. O yüzden "minecraft:" namespace'li bir places_feature doğrulanamıyor ve
 * uyarı olarak raporlanıyor — sessizce geçilmiyor.
 */
export async function checkIdentities(
  files: readonly PackFile[],
  options: IdentityOptions = {},
): Promise<CheckResult> {
  const { parsed, findings } = parseJsonFiles(files);

  const declared: Record<DeclaredKind, Set<string>> = {
    thing: new Set(),
    feature: new Set(),
    recipe: new Set(),
  };
  const references: Reference[] = [];

  for (const { file, root, body } of parsed) {
    const declaredKind = DECLARES[root] ?? (isFeatureRoot(root) ? "feature" : null);
    if (declaredKind !== null) {
      const id = identifierOf(body);
      if (id !== null) declared[declaredKind].add(normalizeId(id));
      continue;
    }

    if (isRecipeRoot(root)) {
      const id = identifierOf(body);
      if (id !== null) declared.recipe.add(normalizeId(id));
      collectRecipeRefs(body, root, file.path, references);
      continue;
    }

    if (root === "minecraft:spawn_rules") {
      // Spawn kuralının identifier'ı kendi kimliği değil, kural yazdığı
      // entity'nin kimliği. Var olmayan bir entity'ye kural yazılamaz.
      const id = identifierOf(body);
      if (id !== null) {
        references.push({
          id,
          kind: "entity",
          path: file.path,
          where: `/${root}/description/identifier`,
        });
      }
      continue;
    }

    if (root === "minecraft:feature_rules") {
      const places = asString(asObject(body["description"])?.["places_feature"]);
      if (places !== null) {
        references.push({
          id: places,
          kind: "feature",
          path: file.path,
          where: `/${root}/description/places_feature`,
        });
      }
    }
  }

  for (const reference of references) {
    const id = normalizeId(reference.id);
    const custom = !id.startsWith("minecraft:");

    if (reference.kind === "feature") {
      if (declared.feature.has(id)) continue;
      findings.push({
        check: "identity",
        severity: custom ? "error" : "warning",
        path: reference.path,
        message: custom
          ? `${reference.where}: "${id}" is not defined in any feature file`
          : `${reference.where}: "${id}" could not be verified — the vanilla feature index is incomplete`,
        evidence: `${LIMITS} · A ("No definition found for feature")`,
      });
      continue;
    }

    if (declared.thing.has(id)) continue;

    if (custom) {
      findings.push({
        check: "identity",
        severity: "error",
        path: reference.path,
        message:
          `${reference.where}: "${id}" is not defined in this pack. ` +
          "An identifier outside the minecraft: namespace can only be defined by the pack itself",
        evidence: `${LIMITS} · A ("The Item … is missing or invalid")`,
      });
      continue;
    }

    const found = await lookup(id, {
      version: options.version,
      ...(reference.kind === "entity" ? { kind: "entity" as const } : {}),
    });
    if (found.found) continue;

    findings.push({
      check: "identity",
      severity: "error",
      path: reference.path,
      message: `${reference.where}: "${id}" does not exist in version ${found.version}`,
      evidence: `${LIMITS} · A`,
    });
  }

  return toResult(findings);
}

// --------------------------------------------------------------------------
// B · dosya adı ile içerik arasındaki kurallar
// --------------------------------------------------------------------------

/**
 * B sınıfı: hiçbir JSON şemasının yakalayamayacağı kural türü — şema dosyanın
 * içeriğini görür, adını görmez.
 *
 * Burada YALNIZCA kanıtı olan kural kodlanıyor. Feature rule dosyasının adının
 * identifier'ın namespace'siz hâline eşit olması gerektiği 30-08-2026'da oyunda
 * ölçüldü: oyun reddetti, dosya adı düzeltilince hata kayboldu
 * (docs/VALIDATION-LIMITS.md B).
 *
 * Başka dosya tipleri için benzer kurallar olabilir ama ölçülmedi. Ölçülmemiş
 * kural buraya yazılmaz — bu aracın var olma sebebi tam olarak tahmine dayalı
 * çıktı üretmemek.
 */
/**
 * E sınıfı: şemadan geçen ama oyunun yüklemediği manifest.
 *
 * **30-08-2026'da gerçek oyunda ölçüldü.** Model şunu üretti:
 *
 *   { "type": "javascript", "entry": "scripts/main.js" }
 *
 * Şema bunu kabul etti — modül tipi listesinde `javascript` VAR
 * (`["resources","data","client_data","interface","world_template",
 * "javascript","script"]`) ve uydurma bir tip reddediliyor, yani şema
 * gerçekten bakıyor. Ama oyun paketi hiç göstermedi: davranış paketleri
 * listesinde çıkmadı.
 *
 * Tek şey değiştirilip yeniden bakıldı — `type: "script"` +
 * `language: "javascript"` — ve paket göründü, script çalıştı. Yani sebep
 * kesinleşti, tahmin değil.
 *
 * `javascript` 1.16 öncesinden kalma bir tip. Blockception geriye dönük
 * uyumluluk için listede tutuyor; `@minecraft/server` 2.x ile çalışmıyor.
 *
 * Bu kontrol ÖLÇÜYOR, düzeltmiyor: doğru tipi bulguda söylüyor ve düzeltmeyi
 * çağırana bırakıyor — checkFileNames ile aynı düzen.
 */
export function checkManifest(files: readonly PackFile[]): CheckResult {
  const findings: Finding[] = [];

  for (const file of files) {
    if (!file.path.endsWith("manifest.json")) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(file.content);
    } catch {
      continue; // validateJson bunu ayrıntısıyla raporluyor
    }

    const modules = asObject(parsed)?.["modules"];
    if (!Array.isArray(modules)) continue;

    for (const [i, entry] of modules.entries()) {
      const module = asObject(entry);
      if (module === null) continue;

      if (module["type"] === "javascript") {
        findings.push({
          check: "manifest",
          severity: "error",
          path: file.path,
          message:
            `/modules/${i}/type: "javascript" is a module type left over from ` +
            'before 1.16. For @minecraft/server 2.x it must be "script", with ' +
            '"language": "javascript" alongside it',
          evidence: `${LIMITS} · E (measured in game: the pack never appeared in the list)`,
        });
        continue;
      }

      if (module["type"] !== "script") continue;

      if (module["language"] !== "javascript") {
        findings.push({
          check: "manifest",
          severity: "error",
          path: file.path,
          message: `/modules/${i}: the script module is missing "language": "javascript"`,
          evidence: `${LIMITS} · E`,
        });
      }
      if (typeof module["entry"] !== "string") {
        findings.push({
          check: "manifest",
          severity: "error",
          path: file.path,
          message: `/modules/${i}: the script module is missing "entry"`,
          evidence: `${LIMITS} · E`,
        });
      }
    }
  }

  return toResult(findings);
}

export function checkFileNames(files: readonly PackFile[]): CheckResult {
  const { parsed, findings } = parseJsonFiles(files);

  for (const { file, root, body } of parsed) {
    if (root !== "minecraft:feature_rules") continue;

    const id = identifierOf(body);
    if (id === null) continue;

    const expected = normalizeId(id).split(":").slice(1).join(":");
    const actual = basename(file.path).replace(/\.json$/, "");
    if (actual === expected) continue;

    findings.push({
      check: "filename",
      severity: "error",
      path: file.path,
      message:
        `the feature rule file is named "${actual}" but, because its identifier ` +
        `is "${id}", it must be "${expected}.json"`,
      evidence: `${LIMITS} · B ("does not match filename")`,
    });
  }

  return toResult(findings);
}

// --------------------------------------------------------------------------
// C · varlık (asset) referansları
// --------------------------------------------------------------------------

/**
 * Doku referansı taşıyan alanlar ve hangi atlasa baktıkları.
 *
 * `minecraft:icon` item ikonudur (atlas.items), `material_instances` blok
 * yüzeyidir (atlas.terrain). İkisi de bir KAYNAK PAKETİNDEKİ anahtara işaret
 * ediyor — dosya yoluna değil.
 */
const ASSET_FIELDS: Record<string, TextureAtlas> = {
  "minecraft:icon": "item",
  "minecraft:material_instances": "terrain",
};

/**
 * `minecraft:icon` üç biçimde de KARŞILAŞILIYOR, ama üçü geçerli değil.
 *
 *   "minecraft:icon": "ruby"                            şema kabul ediyor
 *   "minecraft:icon": { "textures": { "default": … } }  şema kabul ediyor
 *   "minecraft:icon": { "texture": "ruby" }             şema REDDEDİYOR
 *
 * Ölçüldü (30-08-2026, behavior/items/items, format_version 1.21.100):
 * üçüncüsü "must be string · must have required property 'textures'" veriyor.
 * Model bu biçimi gerçekten üretti (`ore-gen-01`, ikinci deneme).
 *
 * Üçü de OKUNUYOR çünkü bu kontrolün işi doku anahtarını bulmak; biçimin
 * geçerliliğine şema karar veriyor ve zaten veriyor. Geçersiz biçimdeki bir
 * anahtarı görmezden gelmek, aynı dosyada iki ayrı hatayı tek tek raporlamak
 * yerine yalnızca birini göstermek olurdu.
 */
function iconKeys(value: unknown): string[] {
  if (typeof value === "string") return [value];

  const object = asObject(value);
  if (object === null) return [];

  const keys: string[] = [];
  if (typeof object["texture"] === "string") keys.push(object["texture"]);

  const textures = asObject(object["textures"]);
  if (textures !== null) {
    for (const entry of Object.values(textures)) {
      if (typeof entry === "string") keys.push(entry);
    }
  }

  return keys;
}

/** `material_instances`: { "*": { "texture": "ruby_ore", ... } } */
function materialKeys(value: unknown): string[] {
  const instances = asObject(value);
  if (instances === null) return [];

  const keys: string[] = [];
  for (const instance of Object.values(instances)) {
    const object = asObject(instance);
    const texture = object?.["texture"];
    if (typeof texture === "string") keys.push(texture);
  }
  return keys;
}

/**
 * Ağacın herhangi bir yerindeki doku referanslarını toplar.
 *
 * Özyineleme, alan yolunu sabitlemekten güvenli: bileşenler hem `components`
 * altında hem `permutations[].components` altında geçiyor ve biçim sürümden
 * sürüme yer değiştiriyor. Aranan şey alanın ADI, yerleştiği yol değil.
 */
function collectAssetRefs(value: unknown, out: { key: string; atlas: TextureAtlas }[]): void {
  if (Array.isArray(value)) {
    for (const item of value) collectAssetRefs(item, out);
    return;
  }

  const object = asObject(value);
  if (object === null) return;

  for (const [name, child] of Object.entries(object)) {
    const atlas = ASSET_FIELDS[name];
    if (atlas !== undefined) {
      const keys = name === "minecraft:icon" ? iconKeys(child) : materialKeys(child);
      for (const key of keys) out.push({ key, atlas });
      continue;
    }
    collectAssetRefs(child, out);
  }
}

export type AssetOptions = { version?: string };

/**
 * Paketin KENDİ tanımladığı doku anahtarları.
 *
 * Ölçülerek eklendi (01-09-2026, docs/mcp-kullanim.md senaryo 5). Kontrol yalnızca vanilla
 * atlasına bakıyordu ve bu bir YANLIŞ POZİTİF üretiyordu: model bir kaynak
 * paketi de üreten eksiksiz bir eklenti verdi, anahtarları
 * RP/textures/terrain_texture.json ve item_texture.json içinde tanımladı, ve
 * review_pack iki ERROR bulgusuyla ok:false döndü. Doğru ve kurulabilir bir
 * paket "hatalı" raporlandı.
 *
 * Kapsam kararı değişmedi — CodeCraft'ın kendi ürettiği şey hâlâ behavior
 * pack. Değişen şey referansın nasıl ÇÖZÜLDÜĞÜ: bir anahtar paketin kendi
 * atlas tanımında duruyorsa, o referans çözülüyor demektir. Bunu yok saymak
 * modele "bizim hatalarımızı yok say" öğretir ve o alışkanlık gerçek bir
 * hatayı da yok saydırır.
 *
 * Atlas ayrımı önce `texture_name` alanından, o yoksa dosya adından okunuyor.
 *
 * HAM DOSYA üzerinden çalışıyor, parseJsonFiles çıktısı üzerinden değil: o
 * fonksiyon belgeyi üst düzey anahtar BAŞINA parçalıyor, yani `texture_data`
 * ile `texture_name` ayrı kayıtlara düşüyor ve atlas adı görünmez oluyor.
 * İlk deneme tam bu yüzden sessizce hiçbir anahtar bulamadı.
 */
function packTextureKeys(files: readonly PackFile[]): Record<TextureAtlas, Set<string>> {
  const out: Record<TextureAtlas, Set<string>> = { item: new Set(), terrain: new Set() };

  for (const file of files) {
    if (!file.path.endsWith(".json")) continue;

    let value: unknown;
    try {
      value = JSON.parse(file.content);
    } catch {
      continue; // parseJsonFiles aynı dosya için zaten uyarı üretiyor.
    }
    const record = asObject(value);
    if (record === null) continue;

    const data = asObject(record["texture_data"]);
    if (data === null) continue;

    const name = asString(record["texture_name"]) ?? "";
    const lower = file.path.toLowerCase();
    let atlas: TextureAtlas | null = null;
    if (name === "atlas.items" || lower.endsWith("item_texture.json")) atlas = "item";
    else if (name === "atlas.terrain" || lower.endsWith("terrain_texture.json")) atlas = "terrain";
    if (atlas === null) continue;

    for (const key of Object.keys(data)) out[atlas].add(key);
  }

  return out;
}

/**
 * Atlasta bu anahtara en yakın birkaç ad.
 *
 * Retry'ın işe yaraması için gerekli: "bu anahtar yok" demek modele ne
 * yazacağını söylemiyor. Anahtar adı kimlikten TÜRETİLEMİYOR — ölçüldü
 * (30-08-2026): item kimliklerinin yalnızca %13'ü, blok kimliklerinin %40'ı
 * atlasta aynı adla geçiyor. O yüzden kural anlatmak yerine gerçek adlar
 * öneriliyor.
 *
 * Eşleşme parça bazlı: "ruby_ore" -> "ore" geçen anahtarlar.
 */
function nearestKeys(key: string, atlas: ReadonlySet<string>, limit = 3): string[] {
  const parts = key.split("_").filter((part) => part.length > 2);
  if (parts.length === 0) return [];

  const scored: { key: string; score: number }[] = [];
  for (const candidate of atlas) {
    const score = parts.filter((part) => candidate.includes(part)).length;
    if (score > 0) scored.push({ key: candidate, score });
  }

  // Skor eşitse alfabetik: aynı girdi her koşuda aynı öneriyi versin.
  scored.sort((a, b) => (b.score - a.score) || (a.key < b.key ? -1 : 1));
  return scored.slice(0, limit).map((entry) => entry.key);
}

/**
 * Doku referansı gerçekten var mı.
 *
 * NEDEN ERROR: kaynak paketi olmayan bir pakette tanımsız bir doku anahtarı
 * oyunda uyarı değil İÇERİK HATASI üretiyor ve item elde bomboş görünüyor —
 * gerçek oyunda ölçüldü (docs/VALIDATION-LIMITS.md C).
 *
 * KAYNAK PAKETİ: 30-08-2026'da "üretilmiyor, model yalnızca var olan bir
 * vanilla anahtarına işaret edebilir" deniyordu. ~~O kural~~ 01-09-2026'da
 * genişletildi (docs/mcp-kullanim.md senaryo 5): kaynak paketi üretilebilir ve bu kontrol
 * artık paketin KENDİ atlas tanımını da çözüyor. Vanilla anahtarına işaret
 * etmek hâlâ geçerli ve en ucuz yol; tek yol değil.
 *
 * Yanlış atlas ERROR değil WARNING: anahtar gerçekten var, yalnızca beklenen
 * atlasta değil. Ona "yok" demek uydurma hata olurdu.
 */
export async function checkAssets(
  files: readonly PackFile[],
  options: AssetOptions = {},
): Promise<CheckResult> {
  const { parsed, findings } = parseJsonFiles(files);

  const refs: { file: PackFile; key: string; atlas: TextureAtlas }[] = [];
  for (const { file, body } of parsed) {
    const found: { key: string; atlas: TextureAtlas }[] = [];
    collectAssetRefs(body, found);
    for (const ref of found) refs.push({ file, ...ref });
  }

  if (refs.length === 0) return toResult(findings);

  const item = await textureKeys("item", options);
  const terrain = await textureKeys("terrain", options);
  const sets: Record<TextureAtlas, ReadonlySet<string>> = { item, terrain };
  // Paket kendi atlas tanımını getiriyorsa anahtarları oradan da çözülür.
  const own = packTextureKeys(files);

  for (const { file, key, atlas } of refs) {
    if (sets[atlas].has(key) || own[atlas].has(key)) continue;

    const other: TextureAtlas = atlas === "item" ? "terrain" : "item";
    if (sets[other].has(key) || own[other].has(key)) {
      findings.push({
        check: "asset",
        severity: "warning",
        path: file.path,
        message: `texture key "${key}" is not in the ${atlas} atlas, it is in the ${other} atlas`,
        evidence: `${LIMITS} · C · data/<version>/textures.json`,
      });
      continue;
    }

    const near = nearestKeys(key, sets[atlas]);
    findings.push({
      check: "asset",
      severity: "error",
      path: file.path,
      message:
        `texture key "${key}" is defined neither in the vanilla atlas nor in ` +
        "this pack's own terrain_texture.json / item_texture.json. Either use an " +
        "existing vanilla key or define the key in a resource pack" +
        (near.length === 0 ? "" : `. Nearest keys: ${near.join(", ")}`),
      evidence: `${LIMITS} · C ("Missing referenced asset")`,
    });
  }

  return toResult(findings);
}

// --------------------------------------------------------------------------
// A · komut metnindeki kimlikler
// --------------------------------------------------------------------------

/**
 * Komut metninde geçen namespace'li kimlikler.
 *
 * Yalnızca kimlik biçimindeki belirteçler alınıyor; komut SÖZDİZİMİ
 * doğrulanmıyor. Bedrock komut grameri için makine okunur resmi kaynak yok ve
 * sözdizimi doğrulayıcısı v1 kapsamı dışında (CLAUDE.md). Bu, var olan kimlik
 * kontrolünün komut metnine uygulanması — modelin en sık hatasını keser.
 */
const COMMAND_ID_RE = /\b[a-z][a-z0-9_]*:[a-z][a-z0-9_]*\b/g;

export type CommandIdentityOptions = {
  version?: string;
  /** Üretilen paketin kendi tanımladığı kimlikler. Verilmezse doğrulanamaz. */
  declared?: readonly string[];
  /** Bulgulara yazılacak dosya yolu. */
  path?: string;
};

/**
 * Komut metnindeki kimlikler bu sürümde gerçekten var mı.
 *
 * minecraft: namespace'i BÜTÜN indekslerde aranıyor (lookupAny): komutlarda
 * blok/item/entity dışında efekt, boyut, büyü kimlikleri de geçiyor ve dar
 * arama onlara uydurma "yok" hatası verirdi.
 *
 * minecraft: dışı bir kimlik komut metninden doğrulanamaz — hangi paketin
 * tanımladığı bilinmiyor. `declared` verilmişse ona bakılır, verilmemişse
 * uyarı üretilir: bilinmeyene "geçti" denmiyor ama hata da uydurulmuyor.
 */
export async function checkCommandIdentities(
  text: string,
  options: CommandIdentityOptions = {},
): Promise<CheckResult> {
  const findings: Finding[] = [];
  const declared = new Set((options.declared ?? []).map(normalizeId));
  const seen = new Set<string>();

  for (const match of text.matchAll(COMMAND_ID_RE)) {
    const id = normalizeId(match[0]);
    if (seen.has(id)) continue;
    seen.add(id);

    if (declared.has(id)) continue;

    if (!id.startsWith("minecraft:")) {
      findings.push({
        check: "commandIdentity",
        severity: "warning",
        ...(options.path === undefined ? {} : { path: options.path }),
        message:
          `"${id}" could not be verified from the command text — for an identifier ` +
          "outside the minecraft: namespace there is no way to tell which pack defines it",
        evidence: `${LIMITS} · A`,
      });
      continue;
    }

    const found = await lookupAny(id, { version: options.version });
    if (found.found) continue;

    findings.push({
      check: "commandIdentity",
      severity: "error",
      ...(options.path === undefined ? {} : { path: options.path }),
      message: `"${id}" does not exist in version ${found.version}`,
      evidence: `${LIMITS} · A (the identifier check applied to command text)`,
    });
  }

  return toResult(findings);
}

// --------------------------------------------------------------------------
// D · geçerli ama amaçlanmayan
// --------------------------------------------------------------------------

type Pattern = {
  /** Kalıp adı, vaka dosyasında "pattern:<ad>" diye istenir. */
  name: string;
  /** Kalıbı arar. Bulursa mesaj döner, bulmazsa null. */
  find: (code: string) => string | null;
  evidence: string;
  /**
   * Doğrusunun nasıl yazılacağı. Kalıp burada hem SONRADAN ölçülüyor hem
   * ÖNCEDEN anlatılıyor: `get_version_info` bağlamı bu alandan besleniyor,
   * yani kalıp hem önceden anlatılıyor hem sonradan ölçülüyor.
   * Böylece liste tek yerde durur, ikinci bir kopya tutulmaz.
   */
  guidance: string;
};

/**
 * `subscribe(` sonrasındaki argüman metnini parantez dengeleyerek çıkarır.
 * Yaklaşık bir okuma: metin sabitlerinin içindeki parantezleri de sayar. AST
 * kullanılmıyor çünkü kurulu typescript@7'nin JS yüzeyi "unstable/" altında
 * (bkz. script.ts). Yanlış tarafa düşerse kalıbı bulamaz — uydurma bulgu
 * üretmez, yani hata yönü güvenli tarafta.
 */
function argumentText(code: string, openIndex: number): string {
  let depth = 0;
  for (let i = openIndex; i < code.length; i += 1) {
    const char = code[i];
    if (char === "(") depth += 1;
    else if (char === ")") {
      depth -= 1;
      if (depth === 0) return code.slice(openIndex + 1, i);
    }
  }
  return code.slice(openIndex + 1);
}

const WORLD_LOAD = /\bworldLoad\s*\.\s*subscribe\s*\(/g;

/**
 * Kalıp tablosu. Her kalıbın kanıtı var — "böyle olsa iyi olur" maddesi yok.
 * Buraya kalıp eklendikçe `get_version_info` bağlamı da aynı listeden beslenir.
 */
const PATTERNS: Pattern[] = [
  {
    name: "welcome-on-player-spawn",
    evidence: `${LIMITS} · D (measured in game: the event fires, the message reaches nobody)`,
    guidance:
      "Do not put a message meant for players inside a worldLoad subscription: " +
      "the event does fire, but at that moment there is no player in the world " +
      "to receive it. " +
      "Use world.afterEvents.playerSpawn and event.player.sendMessage " +
      "instead; if the message is only meant for the first join, filter with " +
      "event.initialSpawn.",
    find: (code) => {
      WORLD_LOAD.lastIndex = 0;
      for (let match = WORLD_LOAD.exec(code); match !== null; match = WORLD_LOAD.exec(code)) {
        const body = argumentText(code, match.index + match[0].length - 1);
        if (/\bsendMessage\s*\(/.test(body)) {
          return (
            "sendMessage inside a worldLoad subscription: the event fires, but at " +
            "that moment there is no player to receive the message. A welcome " +
            "message must be sent from playerSpawn instead (guarded by " +
            "event.initialSpawn)"
          );
        }
      }
      return null;
    },
  },
];

/** Bu sürümde tanınan kalıpların adları. */
export const patternNames = (): string[] => PATTERNS.map((pattern) => pattern.name);

export type PatternGuide = {
  name: string;
  guidance: string;
  evidence: string;
};

/**
 * Kalıpların prompt'a girecek hâli — ad, doğrusunun nasıl yazılacağı, kanıt.
 * `find` dışarı verilmiyor: o doğrulama tarafının işi.
 *
 * Üretim katmanı bunu prompt'a koyar, doğrulama katmanı aynı tabloyla ölçer.
 */
export const patternGuide = (): PatternGuide[] =>
  PATTERNS.map(({ name, guidance, evidence }) => ({ name, guidance, evidence }));

export type PatternOptions = {
  /** Bulgulara yazılacak dosya yolu. */
  path?: string;
  /** Verilirse yalnızca bu adlardaki kalıplar koşar. */
  only?: string[];
};

/**
 * D sınıfı: kod her ölçüte göre doğru, yanlış olan niyetle sonuç arasındaki fark.
 * Ne derleyici ne şema yakalayabilir; yakalanabilmesi için kalıbın bilinmesi
 * gerekiyor (docs/VALIDATION-LIMITS.md D).
 *
 * Bilinmeyen kalıp adı sessizce atlanmaz, hata fırlatır — vaka dosyasındaki bir
 * yazım hatası "kontrol geçti" gibi görünmesin.
 */
export function checkPatterns(code: string, options: PatternOptions = {}): CheckResult {
  const selected =
    options.only === undefined
      ? PATTERNS
      : options.only.map((name) => {
          const pattern = PATTERNS.find((candidate) => candidate.name === name);
          if (pattern === undefined) {
            throw new Error(
              `Unknown pattern: "${name}". Known patterns: ${patternNames().join(", ")}`,
            );
          }
          return pattern;
        });

  const findings: Finding[] = [];
  for (const pattern of selected) {
    const message = pattern.find(code);
    if (message === null) continue;
    findings.push({
      check: `pattern:${pattern.name}`,
      severity: "error",
      ...(options.path === undefined ? {} : { path: options.path }),
      message,
      evidence: pattern.evidence,
    });
  }

  return toResult(findings);
}

// --------------------------------------------------------------------------
// F · Molang ifadeleri
// --------------------------------------------------------------------------

/**
 * JSON gövdesindeki bütün string değerleri, JSON pointer yoluyla birlikte.
 *
 * Molang'ın hangi alanlarda geçtiğini bilmeye gerek yok ve bilmek de
 * istenmiyor: alan listesi yazsaydık listede olmayan bir alandaki ifade
 * sessizce atlanırdı. Bunun yerine bütün stringlere bakılıyor ve Molang'a
 * benzemeyenler `scanMolang` tarafından zaten sıfır çağrı döndürüyor.
 */
function collectStrings(value: unknown, path: string, out: { path: string; text: string }[]): void {
  if (typeof value === "string") {
    out.push({ path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) collectStrings(item, `${path}/${i}`, out);
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      collectStrings(item, `${path}/${key.replace(/~/g, "~0").replace(/\//g, "~1")}`, out);
    }
  }
}

export type MolangCheckOptions = { version?: string };

/**
 * Molang sorgu ve fonksiyon adlarını bu sürümün kümesine karşı ölçer.
 *
 * NEDEN WARNING, ERROR DEĞİL: bu sınıf henüz gerçek oyunda ölçülmedi. A-E
 * sınıflarının hepsinin ContentLog kanıtı var, bunun yok. Ayrıca veri sürümü
 * kurulu oyunun gerisinde kalabiliyor, yani yeni eklenmiş bir sorguya "yok"
 * demek yanlış pozitif olurdu — ve yanlış pozitif bu depoda pahalı
 * (docs/VALIDATION-LIMITS.md C, 01-09-2026). Gerekçenin tamamı
 * `packages/validator/src/molang.ts` başlığında.
 */
export async function checkMolang(
  files: readonly PackFile[],
  options: MolangCheckOptions = {},
): Promise<CheckResult> {
  const { documents, findings } = parseJsonDocuments(files);
  if (documents.length === 0) return toResult(findings);

  // İndeks bir kez okunur: dosya başına yüzlerce string taranıyor.
  const index = await molangIndex({ version: options.version });

  for (const { file, value } of documents) {
    const strings: { path: string; text: string }[] = [];
    collectStrings(value, "", strings);

    for (const { path, text } of strings) {
      const result = await validateMolang(text, { index });
      for (const finding of result.findings) {
        // ÖLÇÜLDÜ 03-09-2026, Bedrock 1.26.45, ContentLog: bilinmeyen bir
        // sorgu bloğun TAMAMINI düşürüyor ("Failed to resolve query
        // query.is_babyy" → "permutation condition failed to parse" →
        // "Block definition parsing failed"). O yüzden unknown-query artık
        // error. Diğer üç tür (unknown-math, removed-query, arity) AYNI
        // ölçümden geçmedi ve warning kalıyor — ölçülmemiş kural
        // kodlanmıyor.
        const measured = finding.kind === "unknown-query";
        findings.push({
          check: `molang:${finding.kind}`,
          severity: measured ? "error" : "warning",
          path: file.path,
          message: `${path || "/"} :: ${finding.message}`,
          evidence: measured
            ? "data/<version>/molang.json (bedrock-samples metadata/molang_modules)" +
              ` · ${LIMITS} · F — measured in game 03-09-2026: the whole block definition fails to parse`
            : "data/<version>/molang.json (bedrock-samples metadata/molang_modules)" +
              ` · ${LIMITS} · F — this kind has not been measured in game, hence a warning`,
        });
      }
    }
  }

  return toResult(findings);
}

// --------------------------------------------------------------------------
// A' · yol referansları: loot ve trade tabloları
// --------------------------------------------------------------------------

/**
 * Yol taşıyan bileşenler ve hangi referans kümesine baktıkları.
 *
 * Bunlar kimlik değil DOSYA YOLU taşıyor ("loot_tables/entities/cow.json"),
 * o yüzden `checkIdentities` görmüyor. Şema yolun string olduğunu doğruluyor,
 * işaret ettiği dosyanın var olup olmadığını değil — A sınıfının aynısı.
 */
const PATH_COMPONENTS: Readonly<Record<string, ReferenceKind>> = {
  "minecraft:loot": "lootTables",
  "minecraft:trade_table": "tradeTables",
  "minecraft:economy_trade_table": "tradeTables",
};

/** `table` alanı taşıyan bileşenleri, JSON pointer yoluyla toplar. */
function collectPathRefs(
  value: unknown,
  path: string,
  out: { kind: ReferenceKind; table: string; where: string }[],
): void {
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) collectPathRefs(item, `${path}/${i}`, out);
    return;
  }
  const object = asObject(value);
  if (object === null) return;

  for (const [key, item] of Object.entries(object)) {
    const kind = PATH_COMPONENTS[key];
    const inner = asObject(item);
    if (kind !== undefined && inner !== null && typeof inner["table"] === "string") {
      out.push({ kind, table: inner["table"], where: `${path}/${key}/table` });
    }
    collectPathRefs(item, `${path}/${key}`, out);
  }
}

/** Paketin kendi getirdiği loot/trade tablo dosyaları. */
function packTablePaths(files: readonly PackFile[]): ReadonlySet<string> {
  const out = new Set<string>();
  for (const file of files) {
    if (!file.path.endsWith(".json")) continue;
    // Paket içi yol "BP/loot_tables/x.json" ya da "loot_tables/x.json"
    // gelebiliyor; referans metni her zaman paket köküne göreli yazılıyor.
    const match = /(?:^|\/)((?:loot_tables|trading)\/.+\.json)$/.exec(file.path);
    if (match?.[1] !== undefined) out.add(match[1]);
  }
  return out;
}

/**
 * H sınıfı: sürüme bağlı zorunlu alan — şema geçiriyor, oyun yüklemiyor.
 *
 * ÖLÇÜLDÜ 03-09-2026, gerçek oyunda. Ölçüm paketindeki tarif dosyası şemadan
 * temiz geçti ve `ContentLog` şunu yazdı:
 *
 *   [Recipes][error] recipes/ruby_block.json | codecraft:ruby_block |
 *       1.20+ Recipes require unlock data
 *
 * Yani tarif hiç yüklenmedi. Blockception şeması `unlock`'u TANIYOR ama hiçbir
 * tarif tipinde ZORUNLU tutmuyor (altı tanımın altısında da opsiyonel), o
 * yüzden şema ayağı bunu yapısal olarak yakalayamaz.
 *
 * KAPSAM ÖLÇÜLDÜ, tahmin edilmedi. Vanilla'dan 90 tarif örneklendi
 * (`Mojang/bedrock-samples`, 03-09-2026) ve korelasyon istisnasız çıktı:
 *
 * | Tip | format_version | unlock var / yok |
 * |---|---|---|
 * | shaped + shapeless | 1.12 ve 1.16 | 0 / 11 |
 * | shaped + shapeless | 1.20.10 ve üstü | 48 / 0 |
 * | brewing_mix | 1.20.10 | 0 / 4 |
 * | smithing_transform | 1.20.10 | 0 / 1 |
 * | furnace | her sürüm | hepsinde var |
 *
 * Sonuç: kural **crafting table tarifleri** için ve **1.20+** için. Brewing ve
 * smithing modern formatta bile `unlock` taşımıyor — onlara "eksik" demek
 * uydurma hata olurdu. Furnace her sürümde taşıyor, yani eksikliği sürümle
 * açıklanamaz ve ölçülmedi; o da kapsam dışında.
 */
const UNLOCK_ROOTS = new Set(["minecraft:recipe_shaped", "minecraft:recipe_shapeless"]);

/** "1.21.100" >= 1.20 mi. Üçüncü hane ilgisiz, kural iki haneyle ölçüldü. */
function atLeast(version: string, major: number, minor: number): boolean {
  const [first, second] = version.split(".").map((part) => Number.parseInt(part, 10));
  if (first === undefined || Number.isNaN(first)) return false;
  const minorValue = second === undefined || Number.isNaN(second) ? 0 : second;
  return first > major || (first === major && minorValue >= minor);
}

export function checkRecipes(files: readonly PackFile[]): CheckResult {
  const { documents, findings } = parseJsonDocuments(files);

  for (const { file, value } of documents) {
    const object = asObject(value);
    if (object === null) continue;

    const formatVersion = asString(object["format_version"]);
    if (formatVersion === null || !atLeast(formatVersion, 1, 20)) continue;

    for (const [root, body] of Object.entries(object)) {
      if (!UNLOCK_ROOTS.has(root)) continue;
      const recipe = asObject(body);
      if (recipe === null || recipe["unlock"] !== undefined) continue;

      findings.push({
        check: "recipe-unlock",
        severity: "error",
        path: file.path,
        message:
          `/${root} :: a recipe with format_version ${formatVersion} must carry "unlock". ` +
          "Without it the game refuses to load the recipe " +
          '("1.20+ Recipes require unlock data"). Use "unlock": [{ "item": "<id>" }] ' +
          'for the items that reveal it, or "unlock": { "context": "AlwaysUnlocked" }',
        evidence:
          `${LIMITS} · H (measured in game 03-09-2026) · ` +
          "vanilla sample: 48/48 crafting-table recipes at format_version 1.20+ carry unlock, 0/11 below it",
      });
    }
  }

  return toResult(findings);
}

export type ReferenceOptions = { version?: string };

/**
 * `minecraft:loot` ve `minecraft:trade_table` işaret ettiği dosya var mı.
 *
 * `checkAssets`'in 01-09-2026 dersinin aynısı uygulanıyor: paket kendi
 * tablosunu getiriyorsa referans çözülmüştür, kimin yazdığından bağımsız.
 * Aksi hâlde doğru ve kurulabilir bir paket "hatalı" raporlanırdı.
 *
 * NEDEN WARNING — gerekçe 03-09-2026'da DEĞİŞTİ, ölçümle.
 *
 * Eskiden "oyunda ne yaptığı ölçülmedi" idi. Ölçüldü: olmayan bir tabloya
 * işaret eden bir entity doğuruldu ve öldürüldü, `ContentLog`'un TAMAMINDA
 * loot'a dair tek satır çıkmadı — hiçbir seviyede. Oyun şikâyet etmiyor,
 * sessizce hiçbir şey düşürmüyor.
 *
 * Yani bu, F ve G'nin tersi bir sınıf: orada oyun reddediyordu ve severity
 * yükseldi, burada oyun susuyor. Susması "sorun yok" demek değil — bu deponun
 * var olma sebebi tam olarak sessiz başarısızlık. Ama error'a yükseltmenin
 * şartı, G'de olduğu gibi, İNDEKSİN eksiksizliğinin ölçülmesi: 207 vanilla
 * tablosunun tam olduğu doğrulanmadı ve eksikse her bulgu yanlış pozitif olur.
 * Ölçülene kadar uyarı.
 */
export async function checkReferences(
  files: readonly PackFile[],
  options: ReferenceOptions = {},
): Promise<CheckResult> {
  const { documents, findings } = parseJsonDocuments(files);

  const refs: { file: PackFile; kind: ReferenceKind; table: string; where: string }[] = [];
  for (const { file, value } of documents) {
    const found: { kind: ReferenceKind; table: string; where: string }[] = [];
    collectPathRefs(value, "", found);
    for (const ref of found) refs.push({ file, ...ref });
  }

  if (refs.length === 0) return toResult(findings);

  const own = packTablePaths(files);
  const sets = new Map<ReferenceKind, ReadonlySet<string>>();
  for (const kind of new Set(refs.map((ref) => ref.kind))) {
    sets.set(kind, await referenceSet(kind, options));
  }

  for (const { file, kind, table, where } of refs) {
    if (own.has(table)) continue;
    if (sets.get(kind)?.has(table) === true) continue;

    const label = kind === "lootTables" ? "loot table" : "trade table";
    findings.push({
      check: "reference",
      severity: "warning",
      path: file.path,
      message:
        `${where} :: ${label} "${table}" exists neither in vanilla nor in this pack. ` +
        "Point at an existing vanilla table or add the file to the pack",
      evidence: `${LIMITS} · A (path reference) · data/<version>/references.json`,
    });
  }

  return toResult(findings);
}

/**
 * `/playsound` ile çalınan ses olayı gerçekten tanımlı mı.
 *
 * Ses olayları `checkCommandIdentities`'in göremediği yerde duruyor: kimlik
 * değiller, nokta ayraçlı adlar ("mob.cow.say") ve namespace taşımıyorlar,
 * yani kimlik regex'i onları hiç yakalamıyor.
 *
 * Yalnızca `playsound` ölçülüyor. `stopsound` da ses adı alıyor ama argüman
 * sırası farklı ve ölçülmedi — ölçülmemiş kural kodlanmıyor.
 */
export async function checkSounds(
  text: string,
  options: ReferenceOptions & { path?: string } = {},
): Promise<CheckResult> {
  const findings: Finding[] = [];
  const wanted: { line: number; sound: string }[] = [];

  for (const [i, raw] of text.split(/\r?\n/).entries()) {
    const line = raw.trim().replace(/^\//, "");
    if (!/^playsound\s/.test(line)) continue;
    const sound = line.split(/\s+/)[1];
    // Tırnaklı ad da kabul: /playsound "mob.cow.say" @a
    if (sound !== undefined) wanted.push({ line: i + 1, sound: sound.replace(/^["']|["']$/g, "") });
  }

  if (wanted.length === 0) return toResult(findings);

  const sounds = await referenceSet("sounds", options);
  for (const { line, sound } of wanted) {
    if (sounds.has(sound)) continue;
    // Ses adları nokta ayraçlı; yakınlık da parça bazlı ölçülüyor.
    const near = nearestKeys(sound.replace(/\./g, "_"), new Set([...sounds].map((s) => s.replace(/\./g, "_"))));
    findings.push({
      check: "sound",
      severity: "warning",
      ...(options.path === undefined ? {} : { path: options.path }),
      message:
        `line ${line}: sound event "${sound}" is not defined in this version` +
        (near.length === 0 ? "" : `. Nearest names: ${near.map((n) => n.replace(/_/g, ".")).join(", ")}`),
      evidence: "data/<version>/references.json (resource_pack/sounds/sound_definitions.json)",
    });
  }

  return toResult(findings);
}

// --------------------------------------------------------------------------
// G · bileşen adları — şema bunu yakalamıyor
// --------------------------------------------------------------------------

/**
 * Kök anahtar → hangi bileşen kümelerine bakılacağı.
 *
 * Kümeler AYRI tutuluyor ve burada birleştiriliyor, çünkü hepsi aynı
 * `minecraft:` önekiyle başlasa da anlamları farklı: entity'de AI hedefi,
 * öznitelik ve özellik `components` altına yazılabiliyor, ama "Built-in
 * Events" yazılamaz — o yüzden entityEvents bu birleşime GİRMİYOR.
 */
const COMPONENT_SETS: Readonly<Record<string, readonly (keyof ComponentIndex)[]>> = {
  "minecraft:block": ["blockComponents", "blockTriggers", "blockSchemaComponents"],
  "minecraft:entity": [
    "entityComponents",
    "entityGoals",
    "entityAttributes",
    "entityProperties",
    // İkinci kaynak, 03-09-2026'da ölçülerek eklendi: doküman modülleri eksik
    // ve tek başına 126 geçerli ada "yok" diyordu (minecraft:health dahil).
    "entitySchemaComponents",
  ],
};

/**
 * `components` ve `component_groups` altındaki anahtarları toplar.
 *
 * `permutations[].components` de dahil: blok permütasyonları aynı bileşenleri
 * kullanıyor ve orada yazılan yanlış ad da sessizce geçerdi.
 */
function collectComponentKeys(
  value: unknown,
  path: string,
  out: { name: string; where: string }[],
): void {
  if (Array.isArray(value)) {
    for (const [i, item] of value.entries()) collectComponentKeys(item, `${path}/${i}`, out);
    return;
  }
  const object = asObject(value);
  if (object === null) return;

  for (const [key, item] of Object.entries(object)) {
    if (key === "components") {
      const components = asObject(item);
      if (components !== null) {
        for (const name of Object.keys(components)) {
          out.push({ name, where: `${path}/components/${name}` });
        }
      }
      continue;
    }
    if (key === "component_groups") {
      const groups = asObject(item);
      if (groups !== null) {
        for (const [group, body] of Object.entries(groups)) {
          const components = asObject(body);
          if (components === null) continue;
          for (const name of Object.keys(components)) {
            out.push({ name, where: `${path}/component_groups/${group}/${name}` });
          }
        }
      }
      continue;
    }
    collectComponentKeys(item, `${path}/${key}`, out);
  }
}

export type ComponentOptions = { version?: string };

/**
 * Bileşen adı bu sürümde gerçekten var mı.
 *
 * NEDEN VAR: ne Blockception ne Mojang şemaları bilinmeyen bir bileşen adını
 * reddediyor — `cases.json` içindeki `block-unknown-component` vakası tam
 * bunu ölçüyor ve iki kaynak da "geçti" diyor. Yani `minecraft:destructable`
 * (doğrusu `destructible_by_mining`) yazan bir dosya doğrulamadan geçiyor.
 *
 * Yalnızca `minecraft:` önekli adlar ölçülüyor. Özel namespace'li bir anahtar
 * bileşen değil (kullanıcının kendi verisi olabilir) ve ona "bilinmiyor"
 * demek uydurma hata olurdu.
 *
 * NEDEN WARNING: dokümantasyon oyunun gerisinde kalabiliyor ve yeni eklenmiş
 * bir bileşene "yok" demek yanlış pozitif olurdu. Ayrıca bu sınıf gerçek
 * oyunda ÖLÇÜLMEDİ — A–E'nin ContentLog kanıtı var, bunun yok.
 */
export async function checkComponents(
  files: readonly PackFile[],
  options: ComponentOptions = {},
): Promise<CheckResult> {
  const { parsed, findings } = parseJsonFiles(files);

  const refs: { file: PackFile; root: string; name: string; where: string }[] = [];
  for (const { file, root, body } of parsed) {
    if (COMPONENT_SETS[root] === undefined) continue;
    const found: { name: string; where: string }[] = [];
    collectComponentKeys(body, `/${root}`, found);
    for (const ref of found) refs.push({ file, root, ...ref });
  }

  if (refs.length === 0) return toResult(findings);

  const index = await componentIndex(options);
  for (const { file, root, name, where } of refs) {
    if (!name.startsWith("minecraft:")) continue;

    const keys = COMPONENT_SETS[root] ?? [];
    // ?? [] : entitySchemaComponents opsiyonel, eski bir components.json çökmesin.
    const valid = new Set(keys.flatMap((key) => index[key] ?? []));
    if (valid.has(name)) continue;

    const bare = name.replace("minecraft:", "");
    const pool = new Set([...valid].map((value) => value.replace("minecraft:", "")));
    // nearestKeys parça bazlı çalışıyor ve alt çizgi taşımayan bir yazım
    // hatasında ("destructable") hiç öneri üretmiyor. Ortak önek geriye
    // düşüşü tam o durumu kurtarıyor: "destructable" -> "destructible_by_*".
    const near =
      nearestKeys(bare, pool).length > 0
        ? nearestKeys(bare, pool)
        : [...pool].filter((value) => value.slice(0, 5) === bare.slice(0, 5)).sort().slice(0, 3);
    findings.push({
      check: "component",
      severity: "warning",
      path: file.path,
      message:
        `${where} :: "${name}" is not a ${root} component defined in this version` +
        (near.length === 0 ? "" : `. Nearest names: ${near.map((n) => `minecraft:${n}`).join(", ")}`),
      evidence: `${LIMITS} · G · data/<version>/components.json (doc_modules + Mojang entity schema)`,
    });
  }

  return toResult(findings);
}
