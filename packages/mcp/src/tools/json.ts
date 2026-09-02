/**
 * validate_json — üretilen JSON'u Blockception şemasına karşı doğrular
 *.
 *
 * CodeCraft'ın var olma sebebi tam olarak bu araç: genel bir model Bedrock
 * JSON'unu ezberden yazıyor ve yanlış alan adı sessizce çalışmayan çıktı
 * üretiyor. Burada gerçek şema, gerçek ajv, gerçek hata.
 *
 * HATA ÇIKTISI DÜZLEŞTİRİLMİYOR. `errors` bir dizi olarak geçiyor,
 * birleştirilmiş metin değil; her hatanın JSON pointer'ı (`path`) ve ihlal
 * edilen anahtar kelimesi (`keyword`) ayrı duruyor. json.ts'teki `describe()`
 * fazla alanın adını ve enum listesini (12 öğeye kadar) mesaja koyuyor —
 * arşivdeki Adım 3.5 ölçümü bu iki eklemenin tek başına bir vakayı
 * kurtardığını gösteriyor (`ore-gen-01`: "must NOT have additional
 * properties" -> '... : "places_block"').
 *
 * ATMA / DÖNME AYRIMI: doküman tipi çözümlenemezse validateJson ATIYOR ve bu
 * araç hatası olarak dışarı çıkıyor — kullanıcının tipi yanlış, doğrulama
 * hiç koşmadı. İçeriğin şemaya uymaması hata değil, `ok:false` taşıyan
 * normal sonuç.
 */
import { validateJson } from "@codecraft/validator";
import { z } from "zod";

import { jsonResult } from "../limit.ts";
import { READ_ONLY, versionField, type ToolModule } from "../tool.ts";

export const validateJsonTool: ToolModule = {
  name: "validate_json",
  register: (server) => {
    server.registerTool(
      "validate_json",
      {
        title: "Validate Bedrock JSON against its schema",
        description:
          "Validates a behavior or resource pack JSON file against the official " +
          "schema and returns the JSON pointer, the violated rule and a readable " +
          "message for every error. Unexpected property names and the valid enum " +
          "values are included in the message. Run every JSON file you produce " +
          "through this before handing it to the user.",
        inputSchema: {
          content: z
            .string()
            .min(1)
            .describe("The complete file content as text. Parse errors are reported too."),
          type: z
            .string()
            .min(1)
            .describe(
              'Document type. A canonical name ("behavior/blocks/blocks"), a short ' +
                'form ("behavior/blocks") or a file path ("BP/blocks/ruby.json") are all ' +
                "accepted. The list of recognised types is in the get_version_info output.",
            ),
          version: versionField,
        },
        annotations: READ_ONLY,
      },
      async ({ content, type, version }) => jsonResult(await validateJson(content, type, version)),
    );
  },
};
