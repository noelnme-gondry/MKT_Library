"use client";

import Link from "next/link";

import ToolTemplateAction from "@/components/ds/ToolTemplateAction";
import { trackProductEvent } from "@/lib/analytics";
import { getJourneyContext, getNextTools } from "@/lib/toolConnections";

const COPY = {
  ko: {
    eyebrow: "NEXT DECISION",
    title: "이 분석 다음에는 무엇을 확인할까요?",
    deck: "결과를 다음 판단으로 이어가세요. 첫 번째 카드는 지금 흐름에서 가장 가까운 다음 단계입니다.",
    recommended: "추천 다음 단계",
    sameData: "같은 CSV로 이어보기",
    newData: "새 데이터 준비",
    back: "앞 단계로",
    here: "같은 단계에서",
    forward: "다음 단계로",
    cycle: "다음 운영 주기",
    mapDeck: "어디서 시작해도 괜찮습니다. 앞뒤 단계와 같은 단계의 다른 도구로 자유롭게 이동하세요.",
    templateReason: "새 데이터가 필요한 다음 분석을 위해 템플릿을 미리 준비하세요",
  },
  en: {
    eyebrow: "NEXT DECISION",
    title: "What should you check after this analysis?",
    deck: "Carry the result into the next decision. The first card is the closest next step in this workflow.",
    recommended: "Recommended next step",
    sameData: "Continue with the same CSV",
    newData: "Prepare a new dataset",
    back: "Previous stage",
    here: "Same-stage options",
    forward: "Next stage",
    cycle: "Next operating cycle",
    mapDeck: "Start anywhere, then move freely to the previous, next, or an alternative tool in the same stage.",
    templateReason: "Prepare the mapping template for a next analysis that needs a new dataset",
  },
};

export default function ToolConnections({ toolId, locale = "ko" }) {
  const lang = locale === "en" ? "en" : "ko";
  const nextTools = getNextTools(toolId, lang);
  const journey = getJourneyContext(toolId, lang);
  if (nextTools.length === 0) return null;
  const T = COPY[lang];
  const templateTarget = nextTools.find((tool) => !tool.isSameData);

  return (
    <section className="tool-connections" aria-labelledby={`tool-connections-${toolId}`}>
      <header className="tool-connections__head">
        <span>{T.eyebrow}</span>
        <h2 id={`tool-connections-${toolId}`}>{T.title}</h2>
        <p>{T.deck}</p>
      </header>
      {journey && (
        <div className="tool-connections__map" aria-label={T.mapDeck}>
          <p>{T.mapDeck}</p>
          <div>
            <JourneyLinks label={T.back} tools={journey.previous} sourceToolId={toolId} locale={lang} />
            {journey.alternatives.length > 0 && (
              <JourneyLinks label={T.here} tools={journey.alternatives} sourceToolId={toolId} locale={lang} />
            )}
            <JourneyLinks
              label={journey.isCycleRestart ? T.cycle : T.forward}
              tools={journey.next}
              sourceToolId={toolId}
              locale={lang}
            />
          </div>
        </div>
      )}
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
      {templateTarget && (
        <ToolTemplateAction
          toolId={templateTarget.id}
          locale={lang}
          compact
          reason={T.templateReason}
          source={`connection_from_${toolId}`}
        />
      )}
    </section>
  );
}

function JourneyLinks({ label, tools, sourceToolId, locale }) {
  return (
    <div className="tool-connections__map-group">
      <span>{label}</span>
      <div>
        {tools.map((tool) => (
          <Link
            href={tool.href}
            key={tool.id}
            onClick={() => trackProductEvent("journey_direction_pick", {
              tool_id: tool.id,
              source_tool_id: sourceToolId,
              placement: "journey_map",
              locale,
            })}
          >
            {tool.title}
          </Link>
        ))}
      </div>
    </div>
  );
}
