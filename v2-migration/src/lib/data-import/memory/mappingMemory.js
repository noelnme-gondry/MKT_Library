import { CANONICAL_FIELDS } from "../schema/canonicalFields";

export const MAPPING_MEMORY_SCHEMA_VERSION = 1;
const UNSAFE_NAME = /^(?:__proto__|prototype|constructor)$/i;

const safeText = (value) => String(value || "").normalize("NFKC").trim().toLowerCase().replace(/[\s_-]+/g, "_");
const bucket = (value, boundaries) => boundaries.find((boundary) => value <= boundary) ?? boundaries.at(-1);

export function profileFingerprint(profile = {}) {
  return {
    inferredType: profile.inferredType || "unknown",
    numericRateBucket: bucket(Number(profile.rates?.numeric || 0), [0, 0.2, 0.8, 1]),
    missingRateBucket: bucket(Number(profile.missingRate || 0), [0, 0.1, 0.5, 1]),
    cardinality: profile.cardinality || "unknown",
    unitHint: profile.rates?.currencyLike >= 0.5 ? "currency" : profile.rates?.percentLike >= 0.5 ? "rate" : "unknown",
  };
}

export function buildMappingMemoryRecord({ normalizedColumnName, canonicalKey, profile, context = {}, confirmedAt = Date.now() } = {}) {
  if (!CANONICAL_FIELDS[canonicalKey]) throw new Error("MAPPING_MEMORY_UNKNOWN_CANONICAL_KEY");
  const name = safeText(normalizedColumnName);
  if (!name || UNSAFE_NAME.test(name)) throw new Error("MAPPING_MEMORY_UNSAFE_NAME");
  const safeContext = { representation: context.representation || "tabular", roleFamilies: [...new Set(context.roleFamilies || [])].filter((family) => /^[A-Z_]+$/.test(family)) };
  return {
    schemaVersion: MAPPING_MEMORY_SCHEMA_VERSION,
    normalizedColumnName: name,
    canonicalKey,
    profile: profileFingerprint(profile),
    context: safeContext,
    confirmationCount: 1,
    confirmedAt: Number(confirmedAt),
  };
}

export function isMemoryCompatible(record, { normalizedColumnName, profile, context = {} } = {}) {
  if (!record || record.schemaVersion !== MAPPING_MEMORY_SCHEMA_VERSION) return false;
  if (record.normalizedColumnName !== safeText(normalizedColumnName)) return false;
  const current = profileFingerprint(profile);
  const stored = record.profile || {};
  if (stored.inferredType !== current.inferredType || stored.unitHint !== current.unitHint || stored.cardinality !== current.cardinality) return false;
  return (record.context?.representation || "tabular") === (context.representation || "tabular");
}

export function findCompatibleMemory(records = [], input = {}) {
  return records
    .filter((record) => isMemoryCompatible(record, input))
    .sort((left, right) => right.confirmationCount - left.confirmationCount || right.confirmedAt - left.confirmedAt)[0] || null;
}
