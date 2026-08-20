import { TOOL_OPTIONAL_FIELDS, TOOL_REQUIRED_FIELDS } from "@/utils/csvConstants";
import { LEGACY_FIELD_MIGRATIONS } from "../schema/legacyFieldMigration";

function keysFromContract(toolId) {
  const keys = new Set();
  (TOOL_REQUIRED_FIELDS[toolId] || []).forEach((field) => {
    if (typeof field === "string") keys.add(field);
    else field?.oneOf?.forEach((key) => keys.add(key));
  });
  (TOOL_OPTIONAL_FIELDS[toolId] || []).forEach(({ key }) => keys.add(key));
  return keys;
}

function legacyKeysForCanonical(canonicalKey, allowedKeys) {
  return Object.entries(LEGACY_FIELD_MIGRATIONS)
    .filter(([, migration]) => migration.canonicalKey === canonicalKey)
    .map(([legacyKey]) => legacyKey)
    .filter((legacyKey) => allowedKeys.has(legacyKey));
}

// V2가 기존 엔진에 닿는 유일한 경계다. 기존 V1 자동 매핑은 전환 기간 동안
// 유지하되, 사용자가 V2 역할을 명시적으로 바꾸면 해당 컬럼만 같은 의미의 V1
// 키로 투영한다. 지원하지 않는 semantic role은 억지로 legacy 키를 만들지 않는다.
export function projectSemanticBindingsToLegacyMapping({ toolId, legacyMapping = {}, bindings = [] } = {}) {
  const allowedKeys = keysFromContract(toolId);
  const projected = { ...legacyMapping };
  for (const binding of bindings) {
    if (binding?.source !== "user") continue;
    const sourceColumn = binding.sourceColumn;
    if (!sourceColumn) continue;
    if (!binding.canonicalKey || binding.decision === "UNKNOWN") {
      projected[sourceColumn] = "__ignore__";
      continue;
    }
    const candidates = legacyKeysForCanonical(binding.canonicalKey, allowedKeys);
    // V2에서 사용자가 고른 역할을 V1 엔진이 소비하지 못하면, 이전 V1 선택을
    // 그대로 두어 다른 의미의 열로 계산하지 않는다. 이 경우 V2 eligibility가
    // 분석을 막고 역할을 다시 확인하게 한다.
    if (!candidates.length) {
      projected[sourceColumn] = "__ignore__";
      continue;
    }
    const existing = projected[sourceColumn];
    projected[sourceColumn] = candidates.includes(existing) ? existing : candidates[0];
  }
  return projected;
}

// V1 project import와 이미 메모리에 있는 업로드는 V2 binding이 없을 수 있다. 이
// fallback은 명시된 migration만 사용해 readiness를 복원하며, 새 업로드의 V2
// UNKNOWN을 덮어쓰지는 않는다.
export function semanticBindingsFromLegacyMapping(legacyMapping = {}) {
  return Object.entries(legacyMapping).flatMap(([sourceColumn, legacyKey]) => {
    const migration = LEGACY_FIELD_MIGRATIONS[legacyKey];
    if (!migration?.canonicalKey) return [];
    return [{
      sourceColumn,
      canonicalKey: migration.canonicalKey,
      role: null,
      decision: "SUGGEST",
      source: "legacy_project_migration",
      member: migration.memberHint ? { kind: migration.memberHint } : null,
      window: migration.window || null,
    }];
  });
}
