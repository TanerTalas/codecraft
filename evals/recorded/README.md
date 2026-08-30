# Kayıtlı çıktılar

**Bu klasördeki dosyalar elle yazıldı. Model çıktısı değiller.**

Aşama 2.5'te LLM katmanı henüz yok (`packages/core` boş, Aşama 3'ün işi). Eval
tezgâhının bugün ölçülebilir olması için runner takılabilir bir `Generator`
arayüzü üstünde çalışıyor ve varsayılan üretici burayı okuyor.

Runner terminale ve HTML rapora üreticinin `provenance` satırını basar:

```
elle yazılmış kayıt (evals/recorded/) — model çıktısı değil
```

Bu satır görünmeden rapor basılmaz. Kayıtlı bir çıktının model sonucu gibi
raporlanması, bu projenin baştan reddettiği şey (`CLAUDE.md`, "sahte veya örnek
veriyle ilerleyip gerçekmiş gibi raporlamak").

## Düzen

```
evals/recorded/<vaka-id>/BP/...        davranış paketi dosyaları
evals/recorded/<vaka-id>/automation/…  dışarıdan çalışan script'ler
```

`BP/` öneki bilerek: doküman tipi çözümlemesi Blockception'ın glob eşlemesinden
geliyor ve o eşleme yolun içinde bir davranış paketi klasörü bekliyor
(`*bp*/blocks/*.json`). Yol elle tipe eşlenmiyor, `resolveType` çözüyor.

## Bilerek başarısız beş vaka

Hepsi geçseydi runner'ın hata dalları hiç koşmazdı ve `--gate` bayrağının
gerçekten kapı olduğu görülemezdi. Beş düşüş beş ayrı sınıfı gösteriyor:

| Vaka | Ne düşüyor | Sınıf |
|---|---|---|
| `custom-item-01` | ajv — `max_stack_size` metin verilmiş | şema |
| `mob-timer-01` | tsc — `world.events` 2.x'te kaldırıldı | tip |
| `recipe-ruby-01` | `checkIdentities` — sonuç item'ı tanımlı değil | A |
| `ore-gen-01` | `checkFileNames` — dosya adı identifier'a eşit değil | B |
| `welcome-message-01` | `checkPatterns` — `worldLoad`'da `sendMessage` | D |

A, B ve D 30-08-2026'da gerçek oyunda ölçüldü (`docs/VALIDATION-LIMITS.md`).

Bugünkü skor **20'de 15**. Geçiş kapısı 18, yani `npm run eval -- --gate`
şu an `exit 1` veriyor — beklenen davranış bu.

## Aşama 3'te ne olacak

`evals/src/generators/model.ts` eklenecek ve `--generator=model` ile
seçilecek. Runner ve rapor değişmeyecek. Gerçek model cevapları buraya
commit edilmez; `evals/output/` altına yazılır ve `.gitignore` içindedir.
