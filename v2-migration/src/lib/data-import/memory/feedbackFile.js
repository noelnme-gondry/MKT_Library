import { CANONICAL_FIELDS } from "../schema/canonicalFields";
import { MAPPING_MEMORY_SCHEMA_VERSION } from "./mappingMemory";

const BLOCKED = new Set(["__proto__", "prototype", "constructor"]);

function assertSafe(value, depth = 0) {
  if (depth > 8) throw new Error("MAPPING_MEMORY_FILE_TOO_DEEP");
  if (Array.isArray(value)) value.forEach((item) => assertSafe(item, depth + 1));
  else if (value && typeof value === "object") Object.entries(value).forEach(([key, item]) => {
    if (BLOCKED.has(key)) throw new Error("MAPPING_MEMORY_FILE_UNSAFE_KEY");
    assertSafe(item, depth + 1);
  });
}

export function serializeMappingMemory(records = []) {
  return {
    schemaVersion: MAPPING_MEMORY_SCHEMA_VERSION,
    product: "growthopt-playbook-mapping-memory",
    records: records.map((record) => ({
      schemaVersion: MAPPING_MEMORY_SCHEMA_VERSION,
      normalizedColumnName: record.normalizedColumnName,
      canonicalKey: record.canonicalKey,
      profile: record.profile,
      context: record.context,
      confirmationCount: record.confirmationCount,
      confirmedAt: record.confirmedAt,
    })),
  };
}

export function parseMappingMemory(text) {
  const parsed = JSON.parse(text);
  assertSafe(parsed);
  if (parsed?.schemaVersion !== MAPPING_MEMORY_SCHEMA_VERSION || parsed.product !== "growthopt-playbook-mapping-memory" || !Array.isArray(parsed.records) || parsed.records.length > 500) throw new Error("MAPPING_MEMORY_FILE_INVALID");
  return parsed.records.map((record) => {
    if (!record?.normalizedColumnName || !CANONICAL_FIELDS[record.canonicalKey]) throw new Error("MAPPING_MEMORY_FILE_INVALID_RECORD");
    return {
      schemaVersion: MAPPING_MEMORY_SCHEMA_VERSION,
      normalizedColumnName: String(record.normalizedColumnName),
      canonicalKey: record.canonicalKey,
      profile: record.profile || {},
      context: record.context || {},
      confirmationCount: Math.max(1, Number(record.confirmationCount) || 1),
      confirmedAt: Number(record.confirmedAt) || 0,
    };
  });
}
