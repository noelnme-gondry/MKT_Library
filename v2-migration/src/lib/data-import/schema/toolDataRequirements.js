import { buildCsvToolInventory } from "./toolDataInventory";
import { canonicalFieldForLegacyKey } from "./legacyFieldMigration";

function canonicalRequirement(requirement) {
  const fields = requirement.fields.map(({ legacyKey }) => {
    const migration = canonicalFieldForLegacyKey(legacyKey);
    return { legacyKey, canonicalKey: migration?.canonicalKey || null, window: migration?.window || null };
  });
  return { ...requirement, fields };
}

// V2 tool requirements are derived from the currently-running V1 input
// contract. A null canonicalKey is intentional technical debt, not an inferred
// role; it prevents an unsupported legacy key from silently satisfying V2.
export function buildToolDataRequirements() {
  return Object.fromEntries(buildCsvToolInventory().map((tool) => [tool.toolId, {
    toolId: tool.toolId,
    dataGroup: tool.dataGroup,
    grain: tool.grain,
    requires: tool.requirements.map(canonicalRequirement),
    unmigratedLegacyKeys: tool.requirements.flatMap((requirement) => requirement.fields)
      .map((field) => field.legacyKey)
      .filter((legacyKey) => !canonicalFieldForLegacyKey(legacyKey)),
  }]));
}

export const TOOL_DATA_REQUIREMENTS_V2 = buildToolDataRequirements();

export function evaluateV2Eligibility({ toolId, bindings = [] } = {}) {
  const contract = TOOL_DATA_REQUIREMENTS_V2[toolId];
  if (!contract) return { status: "not_declared", missing: [], unmigratedLegacyKeys: [] };
  const resolved = new Set(bindings.filter((binding) => binding.decision !== "UNKNOWN").map((binding) => binding.canonicalKey).filter(Boolean));
  const missing = contract.requires.filter((requirement) => {
    const eligible = requirement.fields.filter((field) => field.canonicalKey);
    return !eligible.length || !eligible.some((field) => resolved.has(field.canonicalKey));
  });
  return {
    status: missing.length || contract.unmigratedLegacyKeys.length ? "blocked" : "ready",
    missing,
    unmigratedLegacyKeys: contract.unmigratedLegacyKeys,
  };
}
