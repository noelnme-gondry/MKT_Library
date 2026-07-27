import Link from "next/link";

import { TOOL_JOURNEY, localizedTool } from "@/lib/toolConnections";

const COPY = {
  ko: {
    eyebrow: "CONNECTED WORKFLOW",
    title: "도구 하나로 끝내지 않고, 판단 다음 단계까지",
    deck: "상태를 보고 원인을 설명한 뒤, 조치를 고르고 효과를 검증합니다. 각 질문에 맞는 도구가 자연스럽게 이어집니다.",
    open: "열기",
  },
  en: {
    eyebrow: "CONNECTED WORKFLOW",
    title: "Move from one analysis to the next decision",
    deck: "Monitor the signal, explain the cause, choose an action, prove the effect, and turn it into reusable learning.",
    open: "Open",
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
        <p>{T.deck}</p>
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
                  <Link className="connected-tool-card" href={tool.href} key={tool.id}>
                    <span className="connected-tool-card__id">{tool.id}</span>
                    <strong>{tool.title}</strong>
                    <p>{tool.question}</p>
                    <b>{T.open} <span aria-hidden="true">→</span></b>
                  </Link>
                );
              })}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
