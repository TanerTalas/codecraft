/** Araçlar sayfası. Karşılığı `docs/CodeCraft Site.dc.html`, satır 247-304. */

import type { Metadata } from "next";

import { ToolCard } from "@/components/ToolCard";
import { VersionTabs } from "@/components/VersionTabs";
import { toolCards } from "@/content/site";

export const metadata: Metadata = {
  title: "Tools",
  description:
    "The nine read-only tools, the order the server hands to the model, and the five separate Bedrock version numbers that are routinely confused with each other.",
  alternates: { canonical: "/tools" },
};

export default function ToolsPage() {
  return (
    <div className="page">
      <h1 className="page-h">Tools</h1>

      <section className="sec sec-16">
        <div className="eyebrow">CALL ORDER</div>
        <p className="lede lede-70">The order the server hands to the model, in plain words:</p>
        <ol className="ol">
          <li>
            <code className="inl">check_feasibility</code> — can Bedrock do this at all.
          </li>
          <li>
            <code className="inl">get_version_info</code> and{" "}
            <code className="inl">get_schema</code> — which fields are required, which{" "}
            <code className="inl">format_version</code>.
          </li>
          <li>
            After the files are written, <code className="inl">review_pack</code>.
          </li>
        </ol>
      </section>

      <section className="sec sec-18">
        <div className="eyebrow">FIVE SEPARATE VERSION NUMBERS</div>
        <p className="lede lede-70">
          This is what <code className="inl">get_version_info</code> returns. They are five
          different things and they are routinely confused.
        </p>
        <VersionTabs />
        <div className="traps">
          <div className="trap">
            <strong>Trap 1.</strong> <code>format_version</code> is not the game version. It is that
            document type&apos;s own schema version: block <code>1.21.100</code>, feature rule{" "}
            <code>1.13.0</code>, spawn rule <code>1.8.0</code>, manifest <code>2</code>.
          </div>
          <div className="trap">
            <strong>Trap 2.</strong> The module version is <code>2.x</code> while the game version
            is <code>1.26.x</code>. On a prerelease tag the game version arrives embedded inside the
            module version: <code>2.11.0-beta.1.26.50-preview.27</code>.
          </div>
        </div>
      </section>

      <section className="sec sec-14">
        <div className="eyebrow">NINE TOOL CARDS</div>
        <div className="tcards">
          {toolCards.map((t) => (
            <ToolCard key={t.name} name={t.name} line={t.line} when={t.when} note={t.note} />
          ))}
        </div>
      </section>
    </div>
  );
}
