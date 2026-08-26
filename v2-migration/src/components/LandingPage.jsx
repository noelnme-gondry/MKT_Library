"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef } from "react";

import ToolIndex from "@/components/ds/ToolIndex";
// 개수는 세서 쓴다 — "17개"라고 손으로 적힌 값이 실제 발행 도구 수와 어긋나 있었다(§8).
import { PUBLISHED_TOOL_IDS } from "@/lib/toolIndex";
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
    title: "성과 원인을 찾고,",
    titleAccent: "다음 하나를 정하세요.",
    deck: "CSV만 올리면 브라우저 안에서 바로 분석합니다.",
    actionAria: "바로 시작할 작업",
    dataCta: "내 CSV로 분석",
    dataActionHint: "성과·예산·소재를 내 데이터로",
    calculatorCta: "빠른 계산",
    calculatorActionHint: "목표 CPA·ROAS·표본수",
    diagnoseCta: "성과 원인 찾기",
    diagnoseActionHint: "CSV 없이 확인 순서부터",
    demoCta: "예시 데이터로 30초 체험",
    dataGuideCta: "CSV 컬럼 준비 방법",
    // 구 trustBadges(무료·가입 없음·브라우저에서만 처리)와 privacy 줄이 거의 같은
    // 문장을 두 번 반복했다. 한 줄로 통합.
    assurance: "무료 · 가입 없음 · 원본 데이터는 브라우저에서만 처리",
    continueEyebrow: "CONTINUE ON THIS DEVICE",
    continueTitle: "지난 판단을 이어서 검토하세요",
    continueDeck: "이 브라우저에 남아 있는 결정 요약과 직접 올린 파일을 이어서 보여줍니다. 저장 화면에서 언제든 지울 수 있습니다.",
    dueNow: "지금 검토",
    nextReview: "다음 검토",
    latestDecision: "최근 판단",
    noSchedule: "일정 미정",
    reviewed: "검토 완료",
    openInbox: "결정 검토함 열기",
    reopenTool: "원본 도구 다시 열기",
    loopEyebrow: "WEEKLY DECISION LOOP",
    loopTitle: "분석으로 끝내지 않고, 다음 주 결과까지",
    loopDeck: "직접 올린 파일과 결정 기록은 이 기기에만 최대 90일 남고, 언제든 지우거나 저장을 끌 수 있습니다.",
    loop: [
      { id: "start", label: "01 · START", title: "내 데이터 진단", desc: "CSV나 Google Sheets를 가져오면 가능한 분석과 가장 먼저 볼 질문을 추천합니다.", cta: "데이터로 시작" },
      { id: "decide", label: "02 · DECIDE", title: "이번 주 한 가지 결정", desc: "결론, 근거, 다음 행동 순서로 보고 유지·감액·증액·교체 중 하나를 정합니다.", cta: "샘플 판단 보기" },
      { id: "review", label: "03 · REVIEW", title: "다음 주 결과 검토", desc: "저장한 결정의 기준값과 실제값을 대조하고, 배운 점을 다음 판단의 근거로 남깁니다.", cta: "결정 검토함 보기" },
    ],
    questionEyebrow: "CHOOSE BY QUESTION",
    questionTitle: "지금 가장 먼저 판단할 것은?",
    questionDeck: (count) => `${count}개 분석 전부입니다. 도구 이름이 아니라 판단 상황으로 골라요.`,
    libraryEyebrow: "PLAYBOOK LIBRARY",
    libraryTitle: "다음 판단에 필요한 근거를 쌓으세요.",
    libraryDeck: "예산·소재·측정 판단에 바로 쓰는 인사이트와 SOP를 같은 제품 안에 유지합니다.",
    blogLabel: "MARKETING BLOG",
    blogTitle: "성과를 해석하는 실무 인사이트",
    blogDesc: "예산·소재·측정 문제를 원인부터 좁히고 실제 분석으로 이어가는 실무 글입니다.",
    guideLabel: "OPERATING PLAYBOOK",
    guideTitle: "팀이 함께 쓰는 운영 표준",
    guideDesc: "트래킹 셋업부터 캠페인 운영·소재·분석까지 단계별 SOP를 확인합니다.",
    resources: "바로 쓰는 자료와 외부 채널",
    templates: "CSV 템플릿",
    glossary: "용어사전",
    naver: "네이버 블로그",
  },
  en: {
    eyebrow: "PERFORMANCE MARKETING DECISIONS",
    title: "Find the cause.",
    titleAccent: "Choose one next move.",
    deck: "Upload a CSV and analyze it right in your browser.",
    actionAria: "Start a task",
    dataCta: "Analyze my CSV",
    dataActionHint: "Performance, budget, and creative",
    calculatorCta: "Quick calculations",
    calculatorActionHint: "Target CPA, ROAS, sample size",
    diagnoseCta: "Find the cause",
    diagnoseActionHint: "A check order without a CSV",
    demoCta: "Try example data in 30 seconds",
    dataGuideCta: "Prepare CSV columns",
    assurance: "Free · no signup · source data stays in your browser",
    continueEyebrow: "CONTINUE ON THIS DEVICE",
    continueTitle: "Continue your last decision",
    continueDeck: "Continue with decision summaries and files uploaded directly in this browser. You can remove them at any time in Storage.",
    dueNow: "Due now",
    nextReview: "Next review",
    latestDecision: "Latest decision",
    noSchedule: "Not scheduled",
    reviewed: "Reviewed",
    openInbox: "Open decision inbox",
    reopenTool: "Reopen source tool",
    loopEyebrow: "WEEKLY DECISION LOOP",
    loopTitle: "Do not stop at analysis—review what happened next",
    loopDeck: "Files you upload directly and decision records stay on this device for up to 90 days. You can remove them or turn storage off at any time.",
    loop: [
      { id: "start", label: "01 · START", title: "Diagnose my data", desc: "Bring a CSV or Google Sheet to see which analyses it supports and which question to check first.", cta: "Start with my data" },
      { id: "decide", label: "02 · DECIDE", title: "Choose one move this week", desc: "Read the conclusion, evidence, and next action before choosing what to hold, cut, scale, or replace.", cta: "See a sample decision" },
      { id: "review", label: "03 · REVIEW", title: "Review the actual next week", desc: "Compare each saved baseline with the actual outcome and keep the learning for the next decision.", cta: "Open decision inbox" },
    ],
    questionEyebrow: "CHOOSE BY QUESTION",
    questionTitle: "What do you need to decide first?",
    questionDeck: (count) => `All ${count} analyses, grouped by the decision each one supports.`,
    libraryEyebrow: "PLAYBOOK LIBRARY",
    libraryTitle: "Build evidence for the next decision.",
    libraryDeck: "Keep practical guidance for budget, creative, and measurement decisions in the same product.",
    blogLabel: "MARKETING BLOG",
    blogTitle: "Practical insight for reading performance",
    blogDesc: "Practical guides that narrow budget, creative, and measurement problems from cause to analysis.",
    guideLabel: "OPERATING PLAYBOOK",
    guideTitle: "Operating standards your team can share",
    guideDesc: "Step-by-step SOPs from tracking setup to campaign operations, creative, and analysis.",
    resources: "Ready-to-use resources and external channels",
    templates: "CSV templates",
    glossary: "Glossary",
    naver: "Naver Blog",
  },
};

export default function LandingPage({ locale = "ko" }) {
  const lang = locale === "en" ? "en" : "ko";
  const T = COPY[lang];
  const router = useRouter();
  const rootRef = useRef(null);
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
              href={lang === "en" ? "/en/start" : "/start"}
              onClick={() => trackLandingNav("landing_data_start_clicked", "hero")}
            >
              <strong>{T.dataCta}</strong>
              <span>{T.dataActionHint}</span>
            </Link>
            <Link
              className="dc-action-route"
              href={lang === "en" ? "/en/calculator" : "/calculator"}
              onClick={() => trackLandingNav("calculator_entry_clicked", "hero")}
            >
              <strong>{T.calculatorCta}</strong>
              <span>{T.calculatorActionHint}</span>
            </Link>
            <Link
              className="dc-action-route"
              href={lang === "en" ? "/en/diagnose" : "/diagnose"}
              onClick={() => trackProductEvent("diagnose_entry_clicked", { source: "landing", placement: "hero", locale: lang })}
            >
              <strong>{T.diagnoseCta}</strong>
              <span>{T.diagnoseActionHint}</span>
            </Link>
          </nav>
          <div className="dc-hero__utility-actions">
            <button type="button" className="dc-text-link dc-text-link--button" onClick={() => openSample("5-2", "hero_example")}>
              {T.demoCta} →
            </button>
            <Link className="dc-text-link" href={lang === "en" ? "/en/guide/csv-data-prep" : "/guide/csv-data-prep"}>
              {T.dataGuideCta} →
            </Link>
          </div>
          <p className="dc-hero__assurance">{T.assurance}</p>
        </div>
      </section>

      {decisionRecords.length > 0 && <section className="dc-return" aria-labelledby="dc-return-title">
        <header className="dc-return__head">
          <div><span>{T.continueEyebrow}</span><h2 id="dc-return-title">{T.continueTitle}</h2></div>
          <p>{T.continueDeck}</p>
        </header>
        <div className="dc-return__grid">
          <Link
            className={`dc-return__status${dueDecisionRecords.length ? " is-due" : ""}`}
            href={lang === "en" ? "/en/weekly-review" : "/weekly-review"}
            onClick={() => trackLandingNav("landing_review_opened", "continue_panel")}
          >
            <span>{T.dueNow}</span><strong>{dueDecisionRecords.length}</strong><b>{T.openInbox} →</b>
          </Link>
          <Link
            className="dc-return__status"
            href={lang === "en" ? "/en/weekly-review" : "/weekly-review"}
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

      {/* 목적 선택(질문 카드)을 개념 설명(주간 결정 루프)보다 앞에 둔다 — 첫 화면
          바로 아래에서 "내가 원하는 것"에 도달하게(claude-ux §1 여정=질문 프레임). */}
      {/* 첫 화면에서 "무엇을 할 수 있나"가 전부 보여야 한다. 예전에는 손으로 고른
          질문 카드 4장만 있어서 4개만 이름이 노출됐고, 전체 목록은 스크롤
          네 번 아래에 있었다. 카드와 목록 두 장치를 하나로 합친다 — 페이지는 짧아지고
          보이는 도구는 4개에서 전부로 늘어난다. */}
      <section className="dc-questions" id="questions" aria-labelledby="dc-question-title">
        <header className="dc-section-head">
          <div>
            <div className="dc-eyebrow">{T.questionEyebrow}</div>
            <h2 id="dc-question-title">{T.questionTitle}</h2>
          </div>
          <p>{T.questionDeck(PUBLISHED_TOOL_IDS.length)}</p>
        </header>
        <ToolIndex
          locale={lang}
          density="compact"
          headingLevel={3}
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
            <div className="dc-eyebrow">{T.loopEyebrow}</div>
            <h2 id="dc-loop-title">{T.loopTitle}</h2>
          </div>
          <p>{T.loopDeck}</p>
        </header>
        <div className="dc-loop__grid">
          {T.loop.map((step) => {
            const content = <><span>{step.label}</span><h3>{step.title}</h3><p>{step.desc}</p><b>{step.cta} →</b></>;
            const href = step.id === "start"
              ? (lang === "en" ? "/en/start" : "/start")
              : step.id === "decide"
                ? toolHref("5-2")
                : (lang === "en" ? "/en/weekly-review" : "/weekly-review");
            return (
              <Link
                className="dc-loop-card"
                href={href}
                key={step.id}
                onClick={() => {
                  if (step.id === "decide") prepareSample("5-2", "weekly_loop");
                  else trackLandingNav(step.id === "start" ? "landing_data_start_clicked" : "landing_review_opened", "weekly_loop");
                }}
              >{content}</Link>
            );
          })}
        </div>
      </section>


      <section className="dc-library" id="library" aria-labelledby="dc-library-title">
        <header className="dc-section-head">
          <div>
            <div className="dc-eyebrow">{T.libraryEyebrow}</div>
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
