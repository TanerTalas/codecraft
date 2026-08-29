# script-types kaynak künyesi

Bu klasördeki `index.d.ts` dosyaları npm'den olduğu gibi alınmıştır.
Dosya elle düzenlenmez, `pipeline/src/script-types.ts` üretir.

| Paket | Modül sürümü | npm sürümü | Lisans (package.json beyanı) |
|---|---|---|---|
| `@minecraft/common` | 1.3.0 | `1.3.0` | MIT |
| `@minecraft/server` | 2.9.0 | `2.9.0` | MIT |
| `@minecraft/server` | 2.10.0-beta | `2.10.0-beta.1.26.40-stable` | MIT |
| `@minecraft/server-ui` | 2.1.0 | `2.1.0` | MIT |
| `@minecraft/server-ui` | 2.2.0-beta | `2.2.0-beta.1.26.40-stable` | MIT |

Klasör adları **modül** sürümüdür, oyun sürümü değil (bkz. `CLAUDE.md`
sürüm tablosu). npm sürümü sütunu, beta kanalında oyun sürümünün etikete
gömülü hâlini gösterir.

Paketler MIT olduklarını `package.json` içinde beyan ediyor ama lisans
metnini ve telif satırını tarball'a koymuyorlar. Beyanın kendisi kanıt
olarak her sürüm klasöründe `package.json` ile birlikte duruyor.
