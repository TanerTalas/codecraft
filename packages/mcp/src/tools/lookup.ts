/**
 * lookup_id — bir kimlik bu sürümde var mı.
 *
 * ADI NEDEN `lookup_block` DEĞİL: karar dokümanı aracı öyle yazmıştı, ama
 * lookup katmanı on iki türü birden tanıyor (block, item, entity, biome,
 * effect, enchantment, feature, dimension, camera-preset, cooldown-category,
 * potion-effect, potion-type). Kullanıcı "minecraft:blaze var mı" diye
 * sorduğunda türü önceden bilmek zorunda kalmamalı; blokla sınırlamak
 * varlıkları ve eşyaları hiç sorulamaz yapardı. Kapsam ölçümle de serbest:
 * tek sonuç 74 bayt, en karmaşık blok durumu 130 bayt — token baskısı yok.
 *
 * İNDEKS DÖNDÜRMÜYOR, TEK KİMLİĞİN SONUCUNU DÖNDÜRÜYOR. Mevcut lookup() zaten
 * öyle çalışıyor ve bu korunmalı: blok indeksi 166.558 bayt.
 *
 * Blok çıkarsa durumları da ekleniyor. Sebep ölçülmüş bir hata sınıfı:
 * `minecraft:oak_stairs["weirdo_direction"=0]` gibi bir durum adı yanlış
 * yazıldığında oyun sessizce yanlış bloğu koyuyor.
 */
import { blockStates, lookupAny } from "@codecraft/knowledge";
import { z } from "zod";

import { jsonResult } from "../limit.ts";
import { READ_ONLY, versionField, type ToolModule } from "../tool.ts";

export const lookupId: ToolModule = {
  name: "lookup_id",
  register: (server) => {
    server.registerTool(
      "lookup_id",
      {
        title: "Verify a vanilla identifier",
        description:
          "Tells you whether a minecraft: identifier actually exists in this version " +
          "and what kind it is (block, item, entity, biome, effect, enchantment, " +
          "feature, dimension, camera preset, particle, potion). For a block it also " +
          "returns the valid block states and the values they accept. An identifier " +
          "without a namespace is treated as minecraft:. Verify every identifier here " +
          "before writing it — an identifier that does not exist fails silently in " +
          "the game.",
        inputSchema: {
          id: z
            .string()
            .min(1)
            .describe('Identifier, e.g. "minecraft:blaze" or just "blaze" without the namespace.'),
          version: versionField,
        },
        annotations: READ_ONLY,
      },
      async ({ id, version }) => {
        const result = await lookupAny(id, { version });
        if (result.kind !== "block") return jsonResult(result);

        // Blok durumları yalnızca blok için anlamlı; null "blok yok" demek.
        const states = await blockStates(result.id, version);
        return jsonResult({ ...result, states: states ?? {} });
      },
    );
  },
};
