import Link from "next/link";

import { COMPARE_SLUGS, getComparePage } from "@/lib/compareContent";
import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";

// 방법 비교 목록. 카드 문구는 각 페이지의 질문·답을 그대로 쓴다 —
// 여기에 따로 요약을 적으면 상세와 갈라진다.
export async function generateMetadata() {
  const title = "마케팅 분석 방법 비교";
  const description = "증분 측정, MMM과 실험, 예산 배분 방식, 스프레드시트와 전용 도구를 기준별로 비교하고 언제 무엇을 쓸지 정리했습니다.";
  const canonical = `${SITE_URL}/compare`;
  return {
    title,
    description,
    alternates: {
      canonical,
      languages: { ko: canonical, en: `${SITE_URL}/en/compare`, "x-default": `${SITE_URL}/en/compare` },
    },
    openGraph: withOpenGraphBase({ title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] }),
  };
}

export default function Page() {
  const pages = COMPARE_SLUGS.map((slug) => getComparePage(slug, "ko"));
  return (
    <section className="compare-page">
      <span className="compare-page__eyebrow">방법 비교</span>
      <h1>마케팅 분석 방법 비교</h1>
      <p className="compare-page__lead">같은 질문에 답하는 방법이 여러 개일 때, 무엇이 다르고 언제 무엇을 써야 하는지 정리했습니다. 각 페이지는 질문과 한 문장 답으로 시작합니다.</p>
      <ul className="compare-page__index">
        {pages.map((page) => (
          <li key={page.slug}>
            <Link href={`/compare/${page.slug}`}>{page.title}</Link>
            <p>{page.answer}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
