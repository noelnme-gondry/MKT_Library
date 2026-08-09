import Link from "next/link";

import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";

export async function generateMetadata() {
  const title = "Free MMM Model Manual | Methodology PDF";
  const description =
    "Download a free PDF manual covering marketing mix modeling: adstock, saturation, contribution decomposition, and validation—including where regression stops being causal evidence.";
  const canonical = `${SITE_URL}/en/manuals`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { ko: `${SITE_URL}/manuals`, en: canonical, "x-default": `${SITE_URL}/manuals` },
    },
    openGraph: withOpenGraphBase({ title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] }, "en"),
  };
}

const MANUALS = [
  {
    href: "/manuals/mmm-model-manual-en.pdf",
    title: "MMM model manual",
    summary: "What a marketing mix model computes, what it cannot compute, and how to read the output—from input requirements to interpretation.",
    contents: [
      "Why adstock (carryover) and saturation (diminishing returns) must be modeled together",
      "The conditions under which channel contribution becomes unidentifiable",
      "Why regression coefficients are not causal evidence, and when to move to a holdout",
      "Why the forecast band is a historical-residual reference range, not a causal confidence interval",
    ],
    toolHref: "/en/tools/marketing-response",
    toolLabel: "Open MMM contribution analysis",
  },
];

export default function Page() {
  return (
    <section className="manuals-page">
      <span className="manuals-page__eyebrow">Methodology</span>
      <h1>Analysis methodology manuals</h1>
      <p className="manuals-page__lead">
        The assumptions behind each calculation are published as documents. Read the limits before putting
        a result in a report. No signup or email required.
      </p>

      {MANUALS.map((manual) => (
        <article className="manuals-page__item" key={manual.href}>
          <h2>{manual.title}</h2>
          <p>{manual.summary}</p>
          <h3>What the document covers</h3>
          <ul>
            {manual.contents.map((line) => <li key={line}>{line}</li>)}
          </ul>
          <div className="manuals-page__actions">
            <a className="btn primary" href={manual.href} download>Download PDF</a>
            <Link className="btn ghost" href={manual.toolHref}>{manual.toolLabel}</Link>
          </div>
        </article>
      ))}

      <p className="manuals-page__note">
        Manuals are updated alongside the tool&rsquo;s current calculation. When citing, please include this page URL.
      </p>
    </section>
  );
}
