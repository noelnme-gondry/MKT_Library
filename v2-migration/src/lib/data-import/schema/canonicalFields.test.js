import { describe, expect, it } from "vitest";
import { STANDARD_FIELDS } from "@/utils/csvConstants";
import { CANONICAL_FIELD_FAMILIES, CANONICAL_FIELDS } from "./canonicalFields";
import {
  LEGACY_FIELD_MIGRATIONS,
  LEGACY_MIGRATION_POLICIES,
  canonicalFieldForLegacyKey,
  legacyFieldMigrationFor,
} from "./legacyFieldMigration";

describe("Semantic Mapper V2 registry baseline", () => {
  it("gives each canonical key one matching definition and a declared family", () => {
    for (const [key, definition] of Object.entries(CANONICAL_FIELDS)) {
      expect(definition.key, key).toBe(key);
      expect(CANONICAL_FIELD_FAMILIES.has(definition.family), key).toBe(true);
      expect(typeof definition.repeatable, key).toBe("boolean");
      expect(typeof definition.windowSupport, key).toBe("boolean");
    }
  });

  it("assigns every current legacy field exactly one migration policy", () => {
    for (const legacyKey of Object.keys(STANDARD_FIELDS)) {
      const migration = legacyFieldMigrationFor(legacyKey);
      expect(migration.legacyKey, legacyKey).toBe(legacyKey);
      expect(LEGACY_MIGRATION_POLICIES.has(migration.policy), legacyKey).toBe(true);
      if (migration.canonicalKey) expect(CANONICAL_FIELDS[migration.canonicalKey], legacyKey).toBeTruthy();
    }
  });

  it("merges only confirmed duplicate meanings and preserves ambiguous actions", () => {
    expect(canonicalFieldForLegacyKey("cost")?.canonicalKey).toBe("media_spend");
    expect(canonicalFieldForLegacyKey("spend")?.canonicalKey).toBe("media_spend");
    expect(canonicalFieldForLegacyKey("campaign_name")?.canonicalKey).toBe("campaign");
    expect(canonicalFieldForLegacyKey("campaign_id")?.canonicalKey).toBe("campaign");
    expect(canonicalFieldForLegacyKey("actions")).toMatchObject({
      canonicalKey: "outcome_generic",
      requiresConfirmation: true,
    });
    expect(canonicalFieldForLegacyKey("revenue_d7")).toMatchObject({
      canonicalKey: "outcome_revenue",
      window: { kind: "cohort_day", value: 7 },
    });
  });

  it("does not let an override name a missing legacy or canonical field", () => {
    for (const [legacyKey, migration] of Object.entries(LEGACY_FIELD_MIGRATIONS)) {
      expect(STANDARD_FIELDS[legacyKey], legacyKey).toBeTruthy();
      expect(CANONICAL_FIELDS[migration.canonicalKey], legacyKey).toBeTruthy();
    }
  });
});
