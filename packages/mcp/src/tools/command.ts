/**
 * validate_command — komut satırını resmi komut indeksine karşı doğrular
 * (Aşama M3).
 *
 * NEDEN VAR: bu doğrulayıcı bir kez "v1'de yapılmayacak" listesindeydi ve
 * gerekçesi "makine okunur resmi kaynak yok" idi. Yanlıştı —
 * bedrock-samples içinde `metadata/command_modules/mojang-commands.json`
 * duruyor: 83 komut, 270 aşırı yükleme, 225 enum. Kural 30-08-2026'da
 * kaldırıldı ve doğrulayıcı yazıldı (CLAUDE.md). Dışarı açılmaması, yazılmış
 * bir yeteneğin kullanılmaması olurdu.
 *
 * Tek satır alıyor. Birden fazla komutu olan bir dosya için review_pack
 * kullanılmalı — o .txt dosyalarını kendi bölüyor, boş satırları ve # ile
 * başlayan yorumları atlıyor.
 *
 * Çıktı küçük: ölçülen en büyüğü `/execute` (18 aşırı yükleme) ile 2.683 bayt.
 * Eşleşen aşırı yükleme bulunamazsa `usage` doluyor — modelin doğru biçimi
 * görmesi için.
 */
import { validateCommand } from "@codecraft/validator";
import { z } from "zod";

import { jsonResult } from "../limit.ts";
import { READ_ONLY, versionField, type ToolModule } from "../tool.ts";

export const validateCommandTool: ToolModule = {
  name: "validate_command",
  register: (server) => {
    server.registerTool(
      "validate_command",
      {
        title: "Bedrock komutunu doğrula",
        description:
          "Tek bir Bedrock komut satırını resmi komut indeksine karşı doğrular: " +
          "komut var mı, argüman sayısı tutuyor mu, seçiciler ve blok durumları " +
          "geçerli mi. Eşleşen bir kullanım yoksa geçerli biçimleri döndürür ve " +
          "komutun hile (cheats) gerektirip gerektirmediğini söyler. " +
          "Kullanıcıya komut vermeden önce buradan geçir. " +
          "BİLİNEN BOŞLUK: `execute ... run <komut>` zincirlemesi çözülmüyor, " +
          "run sonrası fazladan argüman sanılıyor — o biçimdeki arity hatasını " +
          "yok say (docs/COMMANDS.md).",
        inputSchema: {
          line: z
            .string()
            .min(1)
            .describe('Tek bir komut satırı, örn. "/give @p diamond 1". Baştaki / isteğe bağlı.'),
          version: versionField,
        },
        annotations: READ_ONLY,
      },
      async ({ line, version }) => jsonResult(await validateCommand(line, { version })),
    );
  },
};
