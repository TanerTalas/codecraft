/**
 * Kurulu oyunun klasörleri.
 *
 * paths.ts repo içindeki yerleri çözüyor, burası oyunun makinedeki yerini.
 * knowledge içinde duruyor çünkü validator'ın ölçüm script'i kullanıyor ve
 * iki yönlü bir bağımlılık doğmasın diye ikisinin de bağımlı olduğu pakete
 * konuldu.
 */
import { access } from "node:fs/promises";
import { join } from "node:path";

/**
 * Oyunun com.mojang klasörü. İki düzen dolaşıyor ve hangisinin kullanıldığı
 * kurulu sürüme bağlı — tahmin edilmiyor, var olan aranıyor:
 *
 *   yeni  %APPDATA%\Minecraft Bedrock\Users\Shared\games\com.mojang
 *         Çok profilli düzen. Dünyalar profil klasöründe ama geliştirme
 *         paketleri Shared altında, profiller arasında ortak.
 *   eski  %LOCALAPPDATA%\Packages\Microsoft.MinecraftUWP_8wekyb3d8bbwe\
 *         LocalState\games\com.mojang
 *
 * 30-08-2026'da 1.26.45 kurulumunda ölçüldü: UWP LocalState altında sadece
 * bootstrapStorage var, gerçek veri yeni konumda.
 */
export const comMojangCandidates = (env: NodeJS.ProcessEnv = process.env): string[] => [
  join(env["APPDATA"] ?? "", "Minecraft Bedrock", "Users", "Shared", "games", "com.mojang"),
  join(
    env["LOCALAPPDATA"] ?? "",
    "Packages",
    "Microsoft.MinecraftUWP_8wekyb3d8bbwe",
    "LocalState",
    "games",
    "com.mojang",
  ),
];

/** development_behavior_packs klasörü. Bulunamazsa nedeni söylenerek durulur. */
export async function findDevPacksDir(env: NodeJS.ProcessEnv = process.env): Promise<string> {
  const candidates = comMojangCandidates(env);
  for (const candidate of candidates) {
    try {
      await access(candidate);
      return join(candidate, "development_behavior_packs");
    } catch {
      // sıradaki düzene bak
    }
  }
  throw new Error(
    "com.mojang klasörü bulunamadı. Bakılan yerler:\n" +
      candidates.map((path) => `  ${path}`).join("\n") +
      "\nMinecraft en az bir kez açılıp ana menüye ulaşmadıysa bu klasör oluşmaz.",
  );
}
