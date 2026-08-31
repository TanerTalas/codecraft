/**
 * POST /api/review — şema (ajv) ve script (tsc) doğrulaması.
 * GET  /api/review — aynı uç noktanın çalışma zamanı öz-denetimi.
 *
 * Mimari kural 2'nin sunucu yarısı. `review()` üretim döngüsünün çağırdığı
 * fonksiyonun aynısı: eval, CLI ve web aynı mantığı koşuyor, ikinci bir
 * doğrulama yolu yok.
 *
 * GET neden ayrı bir /api/diagnostics rotası DEĞİL: Next dosya izlemeyi rota
 * başına yapıyor. Ayrı bir rota kendi outputFileTracingIncludes girdisini
 * alırdı ve yeşil çıkması buradaki POST'un paketi hakkında hiçbir şey
 * söylemezdi. Aynı dosya = aynı fonksiyon = aynı paket, ölçülen şey gerçekten
 * POST'un kullandığı ortam. Aşama M1, bkz. TODO.md.
 */
import { review, reviewRequestSchema, scriptRuntimeReport } from "@codecraft/core";

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

export async function GET(): Promise<Response> {
  const checks = await scriptRuntimeReport();
  // Bir kontrol düştüyse 503: ölçüm otomatikleştirilebilsin, HTTP kodu
  // okunarak. Gövde her hâlükârda tam rapor.
  const ok = Object.values(checks).every((check) => check.ok);
  return Response.json({ ok, checks }, { status: ok ? 200 : 503 });
}
