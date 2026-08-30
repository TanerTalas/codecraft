# Komut doğrulama

Bedrock komutları iki ayrı eksende yanlış olabiliyor ve ikisi ayrı ayrı
doğrulanıyor:

| Eksen | Ne sorar | Nerede |
|---|---|---|
| **Sözdizimi** | Argümanlar doğru sırada, sayıda ve biçimde mi | `validateCommand` |
| **Kimlik** | Referans verilen `minecraft:...` gerçekten var mı | `checkCommandIdentities` |

Biri diğerini kapsamıyor: `/give @s minecraft:ruby 1` sözdizimi olarak
kusursuz ama böyle bir item yok; `/setblock ~ ~1 minecraft:stone` ise
tamamen geçerli bir kimlik kullanıp koordinat bileşeni eksik bırakıyor.

## Kaynak

`Mojang/bedrock-samples` → `metadata/command_modules/mojang-commands.json`

Mojang'ın **makine okunur** komut tanımı. `pipeline/src/commands.ts` çekiyor,
`data/<sürüm>/commands.json` altına kompakt bir indeks türetiyor (açıklama
metinleri atılır — Mojang'ın prozası birebir commit edilmez, `docs/SOURCES.md`
içindeki aynı gerekçe). Ham dosya `pipeline/raw/` altında kalır.

```
npm run pipeline:commands
```

**Bu dosyanın varlığı bir kararı geçersiz kıldı.** `CLAUDE.md` komut sözdizimi
doğrulayıcısını "Yapılmayacaklar" tablosuna koymuştu ve gerekçesi "Bedrock
komut grameri için makine okunur resmi kaynak yok" idi. Gerekçe yanlıştı:
kaynak, zaten çektiğimiz deponun zaten kullandığımız `metadata/` klasöründe
duruyordu (30-08-2026'da bulundu).

## Ölçüler

| | |
|---|---|
| Komut | 83 |
| Aşırı yükleme (overload) | 270 |
| Parametre | 1.149 |
| Parametre tipi | 248 |
| Enum tablosundan gelen | 225 (14.067 değer) |
| Yapısal tip | 23 |

## Nasıl çalışıyor

1. **Sözcükleme.** Boşlukla bölmek yetmiyor — seçiciler (`@e[type=zombie,r=5]`),
   JSON gövdeleri, blok durumları ve tırnaklı metinler kendi içinde boşluk
   taşıyor. Parantez dengesi sayılarak bölünüyor, tırnak içindekiler
   sayılmıyor.
2. **Aşırı yükleme eşleştirme.** Komutun her biçimi denenir; biri uyarsa komut
   geçerlidir. Hiçbiri uymazsa en çok argüman tüketen adayın hataları
   raporlanır, beraberlikte "yanlış değer" hatası "eksik argüman"a yeğlenir —
   ilki neyin yanlış olduğunu söyler.
3. **Parametre genişliği.** Her parametre bir token tüketmiyor: `POSITION` üç
   (`fill from to` altı sayı alıyor), `MESSAGE_ROOT` satırın kalanını. Bu
   ölçülerek bulundu; bilmeden eşleştirmek her çok argümanlı komuta "fazladan
   argüman" dedirtiyordu.
4. **Enum eşleşmesi namespace'e toleranslı.** Enum değerleri namespace'siz
   tutuluyor (`speed`) ama oyunda `minecraft:speed` de geçerli; ikisi de
   kabul edilir.

## İlke: emin olmadığına hata deme

Yanlış pozitif burada en pahalı hata. Çalışan bir komuta "bozuk" demek, bozuk
bir komutu kaçırmaktan kötü — kullanıcı ilkinden sonra araca güvenmeyi
bırakır.

Bu yüzden **denetlenmeyen bir tip kabul edilir.** Gerçekten denetlenen tipler
`CHECKED_TYPES` içinde açıkça yazılı:

`INT`, `WILDCARDINT`, `POSITION`, `POSITION_FLOAT`, `FULLINTEGERRANGE`,
`SELECTION`, `WILDCARDSELECTION`, `OPERATOR`, `COMPAREOPERATOR`,
`postfix_t/s/d/l`

Denetlenmeyenler de gizlenmiyor, testte tek tek listeli:

`BLOCK_STATE_ARRAY`, `CODEBUILDERARGS`, `EXECUTECHAINEDOPTION_0`, `ID`,
`JSON_OBJECT`, `MESSAGE_ROOT`, `PATHCOMMAND`, `RAWTEXT`, `RVAL`, `VAL`

Liste küçüldükçe test güncellenir. Mojang yeni bir yapısal tip eklerse test
kırmızıya döner ve karar zorlanır — sessizce kabul edilmez.

## Bilinen boşluklar

- **Seçici harfi doğrulanmıyor.** `@z` geçerli bir seçici değil ama geçerli
  harflerin listesi Mojang'ın makine okunur tanımında yok. Elle liste yazmak
  bu projenin kaçındığı şey. Yalnızca yapı denetleniyor: `@` sonrası tek harf
  ve köşeli parantez dengeli kapanmalı.
  - Ölçülebilir: `npm run ws:health` ile oyuna `/give @z ...` gönderilip cevabı
    okunabilir (`docs/WEBSOCKET.md`). Ölçülürse liste kaynaklı hâle gelir.
- **Seçici filtre anahtarları doğrulanmıyor** (`type=`, `r=`, `scores=`).
  Aynı sebep: tanımda yoklar.
- **Blok durumları doğrulanmıyor.** `data/<sürüm>/blocks.json` durum adlarını
  ve alabildikleri değerleri tutuyor, yani bu kapatılabilir bir boşluk —
  `BLOCK_STATE_ARRAY` ayrıştırılıp `blockStates` ile karşılaştırılabilir.

## Testler

`packages/validator/test/command.test.ts` — 16 test, iki yön de ölçülüyor:
on iki geçerli komut geçmeli, altı bozuk komut düşmeli. Eval tarafında
`command-give-01` ve `command-fill-01` vakaları `commandSyntax` kontrolünü
istiyor; negatif kontrol koşuldu (koordinat bileşeni silinince vaka kırmızıya
döndü).
