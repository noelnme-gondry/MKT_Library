"use client";

import Link from "next/link";

import { trackProductEvent } from "@/lib/analytics";
import { getNextTools } from "@/lib/toolConnections";

const COPY = {
  ko: {
    eyebrow: "NEXT DECISION",
    title: "이 분석 다음에는 무엇을 확인할까요?",
    deck: "결과를 다음 판단으로 이어가세요. 첫 번째 카드는 지금 흐름에서 가장 가까운 다음 단계입니다.",
    recommended: "추천 다음 단계",
    sameData: "같은 CSV로 이어보기",
    newData: "새 데이터 준비",
  },
  en: {
    eyebrow: "NEXT DECISION",
    title: "What should you check after this analysis?",
    deck: "Carry the result into the next decision. The first card is the closest next step in this workflow.",
    recommended: "Recommended next step",
    sameData: "Continue with the same CSV",
    newData: "Prepare a new dataset",
  },
};

export default function ToolConnections({ toolId, locale = "ko" }) {
  const lang = locale === "en" ? "en" : "ko";
  const nextTools = getNextTools(toolId, lang);
  if (nextTools.length === 0) return null;
  const T = COPY[lang];

  return (
    <section className="tool-connections" aria-labelledby={`tool-connections-${toolId}`}>
      <header className="tool-connections__head">
        <span>{T.eyebrow}</span>
        <h2 id={`tool-connections-${toolId}`}>{T.title}</h2>
        <p>{T.deck}</p>
      </header>
      <div className="tool-connections__grid">
        {nextTools.map((tool, index) => (
          <Link
            className={`tool-connection-card ${index === 0 ? "is-recommended" : ""}`}
            href={tool.href}
            key={tool.id}
            onClick={() => trackProductEvent("tool_connection_pick", {
              tool_id: tool.id,
              source_tool_id: toolId,
              source: "analysis_tool",
              placement: "next_decision",
              data_continuity: tool.isSameData ? "same_csv" : "new_data",
              rank: index + 1,
              locale: lang,
            })}
          >
            <div className="tool-connection-card__meta">
              <span>{index === 0 ? T.recommended : tool.id}</span>
              <em className={tool.isSameData ? "is-same-data" : ""}>
                {tool.isSameData ? T.sameData : T.newData}
              </em>
            </div>
            <strong>{tool.title}</strong>
            <p>{tool.question}</p>
            <b aria-hidden="true">→</b>
          </Link>
        ))}
      </div>
    </section>
  );
}
