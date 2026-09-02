/**
 * get_schema — bir belge tipinin hedefe yönelik şema özeti.
 *
 * SEKİZ ARAÇTAN TEK "SARMALAMA OLMAYAN" ARAÇ BU, ve M3'ün asıl işi buydu.
 * Sebep ölçüm: ham şema döndürülemiyor. `entities.json` 585.237 bayt,
 * `commands.json` 650.454 — ikisi de bütçenin kat kat üstünde. Karar dokümanı
 * bunu optimizasyon değil zorunluluk sayıyor.
 *
 * Ham şema büyük olmasa bile işe yaramazdı: "compiled" derlemesi tanım
 * adlarını tek harfe indirmiş (`#/definitions/A`). Yani `definitions` bloğunu
 * olduğu gibi vermek modele hiçbir şey söylemezdi.
 *
 * Özetleyici `packages/validator/src/schema-summary.ts` içinde — saf fonksiyon,
 * MCP'ye bağlı değil (mimari kural 3). Burası yalnızca onu araca çeviriyor ve
 * bayt tavanını veriyor.
 *
 * `path` KULLANIM BİÇİMİ: kök özetler küçük (blocks 712 B, entities 706 B) ama
 * derinlerde patlıyor — `minecraft:entity/components` düğümünde 390 alan var.
 * Orada özet ad listesine iniyor ve bunu `truncated` alanında söylüyor, sonra
 * model `path` ile tek bir bileşene inip tam ayrıntıyı alıyor (644 B).
 * Sessiz kesme yok: modelin neyi göremediğini bilmesi gerekiyor.
 */
import { summarizeSchema } from "@codecraft/validator";
import { z } from "zod";

import { BYTE_LIMIT, jsonResult } from "../limit.ts";
import { READ_ONLY, versionField, type ToolModule } from "../tool.ts";

export const getSchema: ToolModule = {
  name: "get_schema",
  register: (server) => {
    server.registerTool(
      "get_schema",
      {
        title: "Schema summary for a document type",
        description:
          "Summarises the schema of a Bedrock document type: required fields, valid " +
          "format_version values, and the name, type and description of every field on " +
          "that node. It does not return the raw schema — that is far too large. When a " +
          "node has many fields the summary narrows and says what was shortened in the " +
          "truncated field; use path to descend into a child node for full detail. Call " +
          "this before writing a file to learn which fields are required and what " +
          "format_version must be.",
        inputSchema: {
          type: z
            .string()
            .min(1)
            .describe(
              'Document type, e.g. "behavior/blocks", "behavior/entities", ' +
                '"behavior/spawn_rules". The full list is in the get_version_info output.',
            ),
          path: z
            .string()
            .optional()
            .describe(
              'Path to descend into the schema, separated by "/". For example ' +
                '"minecraft:entity" or "minecraft:entity/components/minecraft:health". ' +
                "Omit it to get the root summary. An unresolvable path returns an error " +
                "that lists the valid fields on that node.",
            ),
          version: versionField,
        },
        annotations: READ_ONLY,
      },
      async ({ type, path, version }) =>
        jsonResult(await summarizeSchema(type, { version, path, limit: BYTE_LIMIT })),
    );
  },
};
