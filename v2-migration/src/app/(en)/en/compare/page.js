import Link from "next/link";

import { COMPARE_SLUGS, getComparePage } from "@/lib/compareContent";
import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";

export async function generateMetadata() {
  const title = "Marketing analysis method comparisons";
  const description = "Compare incrementality designs, MMM versus experiments, budget allocation rules, and spreadsheets versus dedicated tools, with guidance on when to use each.";
  const canonical = `${SITE_URL}/en/compare`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { ko: `${SITE_URL}/compare`, en: canonical, "x-default": `${SITE_URL}/compare` },
    },
    openGraph: withOpenGraphBase({ title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] }),
  };
}

export default function Page() {
  const pages = COMPARE_SLUGS.map((slug) => getComparePage(slug, "en"));
  return (
    <section className="compare-page">
      <span className="compare-page__eyebrow">Method comparison</span>
      <h1>Marketing analysis method comparisons</h1>
      <p className="compare-page__lead">When several methods answer the same question, these pages set out what differs and when to use which. Each one opens with the question and a one-sentence answer.</p>
      <ul className="compare-page__index">
        {pages.map((page) => (
          <li key={page.slug}>
            <Link href={`/en/compare/${page.slug}`}>{page.title}</Link>
            <p>{page.answer}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
