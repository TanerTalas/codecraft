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
  // @minecraft/server-gametest içinde.
  //
  // Buradaki yokluk ölçümü BİLEREK yalnız @minecraft/server üzerinde koşuyor
  // (bkz. test). O modül veri kümesinde ayrıca duruyor —
  // script-types/@minecraft/server-gametest/1.0.0-beta/ — ve SimulatedPlayer
  // orada var. Kuralın dayanağı "hiçbir yerde yok" değil, "shipped bir
  // behavior pack'in kullanabileceği stable modülde yok".
  //
  // Bu yorum 05-09-2026'da düzeltildi: "o modül bu veri kümesinde yok"
  // yazıyordu ve artık yanlıştı, gametest tipleri çekiliyor. İngilizce
  // evidence metni ("beta-only module") doğruydu, yanlış olan yalnız yorumdu.
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

      // İngilizce kalıplar (02-09-2026). Türkçe olanların aynı dar tutulma
      // kuralı burada da geçerli: yalnız başına /auto/ EKLENMEDİ, çünkü
      // "spawn a zombie automatically" tamamen yapılabilir bir istek ve
      // yanlış engellenirdi — Türkçe tarafta "otomatik <şey>" için ölçülen
      // dersin aynısı.
      /auto[\s-]?click/i,
      /\bmacro\b/i,
      /keep\s+(clicking|mining|attacking|hitting|farming)/i,
      /(hold|press|spam)\w*\s+(down\s+)?(the\s+)?(key|button|mouse|left|right)/i,
      /simulate\s+\w*\s*(input|click|key|mouse|player|press)/i,
      /without\s+(me\s+)?(touching|pressing|using|holding)\s+(the\s+)?(keyboard|mouse|key|button)/i,

      // "otomatik" ile fiil arasında boşluk (05-09-2026). Ölçülen kayıp:
      // "Crosshair taşın üstündeyken otomatik olarak o bloğu kırmaya
      // başlasın" isteği `blocked: false` döndü. Yukarıdaki
      // /otomatik\s*(...)/ kalıbı fiili BİTİŞİK arıyor, araya "olarak o
      // bloğu" giriyor. Senaryo 4 ile aynı sınıfta üçüncü vaka.
      //
      // Genişletme iki yerden dar tutuldu, çünkü satır 67-71'deki gerekçe
      // ("otomatik <şey>" tek başına engellenmez) hâlâ geçerli:
      //   1. Araya en fazla 25 karakter, ve cümle sonu işaretleri hariç —
      //      iki ayrı cümle birleştirilip yanlış eşleşme üretmesin.
      //   2. Fiil kökü TEK BAŞINA yetmiyor, bir çekim eki de gerekiyor.
      //      Bu şart ölçülerek eklendi: eksiz hâli "otomatik olarak kazan
      //      dolsun", "otomatik olarak kesin bir sayı göster", "otomatik
      //      olarak kırmızı yün ver", "otomatik olarak vurgu rengini
      //      değiştir" isteklerini yanlış engelliyordu — hepsi yapılabilir.
      //      Ek şartıyla dördü de geçiyor.
      /otomatik[^.!?\n]{0,25}?\b(t[ıi]kla|vur|kaz|k[ıi]r|kes)(s[ıiuü]n|m[ae]|m[ıi]ş|acak|ecek|[ıiuü]yor|ar|er)/i,

      // İngilizce karşılığı. Aynı 25 karakterlik sınır: "automatically start
      // mining" geçiyor, "automatically place a block and break the old one"
      // geçmiyor (boşluk 25'i aşıyor) — ikincisi yapılabilir bir istek.
      /automatic(ally)?[^.!?\n]{0,25}?\b(click|min(e|ing)|break|dig|attack|hit|chop)/i,
      // İsim hâlleri. Fiil değil isim arandığı için sınır gerekmiyor;
      // "autofarm" BİLEREK yok, otomatik çiftlik yapılabilir bir istek.
      /\bauto[\s-]?(clicker|mine|miner|mining|breaker|digger)\b/i,
    ],
    reason:
      "@minecraft/server cannot simulate player input. It can read input " +
      "(playerButtonInput) and restrict it (PlayerInputPermissions), but it cannot " +
      "produce it — so \"as if a key were held down\" behaviour cannot be built " +
      "with a behavior pack script.",
    evidence:
      "@minecraft/server 2.9.0 index.d.ts defines no SimulatedPlayer, simulateUse " +
      "or sendKey. SimulatedPlayer exists only in @minecraft/server-gametest, which " +
      "is published as a beta-only module and is meant for automated GameTest runs, " +
      "not for shipped behavior packs.",
    alternative:
      "Two options. (1) A behavior pack that produces the desired outcome " +
      "directly instead of faking the input. The general recipe is to read the " +
      "state the input would have acted on and act on it yourself: " +
      "Player.getBlockFromViewDirection gives the block under the crosshair, " +
      "Block.setType removes it, LootTableManager.generateLootFromTable(table, " +
      "tool) produces the drops, and world.afterEvents.playerButtonInput gives " +
      "you a toggle. Chain mining — breaking the neighbours of the block the " +
      "player broke — is the same idea in a simpler form. " +
      "(2) An automation script that runs outside the game (Python) and holds " +
      "the real key or mouse button. Prefer (2) when the request asks for " +
      "vanilla fidelity — mining time per tool, durability loss, correct " +
      "drops — because there the game still does the work and that fidelity is " +
      "free, whereas a pack would have to reimplement all of it and every " +
      "approximation shows. Prefer (1) when the behaviour has to depend on game " +
      "state an outside script cannot see, such as which block is targeted. " +
      "You usually cannot have both: the only bridge between the game and an " +
      "outside process is the /connect WebSocket, and that requires cheats to " +
      "be enabled in the world.",
  },
  {
    category: "filesystem",
    triggers: [
      /yedek(le|lesin|leme)/i,
      // "backup" ve "back up" — ikisi de. Ölçüldü (02-09-2026): yalnızca
      // birleşik hâli aranırken "back up my world every night" kaçıyordu.
      /\bback(ing)?\s?ups?\b/i,
      /dosya(ya|dan)?\s*(yaz|kaydet|oku)/i,
      /klas[öo]r[üu]?\w*\s*(kopyala|ta[şs][ıi])/i,
      /diske\s*kaydet/i,

      // İngilizce kalıplar (02-09-2026).
      // "write the player stats to a file" — fiil ile "file" arasına araya
      // kelimeler girebiliyor, o yüzden sınırlı bir boşluk bırakılıyor. Sınır
      // cümle sonu işaretleriyle kapatıldı ki iki ayrı cümleyi birleştirip
      // yanlış eşleşme üretmesin.
      /(write|read|save|append|dump)\b[^.!?\n]{0,40}?\b(to|into|from)\s+(a|the)\s+file\b/i,
      /(write|read|save|append)\s+(it\s+)?(to\s+)?(a\s+|the\s+)?file\b/i,
      /save\s+(it\s+)?to\s+(the\s+)?disk/i,
      /(copy|move|zip)\s+(the\s+)?(world\s+)?(folder|directory)/i,
      /file\s?system\s+access/i,
    ],
    reason:
      "A behavior pack script cannot reach the file system. @minecraft/server " +
      "exposes no file read/write API; world data is visible only through the " +
      "game's own storage APIs.",
    evidence:
      "@minecraft/server 2.9.0 index.d.ts defines no readFile, writeFile or " +
      "FileSystem, and there is no dynamic require()/import() loading.",
    alternative:
      "A Python script that runs outside the game and copies the world folder " +
      "through the operating system. This is the \"automation script\" kind of " +
      "output; validate it with validate_python.",
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

      // İngilizce kalıplar (02-09-2026). "send to a server" dar tutuldu:
      // yalnızca dış bir uca gönderme kastediliyorsa eşleşiyor, yoksa
      // "send a message to players on the server" yanlış engellenirdi.
      /http\s+request/i,
      /(call|hit|query|consume)\s+(an?\s+)?(external\s+)?api\b/i,
      /send\s+\w*\s*(data|stats|logs?|score\w*)?\s*to\s+(an?\s+)?(external\s+|remote\s+)?(server|endpoint|url|website|api)\b/i,
      /fetch\s+(\w+\s+)?from\s+(the\s+)?(internet|web|url|api)\b/i,
    ],
    reason:
      "A behavior pack script cannot make network requests. @minecraft/server has " +
      "no fetch or any other HTTP client; @minecraft/server-net exists only on the " +
      "Bedrock Dedicated Server, while the scope here is single-player PC.",
    evidence:
      "@minecraft/server 2.9.0 index.d.ts defines no XMLHttpRequest, WebSocket or " +
      "HttpRequest. The word \"fetch\" appears in the file only inside a doc " +
      "comment; it is not defined as an API.",
    alternative:
      "A Python script that runs outside the game. If it needs to talk to the " +
      "game, the /connect WebSocket route exists, but it is undocumented and can " +
      "break in any version.",
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
