"use client";

import { useRef, useState } from "react";
import Link from "next/link";

import ToolTemplateAction from "@/components/ds/ToolTemplateAction";
import { trackProductEvent } from "@/lib/analytics";
import { TOOL_JOURNEY, localizedTool } from "@/lib/toolConnections";
import { findMeta } from "@/store/useDataStore";
import { trItemTitle } from "@/lib/enNavCopy";

const COPY = {
  ko: {
    eyebrow: "CONNECTED WORKFLOW",
    title: "도구 하나로 끝내지 않고, 판단 다음 단계까지",
    deck: "상태를 보고 원인을 설명한 뒤, 조치를 고르고 효과를 검증합니다. 각 질문에 맞는 도구가 자연스럽게 이어집니다.",
    open: "열기",
    startAnywhere: "원하는 단계에서 시작",
    template: "이 단계의 입력 형식",
    details: "단계별 도구와 입력 형식 보기",
    representative: (title) => `대표 도구 · ${title}`,
    choose: (count) => `${count}개 도구 중 선택`,
  },
  en: {
    eyebrow: "CONNECTED WORKFLOW",
    title: "Move from one analysis to the next decision",
    deck: "Monitor the signal, explain the cause, choose an action, prove the effect, and turn it into reusable learning.",
    open: "Open",
    startAnywhere: "Start at any stage",
    template: "Input format for this stage",
    details: "View tools and input formats by stage",
    representative: (title) => `Representative tool · ${title}`,
    choose: (count) => `Choose from ${count} tools`,
  },
};

export default function ConnectedToolJourney({ locale = "ko" }) {
  const lang = locale === "en" ? "en" : "ko";
  const T = COPY[lang];
  const detailsRef = useRef(null);
  const [isDetailsOpen, setDetailsOpen] = useState(false);
  const openStage = (stage) => {
    if (detailsRef.current) detailsRef.current.open = true;
    setDetailsOpen(true);
    trackProductEvent("connected_workflow_stage_opened", {
      source: "landing",
      placement: "connected_workflow_path",
      tab_name: stage.id,
      locale: lang,
    });
    window.requestAnimationFrame(() => {
      const target = document.getElementById(`connected-tool-stage-${stage.id}`);
      const reduceMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
      target?.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "center" });
      target?.focus?.({ preventScroll: true });
    });
  };

  return (
    <section className="connected-tool-journey" aria-labelledby="connected-tool-journey-title">
      <header className="connected-tool-journey__head">
        <span>{T.eyebrow}</span>
        <h2 id="connected-tool-journey-title">{T.title}</h2>
        <p>{T.deck}<br /><strong>{T.startAnywhere}</strong></p>
      </header>
      <ol className="connected-tool-path">
        {TOOL_JOURNEY.map((stage) => {
          const firstTool = localizedTool(stage.tools[0], lang);
          const content = <>
            <span>{stage.label[lang]}</span>
            <strong>{stage.title[lang]}</strong>
            <p>{stage.description[lang]}</p>
            <small>{stage.tools.length > 1 ? T.choose(stage.tools.length) : T.representative(firstTool.title)} <b aria-hidden="true">→</b></small>
          </>;
          return (
            <li key={stage.id}>
              {stage.tools.length === 1 ? <Link
                href={firstTool.href}
                onClick={() => trackProductEvent("connected_workflow_pick", {
                  tool_id: firstTool.id,
                  source: "landing",
                  placement: "connected_workflow_path",
                  tab_name: stage.id,
                  locale: lang,
                })}
              >
                {content}
              </Link> : <button type="button" aria-controls={`connected-tool-stage-${stage.id}`} aria-expanded={isDetailsOpen} onClick={() => openStage(stage)}>{content}</button>}
            </li>
          );
        })}
      </ol>
      <details ref={detailsRef} className="connected-tool-journey__details" onToggle={(event) => setDetailsOpen(event.currentTarget.open)}>
        <summary>{T.details}</summary>
        <div className="connected-tool-journey__stages">
          {TOOL_JOURNEY.map((stage) => (
            <article className="connected-tool-stage" id={`connected-tool-stage-${stage.id}`} key={stage.id} tabIndex="-1">
            <div className="connected-tool-stage__head">
              <span>{stage.label[lang]}</span>
              <h3>{stage.title[lang]}</h3>
              <p>{stage.description[lang]}</p>
            </div>
            <div className="connected-tool-stage__tools">
              {stage.tools.map((toolId) => {
                const tool = localizedTool(toolId, lang);
                const meta = findMeta(toolId);
                const title = meta ? trItemTitle(toolId, lang, meta.title) : tool.title;
                return (
                  <Link
                    className="connected-tool-card"
                    href={tool.href}
                    key={tool.id}
                    onClick={() => trackProductEvent("connected_workflow_pick", {
                      tool_id: tool.id,
                      source: "landing",
                      placement: "connected_workflow",
                      tab_name: stage.id,
                      locale: lang,
                    })}
                  >
                    <strong>{title}</strong>
                    <p>{tool.question}</p>
                    <b>{T.open} <span aria-hidden="true">→</span></b>
                  </Link>
                );
              })}
            </div>
            {stage.tools.length === 1 && <ToolTemplateAction
              toolId={stage.tools[0]}
              locale={lang}
              compact
              reason={T.template}
              source={`journey_${stage.id}`}
            />}
            </article>
          ))}
        </div>
      </details>
    </section>
  );
}
