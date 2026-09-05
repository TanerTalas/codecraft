/**
 * İki veri sürümü arasındaki farkı markdown olarak basar.
 *
 *   npm run version:summary -- 1.26.40.5 1.26.50.1
 *
 * Tek kullanıcısı `.github/workflows/data.yml`: oyun sürümü atladığında
 * açılan bilgi issue'sunun gövdesi. Eski sürüm verilmezse yalnız yeni sürüm
 * özetlenir.
 *
 * NEDEN buildContext YENİDEN KULLANILIYOR: `get_version_info` aracının
 * gövdesi zaten o ve tam olarak sürüm atlamasında bakılacak alanları
 * veriyor — min_engine_version, modül sürümleri, format_version'lar. Ayrı bir
 * özet yazmak, aracın söylediğiyle issue'nun söylediğinin ayrışması demekti.
 *
 * Eski sürüm klasörü okunabiliyor çünkü pipeline eski klasörü silmiyor; yeni
 * sürüm yeni klasör açıyor.
 */
import { buildContext, type Context } from "../src/bedrock/context.ts";

/** Sürüm atladığında bakılacak alanlar. patterns ve identities dışarıda. */
type Summary = {
  version: string;
  engineVersion: string;
  minEngineVersion: string;
  modules: Record<string, string>;
  formatVersions: Record<string, string[]>;
  documentTypes: number;
  textures: Context["textures"];
};

async function summarize(version?: string): Promise<Summary> {
  // İstek metni boş: identities yalnızca istekte geçen kimlikleri arıyor,
  // burada kimlik sorgulanmıyor.
  const context = await buildContext("", version === undefined ? {} : { version });
  return {
    version: context.version,
    engineVersion: context.engineVersion,
    minEngineVersion: `[${context.minEngineVersion.join(", ")}]`,
    modules: context.modules,
    formatVersions: context.formatVersions,
    documentTypes: context.documentTypes.length,
    textures: context.textures,
  };
}

const line = (label: string, before: string | undefined, after: string): string =>
  before === undefined || before === after
    ? `| ${label} | \`${after}\` | — |`
    : `| ${label} | \`${after}\` | önceki \`${before}\` |`;

/**
 * Modül sürümleri: eklenen, kaldırılan ve değişenler. Değişmeyenler atlanır.
 *
 * Karşılaştıracak eski sürüm yoksa boş döner — çağıran o zaman düz liste
 * basıyor. Aksi hâlde her modül "önceki ?" diye görünüyordu.
 */
function moduleRows(before: Record<string, string> | undefined, after: Record<string, string>): string[] {
  if (before === undefined) return [];
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const rows: string[] = [];
  for (const name of names) {
    const old = before[name];
    const now = after[name];
    if (now === undefined) {
      rows.push(`| \`${name}\` | **kaldırıldı** | önceki \`${old ?? "?"}\` |`);
    } else if (old === undefined) {
      rows.push(`| \`${name}\` | \`${now}\` | **yeni** |`);
    } else if (old !== now) {
      rows.push(`| \`${name}\` | \`${now}\` | önceki \`${old}\` |`);
    }
  }
  return rows;
}

/** format_version listeleri: yalnız değişen doküman tipleri. */
function formatVersionRows(
  before: Record<string, string[]> | undefined,
  after: Record<string, string[]>,
): string[] {
  if (before === undefined) return [];
  const types = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const rows: string[] = [];
  for (const type of types) {
    const old = (before[type] ?? []).join(", ");
    const now = (after[type] ?? []).join(", ");
    if (old === now) continue;
    rows.push(`| \`${type}\` | ${now === "" ? "**kaldırıldı**" : `\`${now}\``} | ${old === "" ? "**yeni**" : `önceki \`${old}\``} |`);
  }
  return rows;
}

export async function versionSummary(before: string | undefined, after?: string): Promise<string> {
  const now = await summarize(after);

  let old: Summary | undefined;
  if (before !== undefined && before !== now.version) {
    try {
      old = await summarize(before);
    } catch (error) {
      // Eski klasör yoksa özet yine üretilir, eksikliği yazılır. Bildirim
      // yolunun kendisi bir eksik klasör yüzünden patlamamalı.
      old = undefined;
      console.error(
        `uyarı: önceki sürüm ${before} okunamadı — ` +
          `${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  const out: string[] = [];
  out.push(
    old === undefined
      ? `Veri sürümü: \`${now.version}\`.`
      : `Veri sürümü atladı: \`${old.version}\` → \`${now.version}\`.`,
  );
  out.push("");
  out.push("| Alan | Şimdi | Değişim |");
  out.push("|---|---|---|");
  out.push(line("Oyun sürümü", old?.engineVersion, now.engineVersion));
  out.push(line("min_engine_version", old?.minEngineVersion, now.minEngineVersion));
  out.push(line("Doğrulanabilir doküman tipi", old?.documentTypes.toString(), now.documentTypes.toString()));
  out.push(line("Doku (item / terrain)", old && `${old.textures.item} / ${old.textures.terrain}`, `${now.textures.item} / ${now.textures.terrain}`));

  const modules = moduleRows(old?.modules, now.modules);
  out.push("");
  out.push("### Modül sürümleri");
  out.push("");
  if (modules.length === 0) {
    out.push(
      old === undefined
        ? Object.entries(now.modules)
            .map(([name, version]) => `- \`${name}\` \`${version}\``)
            .join("\n")
        : "Değişen modül yok.",
    );
  } else {
    out.push("| Modül | Şimdi | Değişim |");
    out.push("|---|---|---|");
    out.push(...modules);
  }
  out.push("");
  out.push(
    "> `@minecraft/server` npm'de kendi semver'iyle yayınlanıyor ve oyun " +
      "sürümüyle karıştırılması CLAUDE.md'nin \"en çok tuzak olan yer\" dediği " +
      "satır. Manifest `dependencies` buradan yazılıyor.",
  );

  const formats = formatVersionRows(old?.formatVersions, now.formatVersions);
  if (formats.length > 0) {
    out.push("");
    out.push("### Değişen `format_version` değerleri");
    out.push("");
    out.push("| Doküman tipi | Şimdi | Değişim |");
    out.push("|---|---|---|");
    out.push(...formats);
  }

  return out.join("\n");
}

const [, , beforeArg, afterArg] = process.argv;
console.log(await versionSummary(beforeArg === "" ? undefined : beforeArg, afterArg === "" ? undefined : afterArg));
