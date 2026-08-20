const BLOCKED_KEYS = new Set(["__proto__", "constructor", "prototype"]);
import { CANONICAL_FIELDS } from "@/lib/data-import/schema/canonicalFields";
import { canonicalFieldForLegacyKey } from "@/lib/data-import/schema/legacyFieldMigration";

function assertSafe(value, depth = 0) {
  if (depth > 12) throw new Error("PROJECT_TOO_DEEP");
  if (Array.isArray(value)) {
    if (value.length > 500) throw new Error("PROJECT_ARRAY_TOO_LONG");
    value.forEach((item) => assertSafe(item, depth + 1));
  } else if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, child]) => {
      if (BLOCKED_KEYS.has(key)) throw new Error("PROJECT_UNSAFE_KEY");
      assertSafe(child, depth + 1);
    });
  } else if (typeof value === "string" && value.length > 20_000) {
    throw new Error("PROJECT_STRING_TOO_LONG");
  }
}

function migrateV1Binding(sourceColumn, legacyKey) {
  const migration = canonicalFieldForLegacyKey(legacyKey);
  const field = migration?.canonicalKey ? CANONICAL_FIELDS[migration.canonicalKey] : null;
  return {
    schemaVersion: 2,
    sourceColumn: String(sourceColumn),
    canonicalKey: field?.key || null,
    role: field?.family || "UNKNOWN",
    decision: field ? "SUGGEST" : "UNKNOWN",
    member: migration?.memberHint ? { kind: migration.memberHint } : null,
    unit: null,
    window: migration?.window || null,
    source: "project_v1_migration",
    modelVersion: "semantic-mapper-0.1.0",
  };
}

function migrateV1Project(project) {
  const groups = Object.fromEntries(Object.entries(project.groups || {}).map(([group, config]) => [group, {
    ...config,
    mappingBindingsV2: Object.entries(config.mapping || {}).map(([sourceColumn, legacyKey]) => migrateV1Binding(sourceColumn, legacyKey)),
  }]));
  return { ...project, schemaVersion: 2, groups };
}

export function validateProjectFile(project) {
  assertSafe(project);
  if (!project || project.product !== "growthopt-playbook") throw new Error("PROJECT_PRODUCT_MISMATCH");
  if (project.schemaVersion === 1) return migrateV1Project(project);
  if (project.schemaVersion !== 2) throw new Error(project?.schemaVersion > 2 ? "PROJECT_FUTURE_VERSION" : "PROJECT_VERSION_UNSUPPORTED");
  for (const config of Object.values(project.groups || {})) {
    for (const binding of config?.mappingBindingsV2 || []) {
      if (binding?.canonicalKey && !CANONICAL_FIELDS[binding.canonicalKey]) throw new Error("PROJECT_UNKNOWN_CANONICAL_KEY");
    }
  }
  return project;
}
