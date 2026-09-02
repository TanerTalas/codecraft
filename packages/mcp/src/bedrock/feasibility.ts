/**
 * Niyet ve yapılabilirlik eşlemesi — LLM'siz, kalıp eşlemesiyle.
 * `check_feasibility` aracının gövdesi.
 *
 * Doğrulamadan ÖNCE koşar: kullanıcı isteğini oyuncu diliyle söylüyor,
 * platform bambaşka bir şey sunuyor. Aradaki çeviriyi yapmayan bir araç
 * uydurulmuş API üretir.
 *
 * KANIT KURALI — checks.ts'deki ilkenin aynısı: buradaki her satırın ölçülmüş
 * bir dayanağı var ve o dayanak testle sabitlenmiş. Dayanak,
 * data/<sürüm>/script-types/@minecraft/server/<sürüm>/index.d.ts içinde ilgili
 * API'lerin YOKLUĞU. Mojang birini eklerse test kırmızıya döner ve kural
 * yeniden ölçülür. Ölçülmemiş kural buraya yazılmaz.
 */

/** Bu isteğin doğru cevabının hangi biçimde olduğu. */
export type Category = "input-simulation" | "filesystem" | "network";

export type FeasibilityRule = {
  category: Category;
  /** Oyuncu dilindeki tetikleyiciler. Türkçe ve İngilizce karışık gelebiliyor. */
  triggers: RegExp[];
  /** Neden behavior pack script'i ile yapılamıyor. */
  reason: string;
  /** Kuralın dayandığı ölçüm. Testte doğrulanıyor. */
  evidence: string;
  /** Kullanıcıya önerilecek yol. */
  alternative: string;
};

/**
 * .d.ts içinde BULUNMAMASI gereken tanımlayıcılar. Test bunları tarar.
 *
 * "fetch" listede yok: dosyada geçiyor ama yalnızca bir doküman yorumunda
 * ("the block volume it was fetched from"). Tanımlayıcı olarak arandığında
 * yakalanmaması gerekir, o yüzden test kelime sınırlı ve tip bildirimi
 * bağlamında arar (bkz. test).
 */
export const ABSENT_APIS: Record<Category, string[]> = {
  // Girdi OKUNABİLİR (playerButtonInput) ve KISITLANABİLİR
  // (PlayerInputPermissions) ama ÜRETİLEMEZ. SimulatedPlayer yalnızca
  // @minecraft/server-gametest içinde ve o modül bu veri kümesinde yok.
  "input-simulation": ["SimulatedPlayer", "simulateUse", "simulateBreak", "sendKey"],
  filesystem: ["readFile", "writeFile", "readFileSync", "FileSystem"],
  network: ["XMLHttpRequest", "WebSocket", "HttpRequest", "HttpClient"],
};

const RULES: FeasibilityRule[] = [
  {
    category: "input-simulation",
    triggers: [
      /bas[ıi]l[ıi]\s*tut/i,
      /otomatik\s*(t[ıi]kla|vur|kaz|k[ıi]r)/i,
      /kendi\s*kendine\s*(t[ıi]kla|vur)/i,
      /\bmakro\b/i,
      /\bafk\b/i,
      /(fare|mouse|klavye|keyboard)\w*\s*(ile|ye|ya)?\s*(bas|t[ıi]kla|simüle)/i,
      /girdi(yi)?\s*simüle/i,
      // "klavyeye dokunmadan", "tuşa basmadan", "fareye değmeden" — girdinin
      // YOKLUĞU üzerinden kurulan istek. Ölçülerek eklendi (01-09-2026,
      // docs/mcp-kullanim.md senaryo 4): "Ben klavyeye dokunmadan otomatik
      // balık tutsun" isteği bu listeden geçiyordu, check_feasibility
      // "blocked: false" dönüyordu ve modeli durduran şey aracın kendisi
      // DEĞİL modelin kendi bilgisi oldu. Doğru cevap: oyunun dışından
      // çalışan bir otomasyon script'i.
      //
      // "otomatik <şey>" kalıbı BİLEREK eklenmedi: "otomatik olarak oluşsun"
      // ve "her otuz saniyede bir zombi belirsin" gibi istekler tamamen
      // yapılabilir, yanlış engellenirlerdi. 24 istek üzerinde ölçüldü:
      // yanlış engelleme sıfır.
      //
      // Ek olarak m[ae]: Türkçe ünlü uyumu. "dokunmadan" ve "basmadan"
      // "ma" alıyor ama "değmeden" "me" alıyor; yalnızca "ma" yazınca
      // sonuncusu kaçıyordu ve bunu testin kendisi yakaladı.
      /(klavye|keyboard|fare|mouse|tu[şs]a?)\w*\s*(dokun|bas|de[ğg])\w*m[ae]/i,
    ],
    reason:
      "@minecraft/server oyuncu girdisini simüle edemez. Girdiyi okuyabilir " +
      "(playerButtonInput) ve kısıtlayabilir (PlayerInputPermissions), ama " +
      "üretemez — yani \"basılı tutmuş gibi\" davranış script'le kurulamaz.",
    evidence:
      "@minecraft/server 2.9.0 index.d.ts: SimulatedPlayer/simulateUse/sendKey yok. " +
      "SimulatedPlayer yalnızca @minecraft/server-gametest içinde ve o modül " +
      "data/<sürüm>/script-types/ altında bulunmuyor.",
    alternative:
      "İki yol var: (1) istenen sonucu doğrudan yapan bir behavior pack — " +
      "örneğin \"basılı tutup kazmak\" yerine kırılan bloğun komşularını da " +
      "kıran zincirleme kazma; (2) oyunun dışından çalışan bir otomasyon " +
      "script'i (Python).",
  },
  {
    category: "filesystem",
    triggers: [
      /yedek(le|lesin|leme)/i,
      /\bbackup\b/i,
      /dosya(ya|dan)?\s*(yaz|kaydet|oku)/i,
      /klas[öo]r[üu]?\w*\s*(kopyala|ta[şs][ıi])/i,
      /diske\s*kaydet/i,
    ],
    reason:
      "Behavior pack script'i dosya sistemine erişemez. @minecraft/server " +
      "dosya okuma/yazma API'si sunmuyor; dünya verisi yalnızca oyunun " +
      "kendi depolama API'leri üzerinden görünür.",
    evidence:
      "@minecraft/server 2.9.0 index.d.ts: readFile/writeFile/FileSystem yok, " +
      "require()/import() dinamik yükleme yok.",
    alternative:
      "Oyunun dışından çalışan bir Python script'i — dünya klasörünü işletim " +
      "sistemi üzerinden kopyalar. Bu, aracın \"otomasyon script'i\" çıktı " +
      "tipine giren istek.",
  },
  {
    category: "network",
    triggers: [
      /\bdiscord\b/i,
      /\bwebhook\b/i,
      /\bapi'?(ye|ya)\s*(istek|bağlan)/i,
      /http\s*iste[ğg]i/i,
      /internet(ten|e)\s*(veri|çek|gönder)/i,
      /sunucuya\s*(veri\s*)?g[öo]nder/i,
    ],
    reason:
      "Behavior pack script'i ağ isteği yapamaz. @minecraft/server'da fetch " +
      "veya benzeri bir HTTP istemcisi yok; @minecraft/server-net yalnızca " +
      "Bedrock Dedicated Server'da mevcut ve v1 kapsamı tek oyunculu PC.",
    evidence:
      "@minecraft/server 2.9.0 index.d.ts: XMLHttpRequest/WebSocket/HttpRequest " +
      "yok. \"fetch\" dosyada yalnızca bir doküman yorumunda geçiyor, API olarak " +
      "tanımlı değil.",
    alternative:
      "Oyunun dışından çalışan bir Python script'i. Oyun ile konuşması " +
      "gerekiyorsa /connect (WebSocket) yolu var ama belgelenmemiş ve her " +
      "sürümde kırılabilir.",
  },
];

export type FeasibilityResult =
  | { blocked: false }
  | {
      blocked: true;
      category: Category;
      reason: string;
      evidence: string;
      alternative: string;
      /** Eşleşen tetikleyici — kararın neden verildiği görünsün. */
      matched: string;
    };

/** Bu sürümde tanınan kategoriler. */
export const feasibilityRules = (): readonly FeasibilityRule[] => RULES;

/**
 * İstek platformun izin vermediği bir kategoriye giriyor mu.
 *
 * Yanlış pozitif yönü bilerek muhafazakâr: kalıplar dar tutuldu. Kaçırılan bir
 * istek modele gider ve doğrulamadan geçer ya da geçmez; yanlış yere takılan
 * bir istek ise kullanıcıya yapılabilir bir şeyi "yapılamaz" diye söyler, ki
 * bu daha kötü.
 */
export function checkFeasibility(request: string): FeasibilityResult {
  for (const rule of RULES) {
    for (const trigger of rule.triggers) {
      const match = trigger.exec(request);
      if (match === null) continue;
      return {
        blocked: true,
        category: rule.category,
        reason: rule.reason,
        evidence: rule.evidence,
        alternative: rule.alternative,
        matched: match[0],
      };
    }
  }
  return { blocked: false };
}
