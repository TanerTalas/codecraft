/**
 * Altbilgi: marka feragati, atıflar, bağlantılar, uç adresi.
 * Karşılığı `docs/CodeCraft Site.dc.html`, satır 382-410.
 *
 * Feragat metni İngilizce aslıyla duruyor ve öyle kalmak zorunda
 * (`docs/site-icerik.md`, "Marka feragati — zorunlu").
 *
 * Tasarımda "LINKS" sütunundaki üç satır düz `<div>` idi, href taşımıyordu;
 * burada gerçek bağlantı oldular.
 */

import { ENDPOINT, REPO, REPO_LICENSE, REPO_NOTICES, USAGE_GUIDELINES } from "@/content/site";

export function Footer() {
  return (
    <footer className="ft">
      <div className="ft-in">
        <div className="ft-dis">
          <pre>
            {"NOT AN OFFICIAL MINECRAFT PRODUCT.\nNOT APPROVED BY OR ASSOCIATED WITH MOJANG OR MICROSOFT."}
          </pre>
        </div>
        <div className="ft-cols">
          <div className="ft-col">
            <div className="ft-h">ATTRIBUTIONS</div>
            <div>Schemas: Blockception Ltd, BSD-3-Clause (attribution required).</div>
            <div>Script types: Microsoft, MIT.</div>
            <div>Release notes: Microsoft, CC-BY-4.0.</div>
            <div>CodeCraft: Apache-2.0.</div>
          </div>
          <div className="ft-col">
            <div className="ft-h">LINKS</div>
            <a href={REPO}>Repository</a>
            <a href={REPO_LICENSE}>License</a>
            <a href={REPO_NOTICES}>Third-party notices</a>
            <a href={USAGE_GUIDELINES}>Minecraft Usage Guidelines</a>
          </div>
          <div className="ft-col">
            <div className="ft-h">ENDPOINT</div>
            <code>{ENDPOINT}</code>
            <div>Stateless. Read-only. No auth.</div>
          </div>
        </div>
      </div>
    </footer>
  );
}
