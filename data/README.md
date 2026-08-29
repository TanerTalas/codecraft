# data/

Pipeline tarafından üretilen indeksler, sürüme göre klasörlenir:

```
data/
  1.26.40/
  1.26.41/
```

**Bu klasör git içinde durur.** Veritabanı yok, dosya olarak tutulur ve
versiyonlanır — `CLAUDE.md`, mimari kural 4. `.gitignore`'a eklenmez.

## Elle düzenlenmez

İçerik `pipeline/` tarafından üretilir ve GitHub Actions günlük cron'u ile
tazelenir. Elle yapılan değişiklik bir sonraki koşuda silinir.

## Ham veri buraya girmez

`Mojang/bedrock-samples` içeriği Minecraft EULA'ya tabi, ham hâli yeniden
dağıtılmaz. Ham kopya `pipeline/raw/` altında kalır ve git'e girmez; buraya
sadece ondan türetilen indeksler yazılır. Ayrıntı: `docs/SOURCES.md`.

## Sürüm numarası

Klasör adları her zaman API biçimidir: `1.26.40`. Pazarlama numarası (`26.40`)
kullanılmaz.
