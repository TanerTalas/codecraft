# data/

Pipeline tarafından üretilen veri. **Bu klasör git içinde durur** — veritabanı
yok, dosya olarak tutulur ve versiyonlanır (`CLAUDE.md`, mimari kural 4).

## Yapı

```
data/
  blockception/            # sürümden bağımsız, main dalını izler
    LICENSE                #   BSD-3-Clause, kaynakla birlikte taşınır
    source/                #   1140 şema
  1.26.40.5/               # oyun sürümü, dört parçalı
    index.json             #   kaynak künyesi: neyin nerede olduğu, modül sürümleri
    blocks.json …          #   vanilladata'dan türetilen lookup indeksleri
    schemas/               #   Mojang'ın kendi şemaları, ağaç yapısı korunur
    schemas-index.json     #   tip başına format_version envanteri
    script-types/          #   @minecraft/* index.d.ts dosyaları
      NOTICE.md            #     kaynak künyesi ve lisans beyanı
    release-notes/         #   Update1.26.40.md, CC-BY-4.0 atıflı
```

`blockception/` neden sürüm klasörünün içinde değil: kaynak oyun sürümüne göre
klasörlenmiyor, `main` tek bir güncel küme tutuyor. Her sürüme kopyalamak olmayan
bir kesinlik iddia ederdi. `index.json` → `sources.blockception.path` oraya işaret
eder, yani arama yine tek noktadan yürür.

## Sürüm numarası

Klasör adları **oyun/veri sürümüdür**: `1.26.40.5`. Kaynağı
`bedrock-samples/version.json` → `latest.version`.

Karıştırılmaması gerekenler (`CLAUDE.md` sürüm tablosu):

- `26.40` pazarlama numarası — hiçbir dosyaya yazılmaz
- `[1, 26, 40]` `min_engine_version` — `index.json` içinde bu biçimde durur
- `2.9.0` `@minecraft/server` modül sürümü — `script-types/` klasör adlarında

## Elle düzenlenmez

İçerik `pipeline/` tarafından üretilir ve GitHub Actions günlük cron'u ile
tazelenir (`.github/workflows/data.yml`). Elle yapılan değişiklik bir sonraki
koşuda silinir — `writeTree` kaynakta olmayan dosyaları siler.

Yerelde tazelemek için: `npm run pipeline`. Tek bir kaynak için
`npm run pipeline:schemas`, `pipeline:types`, `pipeline:notes` vb.

## Lisans

Kaynak başına lisans ve hangi verinin birebir kopyalandığı `docs/SOURCES.md`
içinde. Özetle: Blockception BSD-3-Clause, `@minecraft/*` MIT, sürüm notları
CC-BY-4.0. Mojang'ın şemaları EULA kapsamında ve birebir kopyalanıyor — bu
bilinçli bir karar, gerekçesi ve repo public yapılırsa ne yapılacağı
`docs/SOURCES.md` içinde yazılı.
