"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import HomeResultPreview from "@/components/landing/HomeResultPreview";
import MobileQuickStart from "@/components/MobileQuickStart";
import useSampleAnalysis from "@/components/useSampleAnalysis";
import { useEffect, useRef } from "react";

import HomeToolFinder from "@/components/ds/HomeToolFinder";
import { trackProductEvent } from "@/lib/analytics";
import { getDecisionReviewBucket } from "@/lib/decisionReview";
import { hasEnVersion, idToSlug } from "@/lib/routeMap";
import { useAppStore } from "@/store/useDataStore";

const COPY = {
  ko: {
    title: "성과는 왜 바뀌었고,",
    titleAccent: "다음엔 뭘 해야 할까?",
    deck: ["실무 가이드로 기준을 잡고, 내 데이터로 확인하세요.", "성과 분석부터 다음 주의 판단까지 한곳에서 이어갑니다."],
    actionAria: "바로 시작할 작업",
    dataCta: "CSV로 가능한 분석 한 번에",
    reviewCta: "내 프로젝트 열기",
    reviewHint: "기간 비교 → 결정 기록 → 다음 결과 검토",
    calculatorCta: "빠른 계산",
    diagnoseCta: "성과 원인 찾기",
    demoCta: "샘플로 체험하기",
    dataGuideCta: "CSV 컬럼 준비 방법",
    // 구 trustBadges(무료·가입 없음·브라우저에서만 처리)와 privacy 줄이 거의 같은
    // 문장을 두 번 반복했다. 한 줄로 통합.
    assurance: ["가입 없이 무료 분석", "CSV는 브라우저에서 처리"],
    continueTitle: "검토할 결정",
    continueDeck: "이 브라우저에 남아 있는 결정 요약과 직접 올린 파일을 이어서 보여줍니다. 저장 화면에서 언제든 지울 수 있습니다.",
    dueNow: "지금 검토",
    nextReview: "다음 마케팅 프로젝트",
    latestDecision: "최근 판단",
    noSchedule: "일정 미정",
    reviewed: "검토 완료",
    openInbox: "내 프로젝트 열기",
    reopenTool: "원본 도구 다시 열기",
    loopTitle: "판단의 기록과 다음 검토",
    loopDeck: "무엇을 바꿨는지, 어떤 근거로 판단했는지 남기세요.",
    loopFollowup: "검토일에 새 데이터를 보고 결과와 배운 점을 이어 기록합니다.",
    loopCondition: "기록 저장은 로그인과 유효한 Pro가 필요합니다. 7일 체험에도 포함됩니다.",
    // 이용 안내가 같은 조건을 문장으로 설명한다 — 기록 섹션은 이름표 한 줄만 둔다.
    loopTag: "Pro 기능 · 로그인 필요 · 7일 체험 포함",
    shortcutLead: "도구를 고르기 어렵다면",
    questionTitle: "목적별 분석 도구",
    questionDeck: "확인하려는 문제에서 시작하세요.",
    libraryTitle: "실무 가이드와 분석 글",
    libraryDeck: "실무의 질문을 풀어내는 블로그와 바로 꺼내 쓰는 운영 가이드.",
    blogLabel: "마케팅 블로그",
    blogTitle: "성과 분석 사례와 방법",
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
    title: "Why did it change?",
    titleAccent: "What should you do next?",
    deck: ["Build your baseline with practical guides and check your data.", "Connect performance analysis to next week’s decisions in one place."],
    actionAria: "Start a task",
    dataCta: "Find analyses for my CSV",
    reviewCta: "Open My projects",
    reviewHint: "Compare periods → record a decision → review results",
    calculatorCta: "Quick calculations",
    diagnoseCta: "Find the cause",
    demoCta: "Explore a sample",
    dataGuideCta: "Prepare CSV columns",
    assurance: ["Free analysis, no sign-up", "CSV processed in your browser"],
    continueTitle: "Decisions to review",
    continueDeck: "Continue with decision summaries and files uploaded directly in this browser. You can remove them at any time in Storage.",
    dueNow: "Due now",
    nextReview: "Next marketing project",
    latestDecision: "Latest decision",
    noSchedule: "Not scheduled",
    reviewed: "Reviewed",
    openInbox: "Open My projects",
    reopenTool: "Reopen source tool",
    loopTitle: "Decisions and follow-up reviews",
    loopDeck: "Record what changed and the evidence behind your decision.",
    loopFollowup: "Return with new data to review the outcome and record what you learned.",
    loopCondition: "Saving requires sign-in and active Pro, including the 7-day trial.",
    loopTag: "Pro feature · Sign-in required · Included in the 7-day trial",
    shortcutLead: "Not sure where to start?",
    questionTitle: "Analyses by purpose",
    questionDeck: "Start with the question you need to answer.",
    libraryTitle: "Guides and analysis articles",
    libraryDeck: "Practical articles to understand the question, and SOPs to put it into practice.",
    blogLabel: "Marketing blog",
    blogTitle: "Performance analysis methods and examples",
    blogDesc: "Practical guides that narrow budget, creative, and measurement problems from cause to analysis.",
    guideLabel: "Operating playbook",
    guideTitle: "Operating standards your team can share",
    guideDesc: "Step-by-step SOPs from tracking setup to campaign operations, creative, and analysis.",
    resources: "Ready-to-use resources and external channels",
    templates: "CSV templates",
    glossary: "Glossary",
    naver: "Naver Blog",
  },
};

export default function LandingPage({ locale = "ko", reading }) {
  const lang = locale === "en" ? "en" : "ko";
  const T = COPY[lang];
  const launchSample = useSampleAnalysis(lang);
  const rootRef = useRef(null);
  const router = useRouter();
  useEffect(() => {
    const revealFromHash = () => { if (window.location.hash === "#dochi-upload") router.replace(lang === "en" ? "/en/start" : "/start"); };
    revealFromHash();
    window.addEventListener("hashchange", revealFromHash);
    return () => window.removeEventListener("hashchange", revealFromHash);
  }, [lang, router]);
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
  };
  const openSample = (id, placement) => {
    prepareSample(id, placement);
    launchSample();
  };
  const trackLandingNav = (name, placement) => {
    trackProductEvent(name, { source: "landing", placement, locale: lang });
  };

  return (
    <div className="decision-console-landing home-approved" ref={rootRef}>
      {decisionRecords.length > 0 && <section className="dc-return" aria-labelledby="dc-return-title">
        <header className="dc-return__head">
          <div><h2 id="dc-return-title">{T.continueTitle}</h2></div>
          <p>{T.continueDeck}</p><div className="dc-return__actions"><Link className="btn primary" href={lang === "en" ? "/en/weekly-review#wr-upload" : "/weekly-review#wr-upload"} onClick={() => trackLandingNav("landing_review_opened", "next_csv")}>{lang === "en" ? "Upload the next CSV" : "다음 CSV로 이어가기"}</Link><Link className="btn" href={lang === "en" ? "/en/projects" : "/projects"}>{lang === "en" ? "Open projects" : "프로젝트 열기"}</Link></div>
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
            <small>{lang === "en" ? "Review date: " : "검토일: "}{latestDecision.reviewDate || T.noSchedule}</small>
            {latestDecision.sourcePeriod && <small>{lang === "en" ? "Saved period: " : "저장한 기간: "}{latestDecision.sourcePeriod}</small>}
            {idToSlug[latestDecision.toolId] && <Link
              href={toolHref(latestDecision.toolId)}
              onClick={() => trackProductEvent("landing_continue_tool_clicked", { tool_id: latestDecision.toolId, source: "landing", placement: "continue_panel", locale: lang })}
            >{T.reopenTool} →</Link>}
          </article>}
        </div>
      </section>}
      <section className="dc-hero" aria-labelledby="dc-hero-title">
        <div className="dc-hero__copy">
          <h1 id="dc-hero-title">
            <span>{T.title}</span>
            <span className="dc-hero__accent">{T.titleAccent}</span>
          </h1>
          <div className="dc-hero__deck">{T.deck.map((sentence) => <p key={sentence}>{sentence}</p>)}</div>
          <nav className="dc-hero__actions" aria-label={T.actionAria}>
            <Link
              className="dc-action-route dc-action-route--primary"
              data-mobile-task=".dc-action-route--primary"
              href={lang === "en" ? "/en/start" : "/start"}
              onClick={() => trackLandingNav("landing_data_start_clicked", "hero")}
            >
              <strong>{T.dataCta}</strong>
            </Link>
            <button type="button" className="dc-action-route dc-action-route--sample" onClick={() => openSample("5-2", "hero_example")}><strong>{T.demoCta}</strong></button>
          </nav>
          <p className="dc-hero__assurance">{T.assurance.map((condition) => <span key={condition}>{condition}</span>)}</p>
        </div>
        <HomeResultPreview locale={lang} />
      </section>

      <section className="dc-questions" id="questions" tabIndex={-1} aria-labelledby="dc-question-title">
        <header className="dc-section-head">
          <div>
            <h2 id="dc-question-title">{T.questionTitle}</h2>
          </div>
          <p>{T.questionDeck}</p>
        </header>
        <div className="dc-tool-shortcuts">
            <span>{T.shortcutLead}</span>
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
        </div>
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
          <p>{T.loopFollowup}</p>
          <p className="home-pro-condition">{T.loopTag}</p>
          <Link className="dc-text-link" href={`${lang === "en" ? "/en" : ""}/weekly-review`} onClick={() => trackLandingNav("landing_review_opened", "weekly_loop")}>{T.openInbox}</Link>
        </header>
        <article className="home-review-example">
          <h3>{lang === "en" ? "Compare channels using consistent definitions" : "채널별 집계 기준을 맞춰 다시 비교"}</h3>
          <p>{lang === "en" ? "Illustrative record" : "예시 기록"}</p>
          <dl>
            <div><dt>{lang === "en" ? "Observation" : "확인한 내용"}</dt><dd>{lang === "en" ? "Channel ROAS varies within the overall average" : "같은 평균 안에서도 채널별 ROAS가 다름"}</dd></div>
            <div><dt>{lang === "en" ? "Next action" : "다음 행동"}</dt><dd>{lang === "en" ? "Align periods and attribution before reanalyzing" : "기간과 전환 귀속 기준을 맞춘 뒤 재분석"}</dd></div>
            <div><dt>{lang === "en" ? "Review date" : "검토 시점"}</dt><dd>{lang === "en" ? "After next week’s conversions are counted" : "다음 주 전환 집계가 끝난 뒤"}</dd></div>
          </dl>
        </article>
      </section>


      {reading}
      <section className={`dc-library${reading ? " has-reading" : ""}`} id="library" aria-label={reading ? T.resources : undefined} aria-labelledby={reading ? undefined : "dc-library-title"}>
        {!reading && <header className="dc-section-head">
          <div>
            <h2 id="dc-library-title">{T.libraryTitle}</h2>
          </div>
          <p>{T.libraryDeck}</p>
        </header>}
        {!reading && <div className="dc-library__grid">
          <Link className="dc-library-card" href={lang === "en" ? "/en/blog" : "/blog"}>
            <h3>{T.blogTitle}</h3>
            <p>{T.blogDesc}</p>
          </Link>
          <Link className="dc-library-card" href={lang === "en" ? "/en/guide" : "/guide"}>
            <h3>{T.guideTitle}</h3>
            <p>{T.guideDesc}</p>
          </Link>
        </div>}
        <div className="dc-resource-strip">
          <span>{T.resources}</span>
          <div>
            <Link href={lang === "en" ? "/en/templates" : "/templates"}>{T.templates}</Link>
            <Link href={lang === "en" ? "/en/glossary" : "/glossary"}>{T.glossary}</Link>
            <a href="https://youtube.com/channel/UCvRcpOHOqvSHQPNbgZdPNUw/" target="_blank" rel="noopener noreferrer" aria-label={`YouTube (${lang === "en" ? "new tab" : "새 탭"})`}>YouTube ↗</a>
            <a href="https://www.instagram.com/gondry__workshop/" target="_blank" rel="noopener noreferrer" aria-label={`Instagram (${lang === "en" ? "new tab" : "새 탭"})`}>Instagram ↗</a>
            <a href="https://www.facebook.com/profile.php?id=61591483650900" target="_blank" rel="noopener noreferrer" aria-label={`Facebook (${lang === "en" ? "new tab" : "새 탭"})`}>Facebook ↗</a>
            <a href="https://blog.naver.com/growthoptplaybook" target="_blank" rel="noopener noreferrer" aria-label={`${T.naver} (${lang === "en" ? "new tab" : "새 탭"})`}>{T.naver} ↗</a>
          </div>
        </div>
      </section>
      <section className="home-service-terms" aria-labelledby="home-terms-title">
        <h2 id="home-terms-title">{lang === "en" ? "Before you start" : "이용 안내"}</h2>
        <div>
          <section><h3>{lang === "en" ? "What is free?" : "어디까지 무료인가요?"}</h3>
            <p>{lang === "en" ? "Analysis and on-screen results are free, with no sign-up required." : "분석 실행과 화면 결과 확인은 무료이며, 가입 없이 시작합니다."}</p>
            <p>{T.loopCondition}</p>
            <p>{lang === "en" ? "Report downloads require an active purchased pass. They are not included in the 7-day trial." : "보고서 다운로드는 구매한 유효 이용권이 필요합니다. 7일 체험에는 포함되지 않습니다."}</p>
            <Link href={lang === "en" ? "/en/subscription" : "/subscription"}>{lang === "en" ? "Compare free and Pro" : "무료·Pro 범위 보기"}</Link>
          </section>
          <section><h3>{lang === "en" ? "Where is my file processed?" : "파일은 어디서 처리하나요?"}</h3>
            <p>{lang === "en" ? "CSV parsing and calculations run in your browser. Raw rows are not sent to or stored on the server." : "CSV 파싱과 계산은 브라우저에서 실행됩니다. 원본 행을 서버로 전송하거나 저장하지 않습니다."}</p>
          </section>
          <section><h3>{lang === "en" ? "How should I interpret a result?" : "결과는 어떻게 해석하나요?"}</h3>
            <p>{lang === "en" ? "Requirements vary by tool. Read estimates with their uncertainty; observed associations alone do not establish causation." : "도구마다 필요한 조건이 다릅니다. 추정 결과는 불확실성과 함께 읽어야 하며, 관측된 연관만으로 원인을 확정하지 않습니다."}</p>
          </section>
        </div>
      </section>
      <MobileQuickStart locale={lang} />
    </div>
  );
}
