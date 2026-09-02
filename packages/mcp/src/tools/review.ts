/**
 * review_pack — bir paketin tamamını tek çağrıda doğrular.
 *
 * TEK ÇAĞRIDA EN ÇOK DEĞER ÜRETEN ARAÇ BU. Diğerleri tek bir dosyaya ya da tek
 * bir satıra bakıyor; `review()` dosya başına doğru doğrulayıcıyı kendi seçiyor
 * (JSON'a ajv, script'e tsc, .txt'ye komut doğrulayıcı) ve üstüne şemanın
 * yapısal olarak yakalayamadığı semantik kontrolleri koşuyor: kimlik
 * tutarlılığı, dosya adı türetme, manifest, doku anahtarları, kalıp uyumu
 * (docs/VALIDATION-LIMITS.md).
 *
 * Doğrulamanın tek yolu bu: dosya başına doğrulayıcı seçimi başka hiçbir
 * yerde tekrarlanmıyor. Dağıtılmış uçta ölçüldü.
 *
 * SÜRÜM BURADA ZORUNLU: `review(files, version: string)` imzası sürümü
 * opsiyonel almıyor. Araç yüzeyinde opsiyonel tutuluyor (diğer yedi araçla
 * aynı biçim olsun diye) ama verilmezse `resolveVersion()` ile çözülüp
 * geçiliyor — `undefined` sızdırılmıyor.
 *
 * `report` alanı boş değilse retry metnidir: doğrudan modele geri verilebilecek,
 * eyleme dönüştürülebilir bir özet.
 */
import { review } from "../bedrock/review.ts";
import { resolveVersion } from "@codecraft/knowledge";
import { z } from "zod";

import { jsonResult } from "../limit.ts";
import { READ_ONLY, versionField, type ToolModule } from "../tool.ts";

export const reviewPack: ToolModule = {
  name: "review_pack",
  register: (server) => {
    server.registerTool(
      "review_pack",
      {
        title: "Validate a whole pack",
        description:
          "Validates every file of a behavior or resource pack in one call: it applies " +
          "the right validator to each file (JSON schema, script compilation, command " +
          "syntax) and then runs the checks a schema structurally cannot do — " +
          "identifier consistency, filename rules, manifest module type, texture keys, " +
          "component names, Molang queries and loot/trade table paths. This is the LAST " +
          "step before handing a pack to the user, and it is both faster and broader " +
          "than validating each file separately.",
        inputSchema: {
          files: z
            .array(
              z.object({
                path: z
                  .string()
                  .min(1)
                  .describe('Path inside the pack, e.g. "behavior_packs/ruby/blocks/ruby_ore.json".'),
                content: z.string().describe("The complete file content."),
              }),
            )
            .min(1)
            .describe("The files in the pack. Include the manifest — several checks depend on it."),
          version: versionField,
        },
        annotations: READ_ONLY,
      },
      async ({ files, version }) => {
        // review() sürümü zorunlu istiyor; opsiyonel yüzeyi burada kapatılıyor.
        const resolved = version ?? (await resolveVersion()).version;
        return jsonResult(await review(files, resolved));
      },
    );
  },
};
