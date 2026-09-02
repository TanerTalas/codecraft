/**
 * Şema özetleyicinin testi.
 *
 * İki şeyi ölçüyor ve ikisi de M3'ün bitiş kriterinde yazılı:
 *
 *   1. Özet DOĞRU — $ref çözülüyor, zorunlu alanlar geliyor, format_version
 *      değerleri ölçülmüş değerlerle eşleşiyor, çözülemeyen yol hata veriyor.
 *   2. Özet SIĞIYOR — en büyük düğüm bile bayt tavanının altında kalıyor ve
 *      hangi basamağa inildiğini söylüyor.
 *
 * İkincisi neden test: "büyük dosya döndürmüyoruz" bir niyet cümlesi, ölçüm
 * değil. Şema büyüdüğünde bu test kırmızıya döner.
 *
 * Gerçek data/ üzerinde koşuyor, mock yok — mimari kural 3'ün mantığı burada
 * da geçerli: şema gerçekten ne diyorsa o ölçülüyor.
 */
import assert from "node:assert/strict";
import { test } from "node:test";

import { summarizeSchema } from "../src/schema-summary.ts";

/** MCP tarafındaki tavanla aynı değer. Orası değişirse burası da bakılmalı. */
const LIMIT = 24_000;

test("kök özeti zorunlu alanları ve şema kimliğini veriyor", async () => {
  const summary = await summarizeSchema("behavior/blocks");

  assert.equal(summary.type, "behavior/blocks/blocks");
  assert.equal(summary.path, "");
  assert.equal(summary.detail, "full");
  // Bütün belge tipleri bu iskelette: format_version + kök nesne.
  assert.deepEqual(summary.required, ["format_version", "minecraft:block"]);
  assert.ok(summary.version.startsWith("1."), `Sürüm dört haneli değil: ${summary.version}`);
});

test("$ref çözülüyor — kök properties boş dönmüyor", async () => {
  // blocks.json'da minecraft:block doğrudan {"$ref": "#/definitions/B"}.
  // Ref çözülmezse bu düğümün hiç alanı yokmuş gibi görünürdü.
  const summary = await summarizeSchema("behavior/blocks", { path: "minecraft:block" });

  const names = summary.properties.map((property) => property.name);
  assert.deepEqual(summary.required, ["components", "description"]);
  assert.ok(names.includes("components"), `components yok: ${names.join(", ")}`);
  assert.ok(names.includes("description"), `description yok: ${names.join(", ")}`);
});

test("format_version şemadan okunuyor, ölçülmüş değerle uyuşuyor", async () => {
  // İlk gerçek kapı koşusunda model buraya oyun sürümü yazdı ve şema reddetti
  // (spawn-rule-01, CLAUDE.md). Değer şemadan geliyor, elle yazılmıyor.
  const summary = await summarizeSchema("behavior/spawn_rules");
  assert.deepEqual(summary.formatVersions, ["1.10.0", "1.12.0", "1.8.0"]);
});

test("zorunlu olmayan alanda required alanı hiç yok", async () => {
  // required: false yazmak 390 alanlı düğümde ölçülmüş bir israftı.
  const summary = await summarizeSchema("behavior/blocks", { path: "minecraft:block" });
  const optional = summary.properties.find((property) => property.name === "permutations");
  assert.ok(optional, "permutations alanı yok");
  assert.equal(optional.required, undefined);

  const mandatory = summary.properties.find((property) => property.name === "components");
  assert.equal(mandatory?.required, true);
});

test("çözülemeyen yol hata veriyor, en yakına düşmüyor", async () => {
  await assert.rejects(
    () => summarizeSchema("behavior/blocks", { path: "minecraft:block/yokboyleseey" }),
    (error: Error) => {
      assert.match(error.message, /Şema yolu çözümlenemedi/);
      // Hata eyleme dönüştürülebilir olmalı: orada ne olduğunu söylesin.
      assert.match(error.message, /Oradaki alanlar:/);
      return true;
    },
  );
});

test("en büyük düğüm tavanın altında kalıyor ve ne kestiğini söylüyor", async () => {
  // minecraft:entity/components — ölçülen en kalabalık düğüm, 390 alan.
  // Tam özeti 59.763 bayt, yani tavanın iki katından fazla.
  const summary = await summarizeSchema("behavior/entities", {
    path: "minecraft:entity/components",
    limit: LIMIT,
  });

  const bytes = Buffer.byteLength(JSON.stringify(summary), "utf8");
  assert.ok(bytes <= LIMIT, `Tavan aşıldı: ${bytes} > ${LIMIT}`);
  assert.equal(summary.detail, "names-only");
  assert.ok(summary.truncated, "Daralma oldu ama truncated boş — sessiz kesme.");

  // Kritik: daralma ad listesine indi, ama HİÇBİR ad düşmedi. Model neyin var
  // olduğunu tam görüyor, sonra path ile inebiliyor.
  assert.equal(summary.properties.length, 390);
  assert.ok(summary.properties.some((property) => property.name === "minecraft:health"));
});

test("tek bir bileşene inilince tam ayrıntı geri geliyor", async () => {
  const summary = await summarizeSchema("behavior/entities", {
    path: "minecraft:entity/components/minecraft:health",
    limit: LIMIT,
  });

  assert.equal(summary.detail, "full");
  assert.equal(summary.truncated, undefined);
  assert.ok(summary.properties.length > 0, "Bileşenin hiç alanı yok");
});

test("tavan çok küçükse en son basamağa iniyor ve gizlemiyor", async () => {
  // Kademelerin gerçekten sırayla indiğini ölçüyor. 400 bayt hiçbir listeyi
  // taşımaz, yani clipped basamağı zorlanıyor.
  const summary = await summarizeSchema("behavior/entities", {
    path: "minecraft:entity/components",
    limit: 400,
  });

  assert.equal(summary.detail, "clipped");
  assert.ok(summary.properties.length < 390, "Kesilmemiş");
  assert.match(summary.truncated ?? "", /390 alandan/);
});

test("tavan verilmezse tam özet dönüyor", async () => {
  const summary = await summarizeSchema("behavior/entities", {
    path: "minecraft:entity/components",
  });
  assert.equal(summary.detail, "full");
  assert.equal(summary.truncated, undefined);
});

/**
 * Aşağıdaki üç test docs/mcp-kullanim.md ölçümlerinde eklendi ve hepsinin sebebi ÖLÇÜLMÜŞ bir
 * kayıp: gerçek bir Claude oturumunda model `.../conditions` yolunu doğru
 * istedi, araç 307 bayt ve SIFIR alan döndürdü, model altı spawn koşulunu
 * şemadan değil belleğinden yazdı. docs/mcp-kullanim.md senaryo 1.
 */
test("dizi düğümünde alanlar items içinden geliyor", async () => {
  // conditions: type "array", kendi properties'i YOK, 22 bileşen items içinde.
  const summary = await summarizeSchema("behavior/spawn_rules", {
    path: "minecraft:spawn_rules/conditions",
    limit: LIMIT,
  });

  const names = summary.properties.map((property) => property.name);
  assert.equal(summary.properties.length, 22, `22 bileşen beklenirken ${names.length}`);
  assert.ok(names.includes("minecraft:brightness_filter"), names.join(", "));
  assert.ok(names.includes("minecraft:biome_filter"), names.join(", "));
  // Alanların dizinin ÖĞESİNE ait olduğu söylenmeli — sessizce sunmak,
  // "conditions'ın alanları" sanılmasına yol açar ve farklı JSON ürettirir.
  assert.equal(summary.arrayItems, true);
});

test("dizi öğesinin zorunlu alanları düşmüyor", async () => {
  // permutations dizi; "condition" zorunluluğu items içinde yazılı. Dış
  // düğüme bakılsaydı required boş dönerdi.
  const summary = await summarizeSchema("behavior/blocks", {
    path: "minecraft:block/permutations",
    limit: LIMIT,
  });

  assert.equal(summary.arrayItems, true);
  assert.deepEqual(summary.required, ["condition"]);
});

test("oneOf dallarındaki alanlar birleştiriliyor ve kaç dal olduğu yazılıyor", async () => {
  // minecraft:herd bir oneOf: dal 0 nesne, dal 1 o nesnelerin dizisi. Altı
  // alan ikisinde de var. Dallara bakılmazsa düğüm boş görünür.
  const summary = await summarizeSchema("behavior/spawn_rules", {
    path: "minecraft:spawn_rules/conditions/minecraft:herd",
    limit: LIMIT,
  });

  const names = summary.properties.map((property) => property.name);
  assert.ok(names.includes("min_size"), names.join(", "));
  assert.ok(names.includes("max_size"), names.join(", "));
  assert.equal(summary.oneOfBranches, 2);
});

/**
 * Koşullu ve birleşik şemalar — allOf, if/then/else.
 *
 * Ölçüldü 01-09-2026, docs/mcp-kullanim.md senaryo 6: 60 derlenmiş şemadan YEDİSİNİN kökü
 * tamamen boş dönüyordu ve aralarında en çok kullanılan tip vardı,
 * general/manifest. Sebep alanların `allOf` (manifest, attachables, items) ya
 * da `if/then/else` (resource/entity, model_entity) içinde durması.
 *
 * Gerçek kullanımdaki bedeli ölçüldü: model bir client entity yazarken
 * get_schema'yı iki kez çağırdı, işe yarar bir şey alamadı ve stratejisini
 * değiştirip sekiz kez validate_json ile deneme-yanılmaya geçti.
 */
test("allOf içindeki alanlar kökte görünüyor — general/manifest", async () => {
  const summary = await summarizeSchema("general/manifest", { limit: LIMIT });

  const names = summary.properties.map((property) => property.name);
  assert.ok(summary.properties.length > 0, "manifest kökü boş döndü");
  assert.ok(names.includes("format_version"), names.join(", "));
  assert.ok(names.includes("header"), names.join(", "));
  // Zorunluluk allOf'ta BİRLEŞİM: kökün kendi required'ı da sayılmalı.
  assert.deepEqual(summary.required, ["format_version", "header"]);
});

test("if/then/else dalları birleştiriliyor — resource/entity", async () => {
  const summary = await summarizeSchema("resource/entity", { limit: LIMIT });

  const names = summary.properties.map((property) => property.name);
  assert.ok(names.includes("minecraft:client_entity"), names.join(", "));
  assert.equal(summary.oneOfBranches, 2, "iki dal birleştirilmiş olmalı");

  // Asıl kazanç derinde: senaryo 6'da modelin bulamadığı düğüm.
  const description = await summarizeSchema("resource/entity", {
    path: "minecraft:client_entity/description",
    limit: LIMIT,
  });
  const fields = description.properties.map((property) => property.name);
  assert.ok(fields.includes("scripts"), fields.join(", "));
  assert.ok(fields.includes("geometry"), fields.join(", "));
  assert.ok(fields.includes("render_controllers"), fields.join(", "));
});

test("hiçbir belge tipinin kökü boş dönmüyor", async () => {
  // Yedi tip boş dönüyordu ve hangileri olduğu ölçülene kadar bilinmiyordu.
  // Bu test yeni bir şema biçimi çıkarsa kırmızıya döner.
  for (const type of [
    "general/manifest",
    "resource/entity",
    "resource/attachables",
    "resource/items",
    "behavior/blocks",
    "behavior/entities",
    "behavior/spawn_rules",
  ]) {
    const summary = await summarizeSchema(type, { limit: LIMIT });
    assert.ok(summary.properties.length > 0, `${type} kökü boş`);
    assert.ok(summary.required.length > 0, `${type} zorunlu alan bildirmiyor`);
  }
});
