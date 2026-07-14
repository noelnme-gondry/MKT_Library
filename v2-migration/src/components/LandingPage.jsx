"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IA, SECTIONS } from "@/store/useDataStore";
import { idToSlug, hasEnVersion } from "@/lib/routeMap";
import { setLocalePref } from "@/lib/localePref";
import LocaleAutoRedirect from "@/components/LocaleAutoRedirect";

// 랜딩 화면 전용 EN 카피 — 앱 전체 번역은 범위 밖(§1), 이 랜딩 히어로/3카드/블로그
// 배너/소셜 행만 locale 분기. LandingGuide/Analyze/Content 하위 트랙은 IA 원본
// 한글 데이터 그대로(뒤로가기 버튼 라벨만 분기).
const LANDING_COPY = {
  ko: {
    eyebrow: "Growth Opt Playbook",
    title: "무엇이 궁금하세요?",
    deck: "질문을 고르면 그 도구로 바로 들어갑니다. 데이터가 없어도 예시로 먼저 보고, 준비되면 내 데이터로 분석하세요. 모든 분석 도구 무료.",
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
const CONTENT_SECTION = SECTIONS.find((s) => s.id === "content");
const GUIDE_GROUP_IDS = new Set(GUIDE_SECTION.groups);
const OPS_GROUP_IDS = new Set(ANALYSIS_SECTION.groups);
const CONTENT_GROUP_IDS = new Set(CONTENT_SECTION ? CONTENT_SECTION.groups : []);

const GROUP_ICONS = { "05": "📊", "06": "🎨", "07": "🧪", "09": "✍️" };

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
  },
};

function findMeta(id) {
  for (const group of IA) {
    const item = group.items.find((i) => i.id === id);
    if (item) return item;
  }
  return null;
}

function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

/* ──────────────────────────── STEP 1 (홈) ──────────────────────────── */
// 재구성: 추상적 3-트랙 게이트(유저가 안 눌러 이탈)를 제거하고, 분석 도구를 홈에서
// 바로 "질문형 카드"로 노출 → 한 번 클릭에 도구+라이브 데모 진입(선택성·호기심↑).
// 가이드·콘텐츠는 보조 카드로 강등(트랙 유지), 블로그·소셜은 그대로.
function LandingHome({ onTrack, locale }) {
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
  const totalContent = IA.filter((g) => CONTENT_GROUP_IDS.has(g.id)).reduce(
    (a, g) => a + g.items.length,
    0
  );

  const handleLocaleSwitch = () => {
    const next = locale === "en" ? "ko" : "en";
    setLocalePref(next);
    router.push(next === "en" ? "/en" : "/");
  };
  // 번역된 도구만 /en 유지, 미번역은 KR로(Sidebar.navHref와 동일 규칙 — §plan).
  const goTool = (id) =>
    router.push(locale === "en" && hasEnVersion(id) ? `/en${idToSlug[id] || ""}` : idToSlug[id] || "/");
  const ctaLabel = locale === "en" ? "See a live example →" : "예시로 바로 보기 →";

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "12px",
        }}
      >
        <div className="page-eyebrow">{L.eyebrow}</div>
        <button
          type="button"
          onClick={handleLocaleSwitch}
          className="btn ghost"
          style={{ fontSize: "12px" }}
        >
          {L.localeSwitchLabel}
        </button>
      </div>
      {locale !== "en" && <LocaleAutoRedirect />}
      <h1 className="page-title">{L.title}</h1>
      <p className="page-deck">{L.deck}</p>

      {/* 1층 — 질문형 분석 도구(바로 도구+라이브 데모). 그룹 헤더로 가벼운 구조만. */}
      {opsGroups.map((g) => (
        <section key={g.id} className="block" style={{ marginTop: "1.2rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            <span style={{ fontSize: "18px" }}>{GROUP_ICONS[g.id] || "📦"}</span>
            <h2
              className="section-title"
              style={{ margin: 0, border: "none", padding: 0 }}
            >
              {g.title}
            </h2>
          </div>
          <div className="phase-grid">
            {g.items.map((item) => {
              const meta = findMeta(item.id);
              if (!meta) return null;
              const hook = H[item.id];
              const sub = hook
                ? meta.title + (meta.desc ? ` · ${meta.desc}` : "")
                : meta.desc || "";
              return (
                <a
                  key={item.id}
                  className="phase-card phase-card-tool"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    goTool(item.id);
                  }}
                  style={{ cursor: "pointer", textDecoration: "none" }}
                >
                  <div className="phase-card-title">{hook || meta.title}</div>
                  <div className="phase-card-desc">{sub}</div>
                  <div className="phase-card-cta">{ctaLabel}</div>
                </a>
              );
            })}
          </div>
        </section>
      ))}

      {/* 2층 — 가이드·콘텐츠 진입(보조). 트랙 선택 유지, 시각 위계는 낮춤. */}
      <div
        className="phase-grid"
        style={{
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          marginTop: "1.6rem",
        }}
      >
        <div
          className="phase-card"
          style={{ cursor: "pointer" }}
          onClick={() => onTrack("guide")}
        >
          <div className="phase-card-head">
            <span className="phase-card-step">{L.guide.step}</span>
            <span className="phase-card-tag">{L.guide.tag}</span>
          </div>
          <div className="phase-card-title">{L.guide.title}</div>
          <div className="phase-card-desc">{L.guide.desc}</div>
          <div className="phase-card-foot">
            <span className="phase-card-meta tnum">{totalGuides}{L.guide.metaSuffix}</span>
          </div>
          <div className="phase-card-cta">{L.guide.cta}</div>
        </div>

        {totalContent > 0 && (
          <div
            className="phase-card phase-card-tool"
            style={{ cursor: "pointer" }}
            onClick={() => onTrack("content")}
          >
            <div className="phase-card-head">
              <span className="phase-card-step">{L.content.step}</span>
              <span className="phase-card-tag">{L.content.tag}</span>
            </div>
            <div className="phase-card-title">{L.content.title}</div>
            <div className="phase-card-desc">{L.content.desc}</div>
            <div className="phase-card-foot">
              <span className="phase-card-meta tnum">
                {totalContent}{L.content.metaSuffix}
              </span>
            </div>
            <div className="phase-card-cta">{L.content.cta}</div>
          </div>
        )}
      </div>

      {/* 블로그 진입 — 읽을거리라 풀폭 가로 배너로 아래에 배치. /blog로 이동. */}
      <Link
        href={locale === "en" ? "/en/blog" : "/blog"}
        className="phase-card"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "16px",
          marginTop: "1.1rem",
          textDecoration: "none",
          cursor: "pointer",
        }}
      >
        <span style={{ fontSize: "30px", lineHeight: 1 }}>📝</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="phase-card-title" style={{ marginBottom: "3px" }}>
            {L.blogBanner.title}
          </div>
          <div className="phase-card-desc" style={{ margin: 0 }}>
            {L.blogBanner.desc}
          </div>
        </div>
        <span className="phase-card-cta" style={{ whiteSpace: "nowrap", margin: 0 }}>
          {L.blogBanner.cta}
        </span>
      </Link>

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

/* ──────────────────────────── STEP 2a ──────────────────────────── */
function LandingGuide({ onBack, onNavigate, locale }) {
  // 가이드 섹션(01~04)을 병렬로 나열 — 예전엔 셋업/운영/운영후분석 3단계로
  // 불균등하게 묶었으나, 그룹당 1카드로 펼쳐 순서만 참고하게 함(강제 단계 아님).
  const guideGroups = IA.filter((g) => GUIDE_SECTION.groups.includes(g.id));
  const L = LANDING_COPY[locale] || LANDING_COPY.ko;

  return (
    <>
      <button
        className="landing-back-btn"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          color: "var(--text-2)",
          borderRadius: "9px",
          padding: "7px 13px",
          fontSize: "12.5px",
          cursor: "pointer",
          marginBottom: "1.2rem",
        }}
      >
        {L.back}
      </button>
      <div className="page-eyebrow">운영 가이드</div>
      <h1 className="page-title">어느 가이드를 보시겠어요?</h1>
      <p className="page-deck">
        셋업 → 운영 → 소재 → 운영 후 분석, 참고할 순서대로 나열했습니다.
      </p>
      <div className="phase-grid" style={{ marginTop: "1.4rem" }}>
        {guideGroups.map((g, idx) => (
          <a
            key={g.id}
            className="phase-card"
            href="#"
            onClick={(e) => {
              e.preventDefault();
              onNavigate(g.items[0].id);
            }}
            style={{ cursor: "pointer", textDecoration: "none" }}
          >
            <div className="phase-card-head">
              <span className="phase-card-step">STEP {idx + 1}</span>
            </div>
            <div className="phase-card-title">{g.title}</div>
            <div className="phase-card-desc">{g.desc}</div>
            <div className="phase-card-foot">
              <span className="phase-card-meta">
                {g.items.map((it) => it.title).join(" / ")}
              </span>
              <span className="phase-card-meta tnum">{g.items.length}개 항목</span>
            </div>
            <div className="phase-card-cta">시작하기 →</div>
          </a>
        ))}
      </div>
    </>
  );
}

/* ──────────────────────────── STEP 2b (컨텐츠) ──────────────────────────── */
function LandingContent({ onBack, onNavigate, locale }) {
  const contentGroups = IA.filter((g) => CONTENT_GROUP_IDS.has(g.id));
  const L = LANDING_COPY[locale] || LANDING_COPY.ko;

  const findMeta = (id) => {
    for (const group of IA) {
      const item = group.items.find((i) => i.id === id);
      if (item) return item;
    }
    return null;
  };

  return (
    <>
      <button
        className="landing-back-btn"
        onClick={onBack}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          background: "var(--bg-2)",
          border: "1px solid var(--border)",
          color: "var(--text-2)",
          borderRadius: "9px",
          padding: "7px 13px",
          fontSize: "12.5px",
          cursor: "pointer",
          marginBottom: "1.2rem",
        }}
      >
        {L.back}
      </button>
      <div className="page-eyebrow">컨텐츠 성과 분석</div>
      <h1 className="page-title">무엇을 알고 싶으세요?</h1>
      <p className="page-deck">
        블로그·SNS·뉴스레터 콘텐츠 성과 CSV를 올리면 바로 분석합니다.{" "}
        <strong>모든 도구를 무료</strong>로 사용할 수 있습니다.
      </p>

      {contentGroups.map((g) => (
        <section key={g.id} className="block" style={{ marginTop: "1rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "10px",
              marginBottom: "10px",
            }}
          >
            <span style={{ fontSize: "18px" }}>
              {GROUP_ICONS[g.id] || "📦"}
            </span>
            <h2
              className="section-title"
              style={{ margin: 0, border: "none", padding: 0 }}
            >
              {g.title}
            </h2>
          </div>
          <div className="phase-grid">
            {g.items.map((item) => {
              const meta = findMeta(item.id);
              if (!meta) return null;
              return (
                <a
                  key={item.id}
                  className="phase-card"
                  href="#"
                  onClick={(e) => {
                    e.preventDefault();
                    onNavigate(item.id);
                  }}
                  style={{ cursor: "pointer", textDecoration: "none" }}
                >
                  <div className="phase-card-title">{meta.title}</div>
                  <div className="phase-card-desc">{meta.desc || ""}</div>
                  <div className="phase-card-cta">바로 사용 →</div>
                </a>
              );
            })}
          </div>
        </section>
      ))}
    </>
  );
}

/* ──────────────────────────── MAIN ──────────────────────────── */
// locale: "ko"(default, "/") | "en"("/en"). 랜딩 화면만 번역 대상(§1) — 하위
// 트랙(LandingGuide/Analyze/Content)은 IA 원본 한글 데이터 그대로, 뒤로가기
// 버튼 라벨만 locale 분기.
export default function LandingPage({ locale = "ko" }) {
  const [track, setTrack] = useState(null); // null = home, "guide", "content"
  const router = useRouter();

  const handleNavigate = (routeId) => {
    // Client-side nav → preserves the module-level Zustand store (csvData etc.).
    // The catch-all page effect then mirrors the resolved id into the store.
    router.push(idToSlug[routeId] || "/");
  };

  if (track === "guide") {
    return (
      <LandingGuide
        onBack={() => setTrack(null)}
        onNavigate={handleNavigate}
        locale={locale}
      />
    );
  }
  if (track === "content") {
    return (
      <LandingContent
        onBack={() => setTrack(null)}
        onNavigate={handleNavigate}
        locale={locale}
      />
    );
  }
  return <LandingHome onTrack={setTrack} locale={locale} />;
}
