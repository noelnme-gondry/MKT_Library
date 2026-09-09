"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import HomeToolFinder from "@/components/ds/HomeToolFinder";
import { trackProductEvent } from "@/lib/analytics";
import { getDecisionReviewBucket } from "@/lib/decisionReview";
import { hasEnVersion, idToSlug } from "@/lib/routeMap";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { runLandingMotion } from "@/utils/landingMotion";
import { useAppStore } from "@/store/useDataStore";
import { buildDemoCsv } from "@/utils/demoData";

const COPY = {
  ko: {
    eyebrow: "퍼포먼스 마케팅 의사결정",
    title: "데이터로 판단하고,",
    titleAccent: "다음 주에 다시 확인하세요.",
    deck: "도치는 CSV 준비와 첫 분석을 돕고, 주간 리뷰는 이번 결정과 다음 결과를 이어줍니다.",
    actionAria: "바로 시작할 작업",
    dataCta: "내 데이터로 분석 시작",
    dataActionHint: "파일 올리기 → 컬럼 확인 → 가능한 분석",
    reviewCta: "주간 리뷰 이어가기",
    reviewHint: "기간 비교 → 결정 기록 → 다음 결과 검토",
    calculatorCta: "빠른 계산",
    diagnoseCta: "성과 원인 찾기",
    demoCta: "데모로 먼저 보기",
    dataGuideCta: "CSV 컬럼 준비 방법",
    // 구 trustBadges(무료·가입 없음·브라우저에서만 처리)와 privacy 줄이 거의 같은
    // 문장을 두 번 반복했다. 한 줄로 통합.
    assurance: "무료 · 가입 없음 · 원본 데이터는 브라우저에서만 처리",
    continueTitle: "지난 판단을 이어서 검토하세요",
    continueDeck: "이 브라우저에 남아 있는 결정 요약과 직접 올린 파일을 이어서 보여줍니다. 저장 화면에서 언제든 지울 수 있습니다.",
    dueNow: "지금 검토",
    nextReview: "다음 검토",
    latestDecision: "최근 판단",
    noSchedule: "일정 미정",
    reviewed: "검토 완료",
    openInbox: "주간 리뷰 열기",
    reopenTool: "원본 도구 다시 열기",
    loopTitle: "분석한 결정을 저장하고, 다음 주 결과를 검토하세요.",
    loopDeck: "이번 판단과 다음 결과를 주간 리뷰에서 이어보세요.",
    questionTitle: "직접 도구 찾기",
    questionDeck: "살펴볼 목적을 선택하세요.",
    libraryTitle: "다음 판단에 필요한 근거를 쌓으세요.",
    libraryDeck: "예산·소재·측정 판단에 바로 쓰는 인사이트와 SOP를 같은 제품 안에 유지합니다.",
    blogLabel: "마케팅 블로그",
    blogTitle: "성과를 해석하는 실무 인사이트",
    blogDesc: "예산·소재·측정 문제를 원인부터 좁히고 실제 분석으로 이어가는 실무 글입니다.",
    guideLabel: "운영 플레이북",
    guideTitle: "팀이 함께 쓰는 운영 표준",
    guideDesc: "트래킹 셋업부터 캠페인 운영·소재·분석까지 단계별 SOP를 확인합니다.",
    resources: "바로 쓰는 자료와 외부 채널",
    templates: "CSV 템플릿",
    glossary: "용어사전",
    naver: "네이버 블로그",
  },
  en: {
    eyebrow: "PERFORMANCE MARKETING DECISIONS",
    title: "Decide with your data.",
    titleAccent: "Review what happens next.",
    deck: "Dochi helps prepare your CSV and first analysis. Weekly Review connects this decision to the next results.",
    actionAria: "Start a task",
    dataCta: "Start with my data",
    dataActionHint: "Upload → check columns → supported analyses",
    reviewCta: "Continue weekly review",
    reviewHint: "Compare periods → record a decision → review results",
    calculatorCta: "Quick calculations",
    diagnoseCta: "Find the cause",
    demoCta: "Try a demo",
    dataGuideCta: "Prepare CSV columns",
    assurance: "Free · no signup · source data stays in your browser",
    continueTitle: "Continue your last decision",
    continueDeck: "Continue with decision summaries and files uploaded directly in this browser. You can remove them at any time in Storage.",
    dueNow: "Due now",
    nextReview: "Next review",
    latestDecision: "Latest decision",
    noSchedule: "Not scheduled",
    reviewed: "Reviewed",
    openInbox: "Open weekly review",
    reopenTool: "Reopen source tool",
    loopTitle: "Save your decision and review next week’s results.",
    loopDeck: "Connect this decision to the next results in Weekly Review.",
    questionTitle: "Find a tool",
    questionDeck: "Choose what you want to explore.",
    libraryTitle: "Build evidence for the next decision.",
    libraryDeck: "Keep practical guidance for budget, creative, and measurement decisions in the same product.",
    blogLabel: "마케팅 블로그",
    blogTitle: "Practical insight for reading performance",
    blogDesc: "Practical guides that narrow budget, creative, and measurement problems from cause to analysis.",
    guideLabel: "운영 플레이북",
    guideTitle: "Operating standards your team can share",
    guideDesc: "Step-by-step SOPs from tracking setup to campaign operations, creative, and analysis.",
    resources: "Ready-to-use resources and external channels",
    templates: "CSV templates",
    glossary: "Glossary",
    naver: "Naver Blog",
  },
};

export default function LandingPage({ locale = "ko", children }) {
  const lang = locale === "en" ? "en" : "ko";
  const T = COPY[lang];
  const router = useRouter();
  const rootRef = useRef(null);
  const intakeRef = useRef(null);
  const openIntake = () => {
    if (!intakeRef.current) return;
    intakeRef.current.open = true;
    requestAnimationFrame(() => {
      const target = intakeRef.current?.querySelector("#dochi-upload");
      target?.focus();
      target?.scrollIntoView?.({ block: "start" });
    });
  };
  useEffect(() => {
    const revealFromHash = () => { if (window.location.hash === "#dochi-upload") openIntake(); };
    revealFromHash();
    window.addEventListener("hashchange", revealFromHash);
    return () => window.removeEventListener("hashchange", revealFromHash);
  }, []);
  // 진입 모션은 렌더층 전용 — 로케일이 바뀌면 DOM이 갈아끼워지므로 다시 부착한다.
  useEffect(() => runLandingMotion(rootRef.current), [lang]);
  const setDemoDisabled = useAppStore((state) => state.setDemoDisabled);
  const handoffCsvToRoute = useAppStore((state) => state.handoffCsvToRoute);
  const decisionRecords = useAppStore((state) => state.decisionRecords);
  const activeDecisionRecords = decisionRecords.filter((record) => getDecisionReviewBucket(record) !== "reviewed");
  const dueDecisionRecords = activeDecisionRecords.filter((record) => ["overdue", "today"].includes(getDecisionReviewBucket(record)));
  const nextDecision = activeDecisionRecords
    .filter((record) => record.reviewDate)
    .sort((left, right) => String(left.reviewDate).localeCompare(String(right.reviewDate)))[0];
  const latestDecision = activeDecisionRecords[0] || decisionRecords[0];
  const toolHref = (id) =>
    lang === "en" && hasEnVersion(id) ? `/en${idToSlug[id] || ""}` : idToSlug[id] || "/";
  const prepareSample = (id, placement) => {
    trackProductEvent("landing_tool_pick", {
      tool_id: id,
      source: "landing",
      placement,
      locale: lang,
    });
    trackProductEvent("example_run_started", {
      tool_id: id,
      source: "landing",
      placement,
      locale: lang,
    });
    setDemoDisabled(false);
    handoffCsvToRoute(id, buildDemoCsv(TOOL_GROUP[id] || "efficiency", lang));
  };
  const openSample = (id, placement) => {
    prepareSample(id, placement);
    router.push(toolHref(id));
  };
  const trackLandingNav = (name, placement) => {
    trackProductEvent(name, { source: "landing", placement, locale: lang });
  };

  return (
    <div className="decision-console-landing" ref={rootRef}>
      <section className="dc-hero" aria-labelledby="dc-hero-title">
        <div className="dc-hero__copy">
          <div className="dc-eyebrow">{T.eyebrow}</div>
          <h1 id="dc-hero-title">
            <span>{T.title}</span>
            <span className="dc-hero__accent">{T.titleAccent}</span>
          </h1>
          <p className="dc-hero__deck">{T.deck}</p>
          <nav className="dc-hero__actions" aria-label={T.actionAria}>
            <Link
              className="dc-action-route dc-action-route--primary"
              data-mobile-task=".dc-action-route--primary"
              href="#dochi-upload"
              onClick={() => { openIntake(); trackLandingNav("landing_data_start_clicked", "hero"); }}
            >
              <strong>{T.dataCta}</strong>
              <span>{T.dataActionHint}</span>
            </Link>
            {decisionRecords.length > 0 && <Link className="dc-action-route" href={lang === "en" ? "/en/weekly-review#wr-history" : "/weekly-review#wr-history"} onClick={() => trackLandingNav("landing_review_opened", "hero")}>
              <strong>{T.reviewCta}</strong><span>{T.reviewHint}</span>
            </Link>}
          </nav>
          <div className="dc-hero__utility-actions">
            <Link
              className="dc-text-link"
              href={lang === "en" ? "/en/calculator" : "/calculator"}
              onClick={() => trackLandingNav("calculator_entry_clicked", "hero")}
            >
              {T.calculatorCta}
            </Link>
            <Link
              className="dc-text-link"
              href={lang === "en" ? "/en/diagnose" : "/diagnose"}
              onClick={() => trackProductEvent("diagnose_entry_clicked", { source: "landing", placement: "hero", locale: lang })}
            >
              {T.diagnoseCta}
            </Link>
            {/* 예시는 이 제품에서 "무엇이 나오는지"를 볼 유일한 경로다(히어로의 가짜
                차트를 걷어낸 뒤로 §12.28). 버튼으로 승격하면 목적 CTA와 위계가
                섞이므로(LandingPage.smoke가 강제) 텍스트 링크는 유지하고 눈에
                띄는 정도만 올린다. */}
            <button type="button" className="dc-text-link dc-text-link--button dc-text-link--lead" onClick={() => openSample("5-2", "hero_example")}>
              {T.demoCta} →
            </button>
            <Link className="dc-text-link" href={lang === "en" ? "/en/guide/csv-data-prep" : "/guide/csv-data-prep"}>
              {T.dataGuideCta} →
            </Link>
          </div>
          <p className="dc-hero__assurance">{T.assurance}</p>
        </div>
      </section>

      {/* #dochi-upload 탐색은 브라우저가 hydration 전에 부모 details를 열 수 있다. */}
      <details className="dc-intake" ref={intakeRef} suppressHydrationWarning onToggle={(event) => {
        if (!event.currentTarget.open) rootRef.current?.querySelector(".dc-action-route--primary")?.focus();
      }}>
        <summary>{lang === "en" ? "Close data preparation" : "데이터 준비 접기"}</summary>
        {children}
      </details>

      {decisionRecords.length > 0 && <section className="dc-return" aria-labelledby="dc-return-title">
        <header className="dc-return__head">
          <div><h2 id="dc-return-title">{T.continueTitle}</h2></div>
          <p>{T.continueDeck}</p>
        </header>
        <div className="dc-return__grid">
          <Link
            className={`dc-return__status${dueDecisionRecords.length ? " is-due" : ""}`}
            href={lang === "en" ? "/en/weekly-review#wr-history" : "/weekly-review#wr-history"}
            onClick={() => trackLandingNav("landing_review_opened", "continue_panel")}
          >
            <span>{T.dueNow}</span><strong>{dueDecisionRecords.length}</strong><b>{T.openInbox} →</b>
          </Link>
          <Link
            className="dc-return__status"
            href={lang === "en" ? "/en/weekly-review#wr-history" : "/weekly-review#wr-history"}
            onClick={() => trackLandingNav("landing_review_opened", "continue_panel_next")}
          >
            <span>{T.nextReview}</span><strong>{nextDecision?.reviewDate || T.noSchedule}</strong><b>{T.openInbox} →</b>
          </Link>
          {latestDecision && <article className="dc-return__latest">
            <span>{T.latestDecision}</span>
            <strong>{latestDecision.action || latestDecision.conclusion || T.reviewed}</strong>
            <small>{latestDecision.reviewDate || T.noSchedule}</small>
            {idToSlug[latestDecision.toolId] && <Link
              href={toolHref(latestDecision.toolId)}
              onClick={() => trackProductEvent("landing_continue_tool_clicked", { tool_id: latestDecision.toolId, source: "landing", placement: "continue_panel", locale: lang })}
            >{T.reopenTool} →</Link>}
          </article>}
        </div>
      </section>}

      <section className="dc-questions" id="questions" aria-labelledby="dc-question-title">
        <header className="dc-section-head">
          <div>
            <h2 id="dc-question-title">{T.questionTitle}</h2>
          </div>
          <p>{T.questionDeck}</p>
        </header>
        <HomeToolFinder
          locale={lang}
          onItemClick={(toolId) => trackProductEvent("landing_tool_pick", {
            tool_id: toolId,
            source: "landing",
            placement: "question_card",
            locale: lang,
          })}
        />
      </section>

      <section className="dc-loop" aria-labelledby="dc-loop-title">
        <header className="dc-section-head">
          <div>
            <h2 id="dc-loop-title">{T.loopTitle}</h2>
          </div>
          <p>{T.loopDeck}</p>
        </header>
        <Link className="dc-text-link" href={`${lang === "en" ? "/en" : ""}/weekly-review`} onClick={() => trackLandingNav("landing_review_opened", "weekly_loop")}>{T.openInbox}</Link>
      </section>


      <section className="dc-library" id="library" aria-labelledby="dc-library-title">
        <header className="dc-section-head">
          <div>
            <h2 id="dc-library-title">{T.libraryTitle}</h2>
          </div>
          <p>{T.libraryDeck}</p>
        </header>
        <div className="dc-library__grid">
          <Link className="dc-library-card" href={lang === "en" ? "/en/blog" : "/blog"}>
            <span>{T.blogLabel}</span>
            <h3>{T.blogTitle}</h3>
            <p>{T.blogDesc}</p>
          </Link>
          <Link className="dc-library-card" href={lang === "en" ? "/en/guide" : "/guide"}>
            <span>{T.guideLabel}</span>
            <h3>{T.guideTitle}</h3>
            <p>{T.guideDesc}</p>
          </Link>
        </div>
        <div className="dc-resource-strip">
          <span>{T.resources}</span>
          <div>
            <Link href={lang === "en" ? "/en/templates" : "/templates"}>{T.templates} ↗</Link>
            <Link href={lang === "en" ? "/en/glossary" : "/glossary"}>{T.glossary} ↗</Link>
            <a href="https://youtube.com/channel/UCvRcpOHOqvSHQPNbgZdPNUw/" target="_blank" rel="noopener noreferrer">YouTube ↗</a>
            <a href="https://www.instagram.com/gondry__workshop/" target="_blank" rel="noopener noreferrer">Instagram ↗</a>
            <a href="https://www.facebook.com/profile.php?id=61591483650900" target="_blank" rel="noopener noreferrer">Facebook ↗</a>
            <a href="https://blog.naver.com/growthoptplaybook" target="_blank" rel="noopener noreferrer">{T.naver} ↗</a>
          </div>
        </div>
      </section>
    </div>
  );
}
