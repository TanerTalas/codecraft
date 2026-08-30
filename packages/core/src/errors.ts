/**
 * Kullanıcıya yönelik hatalar.
 *
 * Ayrımın sebebi: "anahtar tanımlı değil" bir kod hatası değil, tek adımlık
 * bir talimat. Yığın izi basmak talimatı gürültüye gömer. Bu türden hatalar
 * CLI'da sade basılır; geri kalan her şey olduğu gibi yükselir ki gerçek
 * kusurlar saklanmasın.
 */
export class UserError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "UserError";
  }
}
