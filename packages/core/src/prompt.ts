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
        `Oyun sürümü "${context.engineVersion}". Pazarlama numarası (26.40 gibi) ` +
          "hiçbir dosyaya yazılmaz.",
        "**`format_version` oyun sürümü DEĞİLDİR.** Her dosya tipinin kendi " +
          "şema sürümüdür ve tipe göre değişir. Oyun sürümünü buraya yazmak " +
          "dosyayı geçersiz kılar — aşağıdaki listeye bak.",
        `manifest.json içinde min_engine_version üç parçalı dizidir: [${context.minEngineVersion.join(", ")}].`,
        "Pazarlama numarası (26.40 gibi) hiçbir dosyaya yazılmaz.",
        `@minecraft/* modül sürümleri oyun sürümünden ayrıdır: ${modules}. ` +
          "manifest dependencies alanına bu sürümler yazılır, oyun sürümü değil.",
        "Script API 2.x kullanılır. Aşağıdakiler 1.x'te vardı ve **kaldırıldı** " +
          "— gerçek koşularda modelin ürettiği hâlleriyle ölçüldü:\n" +
          "  · `world.events` → `world.afterEvents` / `world.beforeEvents`\n" +
          "  · `dimension.runCommandAsync(...)` → `dimension.runCommand(...)`\n" +
          "  · `worldInitialize` → `worldLoad`",
        "Doğrulama katı null denetimiyle koşuyor. `getBlock()`, `getComponent()` " +
          "ve `Array.shift()` gibi çağrılar `undefined` dönebilir; sonucu " +
          "kullanmadan önce kontrol et.",
      ]),
  );

  // Tek satır, madde listesi değil. İlk hâli 15 satırdı ve prompt'un %13'ünü
  // kaplıyordu; aynı bilgi üçte bir yere sığıyor. Uzun prompt dikkati
  // seyreltiyor olabilir (ölçüm belirsiz kaldı ama bedava bir iyileştirme bu).
  const formats = Object.entries(context.formatVersions)
    .filter(([type]) => type.startsWith("behavior/") || type === "general/manifest")
    .map(([type, values]) => `${type.split("/").at(-1)} ${values.join("/")}`);

  if (formats.length > 0) {
    sections.push(
      `## format_version\n\n${formats.join(" · ")}\n\n` +
        "Listede olmayan tipte o tipin kendi şema sürümünü yaz, oyun sürümünü değil.",
    );
  }

  sections.push(`## Dosya yerleşimi\n\n${LAYOUT}`);

  sections.push(
    "## manifest.json\n\n" +
      bullet([
        "`header.uuid` ve her modülün `uuid` alanı **RFC 4122 sürüm 4** biçiminde " +
          "olmalı: üçüncü grup `4` ile, dördüncü grup `8`, `9`, `a` veya `b` ile " +
          "başlar. Örnek biçim: `xxxxxxxx-xxxx-4xxx-axxx-xxxxxxxxxxxx`.",
        "Her UUID benzersiz olmalı — header ile modül aynı olamaz.",
        "Script modülü varsa `dependencies` içine `@minecraft/server` ve " +
          "kullanılıyorsa `@minecraft/server-ui` yazılır, yukarıdaki sürümlerle.",
        "Script modülünün biçimi **tam olarak** şöyle olmalı:\n" +
          '  `{ "type": "script", "language": "javascript", ' +
          '"entry": "scripts/main.js", "uuid": "...", "version": [1,0,0] }`\n' +
          '  `"type": "javascript"` 1.16 öncesinden kalma ve artık yüklenmiyor: ' +
          "oyun paketi davranış paketleri listesinde hiç göstermiyor " +
          "(gerçek oyunda ölçüldü).",
      ]),
  );

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
    "## Doku (texture) referansları\n\n" +
      bullet([
        "Kaynak paketi ÜRETİLMİYOR. `minecraft:icon` ve " +
          "`minecraft:material_instances` yalnızca vanilla'da ZATEN VAR OLAN bir " +
          "doku anahtarına işaret edebilir; tanımsız bir anahtar oyunda uyarı " +
          "değil içerik hatası verir ve item elde bomboş görünür.",
        `Anahtar sayısı: ${context.textures.item} item ikonu, ` +
          `${context.textures.terrain} blok yüzeyi.`,
        "Anahtar adı kimlikten TÜRETİLEMEZ. Ölçüldü: item kimliklerinin yalnızca " +
          "%13'ünün, blok kimliklerinin %40'ının atlasta aynı adla karşılığı var. " +
          '"codecraft:ruby" için "ruby" yazma — o anahtar yok.',
        "Yeni bir item ya da blok için var olan bir vanilla dokusunu ödünç al " +
          '(örneğin ikon "diamond", blok yüzeyi "diamond_ore"). Özel görsel ' +
          "kullanıcının kendi kaynak paketini yazmasını gerektirir; bunu notlarda söyle.",
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
