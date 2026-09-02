/**
 * Araç çıktısının bayt tavanı.
 *
 * Karar dokümanı bunu optimizasyon değil zorunluluk sayıyor. Ölçüldü
 * (01-09-2026) ve tablo beklenenden keskin çıktı — sınır tek bir araçta baskı
 * yapıyor:
 *
 *   lookup tek sonuç                                74 B
 *   blockStates en karmaşığı (cauldron)            130 B
 *   validateJson en büyük sonuç (3 hata)           515 B
 *   validateCommand en büyüğü (/execute)         2.683 B
 *   get_version_info                             3.290 B
 *   review() 8 dosyalık paket                    6.230 B
 *   get_schema, minecraft:entity/components     59.763 B   <-- tek sorun
 *
 * Tavan yine de HER araca uygulanıyor: bugün küçük olan bir çıktı yarın büyür
 * ve büyüdüğünde sessizce kesilmemeli.
 *
 * 24.000 bayt neden: review_pack'in ölçülen 6.230 baytının dört katı,
 * get_schema'nın ad listesi basamağının (15.898) rahat üstünde, o düğümün tam
 * özetinin (59.763) ise altında. Yani doğru yerde ayırıyor — küçük çıktılar
 * hiç dokunulmadan geçiyor, gerçekten büyük olan daralıyor.
 *
 * Bu sayı araç TANIMLARININ bütçesiyle karıştırılmamalı. Karar dokümanının
 * andığı ~30.000 token oradaki sınır ve orada sıkışıklık yok: sekiz aracın
 * tools/list çıktısı 9.036 bayt (~2.260 token), yani bütçenin ~%7'si.
 * Dağıtılmış uçta ölçüldü, 01-09-2026. (Bu satır önce "~6 KB" diyordu; o
 * rakam sekiz araç bağlanmadan önce alınmıştı ve eskimişti.)
 */

/** Tek bir araç çıktısının üst sınırı. Gerekçesi dosyanın başında. */
export const BYTE_LIMIT = 24_000;

export const byteLength = (value: unknown): number =>
  Buffer.byteLength(typeof value === "string" ? value : JSON.stringify(value), "utf8");

/**
 * Bir aracın metin gövdesini tavana indirir.
 *
 * SON SAVUNMA HATTI. Asıl daraltma aracın kendi işi olmalı —
 * `summarizeSchema` bunu yapıyor ve neyi kestiğini alanıyla söylüyor. Burası
 * o daralmanın yetmediği ya da hiç yapılmadığı durumda devreye giriyor.
 *
 * Kesme SESSİZ DEĞİL: kesilen gövdenin sonuna kaç bayttan kaçının kaldığı
 * yazılıyor. Model eksik veriyle çalıştığını bilmeli, yoksa yarım JSON'u tam
 * sanıp ona göre üretir.
 */
export function capText(text: string, limit: number = BYTE_LIMIT): string {
  const total = Buffer.byteLength(text, "utf8");
  if (total <= limit) return text;

  const notice =
    `\n\n[TRUNCATED] Output was ${total} bytes and was cut to the ${limit} byte cap. ` +
    "The JSON above is incomplete and may not parse. Call again with a narrower request.";
  const room = limit - Buffer.byteLength(notice, "utf8");
  // Çok haneli karakterin ortasından kesmemek için Buffer üzerinden gidiliyor.
  return Buffer.from(text, "utf8").subarray(0, Math.max(0, room)).toString("utf8") + notice;
}

/**
 * Araç sonucunun ortak biçimi: tavanı uygulanmış tek metin parçası.
 *
 * GİRİNTİ YOK ve bu bilerek. Ölçüldü: girintili yazım get_version_info'yu
 * 3.290 -> 4.025 bayta (%22), get_schema'nın en büyük düğümünü 15.898 ->
 * 22.966 bayta (%45) çıkarıyor. Model girintiye ihtiyaç duymuyor, bütçe
 * duyuyor.
 *
 * Bu ayrıca bir tutarsızlığı kapatıyor: summarizeSchema kendi daralmasını
 * SIKIŞTIRILMIŞ bayt üzerinden ölçüyor. Burada girintili yazsaydık, tam da
 * tavana göre daraltılmış bir özet girintiyle tavanı tekrar aşar ve
 * capText'in sert kesmesine yakalanırdı — yani geçerli JSON bozulurdu.
 */
export function jsonResult(payload: unknown): {
  content: { type: "text"; text: string }[];
} {
  return { content: [{ type: "text", text: capText(JSON.stringify(payload)) }] };
}
