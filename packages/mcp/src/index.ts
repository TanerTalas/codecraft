// @codecraft/mcp — MCP araç katmanı (Aşama M2–M3, bkz. TODO.md)
//
// Bu paket ARAÇLARI, sunucu kurulumunu ve HTTP yüzeyini taşır. Aşama M4'te
// `handleMcpRequest` eklendi: durumsuz Streamable HTTP, `src/http.ts`.
// `app/src/app/mcp/route.ts` yalnızca onu dışa veren ince kabuk.
//
// BAĞIMLILIK SINIRI — buradan `@codecraft/core` (barrel) import EDİLMEZ,
// yalnızca `@codecraft/core/server`. Barrel model.ts'i dışa açıyor ve o
// `ai` + `@ai-sdk/google`'ı çekiyor; MCP sunucusunun bir LLM SDK'sına
// ihtiyacı yok, modeli kullanıcı getiriyor (mimari kural 2).
//
// Kural laf olarak değil ölçüyle duruyor: `test/layers.test.ts`.

export { createServer, SERVER_VERSION, tools } from "./server.ts";
export { handleMcpRequest } from "./http.ts";
export { BYTE_LIMIT, byteLength, capText, jsonResult } from "./limit.ts";
export { READ_ONLY, versionField } from "./tool.ts";
export type { ToolModule } from "./tool.ts";
