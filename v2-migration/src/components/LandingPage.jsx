"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

import ConnectedToolJourney from "@/components/ConnectedToolJourney";
import { trackProductEvent } from "@/lib/analytics";
import { hasEnVersion, idToSlug } from "@/lib/routeMap";
import { useAppStore } from "@/store/useDataStore";

const COPY = {
  ko: {
    eyebrow: "WEEKLY DECISION SYSTEM",
    title: "성과가 움직인 이유를",
    titleMuted: "이번 주 데이터에서 찾고",
    titleAccent: "다음 한 가지를 정합니다.",
    deck: "CSV 하나로 상태 점검부터 예산과 소재 판단까지 이어갑니다. 분석표를 읽게 하지 않고, 무엇을 유지하고 무엇을 바꿀지 먼저 보여줍니다.",
    sampleCta: "샘플 판단 화면 보기",
    dataGuideCta: "내 데이터 준비 방법",
    privacy: "가입 없음 · 모든 분석 무료 · 데이터 서버 전송 0",
    instrumentAria: "이번 주 판단 미리보기",
    weeklyDecision: "이번 주 운영 판단",
    verdict: <>Meta 예산을 바로 늘리기보다<br />검색광고 낭비부터 줄이세요.</>,
    reason: "전체 CPA는 안정적이지만 검색 일반 캠페인의 비용이 18% 늘며 효율을 끌어내렸습니다.",
    nextAction: "다음 행동",
    action: "일반 키워드 예산 10% 감액 검토",
    evidence: "근거 보기",
    questionEyebrow: "CHOOSE BY QUESTION",
    questionTitle: "지금 가장 먼저 판단할 것은?",
    questionDeck: "도구 이름보다 실제 업무 질문으로 시작합니다.",
    questions: [
      { id: "5-2", label: "WEEKLY HEALTH", title: "이번 주, 어디를 먼저 봐야 할까?", desc: "CPA·ROAS·페이싱·이상 신호를 한 화면에서 점검합니다." },
      { id: "5-3", label: "BUDGET MOVE", title: "다음 예산은 어디로 옮길까?", desc: "현재 효율과 한계 효율로 증액·감액 후보를 비교합니다." },
      { id: "9-6", label: "CREATIVE ACTION", title: "무엇을 교체하고 새로 만들까?", desc: "소재 피로 신호와 교체 우선순위를 정리합니다." },
    ],
    libraryEyebrow: "PLAYBOOK LIBRARY",
    libraryTitle: "분석 밖에서도 판단을 이어가세요.",
    libraryDeck: "실무 인사이트와 SOP를 같은 제품 안에 유지합니다.",
    blogLabel: "MARKETING BLOG",
    blogTitle: "성과를 해석하는 실무 인사이트",
    blogDesc: "퍼포먼스·콘텐츠 마케팅, 데이터·SEO·그로스 팁을 정기적으로 업데이트합니다.",
    guideLabel: "OPERATING PLAYBOOK",
    guideTitle: "팀이 함께 쓰는 운영 표준",
    guideDesc: "트래킹 셋업부터 캠페인 운영·소재·분석까지 단계별 SOP를 확인합니다.",
    resources: "바로 쓰는 자료와 외부 채널",
    templates: "CSV 템플릿",
    glossary: "용어사전",
    naver: "네이버 블로그",
  },
  en: {
    eyebrow: "WEEKLY DECISION SYSTEM",
    title: "Know why performance moved,",
    titleMuted: "read this week’s data, then",
    titleAccent: "choose the next move.",
    deck: "Move from weekly health to budget and creative decisions with one CSV. See what to keep and what to change before digging through analysis tables.",
    sampleCta: "See the sample decision",
    dataGuideCta: "Prepare my data",
    privacy: "No signup · every analysis tool is free · nothing sent to a server",
    instrumentAria: "Preview of this week’s decision",
    weeklyDecision: "This week’s operating decision",
    verdict: <>Cut wasted search spend<br />before scaling Meta.</>,
    reason: "Overall CPA is stable, but generic search spend rose 18% and pulled efficiency down.",
    nextAction: "Next action",
    action: "Review a 10% cut to generic-keyword spend",
    evidence: "See evidence",
    questionEyebrow: "CHOOSE BY QUESTION",
    questionTitle: "What do you need to decide first?",
    questionDeck: "Start with the operating question, not the tool name.",
    questions: [
      { id: "5-2", label: "WEEKLY HEALTH", title: "Where should I look first this week?", desc: "Review CPA, ROAS, pacing, and anomaly signals in one view." },
      { id: "5-3", label: "BUDGET MOVE", title: "Where should the next budget go?", desc: "Compare scale-up and pull-back candidates with marginal efficiency." },
      { id: "9-6", label: "CREATIVE ACTION", title: "What should we replace or make next?", desc: "Prioritize creative fatigue signals and the next swaps." },
    ],
    libraryEyebrow: "PLAYBOOK LIBRARY",
    libraryTitle: "Keep learning beyond the analysis.",
    libraryDeck: "Practical insight and operating standards stay in the same product.",
    blogLabel: "MARKETING BLOG",
    blogTitle: "Practical insight for reading performance",
    blogDesc: "Performance and content marketing, data, SEO, and growth notes updated regularly.",
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
  const toolHref = (id) =>
    lang === "en" && hasEnVersion(id) ? `/en${idToSlug[id] || ""}` : idToSlug[id] || "/";
  const openSample = (id, placement) => {
    trackProductEvent("landing_tool_pick", {
      tool_id: id,
      source: "landing",
      placement,
      locale: lang,
    });
    setDemoDisabled(false);
    router.push(toolHref(id));
  };

  return (
    <div className="decision-console-landing">
      <section className="dc-hero" aria-labelledby="dc-hero-title">
        <div className="dc-hero__copy">
          <div className="dc-eyebrow">{T.eyebrow}</div>
          <h1 id="dc-hero-title">
            <span>{T.title}</span>
            <span className="dc-hero__muted">{T.titleMuted}</span>
            <span className="dc-hero__accent">{T.titleAccent}</span>
          </h1>
          <p>{T.deck}</p>
          <div className="dc-hero__actions">
            <button className="btn primary dc-primary-button" type="button" onClick={() => openSample("5-2", "hero")}>
              {T.sampleCta}
            </button>
            <Link className="dc-text-link" href={lang === "en" ? "/en/guide/csv-data-prep" : "/guide/csv-data-prep"}>
              {T.dataGuideCta} →
            </Link>
          </div>
          <div className="dc-privacy">{T.privacy}</div>
        </div>

        <article className="dc-instrument" aria-label={T.instrumentAria}>
          <header className="dc-instrument__head">
            <strong>{T.weeklyDecision}</strong>
            <span>ANALYSIS READY</span>
          </header>
          <div className="dc-instrument__verdict">
            <span>DECISION 01 · BUDGET</span>
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
            </div>
            <button type="button" onClick={() => openSample("5-2", "decision_instrument")}>
              {T.evidence} →
            </button>
          </footer>
        </article>
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
            <button type="button" className="dc-question-card" key={question.id} onClick={() => openSample(question.id, "question_card")}>
              <span>{question.label}</span>
              <h3>{question.title}</h3>
              <p>{question.desc}</p>
            </button>
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
