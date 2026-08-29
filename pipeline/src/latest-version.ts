/**
 * data/ içindeki en yeni sürümü basar. Tek kullanıcısı GitHub Actions:
 * commit mesajına sürümü yazarken sürüm klasörü mantığını YAML'a kopyalamamak
 * için var (bkz. .github/workflows/data.yml).
 */
import { listDataVersions } from "./check-freshness.ts";
import { runIfMain } from "./lib/cli.ts";

runIfMain(import.meta.url, async () => {
  const versions = await listDataVersions();
  const latest = versions.at(-1);
  if (latest === undefined) throw new Error("data/ içinde sürüm klasörü yok");
  process.stdout.write(latest);
});
