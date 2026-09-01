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
        title: "Otomasyon script'ini doğrula",
        description:
          "Oyunun DIŞINDA çalışan bir Python otomasyon script'ini üç eksende " +
          "doğrular: Python sözdizimi (gerçek yorumlayıcıyla), script'e gömülü " +
          "Minecraft komutları (resmi komut indeksine karşı) ve /connect " +
          "WebSocket mesaj zarfının biçimi. Behavior pack script'i için bunu " +
          "değil validate_script'i kullan — Python paketin içinde çalışmaz. " +
          "Gömülü komut kontrolü en değerlisi: ezberden yazılmış bir komut " +
          "sözdizimi olarak doğru görünüp oyunda sessizce çalışmıyor. " +
          "Yalnızca / ile başlayan dizeler komut sayılır. Sözdizimi " +
          "bakılamazsa sonuçtaki syntaxChecked false olur; ok:true tek başına " +
          "sözdiziminin doğru olduğu anlamına gelmez.",
        inputSchema: {
          code: z.string().min(1).describe("Python script'inin tam içeriği."),
          version: versionField,
        },
        annotations: READ_ONLY,
      },
      async ({ code, version }) => jsonResult(await validatePython(code, { version })),
    );
  },
};
