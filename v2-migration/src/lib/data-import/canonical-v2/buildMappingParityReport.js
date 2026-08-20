import { canonicalFieldForLegacyKey } from "../schema/legacyFieldMigration";

// 개발·테스트에서만 V1/V2가 어떤 헤더에서 다르게 해석했는지 확인한다. 원본 값,
// 파일명, 행 번호는 결과에 포함하지 않아 telemetry payload로 전용될 여지가 없다.
export function buildMappingParityReport({ legacyMapping = {}, bindings = [] } = {}) {
  const bindingByHeader = Object.fromEntries(bindings.map((binding) => [binding.sourceColumn, binding]));
  const comparisons = Object.entries(legacyMapping).map(([sourceColumn, legacyKey]) => {
    const legacy = legacyKey && legacyKey !== "__ignore__" ? canonicalFieldForLegacyKey(legacyKey) : null;
    const semantic = bindingByHeader[sourceColumn] || null;
    return {
      sourceColumn,
      legacyCanonicalKey: legacy?.canonicalKey || null,
      semanticCanonicalKey: semantic?.canonicalKey || null,
      matches: (legacy?.canonicalKey || null) === (semantic?.canonicalKey || null),
    };
  });
  return {
    comparedColumnCount: comparisons.length,
    matchCount: comparisons.filter((item) => item.matches).length,
    mismatchCount: comparisons.filter((item) => !item.matches).length,
    comparisons,
  };
}
