"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

import { trackProductEvent } from "@/lib/analytics";
import { getNextTools, localizedTool } from "@/lib/toolConnections";

const COPY = {
  ko: {
    open: "분석 도우미 열기",
    close: "분석 도우미 접기",
    eyebrow: "CONTEXT ASSIST",
    current: "지금 보는 단계",
    jump: "이 위치로 이동",
    mapping: "데이터 매핑 확인",
    support: "판단 기록·보조 도구",
    next: "다음 분석으로",
    noNext: "이 도구에서 판단을 정리한 뒤 다음 단계를 선택하세요.",
    defaultTitle: "분석 흐름 안내",
    defaultBody: "현재 화면에서 필요한 입력과 결과를 확인한 뒤, 다음 판단으로 이어가세요.",
  },
  en: {
    open: "Open analysis assistant",
    close: "Collapse analysis assistant",
    eyebrow: "CONTEXT ASSIST",
    current: "Current step",
    jump: "Jump to this section",
    mapping: "Check data mapping",
    support: "Decision log and supporting tools",
    next: "Continue to next analysis",
    noNext: "Review this result, then choose the next decision step.",
    defaultTitle: "Analysis guide",
    defaultBody: "Check the inputs and result in view, then continue to the next decision.",
  },
};

const ASSIST_SECTIONS = {
  "5-2": [
    { id: "dashboard-tabpanel", title: ["현재 탭 결과 읽기", "Read the active tab"], body: ["지표를 확인한 뒤 원인이 필요하면 성과 변동 탐지로 이어가세요.", "Review the metric, then move to variance analysis when you need the cause."] },
    { id: "dashboard-support-tools", title: ["판단 기록과 다음 분석", "Decision log and next analysis"], body: ["이번 결론을 남기고, 같은 데이터로 다음 분석을 이어갈 수 있습니다.", "Save this conclusion and continue with the same dataset."] },
  ],
  "5-21": [
    { id: "s-prep", title: ["변동 데이터 준비", "Prepare variance data"], body: ["채널·캠페인·소재 단위가 함께 있어야 원인을 정확히 나눌 수 있습니다.", "Channel, campaign, and creative fields let you separate the cause accurately."] },
    { id: "s-pvm-result", title: ["변동 원인 읽기", "Read the variance cause"], body: ["물량·효율·믹스 중 먼저 조치할 원인을 고른 뒤 예산 또는 소재로 이동하세요.", "Choose the first cause to act on—volume, efficiency, or mix—then move to budget or creative work."] },
  ],
  "5-22": [
    { id: "s-prep", title: ["포화도 입력 준비", "Prepare saturation inputs"], body: ["비용과 성과가 같은 기간·같은 단위로 묶여 있는지 먼저 확인하세요.", "Confirm cost and outcomes use the same period and grain first."] },
    { id: "s-sat-summary", title: ["증액 여지 판단", "Decide scaling headroom"], body: ["여유와 포화를 구분한 뒤, 실제 금액 배분은 예산 배분에서 검증하세요.", "Separate headroom from saturation, then validate the amount in Budget allocation."] },
  ],
  "5-3": [
    { id: "s-prep", title: ["배분 기준 준비", "Prepare allocation inputs"], body: ["목표 지표와 가용 예산을 먼저 맞추면 시뮬레이션이 흔들리지 않습니다.", "Set the target metric and available budget before simulating."] },
    { id: "s-scenario", title: ["배분 시나리오 비교", "Compare allocation scenarios"], body: ["한 번에 크게 옮기기보다, 다음 검증을 위한 보수적 시나리오도 함께 비교하세요.", "Compare a conservative scenario for the next validation alongside a large move."] },
  ],
  "9-6": [
    { id: "s-prep", title: ["소재 데이터 준비", "Prepare creative data"], body: ["소재 ID·날짜·비용·성과가 있어야 피로와 교체 우선순위를 함께 볼 수 있습니다.", "Creative ID, date, spend, and outcome are needed to read fatigue and replacement priority together."] },
    { id: "s-creative-hero", title: ["교체 우선순위", "Replacement priority"], body: ["교체할 소재를 고른 뒤, 다음 가설은 실험 분석에서 검증하세요.", "Choose what to replace, then validate the next hypothesis in Experiment analysis."] },
  ],
  "5-4": [
    { id: "s-mode", title: ["실험 방식 선택", "Choose an experiment mode"], body: ["설계와 판독 중 지금 필요한 일을 고르면, 필요한 입력만 남습니다.", "Choose design or readout to keep only the inputs you need now."] },
    { id: "s-readout-sig", title: ["효과 판독", "Read the effect"], body: ["유의하지 않은 결과는 효과 없음이 아니라 판단 보류입니다. 다음 실험 조건을 기록하세요.", "A non-significant result is inconclusive, not no effect. Record the next test condition."] },
  ],
  "5-23": [
    { id: "s-prep", title: ["증분 측정 준비", "Prepare incrementality measurement"], body: ["비교군과 기간 정의가 먼저입니다. 관찰 성과만으로 증분을 단정하지 마세요.", "Define the comparison group and period first; do not infer incrementality from observed outcomes alone."] },
  ],
  "5-18": [
    { id: "s-prep", title: ["반응 데이터 준비", "Prepare response data"], body: ["주차 단위와 채널별 비용·성과가 맞아야 반응을 안정적으로 읽을 수 있습니다.", "Align weekly grain with channel cost and outcome to read response reliably."] },
    { id: "s-forecast", title: ["예측과 다음 조치", "Forecast and next action"], body: ["예측은 방향을 정하는 근거입니다. 실제 증분은 별도 실험으로 확인하세요.", "Use the forecast to choose direction; verify true incrementality with a separate experiment."] },
  ],
  "5-20": [
    { id: "s-prep", title: ["이벤트 데이터 준비", "Prepare event data"], body: ["사용자·이벤트·시간이 연결되어야 초기 행동과 잔존의 관계를 찾을 수 있습니다.", "User, event, and time need to connect to find early actions tied to retention."] },
    { id: "s-aha-hero", title: ["핵심 행동 해석", "Interpret the key action"], body: ["발견한 행동은 가설입니다. 온보딩 또는 실험 설계로 다음 검증을 이어가세요.", "The discovered action is a hypothesis. Continue with onboarding or experiment design to validate it."] },
  ],
  "9-1": [
    { id: "s-prep", title: ["콘텐츠 요소 준비", "Prepare content elements"], body: ["요소가 구분된 콘텐츠 단위와 성과 지표를 맞추면 비교가 선명해집니다.", "Align element-level content data with an outcome metric for a clear comparison."] },
  ],
};

function copyFor(value, lang) {
  return value[lang === "en" ? 1 : 0];
}

function getSections(toolId) {
  return ASSIST_SECTIONS[toolId] || [{ id: "s-prep", title: ["데이터 준비", "Prepare data"], body: ["입력 항목을 확인한 뒤 분석을 시작하세요.", "Confirm the input fields before starting analysis."] }];
}

export default function ToolAssistRail({ toolId, locale = "ko" }) {
  const lang = locale === "en" ? "en" : "ko";
  const T = COPY[lang];
  const sections = useMemo(() => getSections(toolId), [toolId]);
  const [isOpen, setIsOpen] = useState(false);
  const [activeSectionId, setActiveSectionId] = useState(sections[0].id);
  const nextTool = getNextTools(toolId, lang)[0] || null;
  const sourceTool = localizedTool(toolId, lang);
  const activeSection = sections.find((section) => section.id === activeSectionId) || sections[0];

  useEffect(() => {
    let frameId = 0;
    const syncCurrentSection = () => {
      const nearest = sections
        .map((section) => ({ section, element: document.getElementById(section.id) }))
        .filter(({ element }) => element)
        .sort((a, b) => Math.abs(a.element.getBoundingClientRect().top - window.innerHeight * 0.34) - Math.abs(b.element.getBoundingClientRect().top - window.innerHeight * 0.34))[0];
      if (nearest) setActiveSectionId((current) => current === nearest.section.id ? current : nearest.section.id);
    };
    const scheduleSync = () => {
      cancelAnimationFrame(frameId);
      frameId = requestAnimationFrame(syncCurrentSection);
    };
    scheduleSync();
    window.addEventListener("scroll", scheduleSync, { passive: true });
    window.addEventListener("resize", scheduleSync);
    return () => {
      cancelAnimationFrame(frameId);
      window.removeEventListener("scroll", scheduleSync);
      window.removeEventListener("resize", scheduleSync);
    };
  }, [sections]);

  const scrollToSection = (id, source) => {
    const target = document.getElementById(id);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    trackProductEvent("tool_assist_jump", { tool_id: toolId, section_id: id, source, locale: lang });
  };

  const toggle = () => {
    setIsOpen((open) => !open);
    trackProductEvent("tool_assist_toggle", { tool_id: toolId, state: isOpen ? "closed" : "open", locale: lang });
  };

  if (!sourceTool) return null;

  return (
    <aside className={`tool-assist-rail ${isOpen ? "is-open" : ""}`} aria-label={T.open}>
      <button className="tool-assist-rail__toggle" type="button" onClick={toggle} aria-expanded={isOpen} aria-controls={`tool-assist-${toolId}`}>
        <span aria-hidden="true">✦</span>
        <b>{isOpen ? T.close : T.open}</b>
      </button>
      <div className="tool-assist-rail__panel" id={`tool-assist-${toolId}`} aria-hidden={!isOpen}>
        <header>
          <span>{T.eyebrow}</span>
          <strong>{sourceTool.title}</strong>
        </header>
        <div className="tool-assist-rail__context">
          <small>{T.current}</small>
          <h2>{copyFor(activeSection.title, lang) || T.defaultTitle}</h2>
          <p>{copyFor(activeSection.body, lang) || T.defaultBody}</p>
          <button type="button" onClick={() => scrollToSection(activeSection.id, "current_context")}>{T.jump} <span aria-hidden="true">↓</span></button>
        </div>
        <div className="tool-assist-rail__actions">
          <button type="button" onClick={() => scrollToSection(toolId === "5-2" ? "dashboard-support-tools" : "s-prep", "support_action")}>
            {toolId === "5-2" ? T.support : T.mapping}
          </button>
          {nextTool ? (
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
