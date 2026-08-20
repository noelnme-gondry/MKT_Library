import { buildCanonicalDataset } from "./buildCanonicalDataset";
import { buildMappingContract } from "./mappingContract";
import { buildLegacyRows } from "./canonical-v2/buildLegacyRows";
import { buildCanonicalDatasetV2 } from "./canonical-v2/buildCanonicalDatasetV2";
import { mapDataset } from "./semantic-mapper/mapDataset";

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
  const mappingContract = buildMappingContract({ toolId, headers, rows: raw, source });
  const mapping = mappingContract.mapping;
  const semanticMapping = mapDataset({ headers, rows: raw });
  return {
    raw,
    headers,
    mapping,
    fileName: `${source}_${toolId}`,
    importInsights: { ...mappingContract, selections: mapping, handoff: true },
    mappingContract,
    canonicalData: buildCanonicalDataset({ raw, headers, mapping }),
    mappedRows: buildLegacyRows({ raw, legacyMapping: mapping, semanticBindings: semanticMapping.bindings, toolId }),
    mappingBindingsV2: semanticMapping.bindings,
    canonicalDataV2: buildCanonicalDatasetV2({ raw, headers, bindings: semanticMapping.bindings, valueBindingRecipes: semanticMapping.valueBindingRecipes, representation: semanticMapping.profile.representation }),
  };
}
