/**
 * lookup_id — bir kimlik bu sürümde var mı (Aşama M3).
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
        title: "Vanilla kimliği doğrula",
        description:
          "Bir minecraft: kimliğinin bu sürümde gerçekten var olup olmadığını ve " +
          "hangi türde olduğunu söyler (blok, eşya, varlık, biyom, efekt, büyü, " +
          "feature, boyut, kamera ön ayarı, potion). Blok çıkarsa geçerli blok " +
          "durumlarını ve alabilecekleri değerleri de döndürür. Namespace'siz " +
          "verilen kimlik minecraft: sayılır. Hatırladığın bir kimliği yazmadan " +
          "önce buradan doğrula — var olmayan kimlik oyunda sessizce çalışmıyor.",
        inputSchema: {
          id: z
            .string()
            .min(1)
            .describe('Kimlik, örn. "minecraft:blaze" ya da namespace\'siz "blaze".'),
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
