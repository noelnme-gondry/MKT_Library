import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { buildLegacyRows } from "@/lib/data-import/canonical-v2/buildLegacyRows";
import { prepareDatasetForTool } from "@/lib/data-import/prepareDatasetForTool";

// 도치 작업대와 우측 하단 도치가 같은 매핑을 상세 도구로 넘기는 단일 경로다.
// 원본은 브라우저 메모리의 csvData에만 남고, 대상 도구 그룹에 필요한 파생본만 만든다.
export function applyGlobalMapping(prepared, globalMapping = {}, toolId) {
  const mapping = { ...prepared.mapping };
  Object.entries(globalMapping).forEach(([header, field]) => {
    if (field && field !== "__ignore__") mapping[header] = field;
  });
  return {
    ...prepared,
    mapping,
    canonicalData: buildCanonicalDataset({ raw: prepared.raw, headers: prepared.headers, mapping }),
    mappedRows: buildLegacyRows({ raw: prepared.raw, legacyMapping: mapping, semanticBindings: prepared.mappingBindingsV2, toolId }),
  };
}

export function prepareAnalysisHandoff(csvData, toolId) {
  const prepared = prepareDatasetForTool({
    raw: csvData.raw,
    headers: csvData.headers,
    toolId,
    source: csvData.fileName || "dataset",
  });
  return applyGlobalMapping(prepared, csvData.mapping, toolId);
}
