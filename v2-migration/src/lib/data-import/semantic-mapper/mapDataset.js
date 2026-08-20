import { canonicalFieldForLegacyKey } from "../schema/legacyFieldMigration";
import { CANONICAL_FIELDS } from "../schema/canonicalFields";

const normalizeHeaderKey = (header) => String(header || "")
  .normalize("NFKC")
  .trim()
  .toLowerCase()
  .replace(/[\s-]+/g, "_");

// Phase 0 기준선. 이 함수는 현재 업로드 경로에 연결하지 않으며, rows를 읽거나
// 반환하지 않는다. 다음 scorer 단계가 calibration되기 전에는 exact legacy key만
// SUGGEST로 내고 나머지는 UNKNOWN으로 abstain한다.
export function mapDataset({ headers = [] } = {}) {
  const bindings = headers.map((sourceColumn) => {
    const migration = canonicalFieldForLegacyKey(normalizeHeaderKey(sourceColumn));
    const field = migration ? CANONICAL_FIELDS[migration.canonicalKey] : null;
    return {
      schemaVersion: 2,
      sourceColumn,
      canonicalKey: field?.key || null,
      role: field?.family || "UNKNOWN",
      confidence: field ? 1 : 0,
      // exact legacy key도 아직 automatic selection으로 쓰지 않는다.
      decision: field ? "SUGGEST" : "UNKNOWN",
      evidence: field ? [{ kind: "migration", code: "EXACT_LEGACY_KEY" }] : [],
      member: migration?.memberHint ? { kind: migration.memberHint } : null,
      unit: null,
      window: migration?.window || null,
      source: "phase0_baseline",
      modelVersion: "semantic-mapper-0.1.0",
    };
  });

  return {
    schemaVersion: 2,
    bindings,
    unresolvedHeaders: bindings.filter((binding) => binding.decision === "UNKNOWN").map((binding) => binding.sourceColumn),
  };
}
