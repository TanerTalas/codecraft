/**
 * validate_python — dışarıdan çalışan otomasyon script'lerini doğrular.
 *
 * NEDEN AYRI BİR ARAÇ. Python, behavior pack'in içinde çalışmıyor; paketin
 * içinde JS/TS ve `@minecraft/server` var. Python oyunla `/connect` WebSocket
 * köprüsü üzerinden konuşan DIŞ kanal (`docs/WEBSOCKET.md`) ve `CLAUDE.md` v1
 * kapsamında açıkça sayıyor. `validate_script` bu koda uygulanamaz — o tsc
 * çalıştırıyor.
 *
 * Bu araç açılana kadar üretilen Python çıktısı hiçbir doğrulamadan
 * geçmiyordu (`packages/core/src/output.ts`: "command ve python ölçülemiyor").
 *
 * ALT SÜREÇ AÇAN İKİNCİ ARAÇ. `validate_script` gibi bu da bir alt süreç
 * açıyor — Python yorumlayıcısı. Ön koşulu M1'in yöntemiyle ayrıca ölçülüyor
 * (`pythonRuntimeReport`), ve yorumlayıcı yoksa sözdizimi ayağı atlanıp
 * ÇIKTIDA söyleniyor. Sessizce atlayıp `ok:true` dönmek, doğrulanmamış bir
 * çıktıyı doğrulanmış göstermek olurdu.
 */
import { validatePython } from "@codecraft/validator";
import { z } from "zod";

import { jsonResult } from "../limit.ts";
import { READ_ONLY, versionField, type ToolModule } from "../tool.ts";

export const validatePythonTool: ToolModule = {
  name: "validate_python",
  register: (server) => {
    server.registerTool(
      "validate_python",
      {
        title: "Validate an automation script",
        description:
          "Validates a Python automation script that runs OUTSIDE the game, on three " +
          "axes: Python syntax (using the real interpreter), Minecraft commands " +
          "embedded in the script (against the official command index), and the shape " +
          "of the /connect WebSocket message envelope. For behavior pack scripts use " +
          "validate_script instead — Python does not run inside a pack. The embedded " +
          "command check is the most valuable one: a command written from memory can " +
          "look syntactically fine and still do nothing in the game. Only strings " +
          "starting with / are treated as commands. If syntax could not be checked, " +
          "syntaxChecked is false in the result; ok:true alone does not mean the " +
          "syntax is valid.",
        inputSchema: {
          code: z.string().min(1).describe("The complete Python script content."),
          version: versionField,
        },
        annotations: READ_ONLY,
      },
      async ({ code, version }) => jsonResult(await validatePython(code, { version })),
    );
  },
};
