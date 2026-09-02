/**
 * validate_script — @minecraft/server kodunu gerçek tsc ile derler.
 *
 * SEKİZ ARAÇTAN ALT SÜREÇ AÇAN TEK ARAÇ BU. `validateScript` tsc'yi ayrı bir
 * süreç olarak çalıştırıyor, `mkdtemp` ile geçici dizin açıyor ve
 * data/<sürüm>/script-types/ altındaki .d.ts dosyalarını okuyor. Serverless
 * bir ortamda üçünün hiçbiri garanti değildi — barındırma ölçümü tam olarak
 * bunu ölçtü ve dağıtılmış Vercel Node runtime'ında altı ön koşulun altısı da
 * yeşil çıktı. Rotanın `maxDuration`'ı bu araca göre ayarlı.
 *
 * Değeri şurada: model 2.x'te kaldırılmış bir API'yi (`runCommandAsync`) ya
 * da hiç var olmamış bir modülü ezberden yazdığında, buradan gerçek bir tsc
 * tanısı dönüyor — satır, sütun, TS kodu ve öneriyle birlikte.
 *
 * ATMA / DÖNME AYRIMI: kodun tip hatası olması hata DEĞİL, `ok:false` taşıyan
 * normal sonuç. validateScript yalnızca doğrulama ortamı bozuksa atıyor
 * (tsc sıfırdan farklı çıkıp hiç tanı vermediyse) — o gerçekten araç hatası.
 */
import { validateScript } from "@codecraft/validator";
import { z } from "zod";

import { jsonResult } from "../limit.ts";
import { READ_ONLY, versionField, type ToolModule } from "../tool.ts";

export const validateScriptTool: ToolModule = {
  name: "validate_script",
  register: (server) => {
    server.registerTool(
      "validate_script",
      {
        title: "@minecraft/server script'ini derle",
        description:
          "Bir behavior pack script'ini o sürümün gerçek @minecraft/server tip " +
          "tanımlarına karşı TypeScript derleyicisiyle derler. Satır, sütun, TS " +
          "hata kodu ve mesajıyla birlikte tanı döndürür; hangi modül sürümlerine " +
          "karşı derlendiğini de söyler. Var olmayan API'leri ve sürümden " +
          "kaldırılmış çağrıları burada yakala — ezberden yazılmış Bedrock script " +
          "API'si en sık sessizce çalışmayan çıktıyı üretiyor.",
        inputSchema: {
          code: z.string().min(1).describe("Script'in tam içeriği. JavaScript veya TypeScript."),
          version: versionField,
          channel: z
            .enum(["stable", "beta"])
            .optional()
            .describe(
              "Modül kanalı. Varsayılan stable. beta istenip o modülün betası yoksa " +
                "kararlıya düşer — hangi sürüme karşı derlendiği sonuçtaki modules alanında.",
            ),
        },
        annotations: READ_ONLY,
      },
      async ({ code, version, channel }) => jsonResult(await validateScript(code, { version, channel })),
    );
  },
};
