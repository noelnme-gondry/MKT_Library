"use client";

import ToolConnections from "@/components/ToolConnections";
import ProjectHandoffNote from "@/components/ProjectHandoffNote";
import ToolContinuityIndex from "@/components/ToolContinuityIndex";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { useAppStore } from "@/store/useDataStore";
import ToolEvidenceLinks from "@/components/ToolEvidenceLinks";
import ToolLongform from "@/components/ToolLongform";
import { getNextTools } from "@/lib/toolConnections";
import { getToolSearchContent } from "@/lib/toolSearchContent";

// 페이지 하단 공용 마감 영역.
// 분석 결과(위)와 이동·참고 자료(아래)가 같은 층위로 이어져 "결과가 어디서 끝났는지"
// 알 수 없던 문제를 없앤다. 경계선 하나 + 묶음 박스 하나로 소속을 확정하고,
// 안쪽은 얇은 구분선으로만 나눠 박스가 중첩되지 않게 한다.
const COPY = {
  ko: {
    analysis: "분석 결과는 여기까지",
    reference: "여기부터는 참고 영역",
    hint: "아래는 다음 단계와 참고 자료입니다. 분석 결과에 포함되지 않습니다.",
  },
  en: {
    analysis: "End of analysis",
    reference: "Reference section",
    hint: "Next steps and reference material below. Not part of the analysis result.",
  },
};

export default function ToolPageOutro({ toolId, locale = "ko", evidenceLinks = [], withConnections = false }) {
  // 도구 라우트에서만 "이 결과를 프로젝트로" 안내가 참이다. 가이드·SOP 라우트에는
  // 이어 갈 결과가 없다.
  // 넘길 결과가 없으면 이 안내는 지금 할 수 없는 일을 말한다(§12.17). 판정은
  // 분석 게이트와 같은 기준이고(§12.5), **래퍼를 그리는 여기서** 본다 — 자식만
  // null을 돌려주면 빈 `div.tool-outro__section`이 남는다.
  const isAnalyzed = useAppStore((state) => state.isGroupAnalyzed(toolId));
  const hasHandoff = withConnections && Boolean(TOOL_GROUP[toolId]) && isAnalyzed;
  // 업로드 화면에서 하나를 고르면 나머지 후보가 화면에서 사라진다. 같은 CSV로
  // 이어서 볼 수 있는 것들을 여기서 다시 보여 흐름을 잇는다. 판정이 무거우므로
  // (카탈로그 19개 × 매핑 계약) 분석 게이트 뒤에서만 **마운트**한다 — 훅은
  // 조건부로 못 부르니 게이트를 여기서 쥐어야 한다(§4.4).
  // 자식이 null을 돌려주면 빈 `div.tool-outro__section`이 남는다(PR #885에서
  // 같은 실수를 이미 했다) — 행이 없으면 여기서 미리 접는다.
  const hasRows = useAppStore((state) => state.csvData.raw?.length > 0);
  const hasContinuity = hasHandoff && hasRows;
  const lang = locale === "en" ? "en" : "ko";
  const T = COPY[lang];
  const hasConnections = withConnections && getNextTools(toolId, lang).length > 0;
  const hasLongform = Boolean(getToolSearchContent(toolId, lang));
  const hasEvidence = evidenceLinks.length > 0;
  if (!hasConnections && !hasLongform && !hasEvidence && !hasHandoff && !hasContinuity) return null;

  // 도구 라우트(5-x·9-x)에서만 "분석 결과"라는 말이 참이다. 가이드·SOP 라우트는
  // 위쪽이 분석이 아니므로 경계 문구를 참고 영역 안내로 바꾼다(§8 정직성).
  const boundaryLabel = withConnections ? T.analysis : T.reference;

  // `<footer>`는 body 직계가 아니면 이름 있는 landmark가 되지 않아 보조기술이 경계를
  // 못 읽는다 → 이름 붙은 `<section>`(role=region)으로 통째로 건너뛸 수 있게 한다.
  return (
    <section className="tool-outro" aria-labelledby={`tool-outro-${toolId}`}>
      <p className="tool-outro__boundary">
        <span id={`tool-outro-${toolId}`}>{boundaryLabel}</span>
        <small>{T.hint}</small>
      </p>
      {hasHandoff && (
        <div className="tool-outro__section tool-outro__section--handoff">
          <ProjectHandoffNote toolId={toolId} locale={lang} />
        </div>
      )}
      {hasContinuity && (
        <div className="tool-outro__section tool-outro__section--continuity">
          <ToolContinuityIndex toolId={toolId} locale={lang} />
        </div>
      )}
      {hasConnections && (
        <div className="tool-outro__section tool-outro__section--next">
          <ToolConnections toolId={toolId} locale={lang} />
        </div>
      )}
      {hasLongform && (
        <div className="tool-outro__section tool-outro__section--reference">
          <ToolLongform toolId={toolId} locale={lang} />
        </div>
      )}
      {hasEvidence && (
        <div className="tool-outro__section tool-outro__section--evidence">
          <ToolEvidenceLinks items={evidenceLinks} locale={lang} />
        </div>
      )}
    </section>
  );
}
