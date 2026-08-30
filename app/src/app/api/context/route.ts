/**
 * POST /api/context — sürüme kilitli bağlam.
 *
 * İnce kabuk (mimari kural 1): iş `buildContext` içinde, burada yalnızca
 * gövde doğrulaması var. Sunucuda olmasının sebebi `data/` — tarayıcı 1313
 * şemayı indirmiyor.
 */
import { buildContext, contextRequestSchema } from "@codecraft/core";

// tsc ve dosya sistemi gerekiyor; edge runtime'da koşamaz.
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const parsed = contextRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return new Response(`Geçersiz gövde: ${parsed.error.issues[0]?.message ?? "bilinmiyor"}`, {
      status: 400,
    });
  }

  const context = await buildContext(parsed.data.request, { version: parsed.data.version });
  return Response.json(context);
}
