/**
 * Modelin gördüğü her metin İngilizce mi.
 *
 * NEDEN ÖLÇÜ, NEDEN YORUM DEĞİL: `no-llm.test.ts` ile aynı gerekçe. Bu kural
 * `CLAUDE.md`'de yazılı ama yazılı bir kural bir sonraki değişiklikte kayar;
 * ölçülen bir kural kaymaz. Depo Türkçe yazılıyor, o yüzden Türkçe bir mesajı
 * yanlışlıkla modele göndermek kolay.
 *
 * NEDEN İKİ AYRI ÖLÇÜM: yalnızca `tools/list` taransaydı, araç AÇIKLAMALARI
 * İngilizce olurken bulgu MESAJLARI Türkçe kalabilir ve test yine yeşil
 * koşardı. İkinci blok bilerek bozulmuş bir paketi gerçek araçlardan
 * geçiriyor ve dönen metnin tamamına bakıyor.
 *
 * SINIR: bu test "Türkçe karakter yok" diyor, "okunabilir İngilizce" demiyor.
 * İkincisi ölçülemez; onun için insan gözü gerekiyor ve o adım
 * docs/MCP.md'deki doğrulama listesinde duruyor.
 *
 * Kod yorumları, docs/ ve README.md KAPSAM DIŞI — onlar geliştirici için ve
 * Türkçe kalıyorlar.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";

import { createServer } from "../src/server.ts";

/**
 * Yalnızca Türkçeye özgü harfler.
 *
 * `â î û` ve düz `i o u` bilerek DIŞARIDA: İngilizce metinde de geçebilirler
 * ve listeye alınsalardı test yanlış yere kırmızı verirdi. Aranan şey Türkçe
 * metnin kaçınılmaz izi.
 */
const TURKISH = /[şŞğĞıİçÇöÖüÜ]/;

/**
 * Türkçeye özgü harf TAŞIMAYAN Türkçe kelimeler.
 *
 * Bu liste testin ilk hâlinde yoktu ve o hâl bir sızıntıyı KAÇIRDI
 * (02-09-2026): `checkMolang` bulgusu `sorgu "query.is_babyy" is not defined`
 * diye çıkıyordu — "sorgu" kelimesinde ş/ğ/ı yok, regex görmedi. Testin kendi
 * sınırı ölçülerek bulundu, sonra kapatıldı.
 *
 * Liste kapsamlı değil ve olamaz; yalnızca bu depoda gerçekten kullanılmış
 * kelimeler. Yeni bir sızıntı bulunursa buraya EKLENİR, ölçüm genişler.
 *
 * İkinci kaçırma 03-09-2026'da GERÇEK KULLANIMDA bulundu: `get_version_info`
 * çıktısındaki `patterns[].guidance` yarım çevrilmişti
 * ("...playerSpawn kullan ve event.player.sendMessage ile instead").
 * "kullan", "ve" ve "ile" kelimelerinde Türkçeye özgü harf yok, üstelik bu
 * aracın BAŞARILI çıktısı hiç taranmıyordu — yalnızca hata yolu taranıyordu.
 * İki delik de aynı anda kapatıldı: kelimeler aşağıya, başarılı çıktı ayrı
 * bir teste.
 */
const TURKISH_WORDS =
  /\b(sorgu|matematik|fonksiyonu?|dosya|surum|blok|deger|komut|kural|kullan[a-z]*|yerine|ve|ile)\b/i;

/** İkisinden biri eşleşirse metin Türkçe sayılır. */
const hasTurkish = (text: string): boolean => TURKISH.test(text) || TURKISH_WORDS.test(text);

/** Bulunan Türkçe karakterin etrafını gösterir — hangi metin olduğu görünsün. */
function excerpt(text: string): string {
  const at = TURKISH.test(text) ? text.search(TURKISH) : text.search(TURKISH_WORDS);
  if (at === -1) return "";
  return text.slice(Math.max(0, at - 60), at + 60);
}

async function connect(): Promise<Client> {
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  const client = new Client({ name: "test", version: "0.0.0" });
  await Promise.all([createServer().connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

test("tools/list yükünün tamamı İngilizce", async () => {
  const client = await connect();
  try {
    const listed = (await client.listTools()).tools;
    // Kontrol: gerçekten bir şey tarandı. Boş liste de "Türkçe yok" derdi.
    assert.ok(listed.length >= 9, `yalnızca ${listed.length} araç listelendi`);

    for (const tool of listed) {
      // Girdi şeması dahil: .describe() metinleri de modele gidiyor.
      const payload = JSON.stringify(tool);
      assert.ok(
        !hasTurkish(payload),
        `${tool.name}: araç yüzeyinde Türkçe metin var → ${excerpt(payload)}`,
      );
    }
  } finally {
    await client.close();
  }
});

test("sunucu yönergesi İngilizce", async () => {
  const client = await connect();
  try {
    const instructions = client.getInstructions() ?? "";
    assert.ok(instructions.length > 0, "sunucu yönergesi boş");
    assert.ok(!hasTurkish(instructions), `yönergede Türkçe metin var → ${excerpt(instructions)}`);
  } finally {
    await client.close();
  }
});

/**
 * Bilerek bozulmuş bir paket: her bozukluk ayrı bir kontrolü tetikliyor.
 *
 * Amaç en çok bulgu üreten girdiyi kurmak — bulgu üretmeyen bir paket
 * mesajları hiç göstermezdi ve test boşa yeşil koşardı.
 */
const BROKEN_PACK = [
  {
    path: "manifest.json",
    content: JSON.stringify({
      format_version: 2,
      header: {
        name: "broken",
        uuid: "00000000-0000-4000-8000-000000000001",
        version: [1, 0, 0],
        min_engine_version: [1, 26, 40],
      },
      modules: [
        {
          // E sınıfı: 1.16 öncesinden kalma modül tipi.
          type: "javascript",
          uuid: "00000000-0000-4000-8000-000000000002",
          version: [1, 0, 0],
          entry: "scripts/main.js",
        },
      ],
    }),
  },
  {
    path: "blocks/ruby_ore.json",
    content: JSON.stringify({
      format_version: "1.21.100",
      "minecraft:block": {
        description: { identifier: "codecraft:ruby_ore" },
        components: {
          // G sınıfı: böyle bir bileşen yok.
          "minecraft:destructable": {},
          // C sınıfı: böyle bir doku anahtarı yok.
          "minecraft:material_instances": { "*": { texture: "yokboyledoku" } },
        },
        // F sınıfı: böyle bir Molang sorgusu yok.
        permutations: [{ condition: "query.is_babyy", components: {} }],
      },
    }),
  },
  {
    path: "scripts/main.js",
    content:
      'import { world } from "@minecraft/server";\n' +
      // D sınıfı: worldLoad'da sendMessage.
      'world.afterEvents.worldLoad.subscribe(() => world.sendMessage("hi"));\n',
  },
  {
    path: "commands.txt",
    // A sınıfı: uydurulmuş kimlik. Ayrıca tanımsız ses olayı.
    content: "give @p minecraft:uydurma_item 1\nplaysound mob.cow.sayy @a\n",
  },
];

test("review_pack çıktısının tamamı İngilizce", async () => {
  const client = await connect();
  try {
    const result = await client.callTool({
      name: "review_pack",
      arguments: { files: BROKEN_PACK },
    });
    const content = result.content as { type: string; text: string }[];
    const text = content[0]?.text ?? "";
    const parsed = JSON.parse(text) as {
      ok: boolean;
      findings: { message: string; evidence: string }[];
      files: { validator: string; detail: string }[];
      report: string;
    };

    // Kontrol grubu: paket gerçekten bulgu üretmeli. Üretmezse bu test
    // hiçbir mesaja bakmamış olur ve boşa yeşil koşar.
    assert.equal(parsed.ok, false, "bozuk paket temiz raporlandı, fixture çürümüş");
    assert.ok(parsed.findings.length >= 4, `yalnızca ${parsed.findings.length} bulgu üretildi`);
    assert.ok(parsed.report.length > 0, "rapor boş");

    assert.ok(!hasTurkish(text), `review_pack çıktısında Türkçe metin var → ${excerpt(text)}`);
  } finally {
    await client.close();
  }
});

/**
 * Araçların BAŞARILI çıktısı — hata yolu değil.
 *
 * Bu test 03-09-2026'da bir sızıntı ölçüldükten sonra eklendi. O güne kadar
 * `get_version_info` yalnızca geçersiz sürümle çağrılıyordu, yani modele asıl
 * giden yük — sürüm tablosu ve `patterns[].guidance` — hiç görülmüyordu.
 */
test("araçların başarılı çıktıları İngilizce", async () => {
  const client = await connect();
  try {
    const calls: [string, Record<string, unknown>][] = [
      // patterns[].guidance buradan geliyor; sızıntı tam olarak oradaydı.
      ["get_version_info", {}],
      ["get_schema", { type: "behavior/blocks" }],
      ["lookup_id", { id: "minecraft:glass" }],
      ["validate_command", { line: "/give @p diamond 1" }],
      ["check_feasibility", { request: "add a block that glows" }],
      ["validate_python", { code: 'CMD = "/give @p diamond 1"' }],
    ];

    for (const [name, args] of calls) {
      const result = await client.callTool({ name, arguments: args });
      const content = result.content as { type: string; text: string }[];
      const text = content[0]?.text ?? "";
      assert.ok(text.length > 0, `${name}: boş cevap`);
      assert.ok(!hasTurkish(text), `${name}: çıktıda Türkçe metin var → ${excerpt(text)}`);
    }
  } finally {
    await client.close();
  }
});

test("araçların hata metinleri İngilizce", async () => {
  const client = await connect();
  try {
    // Her biri farklı bir hata yolunu açıyor: sürüm çözümleme, şema yolu,
    // komut grameri, tsc tanısı ve yapılabilirlik reddi.
    const calls: [string, Record<string, unknown>][] = [
      ["get_version_info", { version: "26.40" }],
      ["get_schema", { type: "behavior/blocks", path: "minecraft:block/yokboylealan" }],
      ["validate_command", { line: "give @p" }],
      ["validate_script", { code: 'import { world } from "@minecraft/server";\nworld.yokBoyleBirSey();' }],
      ["check_feasibility", { request: "make it auto-click while I am AFK" }],
      ["lookup_id", { id: "minecraft:uydurma_blok" }],
    ];

    for (const [name, args] of calls) {
      const result = await client.callTool({ name, arguments: args });
      const content = result.content as { type: string; text: string }[];
      const text = content[0]?.text ?? "";
      assert.ok(text.length > 0, `${name}: boş cevap`);
      assert.ok(!hasTurkish(text), `${name}: çıktıda Türkçe metin var → ${excerpt(text)}`);
    }
  } finally {
    await client.close();
  }
});
