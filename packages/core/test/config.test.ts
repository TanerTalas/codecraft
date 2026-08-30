/**
 * Yapılandırma ve anahtar kuralları.
 *
 * En önemli iki iddia: anahtar commit edilen dosyadan asla okunmuyor, ve
 * eksik anahtarın hata mesajı ne yapılacağını tek adımda söylüyor
 * (CLAUDE.md, "Nasıl sorulur").
 */
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";

import {
  API_KEY_ENV,
  CONFIG_FILE,
  LOCAL_CONFIG_FILE,
  loadConfig,
  requireApiKey,
} from "../src/config.ts";

async function withConfig(
  files: Record<string, unknown>,
  run: (root: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(join(tmpdir(), "codecraft-config-"));
  try {
    for (const [name, body] of Object.entries(files)) {
      await writeFile(join(root, name), JSON.stringify(body), "utf8");
    }
    await run(root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test("model kimliği yapılandırmadan okunur", async () => {
  await withConfig({ [CONFIG_FILE]: { provider: "google", model: "bir-model" } }, async (root) => {
    const config = await loadConfig(root);
    assert.equal(config.model, "bir-model");
    assert.equal(config.provider, "google");
  });
});

test("yerel dosya üstüne yazar", async () => {
  await withConfig(
    {
      [CONFIG_FILE]: { provider: "google", model: "varsayilan", temperature: 0 },
      [LOCAL_CONFIG_FILE]: { model: "yerel", temperature: 0.7 },
    },
    async (root) => {
      const config = await loadConfig(root);
      assert.equal(config.model, "yerel");
      assert.equal(config.temperature, 0.7);
    },
  );
});

test("yapılandırmaya yazılmış anahtar reddedilir", async () => {
  // Bu dosya commit ediliyor; sessizce yok saymak sırrı repoya sokar.
  await withConfig(
    { [CONFIG_FILE]: { provider: "google", model: "m", apiKey: "gizli" } },
    async (root) => {
      await assert.rejects(loadConfig(root), /apiKey/);
    },
  );
});

test("model alanı yoksa durulur", async () => {
  await withConfig({ [CONFIG_FILE]: { provider: "google" } }, async (root) => {
    await assert.rejects(loadConfig(root), /"model"/);
  });
});

test("bilinmeyen sağlayıcı reddedilir", async () => {
  await withConfig({ [CONFIG_FILE]: { provider: "yok", model: "m" } }, async (root) => {
    await assert.rejects(loadConfig(root), /bilinmeyen sağlayıcı/i);
  });
});

test("eksik anahtar ne yapılacağını söyler", () => {
  assert.throws(
    () => requireApiKey("google", {}),
    (error: Error) => {
      assert.match(error.message, new RegExp(API_KEY_ENV.google));
      assert.match(error.message, /aistudio\.google\.com/);
      assert.match(error.message, /setx/);
      return true;
    },
  );
});

test("depodaki codecraft.config.json geçerli", async () => {
  // Örnek dosya bozuksa CLI ilk çalıştırmada patlar.
  const config = await loadConfig();
  assert.equal(config.provider, "google");
  assert.ok(config.model.length > 0);
});
