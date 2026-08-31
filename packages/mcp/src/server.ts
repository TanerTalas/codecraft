/**
 * MCP sunucusunun kurulumu (Aşama M2).
 *
 * TRANSPORT BURADA YOK ve olmayacak. Yerleşim kararı (TODO.md): araç mantığı
 * bu workspace'te, transport mevcut Next uygulamasında
 * `app/src/app/mcp/route.ts` olarak (Aşama M4). Mimari kural 1'in aynısı —
 * mantık çekirdekte, arayüz ince kabuk. createServer() bir McpServer
 * döndürüyor, ona neyin bağlanacağına çağıran karar veriyor: uçta HTTP
 * transport'u, testte SDK'nın in-memory transport'u.
 *
 * SÜRÜM NUMARASI — buradaki `version` SUNUCUNUN kendi sürümü, MCP protokol
 * sürümü değil, Bedrock sürümü hiç değil. Bedrock'ta zaten beş ayrı sürüm
 * biçimi dolaşıyor (CLAUDE.md); altıncısını karıştırmamak için burada
 * yazılı duruyor.
 */
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { getVersionInfo } from "./tools/version.ts";

/** Sunucunun kendi sürümü. package.json ile aynı, elle tutuluyor. */
export const SERVER_VERSION = "0.0.0";

/**
 * Kayıtlı araçlar. Aşama M3 bu diziyi büyütecek.
 *
 * Dizi olarak duruyor ki hem createServer hem test aynı listeyi görsün —
 * "kaydedildi ama listelenmiyor" hatası ölçülebilsin.
 */
export const tools = [getVersionInfo];

export function createServer(): McpServer {
  const server = new McpServer(
    { name: "codecraft", version: SERVER_VERSION },
    {
      instructions:
        "Minecraft Bedrock için doğrulanmış çıktı üretmeye yarayan araçlar. " +
        "Bedrock'un sürüm alanları birbirine karışıyor: bir behavior pack " +
        "dosyası yazmadan önce get_version_info çağır ve format_version ile " +
        "min_engine_version değerlerini oradan al, hatırladığından değil.",
    },
  );

  for (const tool of tools) {
    server.registerTool(tool.name, tool.config, tool.run);
  }

  return server;
}
