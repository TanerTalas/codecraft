/**
 * validate_command — komut satırını resmi komut indeksine karşı doğrular
 *.
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
        title: "Validate a Bedrock command",
        description:
          "Validates a single Bedrock command line against the official command " +
          "index: does the command exist, does the argument count match, are the " +
          "selectors and block states valid. When no overload matches it returns the " +
          "valid usages, and it tells you whether the command requires cheats. Run " +
          "every command through this before giving it to the user. " +
          "`execute ... run <command>` chains are resolved: the command after run is " +
          "validated too, including nested execute.",
        inputSchema: {
          line: z
            .string()
            .min(1)
            .describe('A single command line, e.g. "/give @p diamond 1". The leading / is optional.'),
          version: versionField,
        },
        annotations: READ_ONLY,
      },
      async ({ line, version }) => jsonResult(await validateCommand(line, { version })),
    );
  },
};
