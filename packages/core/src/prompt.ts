/**
 * Sürüme kilitli prompt kurulumu. Saf: ağ yok, dosya yok.
 *
 * İki şey bilerek buradan geçiyor:
 *
 *  1. CLAUDE.md'deki dört sürüm biçimi tuzağı. Modeller pazarlama numarasını
 *     (26.40) dosyaya yazıyor ve modül sürümüyle oyun sürümünü karıştırıyor;
 *     ikisi de sessizce yüklenmeyen paket üretir.
 *  2. Bilinen kalıplar. Tablo checks.ts'de duruyor ve buraya context üzerinden
 *     geliyor — kalıp hem önceden anlatılıyor hem sonradan ölçülüyor
 *     (TODO.md Aşama 3). İkinci bir liste tutulmuyor.
 */
import type { Context } from "./context.ts";
import { LAYOUT } from "./output.ts";
import type { Review } from "./review.ts";

const bullet = (lines: readonly string[]): string =>
  lines.map((line) => `- ${line}`).join("\n");

export function buildSystemPrompt(context: Context): string {
  const modules = Object.entries(context.modules)
    .map(([name, release]) => `"${name}": "${release}"`)
    .join(", ");

  const sections: string[] = [];

  sections.push(
    "Minecraft Bedrock Edition için davranış paketi, komut ve otomasyon " +
      "script'i üretiyorsun. Çıktın şemaya ve TypeScript tiplerine karşı " +
      "otomatik doğrulanacak, o yüzden hatırladığın alan adlarını değil, " +
      "aşağıda verilen sürüme uyan alan adlarını kullan.",
  );

  sections.push(
    `## Sürüm: ${context.version}\n\n` +
      bullet([
        `format_version ve min_engine_version her zaman "${context.formatVersion}" biçiminde yazılır.`,
        `manifest.json içinde min_engine_version üç parçalı dizidir: [${context.minEngineVersion.join(", ")}].`,
        "Pazarlama numarası (26.40 gibi) hiçbir dosyaya yazılmaz.",
        `@minecraft/* modül sürümleri oyun sürümünden ayrıdır: ${modules}. ` +
          "manifest dependencies alanına bu sürümler yazılır, oyun sürümü değil.",
        "Script API 2.x kullanılır. 1.x'in world.events arayüzü kaldırıldı; " +
          "olaylar world.afterEvents ve world.beforeEvents altındadır.",
      ]),
  );

  sections.push(`## Dosya yerleşimi\n\n${LAYOUT}`);

  sections.push(
    "## Kimlikler\n\n" +
      bullet([
        "Var olmayan bir minecraft: kimliği kullanma. Emin değilsen kendi " +
          "namespace'inde tanımla.",
        "Kendi namespace'indeki bir kimliğe referans veriyorsan onu tanımlayan " +
          "dosyayı da üret: tarifin kendi identifier'ı sonuç item'ını var etmez.",
        "Spawn kuralı yalnızca var olan bir entity için yazılabilir.",
      ]),
  );

  sections.push(
    "## Dosya adı kuralları\n\n" +
      bullet([
        "feature rule dosyasının adı identifier'ın namespace'siz hâline eşit " +
          "olmalı: identifier \"ns:ruby_ore_feature\" ise dosya " +
          "\"ruby_ore_feature.json\".",
      ]),
  );

  if (context.patterns.length > 0) {
    sections.push(
      "## Bilinen tuzaklar\n\n" +
        context.patterns
          .map((pattern) => `### ${pattern.name}\n${pattern.guidance}`)
          .join("\n\n"),
    );
  }

  if (context.identities.length > 0) {
    sections.push(
      "## İstekte geçen kimliklerin doğrulanmış durumu\n\n" +
        bullet(
          context.identities.map((note) =>
            note.found
              ? `${note.id} — var (${note.kind})`
              : `${note.id} — bu sürümde YOK, kullanma`,
          ),
        ),
    );
  }

  sections.push(
    "## Çıktı\n\n" +
      bullet([
        "Yalnızca istenen dosyaları üret, fazladan dosya ekleme.",
        "JSON dosyalarında yorum satırı ve sondaki virgül kullanma.",
        "notes alanına kullanıcıya söylenecek kısa bir açıklama yaz " +
          "(Türkçe, birkaç cümle).",
      ]),
  );

  return sections.join("\n\n");
}

/**
 * Tek retry'ın istemi. Hatayı da vererek bir kez daha dener — ürünün genel
 * modellerden farkı bu (docs/ROADMAP.md).
 */
export function buildRetryPrompt(previous: Review): string {
  return [
    "Ürettiğin çıktı doğrulamadan geçemedi. Hatalar aşağıda, kaynağıyla " +
      "birlikte. Bunları düzelt ve dosyaların tamamını yeniden üret.",
    "",
    previous.report,
    "",
    "Hataları tahminle değil, verilen sürüme uyan alan adlarıyla düzelt. " +
      "Emin olmadığın bir alanı silmek, yanlış bir alan yazmaktan iyidir.",
  ].join("\n");
}
