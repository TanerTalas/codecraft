/**
 * POST /api/review — şema (ajv) ve script (tsc) doğrulaması.
 *
 * Mimari kural 2'nin sunucu yarısı. `review()` üretim döngüsünün çağırdığı
 * fonksiyonun aynısı: eval, CLI ve web aynı mantığı koşuyor, ikinci bir
 * doğrulama yolu yok.
 */
import { review, reviewRequestSchema } from "@codecraft/core";

export const runtime = "nodejs";

// tsc bir alt süreç; soğuk başlangıçta varsayılan süre yetmeyebiliyor.
export const maxDuration = 60;

export async function POST(request: Request): Promise<Response> {
  const parsed = reviewRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return new Response(`Geçersiz gövde: ${parsed.error.issues[0]?.message ?? "bilinmiyor"}`, {
      status: 400,
    });
  }

  const result = await review(parsed.data.files, parsed.data.version);
  return Response.json(result);
}
