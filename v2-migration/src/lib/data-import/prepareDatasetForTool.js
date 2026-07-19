import { STANDARD_FIELDS, TOOL_OPTIONAL_FIELDS, TOOL_REQUIRED_FIELDS } from "@/utils/csvConstants";
import { buildCanonicalDataset } from "./buildCanonicalDataset";
import { scoreMappingCandidates } from "./scoreMappingCandidates";

export function toolFieldKeys(toolId) {
  const keys = new Set();
  (TOOL_REQUIRED_FIELDS[toolId] || []).forEach((field) => {
    if (typeof field === "string") keys.add(field);
    field?.oneOf?.forEach((key) => keys.add(key));
  });
  (TOOL_OPTIONAL_FIELDS[toolId] || []).forEach(({ key }) => keys.add(key));
  return [...keys];
}

// 같은 원본을 다른 분석 도구로 넘길 때, 그 도구가 이해하는 필드만 다시 자동 매핑한다.
// 원본 행은 복사해 서버에 보내지 않으며, 활성 도구의 선택값만 새로 만든다.
export function prepareDatasetForTool({ raw = [], headers = [], toolId, source = "handoff" } = {}) {
  const scored = scoreMappingCandidates({ headers, rows: raw, allowedKeys: toolFieldKeys(toolId), fields: STANDARD_FIELDS });
  const mapping = scored.selections;
  return {
    raw,
    headers,
    mapping,
    fileName: `${source}_${toolId}`,
    importInsights: { profiles: scored.profiles, candidates: scored.candidates, conflicts: scored.conflicts, selections: mapping, handoff: true },
    canonicalData: buildCanonicalDataset({ raw, headers, mapping }),
  };
}
