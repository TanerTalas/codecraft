/**
 * Sınırlar ve veri sayfası. İçerik kaynağı `docs/site-icerik.md`,
 * "Sayfa 4 — Sınırlar ve veri".
 */

import type { Metadata } from "next";

import { measurements, misses, sources } from "@/content/site";

export const metadata: Metadata = {
  title: "Limits & data — what Bedrock validation does not catch",
  description:
    "What Bedrock validation does not catch, what was actually measured, where the data comes from and under which licence, and how fresh it is.",
  alternates: { canonical: "/limits" },
};

export default function LimitsPage() {
  return (
    <div className="page">
      <h1 className="page-h">Limits &amp; data</h1>

      <section className="sec sec-18">
        <div className="eyebrow">WHAT IT DOES NOT CATCH</div>
        <div className="sec sec-12">
          {misses.map((m) => (
            <div key={m.title} className="miss">
              <div className="miss-h">
                <span className="miss-t">{m.title}</span>
                {m.measured ? <span className="badge">MEASURED</span> : null}
              </div>
              <div className="miss-b">{m.text}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="sec sec-16">
        <div className="eyebrow">WHAT WAS MEASURED</div>
        <p className="lede lede-70">
          This project separates &ldquo;it works&rdquo; from &ldquo;it was measured&rdquo;.
        </p>
        <div className="sec sec-12">
          {measurements.map((m) => (
            <div key={m} className="meas">
              <span className="badge-solid">MEASURED</span>
              <span className="meas-t">{m}</span>
            </div>
          ))}
        </div>
        <div className="callout">
          A rule is not coded until it is measured, and everything measured is written down with its
          history.
        </div>
      </section>

      <section className="sec sec-16">
        <div className="eyebrow">WHERE THE DATA COMES FROM</div>
        <p className="lede lede-70">
          Derived facts, not republication. No raw content is served; facts like &ldquo;this id
          exists&rdquo; and &ldquo;this field is required&rdquo; are indexed.
        </p>
        <div className="sec sec-12">
          {sources.map((s) => (
            <div key={s.name} className="row row-src">
              <div className="row-k">
                <code>{s.name}</code>
              </div>
              <div className="row-v">{s.use}</div>
              <div className="row-lic">{s.license}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="cards2">
        <div className="card">
          <div className="card-h">How fresh the data is</div>
          <ul>
            <li>Data indexes update automatically, daily.</li>
            <li>
              The scheduled run is set to 05:00 UTC, but it was measured starting about 5 hours late
              on average. So the data can be at most <strong>1 day + ~5 hours</strong> old.
            </li>
            <li>
              Data is foldered by game version, and the tools state which version they used in their
              answer.
            </li>
          </ul>
        </div>
        <div className="card">
          <div className="card-h">Hosting and privacy</div>
          <ul>
            <li>Hosted on a free tier. That is a design choice, not a constraint being hidden.</li>
            <li>There is no rate limit on the endpoint, and that is stated openly.</li>
            <li>No tool-usage log is kept on the server; the server is stateless.</li>
            <li>No personal data is collected. There are no accounts.</li>
          </ul>
        </div>
      </section>

      <section className="wide">
        <div className="card-h">Source and contributing</div>
        <p>
          The repository is public and licensed Apache-2.0. Issues are the way to report a problem.
          The measurement logs sit in the repo in the open — claims being checkable is a feature
          here.
        </p>
      </section>
    </div>
  );
}
