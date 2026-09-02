# Üçüncü taraf bildirimleri

Kök `LICENSE` (Apache-2.0) yalnızca **bu depoda yazılmış kodu** kapsar.
Depo bunun dışında üç ayrı lisansa tabi içerik taşıyor ve bir dördüncüsünden
türetilmiş veri üretiyor. Bu dosya hangisinin hangisi olduğunu söyler.

Ayrım önemli ve `docs/SOURCES.md` bunu ayrıntısıyla anlatıyor:

| | Yeniden yayın | Türetilmiş olgu |
|---|---|---|
| Ne | Kaynağın metni, birebir | "Bu id var", "bu alan zorunlu", "bu sürüm şu" |
| Bizde | Yalnızca izin veren lisanslarda | Varsayılan |

---

## Birebir kopyalanan içerik

### Blockception — JSON şemaları

| | |
|---|---|
| Nerede | `data/blockception/` |
| Kaynak | [Blockception/Minecraft-bedrock-json-schemas](https://github.com/Blockception/Minecraft-bedrock-json-schemas) |
| Lisans | **BSD-3-Clause** — tam metin `data/blockception/LICENSE` |
| Telif | (c) 2020 Blockception Ltd |

Doğrulama katmanının kullandığı şemalar bunlar. Lisans atıf şartı koşuyor;
`data/blockception/LICENSE` dosyası **silinmemeli.**

### Microsoft / Mojang — `@minecraft/*` script tip tanımları

| | |
|---|---|
| Nerede | `data/<sürüm>/script-types/@minecraft/` |
| Kaynak | npm: `@minecraft/common`, `@minecraft/server`, `@minecraft/server-ui` |
| Lisans | **MIT** — paketlerin kendi `package.json` beyanı |
| Künye | `data/<sürüm>/script-types/NOTICE.md` (pipeline üretir) |

Paketler MIT olduklarını `package.json` içinde beyan ediyor ama tarball'a
lisans metnini ve telif satırını koymuyorlar. Telif sahibi **uydurulmadı:**
beyanın kendisi her sürüm klasöründe duruyor ve `NOTICE.md` kaynağı kayda
geçiriyor.

### Microsoft — sürüm notları

| | |
|---|---|
| Nerede | `data/<sürüm>/release-notes/` |
| Kaynak | [MicrosoftDocs/minecraft-creator](https://github.com/MicrosoftDocs/minecraft-creator) |
| Lisans | **CC-BY-4.0** (29-08-2026, GitHub API ile doğrulandı) |

Her dosyanın başına atıf başlığı yazılıyor — CC-BY'nin şartı bu.

---

## Türetilmiş veri — birebir kopya DEĞİL

### Mojang — `bedrock-samples`

| | |
|---|---|
| Nerede | `data/<sürüm>/*.json` (blok, item, entity, komut, doku indeksleri) |
| Kaynak | [Mojang/bedrock-samples](https://github.com/Mojang/bedrock-samples) |
| Lisans | **Minecraft End User License Agreement** — açık kaynak DEĞİL |

Depo GitHub'da açıkta duruyor ve "açık kaynak" sanılıyor. Değil.
`LICENSE.md` metni (30-08-2026'da okundu):

> (c) Mojang AB. All rights reserved.
>
> By downloading the files in this repository, you agree to the Minecraft End
> User License Agreement and that these files are subject to its terms.

Bu yüzden bu depoda **ham içerik bulunmaz.** Yalnızca ondan türetilen olgular
indekslenir: bir kimliğin var olup olmadığı, bir alanın adı, bir sürüm
numarası. Bunlar olgudur, ifade değil.

Ham dosyalar `pipeline/raw/` altında kalır ve `.gitignore` içindedir.
MCP ucu ham içerik geri sunmaz — `get_schema` özet verir, ham şema isteğini
açıkça reddeder.

> Mojang'ın JSON şemaları 02-09-2026'ya kadar `data/<sürüm>/schemas/` altında
> birebir commit ediliyordu. Depo o gün public yapıldı ve bu dosyalar git'ten
> çıkarıldı: public bir repoda git'in kendisi bir dağıtım kanalıdır.
> Gerekçe ve ölçüm `docs/SOURCES.md` içinde.

---

## Marka

Mojang'ın [kullanım kılavuzu](https://www.minecraft.net/en-us/usage-guidelines)
marka adını kullanan üçüncü taraf ürünlerin şu feragati göstermesini şart
koşuyor:

```
NOT AN OFFICIAL MINECRAFT PRODUCT.
NOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT.
```

İngilizce aslı korunur — şart koşulan biçim o. Çeviri altına konabilir.

---

## Çalışma zamanı bağımlılıkları

npm bağımlılıklarının lisansları `package-lock.json` üzerinden çözülür ve
burada tekrarlanmaz. Doğrudan bağımlılıkların tamamı (02-09-2026):
`@modelcontextprotocol/sdk`, `zod`, `ajv`, `ajv-formats`, `next`, `react`,
`react-dom`; geliştirme tarafında `typescript` ve `@types/node`.

Bu depoda **hiçbir LLM SDK'sı bağımlılık değildir** ve bu bir tercih değil
ölçülen bir kuraldır: `packages/mcp/test/no-llm.test.ts`.
