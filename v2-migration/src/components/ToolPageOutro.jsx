"use client";

import ToolConnections from "@/components/ToolConnections";
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
  const lang = locale === "en" ? "en" : "ko";
  const T = COPY[lang];
  const hasConnections = withConnections && getNextTools(toolId, lang).length > 0;
  const hasLongform = Boolean(getToolSearchContent(toolId, lang));
  const hasEvidence = evidenceLinks.length > 0;
  if (!hasConnections && !hasLongform && !hasEvidence) return null;

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
