import { mapRowsToStandard } from "@/utils/mappedRows";
import { projectSemanticBindingsToLegacyMapping } from "./legacyProjection";

// 전환기 adapter의 책임은 기존 엔진 입력 shape를 보존하는 것이다. V2 binding으로
// 레거시 키를 새로 추측하지 않고, 사용자가 확정한 V1 mapping을 그대로 받는다.
export function buildLegacyRows({ raw = [], legacyMapping = {}, semanticBindings = [], toolId } = {}) {
  const mapping = projectSemanticBindingsToLegacyMapping({ toolId, legacyMapping, bindings: semanticBindings });
  return mapRowsToStandard(raw, mapping);
}
