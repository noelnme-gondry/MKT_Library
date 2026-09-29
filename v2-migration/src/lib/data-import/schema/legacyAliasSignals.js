import { STANDARD_FIELDS } from "@/utils/csvConstants";
import { canonicalFieldForLegacyKey } from "./legacyFieldMigration";
import { stripCurrencySuffix } from "../headerUnits";

const normalize = (value) => stripCurrencySuffix(String(value || "").normalize("NFKC")).trim().toLowerCase().replace(/[\s_-]+/g, "");

// Legacy aliases are deterministic compatibility signals, never the V2 schema
// definition. Only aliases whose source legacy key has an explicit migration
// participate; ambiguous or not-yet-migrated keys remain absent.
export const LEGACY_ALIAS_SIGNALS = Object.freeze(Object.entries(STANDARD_FIELDS).flatMap(([legacyKey, field]) => {
  const migration = canonicalFieldForLegacyKey(legacyKey);
  if (!migration?.canonicalKey) return [];
  return [legacyKey, ...(field.aliases || [])].map((alias) => ({ normalizedAlias: normalize(alias), canonicalKey: migration.canonicalKey, legacyKey }));
}).filter((signal) => signal.normalizedAlias));

export const normalizeAliasSignal = normalize;
