# Mojang şema kaynak künyesi

Bu klasördeki JSON şemaları `Mojang/bedrock-samples` deposundaki
`metadata/json_schemas/` içeriğinin **birebir** kopyasıdır. Dosyalar elle düzenlenmez,
`pipeline/src/schemas-mojang.ts` üretir.

| | |
|---|---|
| Kaynak | `Mojang/bedrock-samples` → `metadata/json_schemas/` |
| Sürüm | 1.26.40.5 |
| Dosya | 1313 (bu künye hariç) |
| Lisans | Minecraft End User License Agreement |

Deponun `LICENSE.md` dosyasının metni (doğrulandı 30-08-2026, HTTP 200):

> (c) Mojang AB. All rights reserved.
>
> By downloading the files in this repository, you agree to the Minecraft End
> User License Agreement and that these files are subject to its terms.

## Bunlar doğrulamada kullanılmıyor

CodeCraft'ın JSON doğrulaması **Blockception'ın derlenmiş şemalarını**
kullanıyor (`data/blockception/compiled/`, BSD-3-Clause). Bu klasör sürüm
farklarını okumak ve ikinci bir kontrol için duruyor.

Ölçüldü 02-09-2026: `packages/*/src` ve `app/src` içinde bu klasöre
**sıfır** referans var. Bu yüzden dosyalar Vercel fonksiyon paketine de
girmiyor (`app/next.config.ts`, `DATA_FILES`) — okunmayan içerik üçüncü bir
tarafa yüklenmiyor.

Karar ve gerekçesi: `docs/SOURCES.md`.
