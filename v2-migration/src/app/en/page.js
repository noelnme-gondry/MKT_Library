import EnLandingHeader from "@/components/EnLandingHeader";
import LandingPage from "@/components/LandingPage";
import { SITE_URL } from "@/lib/routeMap";

// EN 랜딩("/en") — /blog와 마찬가지로 메인 앱 셸(Sidebar) 없는 독립 라우트.
// NOTE: 셸을 app/en/layout.js로 분리하지 않고 이 page.js에 인라인한다 — /en/blog가
// 이미 자기 layout.js(en/blog/layout.js, 부모는 root layout.js뿐)를 갖고 있어서
// en/layout.js를 새로 만들면 Next 중첩 레이아웃 규칙상 /en/blog에도 이 셸이 겹쳐
// 씌워져 헤더/래퍼가 중복 렌더된다. page.js 인라인이면 /en 단일 라우트에만 적용된다.
export async function generateMetadata() {
  const title = "Growth Opt Playbook | Marketing Data Analysis Tools";
  const description =
    "Upload your campaign CSV to instantly analyze performance, budget allocation, and A/B tests — a free performance marketing toolkit.";
  const canonical = `${SITE_URL}/en`;
  return {
    title,
    description,
    alternates: { canonical, languages: { ko: `${SITE_URL}/`, en: canonical } },
    openGraph: {
      title,
      description,
      url: canonical,
      locale: "en_US",
    },
  };
}

export default function EnHomePage() {
  return (
    <>
      <EnLandingHeader />
      <main className="main">
        <article className="content" id="content" aria-live="polite">
          <LandingPage locale="en" />
        </article>
      </main>
    </>
  );
}
