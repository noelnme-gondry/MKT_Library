import GuideIndex from "@/components/GuideIndex";
import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";
import { ROUTE_SEO } from "@/lib/routeSeo";

// EN 가이드 인덱스(/en/guide) — KR /guide(GuideIndex)와 동일 컴포넌트, en/guide/layout
// 셸(EnGuideSidebar+헤더) 안에서 렌더. app/en/guide/ 폴더가 catch-all을 가리므로
// 이 page.js가 없으면 /en/guide는 404.
export async function generateMetadata() {
  const title = `${ROUTE_SEO["guide-index"].en.title} | Growth Opt Playbook`;
  const { description } = ROUTE_SEO["guide-index"].en;
  const canonical = `${SITE_URL}/en/guide`;
  return {
    // absolute: title이 이미 브랜드 접미사 포함 — layout.js template 중복 적용 방지.
    title: { absolute: title },
    description,
    alternates: { canonical, languages: { ko: `${SITE_URL}/guide`, en: canonical, "x-default": canonical } },
    openGraph: withOpenGraphBase({ title, description, url: canonical, images: [`${SITE_URL}/og-card.png`] }, "en"),
  };
}

export default function EnGuideIndexPage() {
  return (
    <article className="content" id="content" aria-live="polite">
      <GuideIndex locale="en" />
    </article>
  );
}
