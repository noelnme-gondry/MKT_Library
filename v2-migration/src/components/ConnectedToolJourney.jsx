"use client";

import Link from "next/link";

import ToolTemplateAction from "@/components/ds/ToolTemplateAction";
import { trackProductEvent } from "@/lib/analytics";
import { TOOL_JOURNEY, localizedTool } from "@/lib/toolConnections";

const COPY = {
  ko: {
    eyebrow: "CONNECTED WORKFLOW",
    title: "도구 하나로 끝내지 않고, 판단 다음 단계까지",
    deck: "상태를 보고 원인을 설명한 뒤, 조치를 고르고 효과를 검증합니다. 각 질문에 맞는 도구가 자연스럽게 이어집니다.",
    open: "열기",
    startAnywhere: "원하는 단계에서 시작",
    template: "이 단계의 입력 형식",
  },
  en: {
    eyebrow: "CONNECTED WORKFLOW",
    title: "Move from one analysis to the next decision",
    deck: "Monitor the signal, explain the cause, choose an action, prove the effect, and turn it into reusable learning.",
    open: "Open",
    startAnywhere: "Start at any stage",
    template: "Input format for this stage",
  },
};

export default function ConnectedToolJourney({ locale = "ko" }) {
  const lang = locale === "en" ? "en" : "ko";
  const T = COPY[lang];

  return (
    <section className="connected-tool-journey" aria-labelledby="connected-tool-journey-title">
      <header className="connected-tool-journey__head">
        <span>{T.eyebrow}</span>
        <h2 id="connected-tool-journey-title">{T.title}</h2>
        <p>{T.deck}<br /><strong>{T.startAnywhere}</strong></p>
      </header>
      <div className="connected-tool-journey__stages">
        {TOOL_JOURNEY.map((stage) => (
          <article className="connected-tool-stage" key={stage.id}>
            <div className="connected-tool-stage__head">
              <span>{stage.label[lang]}</span>
              <h3>{stage.title[lang]}</h3>
              <p>{stage.description[lang]}</p>
            </div>
            <div className="connected-tool-stage__tools">
              {stage.tools.map((toolId) => {
                const tool = localizedTool(toolId, lang);
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
                    <span className="connected-tool-card__id">{tool.id}</span>
                    <strong>{tool.title}</strong>
                    <p>{tool.question}</p>
                    <b>{T.open} <span aria-hidden="true">→</span></b>
                  </Link>
                );
              })}
            </div>
            <ToolTemplateAction
              toolId={stage.tools[0]}
              locale={lang}
              compact
              reason={T.template}
              source={`journey_${stage.id}`}
            />
          </article>
        ))}
      </div>
    </section>
  );
}
