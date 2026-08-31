/**
 * HTTP yüzeyinin testi (Aşama M4).
 *
 * NEDEN NEXT AYAĞA KALKMADAN: `handleMcpRequest` düz bir `Request` alıp düz
 * bir `Response` döndürüyor, yani gerçek JSON-RPC round-trip'i burada
 * ölçülebiliyor. Dağıtılmış uçta ölçülmesi gereken tek şey barındırma kalıyor
 * (`scripts/probe.ts`), protokolün kendisi değil.
 *
 * `test/server.test.ts` aynı araçları InMemoryTransport üzerinden ölçüyor. Bu
 * dosya onun kopyası değil: ölçtüğü şey ARADAKİ HTTP katmanı — durumsuz mod,
 * JSON yanıt biçimi, istek başına yeni transport, ve POST dışındaki
 * yöntemlerin akış açmadan kapatılması.
 *
 * Dördü de bilerek kırılarak doğrulandı (M2/M3'teki enjekte-et-ve-kırmızıya-dön
 * yöntemi), ölçüm TODO.md Aşama M4'te.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { resolveVersion } from "@codecraft/knowledge";

import { handleMcpRequest } from "../src/http.ts";
import { tools } from "../src/server.ts";

const ENDPOINT = "https://codecraft.test/mcp";

/**
 * Spec'e uygun bir MCP POST'u.
 *
 * Accept İKİ tipi birden saymak zorunda — transport aksi hâlde 406 döndürüyor
 * (ölçüldü). Gerçek istemcinin gönderdiği başlığın aynısı.
 */
function post(body: unknown): Request {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json, text/event-stream",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

const INITIALIZE = {
  jsonrpc: "2.0",
  id: 1,
  method: "initialize",
  params: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "http-test", version: "0.0.0" },
  },
};

/** Tek yanıtlık bir POST'un gövdesini JSON olarak okur. */
async function callJson(body: unknown): Promise<{ status: number; type: string; json: any }> {
  const response = await handleMcpRequest(post(body));
  const text = await response.text();
  return {
    status: response.status,
    type: response.headers.get("content-type") ?? "",
    json: text.length > 0 ? JSON.parse(text) : null,
  };
}

test("initialize düz JSON dönüyor, SSE akışı değil", async () => {
  const { status, type, json } = await callJson(INITIALIZE);

  assert.equal(status, 200);
  // enableJsonResponse olmadan burası text/event-stream olurdu ve Vercel'de
  // fonksiyon keep-alive frame'leriyle açık kalırdı. Ölçülen sınır bu.
  assert.match(type, /application\/json/);
  assert.equal(json.result.serverInfo.name, "codecraft");
  assert.ok(json.result.capabilities.tools, "Sunucu tools yeteneğini bildirmiyor.");
});

test("ardışık iki istek çalışıyor: durumsuz mod oturum beklemiyor", async () => {
  // KRİTİK: her istek YENİ bir transport ve YENİ bir server görüyor. tools/list
  // kendi isteğinde initialize'ı hiç görmemiş bir sunucuya düşüyor. Modül
  // seviyesinde tek bir transport tutulsaydı SDK ikinci istekte atardı
  // ("Stateless transport cannot be reused across requests").
  const first = await callJson(INITIALIZE);
  assert.equal(first.status, 200);

  const second = await callJson({ jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
  assert.equal(second.status, 200, `tools/list düştü: ${JSON.stringify(second.json)}`);

  const names = (second.json.result.tools as { name: string }[]).map((tool) => tool.name);
  // Kayıtlı liste ile HTTP'den dönen liste aynı olmalı: "kaydedildi ama
  // listelenmiyor" hatası burada da ölçülüyor.
  assert.deepEqual(names.sort(), tools.map((tool) => tool.name).sort());
});

test("tools/call HTTP üzerinden gerçek data/ sonucu döndürüyor", async () => {
  const { status, json } = await callJson({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: { name: "get_version_info", arguments: {} },
  });

  assert.equal(status, 200);
  assert.notEqual(json.result.isError, true, `Araç hata döndürdü: ${JSON.stringify(json.result)}`);

  const context = JSON.parse(json.result.content[0].text) as { version: string };
  // İkinci yol: aynı veriye HTTP'den değil, doğrudan knowledge katmanından bak.
  // Yalnızca "200 döndü" görmek, sessizce boş dönen bir yoldan da gelebilirdi.
  const { version } = await resolveVersion();
  assert.equal(context.version, version);
});

test("GET ve DELETE 405, akış açmadan", async () => {
  // GET transport'a devredilseydi durumsuz modda BİTMEYEN bir SSE akışı
  // açılırdı ve fonksiyon maxDuration'a kadar asılı kalırdı.
  for (const method of ["GET", "DELETE"] as const) {
    const response = await handleMcpRequest(
      new Request(ENDPOINT, { method, headers: { accept: "text/event-stream" } }),
    );
    assert.equal(response.status, 405, `${method} 405 dönmedi.`);
    assert.equal(response.headers.get("allow"), "POST");
    const json = JSON.parse(await response.text()) as { error: { message: string } };
    assert.match(json.error.message, /POST/);
  }
});

test("bozuk gövde JSON hata döndürüyor, HTML değil", async () => {
  const { status, type, json } = await callJson("{ bozuk");
  assert.equal(status, 400);
  assert.match(type, /application\/json/);
  assert.equal(json.error.code, -32700);
});
