/**
 * MCP sunucusunun HTTP yüzeyi — durumsuz Streamable HTTP (Aşama M4).
 *
 * NEDEN BURADA, `app/src/app/mcp/route.ts` İÇİNDE DEĞİL: TODO'nun M4 maddesi
 * transport'u route dosyasına yazıyordu, sapıldı ve gerekçesi ölçülmüş bir
 * hataya dayanıyor. Kök `tsconfig.json` her paketin src dizinini kapsıyor,
 * `app/`'ı KAPSAMIYOR — M1'de tam bu yüzden `app/src/app/page.tsx` sessizce
 * çürüdü ve deploy'un build adımını düşürdü. Bu dosya `npm run typecheck`
 * altında; route.ts olsaydı olmayacaktı. İkincisi: burası düz bir
 * `new Request(...)` ile çağrılabiliyor, yani JSON-RPC round-trip'i
 * `npm test` içinde Next ayağa kalkmadan ölçülüyor (`test/http.test.ts`).
 *
 * `server.ts`'in kuralı bozulmadı: `createServer()` hâlâ hiçbir transport
 * bilmiyor, ona neyin bağlanacağına çağıran karar veriyor. Değişen tek şey
 * çağıranın yeri — uçta burası, testte InMemoryTransport.
 *
 * HER İSTEKTE YENİ TRANSPORT VE YENİ SERVER. Tercih değil, SDK'nın kısıtı:
 * durumsuz bir transport ikinci `handleRequest`'te ATIYOR ("Stateless
 * transport cannot be reused across requests", `webStandardStreamableHttp.js`).
 * Serverless'ta zaten paylaşılacak durum yok — iki ardışık istek iki ayrı
 * örneğe düşebilir.
 *
 * `initialize`'ın kaybolması sorun değil, SDK kaynağı okunarak doğrulandı:
 * `server/index.js` gelen istekleri "initialize edilmedi" diye reddetmiyor,
 * `_clientCapabilities` yalnızca sunucu->istemci çağrıları (sampling,
 * elicitation) için kullanılıyor ve bu sunucu hiç öyle çağrı yapmıyor. Yani
 * `tools/list` yeni doğmuş bir server'a düşse de çalışıyor. Testte uçtan uca
 * ölçülüyor.
 */
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";

import { createServer } from "./server.ts";

/** JSON-RPC hata gövdesi. Uç HTML değil, her zaman JSON döndürür. */
function jsonRpcError(status: number, code: number, message: string, extra?: Record<string, string>): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", error: { code, message }, id: null }), {
    status,
    headers: { "content-type": "application/json", ...extra },
  });
}

/**
 * GET ve DELETE burada bitiyor, transport'a devredilmiyor.
 *
 * GET devredilseydi durumsuz modda BİTMEYEN bir standalone SSE akışı açılırdı
 * (`handleGetRequest`) ve Vercel'de fonksiyon `maxDuration`'a kadar asılı
 * kalırdı — ücretsiz kademede doğrudan kota yakan bir davranış. Spec, SSE
 * sunmayan sunucunun 405 dönmesine izin veriyor. DELETE ise oturum sonlandırma
 * ve burada oturum yok.
 */
function methodNotAllowed(method: string): Response {
  return jsonRpcError(
    405,
    -32000,
    `${method} desteklenmiyor. Bu uç durumsuz Streamable HTTP: yalnızca POST.`,
    { allow: "POST" },
  );
}

/**
 * Tek bir MCP isteğini karşılar.
 *
 * `enableJsonResponse: true` — varsayılan SSE akışı yerine düz JSON. İki
 * sebep: (1) SSE modda fonksiyon 15 sn'lik keep-alive frame'leriyle açık
 * kalır, (2) JSON modda `handleRequest` TAM MATERYALİZE bir `Response` ile
 * çözülüyor, yani aşağıdaki `finally`'de `close()` çağırmak gövdeyi kesmiyor.
 */
export async function handleMcpRequest(request: Request): Promise<Response> {
  if (request.method !== "POST") return methodNotAllowed(request.method);

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  const server = createServer();

  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } catch (error) {
    // Buraya düşmek araç hatası DEĞİL, transport veya sunucu kurulumu hatası.
    // Araçların kendi hataları `isError: true` taşıyan normal sonuçlar.
    return jsonRpcError(500, -32603, `MCP sunucusu isteği karşılayamadı: ${String(error)}`);
  } finally {
    await server.close();
  }
}
