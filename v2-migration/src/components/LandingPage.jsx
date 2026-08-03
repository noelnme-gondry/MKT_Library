"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import ConnectedToolJourney from "@/components/ConnectedToolJourney";
import { trackProductEvent } from "@/lib/analytics";
import { hasEnVersion, idToSlug } from "@/lib/routeMap";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { useAppStore } from "@/store/useDataStore";
import { buildDemoCsv } from "@/utils/demoData";

const COPY = {
  ko: {
    eyebrow: "퍼포먼스 마케팅 의사결정",
    title: "성과 원인을 찾고,",
    titleAccent: "다음 하나를 정하세요.",
    actionAria: "바로 시작할 작업",
    dataCta: "내 CSV로 분석",
    dataActionHint: "성과·예산·소재를 내 데이터로 확인",
    calculatorCta: "빠른 계산",
    calculatorActionHint: "목표 CPA·ROAS·표본수 계산",
    diagnoseCta: "성과 원인 찾기",
    diagnoseActionHint: "CSV 없이 확인 순서 찾기",
    dataGuideCta: "CSV 컬럼 준비 방법",
    privacy: "가입 없음 · 원본 데이터는 브라우저에서만 처리",
    instrumentAria: "이번 주 판단 미리보기",
    weeklyDecision: "이번 주 판단",
    instrumentReady: "분석 완료",
    decisionLabel: "예산 결정",
    verdict: "검색광고 낭비부터 줄이세요.",
    reason: "검색 일반 비용 +18% · 전체 CPA 안정",
    nextAction: "다음 행동",
    action: "일반 키워드 예산 10% 감액",
    reviewCue: "7일 뒤 CPA 확인",
    evidence: "예시 근거 보기",
    loopEyebrow: "WEEKLY DECISION LOOP",
    loopTitle: "분석으로 끝내지 않고, 다음 주 결과까지",
    loopDeck: "원본 CSV는 저장하지 않습니다. 결정 요약은 사용자가 직접 켠 경우에만 이 기기에 남깁니다.",
    loop: [
      { id: "start", label: "01 · START", title: "내 데이터 진단", desc: "CSV나 Google Sheets를 가져오면 가능한 분석과 가장 먼저 볼 질문을 추천합니다.", cta: "데이터로 시작" },
      { id: "decide", label: "02 · DECIDE", title: "이번 주 한 가지 결정", desc: "결론, 근거, 다음 행동 순서로 보고 유지·감액·증액·교체 중 하나를 정합니다.", cta: "샘플 판단 보기" },
      { id: "review", label: "03 · REVIEW", title: "다음 주 결과 검토", desc: "저장한 결정의 기준값과 실제값을 대조하고, 배운 점을 다음 판단의 근거로 남깁니다.", cta: "결정 검토함 보기" },
    ],
    questionEyebrow: "CHOOSE BY QUESTION",
    questionTitle: "지금 가장 먼저 판단할 것은?",
    questionDeck: "도구 이름보다 실제 업무 질문으로 시작합니다.",
    questions: [
      { id: "5-2", label: "WEEKLY HEALTH", title: "이번 주, 어디를 먼저 봐야 할까?", desc: "CPA·ROAS·페이싱·이상 신호를 한 화면에서 점검합니다." },
      { id: "5-3", label: "BUDGET MOVE", title: "다음 예산은 어디로 옮길까?", desc: "현재 효율과 한계 효율로 증액·감액 후보를 비교합니다." },
      { id: "9-6", label: "CREATIVE ACTION", title: "무엇을 교체하고 새로 만들까?", desc: "소재 피로 신호와 교체 우선순위를 정리합니다." },
    ],
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
    actionAria: "Start a task",
    dataCta: "Analyze my CSV",
    dataActionHint: "Check performance, budget, and creative",
    calculatorCta: "Quick calculations",
    calculatorActionHint: "Calculate target CPA, ROAS, and sample size",
    diagnoseCta: "Find the cause",
    diagnoseActionHint: "Get a check order without a CSV",
    dataGuideCta: "Prepare CSV columns",
    privacy: "No signup · source data stays in your browser",
    instrumentAria: "Preview of this week’s decision",
    weeklyDecision: "This week’s decision",
    instrumentReady: "Analysis ready",
    decisionLabel: "Budget decision",
    verdict: "Cut wasted search spend first.",
    reason: "Generic search cost +18% · overall CPA stable",
    nextAction: "Next action",
    action: "Cut generic-keyword spend 10%",
    reviewCue: "Check CPA in 7 days",
    evidence: "See example evidence",
    loopEyebrow: "WEEKLY DECISION LOOP",
    loopTitle: "Do not stop at analysis—review what happened next",
    loopDeck: "Source CSV data is never stored. Decision summaries remain on this device only when you explicitly enable it.",
    loop: [
      { id: "start", label: "01 · START", title: "Diagnose my data", desc: "Bring a CSV or Google Sheet to see which analyses it supports and which question to check first.", cta: "Start with my data" },
      { id: "decide", label: "02 · DECIDE", title: "Choose one move this week", desc: "Read the conclusion, evidence, and next action before choosing what to hold, cut, scale, or replace.", cta: "See a sample decision" },
      { id: "review", label: "03 · REVIEW", title: "Review the actual next week", desc: "Compare each saved baseline with the actual outcome and keep the learning for the next decision.", cta: "Open decision inbox" },
    ],
    questionEyebrow: "CHOOSE BY QUESTION",
    questionTitle: "What do you need to decide first?",
    questionDeck: "Start with the operating question, not the tool name.",
    questions: [
      { id: "5-2", label: "WEEKLY HEALTH", title: "Where should I look first this week?", desc: "Review CPA, ROAS, pacing, and anomaly signals in one view." },
      { id: "5-3", label: "BUDGET MOVE", title: "Where should the next budget go?", desc: "Compare scale-up and pull-back candidates with marginal efficiency." },
      { id: "9-6", label: "CREATIVE ACTION", title: "What should we replace or make next?", desc: "Prioritize creative fatigue signals and the next swaps." },
    ],
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
  const setDemoDisabled = useAppStore((state) => state.setDemoDisabled);
  const handoffCsvToRoute = useAppStore((state) => state.handoffCsvToRoute);
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
    <div className="decision-console-landing">
      <section className="dc-hero" aria-labelledby="dc-hero-title">
        <div className="dc-hero__copy">
          <div className="dc-eyebrow">{T.eyebrow}</div>
          <h1 id="dc-hero-title">
            <span>{T.title}</span>
            <span className="dc-hero__accent">{T.titleAccent}</span>
          </h1>
          <nav className="dc-hero__actions" aria-label={T.actionAria}>
            <Link
              className="dc-action-route dc-action-route--primary"
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
            <Link className="dc-text-link" href={lang === "en" ? "/en/guide/csv-data-prep" : "/guide/csv-data-prep"}>
              {T.dataGuideCta} →
            </Link>
          </div>
          <div className="dc-privacy">{T.privacy}</div>
        </div>

        <article className="dc-instrument" aria-label={T.instrumentAria}>
          <header className="dc-instrument__head">
            <strong>{T.weeklyDecision}</strong>
            <span>{T.instrumentReady}</span>
          </header>
          <div className="dc-instrument__verdict">
            <span>{T.decisionLabel}</span>
            <h2>{T.verdict}</h2>
            <p>{T.reason}</p>
          </div>
          <div className="dc-mini-chart" aria-hidden="true">
            <svg viewBox="0 0 440 114" preserveAspectRatio="none" focusable="false">
              <path className="dc-chart-primary" d="M0,80 C35,76 48,57 78,61 S125,82 154,67 S201,35 233,44 S286,80 318,62 S375,32 440,38" />
              <path className="dc-chart-baseline" d="M0,96 C40,91 73,92 112,82 S180,80 226,77 S305,74 350,66 S407,59 440,55" />
              <circle cx="440" cy="38" r="4" />
            </svg>
          </div>
          <footer className="dc-instrument__actions">
            <div>
              <b>{T.nextAction}</b>
              <span>{T.action}</span>
              <small>{T.reviewCue}</small>
            </div>
            <button type="button" onClick={() => openSample("5-2", "decision_instrument")}>
              {T.evidence} →
            </button>
          </footer>
        </article>
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

      <section className="dc-questions" id="questions" aria-labelledby="dc-question-title">
        <header className="dc-section-head">
          <div>
            <div className="dc-eyebrow">{T.questionEyebrow}</div>
            <h2 id="dc-question-title">{T.questionTitle}</h2>
          </div>
          <p>{T.questionDeck}</p>
        </header>
        <div className="dc-question-grid">
          {T.questions.map((question) => (
            <Link
              className="dc-question-card"
              href={toolHref(question.id)}
              key={question.id}
              onClick={() => trackProductEvent("landing_tool_pick", {
                tool_id: question.id,
                source: "landing",
                placement: "question_card",
                locale: lang,
              })}
            >
              <span>{question.label}</span>
              <h3>{question.title}</h3>
              <p>{question.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      <div id="workflow">
        <ConnectedToolJourney locale={lang} />
      </div>

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
