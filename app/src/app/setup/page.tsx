/** Kurulum sayfası. İçerik kaynağı `docs/site-icerik.md`, "Sayfa 2 — Kurulum". */

import type { Metadata } from "next";

import { CopyEndpoint } from "@/components/CopyEndpoint";
import { ENDPOINT, nonBugs, scenarios, setupSteps } from "@/content/site";

export const metadata: Metadata = {
  title: "Setup — add the Bedrock MCP server to Claude",
  description:
    "How to add the CodeCraft MCP endpoint to your own Claude client, how to tell it worked, what to try first, and the three things that look like bugs but are not.",
  alternates: { canonical: "/setup" },
};

export default function SetupPage() {
  return (
    <div className="page">
      <h1 className="page-h">Setup</h1>

      <section className="sec sec-16">
        <div className="eyebrow">REQUIREMENTS</div>
        <ul className="bullets">
          <li>A Claude client that can add a custom MCP connector.</li>
          <li>
            Measured clients: the <strong>Claude desktop app (Pro account)</strong> and{" "}
            <strong>Claude Code&apos;s own MCP client</strong>. No other client has been tried, so
            this page does not claim it works everywhere.
          </li>
          <li>
            A Minecraft Bedrock license is needed only to try the output in the game — not to use
            the tools.
          </li>
        </ul>
      </section>

      <section className="sec sec-16">
        <div className="eyebrow">STEPS</div>
        <div className="sec sec-12">
          {setupSteps.map((s) => (
            <div key={s.n} className="snum">
              <div className="snum-n">{s.n}</div>
              <div className="snum-t">{s.text}</div>
            </div>
          ))}
        </div>
        <div className="epbar">
          <code>{ENDPOINT}</code>
          <CopyEndpoint />
        </div>
      </section>

      <section className="sec sec-16">
        <div className="eyebrow">HOW YOU KNOW IT WORKED</div>
        <ul className="bullets">
          <li>
            <strong>9 tools</strong> should be listed.
          </li>
          <li>
            The client should classify all of them as read-only; in the Claude desktop app they
            appear under &ldquo;read only tools&rdquo;.
          </li>
          <li>
            Tool titles should be visible, for example &ldquo;Can Bedrock do this&rdquo; and
            &ldquo;Schema summary for a document type&rdquo;.
          </li>
        </ul>
      </section>

      <section className="sec sec-16">
        <div className="eyebrow">YOUR FIRST TRY</div>
        <p className="lede lede-70">
          Type a request. The expected behaviour: the model calls the tools on its own, without you
          naming any of them. <code className="inl">check_feasibility</code> reads requests in
          Turkish and English alike; its answer is always in English.
        </p>
        <div className="scen">
          {scenarios.map((sc) => (
            <div key={sc.ask} className="scen-c">
              <div className="scen-q">&ldquo;{sc.ask}&rdquo;</div>
              {sc.note ? <div className="scen-n">{sc.note}</div> : null}
            </div>
          ))}
        </div>
      </section>

      <section className="sec sec-16">
        <div className="eyebrow">THREE THINGS THAT ARE EXPECTED, NOT BUGS</div>
        <div className="rows rows-12">
          {nonBugs.map((n) => (
            <div key={n.seen} className="row row-nb">
              <div className="row-k">
                <code>{n.seen}</code>
              </div>
              <div className="row-v">{n.why}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="sec sec-16">
        <div className="eyebrow">TROUBLESHOOTING</div>
        <ul className="bullets">
          <li>
            Tools not listed: check that the address ends in <code className="inl">/mcp</code>.
          </li>
          <li>
            A call drops with a connection error: retry it. In real use, three calls dropped on a
            transient transport error and passed when the same payload was sent again. The cause was
            not on the server.
          </li>
          <li>
            Tool permissions can be left on &ldquo;ask every time&rdquo;. There are no logs on the
            server, so the approval prompt is the only record of which tool was called with which
            arguments.
          </li>
        </ul>
      </section>
    </div>
  );
}
