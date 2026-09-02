/**
 * validate_script — @minecraft/server kodunu gerçek tsc ile derler.
 *
 * DOKUZ ARAÇTAN ALT SÜREÇ AÇAN TEK ARAÇ BU. `validateScript` tsc'yi ayrı bir
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
        title: "Compile an @minecraft/server script",
        description:
          "Compiles a behavior pack script with the real TypeScript compiler against " +
          "the actual @minecraft/server type definitions for that version. Returns " +
          "diagnostics with line, column, TS error code and message, and reports which " +
          "module versions it compiled against. Catch non-existent APIs and calls " +
          "removed in later versions here — Bedrock scripting APIs written from memory " +
          "are the most common source of output that fails silently.",
        inputSchema: {
          code: z.string().min(1).describe("The complete script content. JavaScript or TypeScript."),
          version: versionField,
          channel: z
            .enum(["stable", "beta"])
            .optional()
            .describe(
              "Module channel. Defaults to stable. If beta is requested but a module has " +
                "no beta release it falls back to stable — the modules field in the result " +
                "says which version each module was compiled against.",
            ),
        },
        annotations: READ_ONLY,
      },
      async ({ code, version, channel }) => jsonResult(await validateScript(code, { version, channel })),
    );
  },
};
