/** Ana sayfa. Karşılığı `docs/CodeCraft Site.dc.html`, satır 54-171. */

import type { Metadata } from "next";
import Link from "next/link";

import { ENDPOINT, failures, steps, toolCards } from "@/content/site";

export const metadata: Metadata = {
  title: "CodeCraft — MCP server for Minecraft Bedrock",
  description:
    "Bedrock fails silently: an invented format_version, a missing identifier, an API that is not in @minecraft/server. CodeCraft is an MCP server with nine read-only tools that measure whether the generated content will actually load.",
  alternates: { canonical: "/" },
};

export default function HomePage() {
  return (
    <div className="stack">
      <section className="hero">
        <div className="hero-grid">
          <div className="hero-col">
            <div className="eyebrow">01 — WHAT IT IS</div>
            <h1 className="hero-h">
              An MCP server that checks whether Bedrock content will actually load.
            </h1>
            <p className="lede">
              You bring the model. It runs in your own Claude client, on your own subscription.
              CodeCraft never sits in between and never generates content.
            </p>
          </div>
          <div className="hero-col hero-col-tight">
            <p className="lede">
              The one thing it does: measure whether the thing that was generated is going to work.
            </p>
            <div className="stats">
              <div className="stat">
                <div className="stat-n">9</div>
                <div className="stat-l">read-only tools</div>
              </div>
              <div className="stat">
                <div className="stat-n">60</div>
                <div className="stat-l">document types</div>
              </div>
              <div className="stat">
                <div className="stat-n">5</div>
                <div className="stat-l">version numbers</div>
              </div>
              <div className="stat stat-zero">
                <div className="stat-n">0</div>
                <div className="stat-l">stored requests</div>
              </div>
            </div>
          </div>
        </div>

        <div className="compare">
          <div className="panel">
            <div className="panel-h">WHAT THE MODEL WROTE</div>
            <pre className="panel-code">
              {'{\n  "format_version": '}
              <span className="mark-bad">&quot;1.26.40&quot;</span>
              {',\n  "minecraft:spawn_rules": {\n    "description": { "identifier": "ex:guardian" }\n  }\n}'}
            </pre>
            <div className="panel-f panel-f-bad">
              Loads in the game with no error and no entity.
            </div>
          </div>
          <div className="compare-mid">
            <div className="validate">VALIDATE</div>
          </div>
          <div className="panel">
            <div className="panel-h">WHAT CODECRAFT RETURNS</div>
            <pre className="panel-code">
              {'"ok": false\n"pointer": "/format_version"\n"rule": "enum"\n"allowed": ['}
              <span className="mark-good">&quot;1.8.0&quot;</span>
              {', "1.10.0", "1.12.0"]\n"version": "1.26.40.5"'}
            </pre>
            <div className="panel-f panel-f-good">
              Pointer, rule, and the values the schema accepts.
            </div>
          </div>
        </div>
      </section>

      <section className="sec">
        <div className="eyebrow">02 — THE PROBLEM</div>
        <h2 className="sec-h">Bedrock fails silently.</h2>
        <p className="lede">
          A general model invents a <code className="inl">format_version</code>, references a{" "}
          <code className="inl">minecraft:</code> identifier that does not exist, calls an API that
          is not in <code className="inl">@minecraft/server</code> — and none of it raises an error
          until the pack is loaded in the game.
        </p>
        <div className="rows">
          {failures.map((f) => (
            <div key={f.what} className="row row-hover">
              <div className="row-k">
                <code>{f.what}</code>
              </div>
              <div className="row-v">{f.result}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="sec">
        <div className="eyebrow">03 — HOW IT WORKS</div>
        <div className="cards3">
          {steps.map((s) => (
            <div key={s.n} className="step">
              <div className="step-n">{s.n}</div>
              <div className="step-t">{s.text}</div>
            </div>
          ))}
        </div>
        <div className="note">Values are read from version-pinned data, not recalled.</div>
      </section>

      <section className="cards2">
        <div className="card">
          <div className="card-h">What it guarantees</div>
          <p>
            The validator catches things the game will reject. It does not say your content will
            behave the way you wanted.
          </p>
          <Link href="/limits" className="card-link">
            Read the limits →
          </Link>
        </div>
        <div className="card">
          <div className="card-h">Quick setup</div>
          <ul>
            <li>
              Endpoint: <code>{ENDPOINT}</code>
            </li>
            <li>
              In Claude: <strong>Customize &gt; Connectors</strong> (not Settings) → custom
              connector → paste the address
            </li>
            <li>
              Once connected, <strong>9 tools</strong> should appear — all nine read-only
            </li>
          </ul>
          <Link href="/setup" className="card-link">
            Full setup →
          </Link>
        </div>
      </section>

      <section className="sec">
        <div className="eyebrow">04 — NINE TOOLS, ALL READ-ONLY</div>
        <p className="lede">The server writes nothing, anywhere.</p>
        <div className="rows rows-10">
          {toolCards.map((t) => (
            <div key={t.name} className="row row-tool row-lift">
              <div className="row-k">
                <code>{t.name}</code>
              </div>
              <div className="row-v">{t.line}</div>
            </div>
          ))}
        </div>
        <Link href="/tools" className="card-link">
          Tool reference →
        </Link>
      </section>

      <section className="privacy">
        <div className="eyebrow eyebrow-light">05 — PRIVACY</div>
        <ul>
          <li>No authentication, no accounts, no sessions.</li>
          <li>No user data is stored. The server is stateless; every request is discarded.</li>
          <li>All nine tools are read-only. The server sends data nowhere.</li>
          <li>The validation layer connects to no LLM — that is not a promise, it is a test.</li>
          <li>Source is open, Apache-2.0.</li>
        </ul>
      </section>
    </div>
  );
}
