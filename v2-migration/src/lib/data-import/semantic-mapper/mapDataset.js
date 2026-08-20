import { profileDatasetV2 } from "../profiler/profileDataset";
import { canonicalFieldForLegacyKey } from "../schema/legacyFieldMigration";
import { resolveSemanticBindings } from "./resolveBindings";
import { scoreSemanticCandidates } from "./scoreCandidates";

const normalizeHeaderKey = (header) => String(header || "")
  .normalize("NFKC")
  .trim()
  .toLowerCase()
  .replace(/[\s-]+/g, "_");

// V0 scorer는 전역 registry만 후보로 사용한다. toolId는 의도적으로 받지 않으며,
// 원본 행은 profiling 중에만 메모리에서 읽고 결과 객체에는 포함하지 않는다.
export function mapDataset({ headers = [], rows = [] } = {}) {
  const profile = profileDatasetV2({ headers, rows });
  const candidatesByHeader = Object.fromEntries(profile.columns.map((column) => [column.header, scoreSemanticCandidates(column, profile.columns)]));
  const bindings = resolveSemanticBindings({ headers, candidatesByHeader }).map((binding) => {
    const migration = canonicalFieldForLegacyKey(normalizeHeaderKey(binding.sourceColumn));
    return {
      schemaVersion: 2,
      ...binding,
      member: migration?.canonicalKey === binding.canonicalKey && migration.memberHint ? { kind: migration.memberHint } : null,
      unit: null,
      window: migration?.canonicalKey === binding.canonicalKey ? migration.window || null : null,
      source: "semantic_mapper_v0",
      modelVersion: "semantic-mapper-0.1.0",
    };
  });

  return {
    schemaVersion: 2,
    profile,
    candidatesByHeader,
    bindings,
    unresolvedHeaders: bindings.filter((binding) => binding.decision === "UNKNOWN").map((binding) => binding.sourceColumn),
  };
}
