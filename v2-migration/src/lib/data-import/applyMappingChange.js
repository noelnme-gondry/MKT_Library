import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { buildCanonicalDatasetV2 } from "@/lib/data-import/canonical-v2/buildCanonicalDatasetV2";
import { buildLegacyRows } from "@/lib/data-import/canonical-v2/buildLegacyRows";
import { CANONICAL_FIELDS } from "@/lib/data-import/schema/canonicalFields";
import { canonicalFieldForLegacyKey } from "@/lib/data-import/schema/legacyFieldMigration";

// 사용자가 컬럼 하나의 역할을 바꿨을 때의 슬라이스 갱신. 매핑 편집 화면(CsvUploader)과
// 명령 입력창의 "채널별 — '매체'를 채널로 지정"이 같은 함수를 쓴다 — 두 곳에서 따로 만들면
// V2 바인딩·파생 행 중 하나가 반드시 갈린다(AGENTS §7 메타 4).
export function withMappingChange(csvData, header, value, toolId) {
  const mapping = { ...csvData.mapping, [header]: value };
  const migration = canonicalFieldForLegacyKey(value);
  const bindings = (csvData.mappingBindingsV2 || []).map((binding) => binding.sourceColumn === header ? {
    ...binding,
    canonicalKey: migration?.canonicalKey || null,
    role: migration?.canonicalKey ? CANONICAL_FIELDS[migration.canonicalKey]?.family || "UNKNOWN" : "UNKNOWN",
    decision: migration?.canonicalKey ? "SUGGEST" : "UNKNOWN",
    evidence: migration?.canonicalKey ? [{ kind: "legacy_user", code: "USER_SELECTED_LEGACY_ROLE" }] : [],
    source: "user",
    member: migration?.memberHint ? { kind: migration.memberHint } : null,
    window: migration?.window || null,
  } : binding);
  return {
    ...csvData,
    mapping,
    canonicalData: buildCanonicalDataset({ raw: csvData.raw, headers: csvData.headers, mapping }),
    mappedRows: buildLegacyRows({ raw: csvData.raw, legacyMapping: mapping, semanticBindings: bindings, toolId }),
    mappingBindingsV2: bindings,
    canonicalDataV2: buildCanonicalDatasetV2({ raw: csvData.raw, headers: csvData.headers, bindings, valueBindingRecipes: csvData.semanticMapping?.valueBindingRecipes || [], representation: csvData.semanticMapping?.profile?.representation || "tabular" }),
  };
}
