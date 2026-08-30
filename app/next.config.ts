import type { NextConfig } from "next";

const config: NextConfig = {
  // @codecraft/core ham TypeScript olarak yayınlanıyor (derleme adımı yok,
  // göreli import'larda .ts uzantısı zorunlu). Next'in onu kendi derlemesine
  // dahil etmesi gerekiyor.
  transpilePackages: ["@codecraft/core"],
};

export default config;
