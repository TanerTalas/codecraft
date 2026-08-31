/**
 * get_schema — bir belge tipinin hedefe yönelik şema özeti (Aşama M3).
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
        title: "Belge tipinin şema özeti",
        description:
          "Bir Bedrock belge tipinin şemasını özetler: zorunlu alanlar, geçerli " +
          "format_version değerleri, ve o düğümdeki alanların adı, tipi, açıklaması. " +
          "Ham şema döndürmez — çok büyük. Alan sayısı fazlaysa özet daralır ve " +
          "neyin kısaldığını truncated alanında söyler; ayrıntı için path ile alt " +
          "bir düğüme in. Bir dosya yazmadan önce hangi alanların zorunlu olduğunu " +
          "ve format_version'ın ne olması gerektiğini buradan öğren.",
        inputSchema: {
          type: z
            .string()
            .min(1)
            .describe(
              'Belge tipi: "behavior/blocks", "behavior/entities", ' +
                '"behavior/spawn_rules" gibi. Tam liste get_version_info çıktısında.',
            ),
          path: z
            .string()
            .optional()
            .describe(
              'Şema içinde inilecek yol, "/" ile ayrılmış. Örn. "minecraft:entity" ya da ' +
                '"minecraft:entity/components/minecraft:health". Verilmezse kök özeti döner. ' +
                "Çözülemeyen yol hata verir; o düğümdeki geçerli alanlar hata mesajında.",
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
