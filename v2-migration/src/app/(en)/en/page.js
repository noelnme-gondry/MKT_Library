import Sidebar from "@/components/Sidebar";
import Header from "@/components/Header";
import GlobalModals from "@/components/GlobalModals";
import LandingPage from "@/components/LandingPage";
import DochiAssistant from "@/components/assistant/DochiAssistant";
import DochiWelcomeOverlay from "@/components/assistant/DochiWelcomeOverlay";
import { SITE_URL } from "@/lib/routeMap";
import { withOpenGraphBase } from "@/lib/openGraph";

// EN 랜딩("/en") — KR 홈(app/[[...slug]] home)과 **동일한 셸**로 통일(브랜드·헤더
// 액션·is-home 스타일 일치). 예전엔 EnLandingHeader(브랜드만·EN토글 없음)를 써 KR과
// 구조가 달랐던 버그 수정. 셸을 en/layout.js로 빼지 않고 page.js에 인라인하는 이유는
// 그대로(중첩 레이아웃이 /en/blog에 겹쳐 씌워지는 것 방지).
export async function generateMetadata() {
  const title = "Growth Opt Playbook | Performance Marketing Decision Workspace";
  const description =
    "Use a campaign CSV to explain performance changes, choose the next action, and review the actual outcome in a free browser-based decision workspace.";
  const canonical = `${SITE_URL}/en`;
  return {
    // absolute: 이 페이지 title이 이미 브랜드 접미사를 포함하므로 layout.js의
    // title.template("%s | Growth Opt Playbook") 재적용을 막아 중복 방지.
    title: { absolute: title },
    description,
    alternates: { canonical, languages: { ko: `${SITE_URL}/`, en: canonical, "x-default": canonical } },
    openGraph: withOpenGraphBase({
      title,
      description,
      url: canonical,
      locale: "en_US",
      images: [`${SITE_URL}/og-card.png`],
    }, "en"),
  };
}

export default function EnHomePage() {
  return (
    <>
      <div className="app is-home">
        <Sidebar locale="en" />
        <div className="main">
          <Header locale="en" />
          <main id="main-content" tabIndex="-1">
            <article className="content" id="content">
              <LandingPage locale="en" />
              <DochiAssistant locale="en" />
              <DochiWelcomeOverlay locale="en" />
            </article>
          </main>
        </div>
      </div>
      <GlobalModals locale="en" />
    </>
  );
}
