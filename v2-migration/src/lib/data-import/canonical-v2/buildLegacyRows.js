import { mapRowsToStandard } from "@/utils/mappedRows";
import { isSummaryRow } from "../buildCanonicalDataset";
import { normalizeDateLabel } from "../normalizeValues";
import { projectSemanticBindingsToLegacyMapping } from "./legacyProjection";

// 전환기 adapter의 책임은 기존 엔진 입력 shape를 보존하는 것이다. V2 binding으로
// 레거시 키를 새로 추측하지 않고, 사용자가 확정한 V1 mapping을 그대로 받는다.
export function buildLegacyRows({ raw = [], legacyMapping = {}, semanticBindings = [], toolId } = {}) {
  const mapping = projectSemanticBindingsToLegacyMapping({ toolId, legacyMapping, bindings: semanticBindings });
  const headers = Object.keys(mapping);
  const dateHeaders = headers.filter((header) => mapping[header] === "date");
  const analysisRows = raw.filter((row) => {
    if (isSummaryRow(row, { headers: Object.keys(row || {}), mapping })) return false;
    // canonical에는 오류 진단을 위해 invalid-date record를 남기지만, 계산용 projection에는
    // 유효한 기준 날짜가 있는 행만 넣는다. 그렇지 않으면 주의 배너와 실제 KPI가 갈라진다.
    return !dateHeaders.length || dateHeaders.some((header) => normalizeDateLabel(row?.[header]));
  });
  return mapRowsToStandard(analysisRows, mapping);
}
