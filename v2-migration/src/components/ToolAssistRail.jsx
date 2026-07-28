"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";

import { trackProductEvent } from "@/lib/analytics";
import { getNextTools, localizedTool } from "@/lib/toolConnections";
import { computeAnalyzeSig, TOOL_GROUP, useAppStore } from "@/store/useDataStore";

const COPY = {
  ko: {
    open: "분석 도우미 열기",
    close: "분석 도우미 접기",
    eyebrow: "CONTEXT ASSIST",
    current: "지금 보는 단계",
    jump: "이 위치로 이동",
    evidence: "근거 위치 보기",
    recommendations: "추천 액션",
    mapping: "데이터 매핑 확인",
    prepare: "데이터 준비하기",
    replaceSample: "내 CSV로 바꾸기",
    support: "판단 기록·보조 도구",
    next: "다음 분석으로",
    noNext: "이 도구에서 판단을 정리한 뒤 다음 단계를 선택하세요.",
    defaultTitle: "분석 흐름 안내",
    defaultBody: "현재 화면에서 필요한 입력과 결과를 확인한 뒤, 다음 판단으로 이어가세요.",
    resultReady: "새 결과가 준비됐습니다",
  },
  en: {
    open: "Open analysis assistant",
    close: "Collapse analysis assistant",
    eyebrow: "CONTEXT ASSIST",
    current: "Current step",
    jump: "Jump to this section",
    evidence: "View supporting result",
    recommendations: "Recommended actions",
    mapping: "Check data mapping",
    prepare: "Prepare data",
    replaceSample: "Use my CSV",
    support: "Decision log and supporting tools",
    next: "Continue to next analysis",
    noNext: "Review this result, then choose the next decision step.",
    defaultTitle: "Analysis guide",
    defaultBody: "Check the inputs and result in view, then continue to the next decision.",
    resultReady: "A new result is ready",
  },
};

const ASSIST_SECTIONS = {
  "5-2": [
    { id: "dashboard-tabpanel", result: true, title: ["현재 탭 결과 읽기", "Read the active tab"], body: ["지표를 확인한 뒤 원인이 필요하면 성과 변동 탐지로 이어가세요.", "Review the metric, then move to variance analysis when you need the cause."] },
    { id: "dashboard-support-tools", title: ["판단 기록과 다음 분석", "Decision log and next analysis"], body: ["이번 결론을 남기고, 같은 데이터로 다음 분석을 이어갈 수 있습니다.", "Save this conclusion and continue with the same dataset."] },
  ],
  "5-21": [
    { id: "s-prep", title: ["변동 데이터 준비", "Prepare variance data"], body: ["채널·캠페인·소재 단위가 함께 있어야 원인을 정확히 나눌 수 있습니다.", "Channel, campaign, and creative fields let you separate the cause accurately."] },
    { id: "s-pvm-result", result: true, title: ["변동 원인 읽기", "Read the variance cause"], body: ["물량·효율·믹스 중 먼저 조치할 원인을 고른 뒤 예산 또는 소재로 이동하세요.", "Choose the first cause to act on—volume, efficiency, or mix—then move to budget or creative work."] },
  ],
  "5-22": [
    { id: "s-prep", title: ["포화도 입력 준비", "Prepare saturation inputs"], body: ["비용과 성과가 같은 기간·같은 단위로 묶여 있는지 먼저 확인하세요.", "Confirm cost and outcomes use the same period and grain first."] },
    { id: "s-sat-summary", result: true, title: ["증액 여지 판단", "Decide scaling headroom"], body: ["여유와 포화를 구분한 뒤, 실제 금액 배분은 예산 배분에서 검증하세요.", "Separate headroom from saturation, then validate the amount in Budget allocation."] },
  ],
  "5-3": [
    { id: "s-prep", title: ["배분 기준 준비", "Prepare allocation inputs"], body: ["목표 지표와 가용 예산을 먼저 맞추면 시뮬레이션이 흔들리지 않습니다.", "Set the target metric and available budget before simulating."] },
    { id: "s-scenario", result: true, title: ["배분 시나리오 비교", "Compare allocation scenarios"], body: ["한 번에 크게 옮기기보다, 다음 검증을 위한 보수적 시나리오도 함께 비교하세요.", "Compare a conservative scenario for the next validation alongside a large move."] },
  ],
  "9-6": [
    { id: "s-prep", title: ["소재 데이터 준비", "Prepare creative data"], body: ["소재 ID·날짜·비용·성과가 있어야 피로와 교체 우선순위를 함께 볼 수 있습니다.", "Creative ID, date, spend, and outcome are needed to read fatigue and replacement priority together."] },
    { id: "s-creative-hero", result: true, title: ["교체 우선순위", "Replacement priority"], body: ["교체할 소재를 고른 뒤, 다음 가설은 실험 분석에서 검증하세요.", "Choose what to replace, then validate the next hypothesis in Experiment analysis."] },
  ],
  "5-4": [
    { id: "s-mode", title: ["실험 방식 선택", "Choose an experiment mode"], body: ["설계와 판독 중 지금 필요한 일을 고르면, 필요한 입력만 남습니다.", "Choose design or readout to keep only the inputs you need now."] },
    { id: "s-readout-sig", result: true, title: ["효과 판독", "Read the effect"], body: ["유의하지 않은 결과는 효과 없음이 아니라 판단 보류입니다. 다음 실험 조건을 기록하세요.", "A non-significant result is inconclusive, not no effect. Record the next test condition."] },
  ],
  "5-23": [
    { id: "s-incr-method", title: ["증분 측정 방식 선택", "Choose an incrementality method"], body: ["비교군과 기간 정의가 먼저입니다. 관찰 성과만으로 증분을 단정하지 마세요.", "Define the comparison group and period first; do not infer incrementality from observed outcomes alone."] },
    { id: "s-incr-result", result: true, title: ["증분 결과 판독", "Read the incrementality result"], body: ["무작위 홀드아웃·DiD·단순 전후의 증거 수준을 구분해 다음 실험을 정하세요.", "Distinguish randomized holdout, DiD, and simple pre/post evidence before choosing the next test."] },
  ],
  "5-18": [
    { id: "s-prep", title: ["반응 데이터 준비", "Prepare response data"], body: ["주차 단위와 채널별 비용·성과가 맞아야 반응을 안정적으로 읽을 수 있습니다.", "Align weekly grain with channel cost and outcome to read response reliably."] },
    { id: "s-trend", result: true, title: ["반응 변화 확인", "Read the response change"], body: ["관찰된 변화는 진단 신호입니다. 예산 이동 전에는 잠식·추세를 함께 확인하세요.", "Observed movement is a diagnostic signal. Check cannibalization and trend before moving budget."] },
    { id: "s-macro", result: true, title: ["기여도 해석", "Interpret contribution"], body: ["모델 기여도는 예산 방향을 정하는 근거이며, 인과 효과 확정은 별도 검증이 필요합니다.", "Model contribution guides budget direction; causal confirmation needs separate validation."] },
    { id: "s-forecast", result: true, title: ["예측과 다음 조치", "Forecast and next action"], body: ["예측은 방향을 정하는 근거입니다. 실제 증분은 별도 실험으로 확인하세요.", "Use the forecast to choose direction; verify true incrementality with a separate experiment."] },
  ],
  "5-20": [
    { id: "s-prep", title: ["이벤트 데이터 준비", "Prepare event data"], body: ["사용자·이벤트·시간이 연결되어야 초기 행동과 잔존의 관계를 찾을 수 있습니다.", "User, event, and time need to connect to find early actions tied to retention."] },
    { id: "s-aha-hero", result: true, title: ["핵심 행동 해석", "Interpret the key action"], body: ["발견한 행동은 가설입니다. 온보딩 또는 실험 설계로 다음 검증을 이어가세요.", "The discovered action is a hypothesis. Continue with onboarding or experiment design to validate it."] },
  ],
  "9-1": [
    { id: "s-content-mapping", title: ["콘텐츠 데이터·요소 지정", "Set content data and elements"], body: ["콘텐츠 한 건당 한 행에서 성과 1개와 설명 요소를 고르세요. 비슷한 요소를 너무 많이 넣으면 분리해 읽기 어렵습니다.", "Use one row per content item, then choose one outcome and explanatory elements. Too many similar elements are hard to separate."] },
    { id: "s-content-result", result: true, title: ["요소 연관 해석", "Interpret element associations"], body: ["유의 연관은 다음 제작 가설입니다. 인과 효과로 단정하지 말고 실험으로 확인하세요.", "A significant association is a production hypothesis, not causality. Confirm it with an experiment."] },
  ],
  "9-2": [
    { id: "s-prep", title: ["콘텐츠 행동 데이터 준비", "Prepare content behavior data"], body: ["독자·콘텐츠·행동 시간이 연결되어야 재방문을 만드는 경험을 찾을 수 있습니다.", "Reader, content, and event time need to connect to find experiences that drive return visits."] },
    { id: "s-aha-hero", result: true, title: ["충성 행동 해석", "Interpret the loyalty action"], body: ["발견한 행동은 다음 콘텐츠 실험의 가설로 남기세요.", "Carry the discovered action forward as a hypothesis for the next content experiment."] },
  ],
  "9-3": [
    { id: "s-prep", title: ["트래픽 데이터 준비", "Prepare traffic data"], body: ["콘텐츠·채널·날짜 단위를 함께 맞추면 변동의 원인을 나눌 수 있습니다.", "Align content, channel, and date grain to separate the cause of traffic variance."] },
    { id: "s-pvm-result", result: true, title: ["트래픽 변동 원인", "Read the traffic variance cause"], body: ["변화의 주된 원인을 정한 뒤, 콘텐츠 교체 또는 실험으로 이어가세요.", "Choose the main cause, then continue to content replacement or an experiment."] },
  ],
  "9-7": [
    { id: "dashboard-tabpanel", result: true, title: ["현재 콘텐츠 결과 읽기", "Read the active content result"], body: ["우선순위 신호를 확인한 뒤 트래픽 변동 또는 요소 분석으로 이어가세요.", "Review the priority signal, then continue to traffic variance or element analysis."] },
    { id: "dashboard-support-tools", title: ["판단 기록과 다음 분석", "Decision log and next analysis"], body: ["이번 결론을 기록해 다음 콘텐츠 운영 주기에 이어가세요.", "Save this conclusion for the next content operating cycle."] },
  ],
};

const DASHBOARD_SETUP_SECTIONS = {
  "5-2": [
    { id: "dashboard-data-setup", title: ["데이터 업로드·매핑", "Upload and map data"], body: ["캠페인 CSV를 올린 뒤 날짜·비용·성과 컬럼을 연결하고 분석을 시작하세요.", "Upload a campaign CSV, connect date, spend, and outcome fields, then start the analysis."] },
  ],
  "9-7": [
    { id: "dashboard-data-setup", title: ["데이터 업로드·매핑", "Upload and map data"], body: ["콘텐츠 성과 CSV를 올린 뒤 날짜·콘텐츠·성과 컬럼을 연결하고 분석을 시작하세요.", "Upload a content-performance CSV, connect date, content, and outcome fields, then start the analysis."] },
  ],
};

const DASHBOARD_DEMO_SECTIONS = {
  "5-2": [
    { id: "dashboard-demo-source", result: true, title: ["샘플 결과 살펴보기", "Explore the sample result"], body: ["이 결과는 예시 데이터입니다. 내 캠페인 판단을 시작하려면 CSV를 올려 같은 흐름으로 바꾸세요.", "This result uses sample data. Upload your CSV to make decisions from your own campaigns."] },
  ],
  "9-7": [
    { id: "dashboard-demo-source", result: true, title: ["샘플 결과 살펴보기", "Explore the sample result"], body: ["이 결과는 예시 데이터입니다. 내 콘텐츠 데이터로 바꾸면 같은 흐름에서 분석할 수 있습니다.", "This result uses sample data. Replace it with your content data to analyze in the same flow."] },
  ],
};

// 공개 도구 여정과 별개로, preview 콘텐츠 화면도 같은 보조 경험을 제공한다.
// CONNECTED_TOOLS에 넣으면 랜딩 여정·CSV 템플릿의 공개 범위까지 바뀌므로 여기서만 관리한다.
const ASSIST_TOOL_FALLBACKS = {
  "9-2": { title: { ko: "킬러 콘텐츠·충성 독자 발굴", en: "Killer content and loyal reader finder" } },
  "9-3": { title: { ko: "콘텐츠 트래픽 변동 탐지", en: "Content traffic variance" } },
  "9-7": { title: { ko: "콘텐츠 운영 대시보드", en: "Content operations dashboard" } },
};

const QUICK_ACTION_TARGETS = {
  "5-2": "dashboard-support-tools",
  "9-7": "dashboard-support-tools",
  "5-23": "s-incr-method",
  "9-1": "s-content-mapping",
};

function copyFor(value, lang) {
  return value[lang === "en" ? 1 : 0];
}

export function readAssistInsight(element, lang = "ko") {
  if (!element?.dataset) return null;
  const suffix = lang === "en" ? "En" : "Ko";
  const summary = element.dataset[`assistSummary${suffix}`];
  if (!summary) return null;
  return {
    title: element.dataset[`assistTitle${suffix}`] || null,
    summary,
    actions: String(element.dataset[`assistActions${suffix}`] || "")
      .split("|||")
      .map((item) => item.trim())
      .filter(Boolean),
  };
}

function getSections(toolId, { hasDashboardResults = true, isDashboardDemo = false } = {}) {
  if (!hasDashboardResults && DASHBOARD_SETUP_SECTIONS[toolId]) return DASHBOARD_SETUP_SECTIONS[toolId];
  if (isDashboardDemo && DASHBOARD_DEMO_SECTIONS[toolId]) return DASHBOARD_DEMO_SECTIONS[toolId];
  return ASSIST_SECTIONS[toolId] || [{ id: "s-prep", title: ["데이터 준비", "Prepare data"], body: ["입력 항목을 확인한 뒤 분석을 시작하세요.", "Confirm the input fields before starting analysis."] }];
}

export default function ToolAssistRail({ toolId, locale = "ko" }) {
  const lang = locale === "en" ? "en" : "ko";
  const T = COPY[lang];
  const isDashboardTool = Boolean(DASHBOARD_SETUP_SECTIONS[toolId]);
  const csvData = useAppStore((state) => state.csvData);
  const analyzedByGroup = useAppStore((state) => state.analyzedByGroup);
  const group = TOOL_GROUP[toolId];
  const hasDashboardResults = !isDashboardTool || Boolean(csvData?.raw?.length > 0 && group && analyzedByGroup?.[group] === computeAnalyzeSig(csvData));
  const isDashboardDemo = isDashboardTool && String(csvData?.fileName || "").startsWith("demo_");
  const sections = useMemo(() => getSections(toolId, { hasDashboardResults, isDashboardDemo }), [toolId, hasDashboardResults, isDashboardDemo]);
  const [isOpen, setIsOpen] = useState(false);
  const [hasNewContext, setHasNewContext] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(sections[0].id);
  const [activeInsight, setActiveInsight] = useState(null);
  const didRevealResult = useRef(false);
  const nextTool = getNextTools(toolId, lang)[0] || null;
  const sourceTool = localizedTool(toolId, lang) || (ASSIST_TOOL_FALLBACKS[toolId] && { title: ASSIST_TOOL_FALLBACKS[toolId].title[lang] });
  const activeSection = sections.find((section) => section.id === activeSectionId) || sections[0];
  const quickActionTarget = isDashboardTool && !hasDashboardResults
    ? "dashboard-data-setup"
    : isDashboardDemo
      ? "dashboard-data-setup"
    : (QUICK_ACTION_TARGETS[toolId] || "s-prep");

  useEffect(() => {
    didRevealResult.current = false;
    let frameId = 0;
    const revealResultIfReady = () => {
      const resultIsVisible = sections.some((section) => section.result && document.getElementById(section.id));
      if (resultIsVisible && !didRevealResult.current) {
        didRevealResult.current = true;
        setHasNewContext(true);
        // 모바일에서 자동 패널이 결과·필터를 덮지 않게 배지만 알린다.
        // 사용자가 토글을 누르면 같은 맥락 안내를 그대로 펼칠 수 있다.
        if (window.innerWidth > 760) setIsOpen(true);
      }
    };
    const syncCurrentSection = () => {
      const checkpoints = sections
        .map((section) => ({ section, element: document.getElementById(section.id) }))
        .filter(({ element }) => element);
      const viewportMarker = window.innerHeight * 0.38;
      const passed = checkpoints.filter(({ element }) => element.getBoundingClientRect().top <= viewportMarker);
      const current = (passed.length > 0 ? passed : checkpoints)[(passed.length > 0 ? passed : checkpoints).length - 1];
      if (current) {
        setActiveSectionId((previous) => previous === current.section.id ? previous : current.section.id);
        const nextInsight = readAssistInsight(current.element, lang);
        setActiveInsight((previous) => JSON.stringify(previous) === JSON.stringify(nextInsight) ? previous : nextInsight);
      }
      revealResultIfReady();
    };
    const scheduleSync = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(syncCurrentSection);
    };
    scheduleSync();
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    const observer = typeof MutationObserver === "undefined" ? null : new MutationObserver(() => {
      scheduleSync();
      revealResultIfReady();
    });
    observer?.observe(document.getElementById("content") || document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: [
        "data-assist-title-ko",
        "data-assist-title-en",
        "data-assist-summary-ko",
        "data-assist-summary-en",
        "data-assist-actions-ko",
        "data-assist-actions-en",
      ],
    });
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
      observer?.disconnect();
    };
  }, [sections, lang]);

  const scrollToSection = (id, source) => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    trackProductEvent("tool_assist_jump", { tool_id: toolId, section_id: id, source, locale: lang });
  };

  const toggle = () => {
    setIsOpen((open) => !open);
    setHasNewContext(false);
    trackProductEvent("tool_assist_toggle", { tool_id: toolId, state: isOpen ? "closed" : "open", locale: lang });
  };

  if (!sourceTool) return null;

  return (
    <aside className={`tool-assist-rail ${isOpen ? "is-open" : ""}`} aria-label={T.open}>
      <button className="tool-assist-rail__toggle" type="button" onClick={toggle} aria-expanded={isOpen} aria-controls={`tool-assist-${toolId}`} aria-label={isOpen ? T.close : `${T.open}: ${copyFor(activeSection.title, lang)}`}>
        <span aria-hidden="true">✦</span>
        <b><small>{isOpen ? T.close : T.current}</small>{isOpen ? "" : copyFor(activeSection.title, lang)}</b>
        {hasNewContext && !isOpen && <i>{T.resultReady}</i>}
      </button>
      <div className="tool-assist-rail__panel" id={`tool-assist-${toolId}`} aria-hidden={!isOpen}>
        <header>
          <span>{T.eyebrow}</span>
          <strong>{sourceTool.title}</strong>
        </header>
        <div className="tool-assist-rail__context">
          <small>{T.current}</small>
          <h2>{activeInsight?.title || copyFor(activeSection.title, lang) || T.defaultTitle}</h2>
          <p>{activeInsight?.summary || copyFor(activeSection.body, lang) || T.defaultBody}</p>
          {activeInsight?.actions?.length > 0 && (
            <div className="tool-assist-rail__recommendations">
              <small>{T.recommendations}</small>
              <ol>{activeInsight.actions.map((action) => <li key={action}>{action}</li>)}</ol>
            </div>
          )}
          <button type="button" onClick={() => scrollToSection(activeSection.id, "current_context")}>{activeInsight ? T.evidence : T.jump} <span aria-hidden="true">↓</span></button>
        </div>
        <div className="tool-assist-rail__actions">
          {!activeInsight && (
            <button type="button" onClick={() => scrollToSection(quickActionTarget, "support_action")}>
              {isDashboardDemo ? T.replaceSample : quickActionTarget === "dashboard-support-tools" ? T.support : quickActionTarget === "dashboard-data-setup" ? T.prepare : T.mapping}
            </button>
          )}
          {nextTool && !isDashboardDemo ? (
            <Link href={nextTool.href} onClick={() => trackProductEvent("tool_assist_next", { tool_id: nextTool.id, source_tool_id: toolId, locale: lang })}>
              <span>{T.next}</span>
              <strong>{nextTool.title}</strong>
              <b aria-hidden="true">→</b>
            </Link>
          ) : <p>{T.noNext}</p>}
        </div>
      </div>
    </aside>
  );
}

export { ASSIST_SECTIONS, getSections };
