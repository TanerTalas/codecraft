/**
 * validate_json — üretilen JSON'u Blockception şemasına karşı doğrular
 * (Aşama M3).
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
        title: "Bedrock JSON'unu şemaya karşı doğrula",
        description:
          "Bir behavior/resource pack JSON dosyasını resmi şemaya karşı doğrular ve " +
          "her hatanın JSON pointer'ını, ihlal edilen kuralı ve okunabilir mesajını " +
          "döndürür. Fazla alanın adını ve geçerli enum değerlerini mesaja koyar. " +
          "Ürettiğin her JSON dosyasını kullanıcıya vermeden önce buradan geçir.",
        inputSchema: {
          content: z
            .string()
            .min(1)
            .describe("Dosyanın tam içeriği, metin olarak. Ayrıştırma hataları da yakalanır."),
          type: z
            .string()
            .min(1)
            .describe(
              'Belge tipi. Kanonik ad ("behavior/blocks/blocks"), kısaltma ' +
                '("behavior/blocks") ya da dosya yolu ("BP/blocks/ruby.json") kabul edilir. ' +
                "Tanınan tiplerin listesi get_version_info çıktısında.",
            ),
          version: versionField,
        },
        annotations: READ_ONLY,
      },
      async ({ content, type, version }) => jsonResult(await validateJson(content, type, version)),
    );
  },
};
