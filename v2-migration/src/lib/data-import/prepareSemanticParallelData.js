import { buildCanonicalDatasetV2 } from "./canonical-v2/buildCanonicalDatasetV2";
import { mapDataset } from "./semantic-mapper/mapDataset";

// 자체 업로더를 가진 도구도 공용 CsvUploader와 같은 V2 shadow contract를 만든다.
// 기존 mapping과 엔진 입력은 호출자가 계속 소유한다.
export function prepareSemanticParallelData({ headers = [], raw = [] } = {}) {
  const semanticMapping = mapDataset({ headers, rows: raw });
  return {
    semanticMapping,
    mappingBindingsV2: semanticMapping.bindings,
    canonicalDataV2: buildCanonicalDatasetV2({ raw, headers, bindings: semanticMapping.bindings, valueBindingRecipes: semanticMapping.valueBindingRecipes, representation: semanticMapping.profile.representation }),
  };
}
