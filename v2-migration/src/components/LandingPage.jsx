"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IA, SECTIONS } from "@/store/useDataStore";
import { idToSlug, hasEnVersion } from "@/lib/routeMap";
import { trItemTitle } from "@/lib/enNavCopy";
import LocaleAutoRedirect from "@/components/LocaleAutoRedirect";
import ProductPreview from "@/components/landing/ProductPreview";
import ToolCarousel from "@/components/landing/ToolCarousel";

// 랜딩 화면 전용 EN 카피 — 앱 전체 번역은 범위 밖(§1), 이 랜딩 히어로/3카드/블로그
// 배너/소셜 행만 locale 분기. LandingGuide/Analyze/Content 하위 트랙은 IA 원본
// 한글 데이터 그대로(뒤로가기 버튼 라벨만 분기).
const LANDING_COPY = {
  ko: {
    eyebrow: "Growth Opt Playbook",
    title: "무엇이 궁금하세요?",
    deck: "질문을 고르면 그 도구로 바로 들어갑니다. 데이터가 없어도 예시로 먼저 보고, 준비되면 내 데이터로 분석하세요. 모든 분석 도구 무료.",
    hero: {
      title: "Excel로 못 푸는 마케팅 분석,\n브라우저에서 바로.",
      sub: "증분·MMM·포화도·성과 변동 — 손으로 못 푸는 분석을 CSV 한 장으로. 설치·로그인 없이, 데이터는 100% 브라우저에서만 처리됩니다.",
      ctaPrimary: "내 데이터로 분석 시작",
      ctaDemo: "데모 먼저 보기",
      privacy: "🔒 서버 전송 0 · 브라우저 메모리에서만 처리",
      previewCaption: "실제 운영 대시보드 미리보기 (샘플 데이터)",
      carouselTitle: "궁금한 것부터 골라보세요",
    },
    localeSwitchLabel: "English",
    guide: {
      step: "가이드",
      tag: "SOP 문서",
      title: "📘 운영 가이드 확인",
      desc: "MMP·트래킹 셋업부터 캠페인 운영·소재, 운영 후 분석·최적화까지. 단계별 표준 절차 문서.",
      metaSuffix: "개 가이드",
      cta: "가이드 보기 →",
    },
    analyze: {
      step: "분석",
      tag: "대시보드 · 도구",
      title: "📊 마케팅 분석 · 대시보드",
      desc: "실제 운영한 캠페인 CSV를 올려 대시보드 시각화·효율 분석·실험 판독·고급 회귀까지. 시각화·모니터링은 무료.",
      metaSuffix: "개 분석 도구",
      cta: "분석 시작 →",
    },
    content: {
      step: "콘텐츠",
      tag: "블로그 · SNS · 뉴스레터",
      title: "✍️ 콘텐츠 성과 분석",
      desc: "콘텐츠 성과 CSV를 올려 어떤 제작 요소가 조회수·CTR을 끌어올리는지, 어떤 콘텐츠가 구독 전환을 만드는지 진단. 전부 무료.",
      metaSuffix: "개 분석 도구",
      cta: "콘텐츠 분석 →",
    },
    blogBanner: {
      title: "마케팅 블로그",
      desc: "퍼포먼스·콘텐츠 마케팅 실무 인사이트와 데이터·SEO·그로스 팁을 정기적으로 업데이트합니다.",
      cta: "글 보러 가기 →",
    },
    social: { youtube: "유튜브", instagram: "인스타그램", facebook: "페이스북", feedback: "1분 설문 남기기" },
    back: "← 처음으로",
  },
  en: {
    eyebrow: "Growth Opt Playbook",
    title: "What are you curious about?",
    deck: "Pick a question and jump straight into the tool. No data yet? See a live example first, then analyze your own. All analysis tools are free.",
    hero: {
      title: "Marketing analysis Excel can't do —\nright in your browser.",
      sub: "Incrementality, MMM, saturation, performance shifts — analyses you can't do by hand, from a single CSV. No install, no login; your data stays 100% in the browser.",
      ctaPrimary: "Analyze my data",
      ctaDemo: "See a live demo",
      privacy: "🔒 Nothing sent to any server · processed in browser memory only",
      previewCaption: "Live operations dashboard preview (sample data)",
      carouselTitle: "Start with whatever you're curious about",
    },
    localeSwitchLabel: "한국어",
    guide: {
      step: "Guides",
      tag: "SOP docs",
      title: "📘 Browse operating guides",
      desc: "From MMP/tracking setup to campaign ops, creative, and post-launch analysis — step-by-step standard playbooks.",
      metaSuffix: " guides",
      cta: "Browse guides →",
    },
    analyze: {
      step: "Analyze",
      tag: "Dashboard · tools",
      title: "📊 Marketing analysis · dashboard",
      desc: "Upload your campaign CSV for dashboard visualization, efficiency analysis, experiment readouts, and advanced regression. Visualization and monitoring are free.",
      metaSuffix: " analysis tools",
      cta: "Start analyzing →",
    },
    content: {
      step: "Content",
      tag: "Blog · social · newsletter",
      title: "✍️ Content performance analysis",
      desc: "Upload your content performance CSV to see which creative elements drive views/CTR and which content drives subscriber conversions. All free.",
      metaSuffix: " analysis tools",
      cta: "Analyze content →",
    },
    blogBanner: {
      title: "Marketing blog",
      desc: "Practical performance and content marketing insights — data, SEO, and growth tips, updated regularly.",
      cta: "Read the blog →",
    },
    social: { youtube: "YouTube", instagram: "Instagram", facebook: "Facebook", feedback: "Take our 1-min survey" },
    back: "← Back to home",
  },
};

const GUIDE_SECTION = SECTIONS.find((s) => s.id === "guide");
const ANALYSIS_SECTION = SECTIONS.find((s) => s.id === "analysis");
const GUIDE_GROUP_IDS = new Set(GUIDE_SECTION.groups);
const OPS_GROUP_IDS = new Set(ANALYSIS_SECTION.groups);

// 홈 1층에 도구를 "질문"으로 노출 — 유저가 자기 궁금증으로 도구를 고르게(선택성↑)
// + 궁금해서 더 누르게(호기심 훅). 실제 도구 이름은 카드 desc에 함께 노출(식별 유지).
// 키=라우트 id(§4.1 불변). 훅 없는 신규 도구는 자동으로 도구명+설명으로 폴백.
const TOOL_HOOKS = {
  ko: {
    "5-2": "이번 주 성과, 예산 속도, 코호트까지 한눈에 볼까?",
    "5-21": "성과가 올랐네? 물량 때문일까, 효율 때문일까?",
    "5-22": "이 캠페인, 예산을 더 태워도 효율이 유지될까?",
    "5-3": "예산, 어디에 더 써야 이득일까?",
    "5-6": "지금 성과 좋은 소재, 언제쯤 교체해야 할까?",
    "5-4": "A안과 B안, 진짜 차이가 있는 걸까?",
    "5-23": "자연 유입 빼고, 광고가 순수하게 만든 성과는?",
    "5-18": "우리 광고비, 어디서 벌고 어디서 갉아먹을까?",
    "5-20": "유저를 붙잡는 '아하 순간'은 언제일까?",
  },
  en: {
    "5-2": "Is our operation running healthy right now?",
    "5-21": "What actually moved this week's performance?",
    "5-22": "That winning campaign — why did CPA suddenly jump?",
    "5-3": "Where should the next dollar of budget go?",
    "5-6": "Which creatives are actually lifting performance?",
    "5-4": "Version A vs B — is the difference real?",
    "5-23": "How much did this ad truly create on its own?",
    "5-18": "If we spend more, how much will performance grow?",
    "5-20": "When is the 'aha moment' that keeps users hooked?",
    "9-1": "Which content elements actually drive views/CTR?",
    "9-2": "Which content turns readers into subscribers?",
    "9-3": "What moved your traffic — and which source drove it?",
    "9-6": "Which content is still fresh, and when to refresh?",
    "9-7": "Is our content operation healthy right now?",
  },
};

function findMeta(id) {
  for (const group of IA) {
    const item = group.items.find((i) => i.id === id);
    if (item) return item;
  }
  return null;
}

/* ──────────────────────────── STEP 1 (홈) ──────────────────────────── */
// 재구성: 추상적 3-트랙 게이트(유저가 안 눌러 이탈)를 제거하고, 분석 도구를 홈에서
// 바로 "질문형 카드"로 노출 → 한 번 클릭에 도구+라이브 데모 진입(선택성·호기심↑).
// 가이드·콘텐츠는 보조 카드로 강등(트랙 유지), 블로그·소셜은 그대로.
function LandingHome({ locale }) {
  const router = useRouter();
  const L = LANDING_COPY[locale] || LANDING_COPY.ko;
  const H = TOOL_HOOKS[locale] || TOOL_HOOKS.ko;
  // 데이터 가이드(그룹 08)는 상단 도구 그리드에서 제외 → 맨 밑에 약하게(§요구:
  // 준비 가이드가 맨 위에 오지 않게). 사이드바(SECTIONS)는 불변.
  const DATA_GUIDE_GROUP = "08";
  const opsGroups = IA.filter(
    (g) => OPS_GROUP_IDS.has(g.id) && g.id !== DATA_GUIDE_GROUP
  );
  const dataGuideItem = (IA.find((g) => g.id === DATA_GUIDE_GROUP) || {}).items?.[0];
  const fireGa = (name, params) => {
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", name, params);
    }
  };
  const totalGuides = IA.filter((g) => GUIDE_GROUP_IDS.has(g.id)).reduce(
    (a, g) => a + g.items.length,
    0
  );
  // 번역된 도구만 /en 유지, 미번역은 KR로(Sidebar.navHref와 동일 규칙 — §plan).
  const goTool = (id) =>
    router.push(locale === "en" && hasEnVersion(id) ? `/en${idToSlug[id] || ""}` : idToSlug[id] || "/");
  const ctaLabel = locale === "en" ? "See a live example →" : "예시로 바로 보기 →";
  const hero = L.hero || {};

  // 캐러셀 카드 = 분석 도구(콘텐츠 09 포함, SECTIONS.analysis에 흡수됨)를 "질문"으로
  // 평탄화(그룹 제목=eyebrow, 훅=헤드라인). opsGroups가 09를 이미 포함.
  const carouselCards = opsGroups.flatMap((g) =>
    g.items
      .filter((it) => !it.hidden)
      .map((it) => {
        const meta = findMeta(it.id);
        if (!meta) return null;
        return {
          id: it.id,
          eyebrow: g.title,
          headline: H[it.id] || trItemTitle(it.id, locale, meta.title),
          mockTitle: trItemTitle(it.id, locale, meta.title),
        };
      })
      .filter(Boolean)
  );
  const pickTool = (id) => { fireGa("landing_tool_pick", { tool: id }); goTool(id); };

  return (
    <>
      {/* 브랜드(로고+이름)는 전역 Header 좌상단으로 이동, 언어 전환도 Header EN 토글로
          일원화 — 랜딩 자체 eyebrow/English 버튼(중복) 제거. */}
      {locale !== "en" && <LocaleAutoRedirect />}

      {/* ── 히어로 (Semrush형 전환 히어로) ── */}
      <section style={{ textAlign: "center", padding: "1.5rem 0 0.5rem", maxWidth: "780px", margin: "0 auto" }}>
        <h1 className="page-title" style={{ fontSize: "clamp(28px, 5vw, 46px)", lineHeight: 1.2, whiteSpace: "pre-line", marginBottom: "1rem" }}>
          {hero.title}
        </h1>
        <p className="page-deck" style={{ fontSize: "15px", maxWidth: "620px", margin: "0 auto 1.4rem" }}>
          {hero.sub}
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", flexWrap: "wrap" }}>
          <button type="button" className="btn primary" style={{ fontSize: "14px", padding: "12px 22px" }} onClick={() => { fireGa("landing_cta", { action: "analyze" }); goTool("5-2"); }}>
            {hero.ctaPrimary} →
          </button>
          <button type="button" className="btn ghost" style={{ fontSize: "14px", padding: "12px 22px" }} onClick={() => { fireGa("landing_cta", { action: "demo" }); goTool("5-2"); }}>
            ▶ {hero.ctaDemo}
          </button>
        </div>
        <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "14px" }}>{hero.privacy}</div>
      </section>

      {/* ── 라이브 제품 미리보기(시연 슬롯 — 여러 도구 로테이션, 나중 mp4 교체 가능) ── */}
      <div style={{ marginTop: "1.6rem" }}>
        <ProductPreview locale={locale} />
      </div>

      {/* ── 질문 캐러셀(도구 진입) ── */}
      <ToolCarousel
        cards={carouselCards}
        title={hero.carouselTitle}
        onPick={pickTool}
        ctaLabel={ctaLabel}
        liveCardId="5-2"
        locale={locale}
      />

      {/* ── 블로그 | SOP 나란히(읽을거리·문서 2대장). 각자 자체 주소(/blog · /guide). ── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
          gap: "16px",
          marginTop: "2.5rem",
        }}
      >
        <Link href={locale === "en" ? "/en/blog" : "/blog"} className="home-hub-card" style={{ textDecoration: "none" }}>
          <div className="home-hub-icon" style={{ background: "linear-gradient(135deg,#a78bfa33,#4cd7f622)" }}>📝</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="phase-card-title" style={{ marginBottom: "4px" }}>{L.blogBanner.title}</div>
            <div className="phase-card-desc" style={{ margin: 0 }}>{L.blogBanner.desc}</div>
          </div>
          <span className="phase-card-cta" style={{ margin: 0, whiteSpace: "nowrap" }}>{L.blogBanner.cta}</span>
        </Link>

        <Link href={locale === "en" ? "/en/guide" : "/guide"} className="home-hub-card" style={{ textDecoration: "none" }}>
          <div className="home-hub-icon" style={{ background: "linear-gradient(135deg,#adc6ff33,#4ade8022)" }}>📘</div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="phase-card-title" style={{ marginBottom: "4px" }}>{L.guide.title}</div>
            <div className="phase-card-desc" style={{ margin: 0 }}>{L.guide.desc}</div>
            <div className="phase-card-meta tnum" style={{ marginTop: "6px", color: "var(--text-muted)", fontSize: "11.5px" }}>{totalGuides}{L.guide.metaSuffix}</div>
          </div>
          <span className="phase-card-cta" style={{ margin: 0, whiteSpace: "nowrap" }}>{L.guide.cta}</span>
        </Link>
      </div>

      {/* 데이터 준비 가이드 — 상단이 아닌 맨 밑에 약하게(자기서비스 탈출구). */}
      {dataGuideItem && (
        <div style={{ marginTop: "1.4rem", textAlign: "center" }}>
          <a
            href="#"
            onClick={(e) => {
              e.preventDefault();
              fireGa("data_guide_open", { from: "landing" });
              goTool(dataGuideItem.id);
            }}
            style={{
              fontSize: "12.5px",
              color: "var(--text-muted)",
              textDecoration: "none",
              cursor: "pointer",
            }}
          >
            📄{" "}
            {locale === "en"
              ? "New to preparing data? See the CSV prep & column-mapping guide"
              : "데이터 준비가 처음이라면 — CSV 준비 & 컬럼 매핑 가이드"}{" "}
            →
          </a>
        </div>
      )}

      <div className="landing-social-row">
        <a className="landing-social-btn ls-youtube" href="https://youtube.com/channel/UCvRcpOHOqvSHQPNbgZdPNUw/" target="_blank" rel="noopener noreferrer" onClick={() => fireGa("social_click", { network: "youtube", from: "landing" })}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M23.5 6.2a3 3 0 0 0-2.11-2.12C19.44 3.5 12 3.5 12 3.5s-7.44 0-9.39.58A3 3 0 0 0 .5 6.2 31.6 31.6 0 0 0 0 12a31.6 31.6 0 0 0 .5 5.8 3 3 0 0 0 2.11 2.12C4.56 20.5 12 20.5 12 20.5s7.44 0 9.39-.58a3 3 0 0 0 2.11-2.12A31.6 31.6 0 0 0 24 12a31.6 31.6 0 0 0-.5-5.8ZM9.6 15.6V8.4L15.8 12Z"/></svg>
          <span>{L.social.youtube}</span>
        </a>
        <a className="landing-social-btn ls-instagram" href="https://www.instagram.com/gondry__workshop/" target="_blank" rel="noopener noreferrer" onClick={() => fireGa("social_click", { network: "instagram", from: "landing" })}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2.2c3.2 0 3.6 0 4.85.07 1.17.06 1.97.24 2.43.42a4.9 4.9 0 0 1 1.77 1.15 4.9 4.9 0 0 1 1.15 1.77c.18.46.36 1.26.42 2.43.06 1.25.07 1.65.07 4.85s0 3.6-.07 4.85c-.06 1.17-.24 1.97-.42 2.43a4.9 4.9 0 0 1-1.15 1.77 4.9 4.9 0 0 1-1.77 1.15c-.46.18-1.26.36-2.43.42-1.25.06-1.65.07-4.85.07s-3.6 0-4.85-.07c-1.17-.06-1.97-.24-2.43-.42a4.9 4.9 0 0 1-1.77-1.15 4.9 4.9 0 0 1-1.15-1.77c-.18-.46-.36-1.26-.42-2.43C2.2 15.6 2.2 15.2 2.2 12s0-3.6.07-4.85c.06-1.17.24-1.97.42-2.43A4.9 4.9 0 0 1 3.84 3c.53-.5 1.12-.9 1.77-1.15.46-.18 1.26-.36 2.43-.42C9.29 1.37 9.69 2.2 12 2.2Zm0 1.8c-3.15 0-3.52 0-4.75.06-.96.05-1.48.2-1.82.34a3.1 3.1 0 0 0-1.15.75 3.1 3.1 0 0 0-.75 1.15c-.14.34-.29.86-.34 1.82-.06 1.23-.06 1.6-.06 4.75s0 3.52.06 4.75c.05.96.2 1.48.34 1.82.16.42.38.79.75 1.15.36.36.73.6 1.15.75.34.14.86.29 1.82.34 1.23.06 1.6.06 4.75.06s3.52 0 4.75-.06c.96-.05 1.48-.2 1.82-.34.42-.16.79-.38 1.15-.75.36-.36.6-.73.75-1.15.14-.34.29-.86.34-1.82.06-1.23.06-1.6.06-4.75s0-3.52-.06-4.75c-.05-.96-.2-1.48-.34-1.82a3.1 3.1 0 0 0-.75-1.15 3.1 3.1 0 0 0-1.15-.75c-.34-.14-.86-.29-1.82-.34C15.52 4 15.15 4 12 4Zm0 3.05a4.95 4.95 0 1 1 0 9.9 4.95 4.95 0 0 1 0-9.9Zm0 1.8a3.15 3.15 0 1 0 0 6.3 3.15 3.15 0 0 0 0-6.3Zm5.3-3.4a1.15 1.15 0 1 1 0 2.3 1.15 1.15 0 0 1 0-2.3Z"/></svg>
          <span>{L.social.instagram}</span>
        </a>
        <a className="landing-social-btn ls-facebook" href="https://www.facebook.com/profile.php?id=61591483650900" target="_blank" rel="noopener noreferrer" onClick={() => fireGa("social_click", { network: "facebook", from: "landing" })}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M22 12.06C22 6.51 17.52 2 12 2S2 6.51 2 12.06c0 5.01 3.66 9.16 8.44 9.94v-7.03H7.9v-2.91h2.54V9.79c0-2.51 1.49-3.9 3.77-3.9 1.09 0 2.23.2 2.23.2v2.75h-1.26c-1.24 0-1.63.78-1.63 1.58v1.89h2.78l-.44 2.91h-2.34V22c4.78-.78 8.44-4.93 8.44-9.94Z"/></svg>
          <span>{L.social.facebook}</span>
        </a>
        <a className="landing-social-btn ls-feedback" href="https://forms.gle/vxTfmt6HmxwNnWb99" target="_blank" rel="noopener noreferrer" onClick={() => fireGa("feedback_open", { from: "landing" })}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4"/><path d="M17 21H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7l5 5v11a2 2 0 0 1-2 2Z"/><line x1="9" y1="13" x2="15" y2="13"/><line x1="9" y1="17" x2="15" y2="17"/></svg>
          <span>{L.social.feedback}</span>
        </a>
      </div>
    </>
  );
}

/* ──────────────────────────── MAIN ──────────────────────────── */
// locale: "ko"(default, "/") | "en"("/en"). 홈은 단일 화면(무주소 게이트 트랙 제거 —
// 가이드는 /guide 라우트, 콘텐츠는 분석에 흡수). 뒤로가기 정상.
export default function LandingPage({ locale = "ko" }) {
  return <LandingHome locale={locale} />;
}
