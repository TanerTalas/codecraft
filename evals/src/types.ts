/**
 * Eval tipleri — Aşama 2.5 (bkz. TODO.md).
 *
 * Alan adları İngilizce, içerik Türkçe: vaka dosyası
 * packages/validator/test/fixtures/cases.json ile aynı düzeni izliyor
 * (core = ölçüt, extra = ölçüm) ve TS tipleriyle birebir eşleşiyor.
 */
import type { FileResult } from "@codecraft/core";
import type { Finding } from "@codecraft/validator";

/**
 * Üretilen çıktının türü.
 *
 * script/json bugün otomatik ölçülebiliyor (tsc / ajv). command ve python
 * ölçülemiyor — komut sözdizimi doğrulayıcısı v1 kapsamı dışında (CLAUDE.md)
 * ve altyapıda Python çalıştırılmıyor. O yüzden ikisi sadece "extra"
 * listesinde durur, geçiş kapısına sayılmaz.
 */
export type EvalKind = "script" | "json" | "command" | "python";

export type EvalCase = {
  /** "chain-mining-01" */
  id: string;
  /** Oyuncu diliyle istek. Modele giden metin bu. */
  request: string;
  /** data/ içindeki sürüm. resolveVersion üç parçalıyı dört haneliye çözüyor. */
  version: string;
  kind: EvalKind;
  expect: {
    /** Şema ve tsc sonucu. Bugün her vaka için "pass". */
    validation: "pass";
    /** Koşulacak ek kontroller: "identity" · "filename" · "pattern:<ad>" */
    checks: string[];
  };
  /** Vaka neden var, hangi hata sınıfını hedefliyor. */
  note?: string;
};

export type EvalCases = {
  core: EvalCase[];
  extra: EvalCase[];
};

/** Üreticinin verdiği tek dosya. path paket köküne göreli. */
export type GeneratedFile = {
  path: string;
  content: string;
};

export type Generation = {
  files: GeneratedFile[];
  /** Modelin açıklaması varsa rapora basılır. */
  notes?: string;
};

/**
 * Çıktıyı üreten kaynak. Aşama 2.5'te elle yazılmış kayıt, Aşama 3'te model.
 * Runner ikisini de aynı arayüzden görür.
 */
export type Generator = {
  /** "recorded" · "model". Rapora basılır. */
  name: string;
  /**
   * Çıktının nereden geldiği. Rapora ve terminale aynen yazılır — elle yazılmış
   * bir çıktı model sonucu gibi görünmesin.
   */
  provenance: string;
  generate(testCase: EvalCase): Promise<Generation>;
};

/**
 * Tek dosyanın doğrulama sonucu — @codecraft/core (review.ts) içinde tanımlı.
 * Üretim döngüsü ve eval aynı tipi kullanır, ikisi ayrışamaz.
 */
export type { FileResult };

export type CaseResult = {
  case: EvalCase;
  files: FileResult[];
  /**
   * En az bir dosya ajv ya da tsc ile ölçülebildi mi. command/python
   * çıktılarında false — "düştü" ile "ölçülemedi" karışmasın.
   */
  measured: boolean;
  /** Ölçülebilen bütün dosyalar geçti mi. */
  validation: boolean;
  /** İstenen ek kontrollerin sonucu. */
  checks: { ok: boolean; findings: Finding[] };
  /** validation && checks.ok */
  ok: boolean;
  /**
   * Üretici ya da runner patladıysa mesajı. Doluysa vaka geçmemiş sayılır —
   * bir istisna "geçti" gibi görünmez.
   */
  failure?: string;
  /**
   * Vaka sağlayıcının istek limiti yüzünden tamamlanamadı.
   *
   * Ayrı tutuluyor çünkü "model yanlış çıktı üretti" ile "çağrı hiç
   * yapılamadı" aynı şey değil; ücretsiz kademede ikincisi olağan ve skoru
   * model başarımı sanmak ölçümü yalanlar.
   */
  limited?: boolean;
};

export type RunResult = {
  generator: { name: string; provenance: string };
  /** ISO 8601, raporun başlığında. */
  startedAt: string;
  /** Geçiş kapısının saydığı liste. */
  core: CaseResult[];
  /** Ölçüm listesi — kapıya sayılmaz. */
  extra: CaseResult[];
  gate: { total: number; passed: number; required: number };
  /** Kaç vaka istek limitinden tamamlanamadı. Skor bununla birlikte okunur. */
  limited: number;
};
