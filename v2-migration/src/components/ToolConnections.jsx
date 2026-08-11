"use client";

import Link from "next/link";

import ToolTemplateAction from "@/components/ds/ToolTemplateAction";
import { trackProductEvent } from "@/lib/analytics";
import { getJourneyContext, getNextTools, localizedTool } from "@/lib/toolConnections";

const COPY = {
  ko: {
    recommended: "일반적인 다음 단계",
    connected: "연결 분석",
    afterVerdict: "판정 후 선택",
    sameData: "같은 CSV로 이어보기",
    newData: "새 데이터 준비",
    back: "앞 단계로",
    here: "같은 단계에서",
    forward: "다음 단계로",
    cycle: "다음 운영 주기",
    mapDeck: "전체 분석 여정",
    templateReason: "새 데이터가 필요한 다음 분석을 위해 템플릿을 미리 준비하세요",
    expand: "전체 여정",
  },
  en: {
    recommended: "Common next step",
    connected: "Connected analysis",
    afterVerdict: "Choose after the verdict",
    sameData: "Continue with the same CSV",
    newData: "Prepare a new dataset",
    back: "Previous stage",
    here: "Same-stage options",
    forward: "Next stage",
    cycle: "Next operating cycle",
    mapDeck: "Full analysis journey",
    templateReason: "Prepare the mapping template for a next analysis that needs a new dataset",
    expand: "Full journey",
  },
};

export default function ToolConnections({ toolId, locale = "ko" }) {
  const lang = locale === "en" ? "en" : "ko";
  const nextTools = getNextTools(toolId, lang);
  const journey = getJourneyContext(toolId, lang);
  const sourceTool = localizedTool(toolId, lang);
  if (nextTools.length === 0) return null;
  const T = COPY[lang];
  const isVerdictDependent = toolId === "5-25";
  const templateTarget = nextTools.find((tool) => !tool.isSameData);
  // 상단 레일은 "바로 갈 곳" 두 개만 보여주고, 나머지 경로는 접어서 제공한다.
  // 고정 폭 카드 3개가 좁은 도구 셸 밖으로 밀리던 문제를 없애며 선택 부담도 줄인다.
  const visibleNextTools = nextTools.slice(0, 2);

  return (
    <section className="tool-connections tool-connections--rail" aria-labelledby={`tool-connections-${toolId}`}>
      <header className="tool-connections__head">
        <h2 id={`tool-connections-${toolId}`}>{journey?.stage.title[lang] || sourceTool?.title}</h2>
      </header>
      <div className="tool-connections__grid">
        {visibleNextTools.map((tool, index) => (
          <Link
            className={`tool-connection-card ${index === 0 && !isVerdictDependent ? "is-recommended" : ""}`}
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
              <span>{isVerdictDependent ? T.afterVerdict : index === 0 ? T.recommended : T.connected}</span>
              <em className={tool.isSameData ? "is-same-data" : ""}>
                {tool.isSameData ? T.sameData : T.newData}
              </em>
            </div>
            <strong>{tool.title}</strong>
            <b aria-hidden="true">→</b>
          </Link>
        ))}
      </div>
      <details className="tool-connections__more">
        <summary>{T.expand} <span aria-hidden="true">＋</span></summary>
        {journey && (
          <div className="tool-connections__map" aria-label={T.mapDeck}>
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
        {templateTarget && (
          <ToolTemplateAction
            toolId={templateTarget.id}
            locale={lang}
            compact
            reason={T.templateReason}
            source={`connection_from_${toolId}`}
          />
        )}
      </details>
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
