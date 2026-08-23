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
    expect(canonicalFieldForLegacyKey("group")).toMatchObject({
      canonicalKey: "intervention_group",
      requiresConfirmation: true,
    });
    expect(canonicalFieldForLegacyKey("revenue_d7")).toMatchObject({
      canonicalKey: "outcome_revenue",
      window: { kind: "cohort_day", value: 7 },
    });
  });

  it("promotes catalogued V1 fields without replacing their legacy keys", () => {
    expect(canonicalFieldForLegacyKey("daily_budget")?.canonicalKey).toBe("media_daily_budget");
    expect(canonicalFieldForLegacyKey("current_cpt")?.canonicalKey).toBe("media_current_cpt");
    expect(canonicalFieldForLegacyKey("video_3s_views")?.canonicalKey).toBe("media_video_3s_views");
    expect(canonicalFieldForLegacyKey("hook_type")?.canonicalKey).toBe("creative_hook_type");
    expect(canonicalFieldForLegacyKey("d_seollal")).toMatchObject({
      canonicalKey: "control_holiday",
      memberHint: "lunar_new_year",
    });
    expect(canonicalFieldForLegacyKey("mmm_platform")).toMatchObject({
      canonicalKey: "platform",
      memberHint: "weekly_panel",
    });
    expect(canonicalFieldForLegacyKey("subscription_start_date")?.canonicalKey).toBe("subscription_start_date");
    expect(canonicalFieldForLegacyKey("churn_date")?.canonicalKey).toBe("subscription_churn_date");
    expect(canonicalFieldForLegacyKey("observation_end_date")?.canonicalKey).toBe("subscription_observation_end_date");
  });

  it("marks tool-owned and intervention semantics as confirmation-required", () => {
    for (const key of ["intervention_cutoff", "intervention_group", "user_id", "content_id", "outcome_binary", "outcome_numeric", "numeric_feature"]) {
      expect(CANONICAL_FIELDS[key]?.requiresConfirmation, key).toBe(true);
    }
    expect(CANONICAL_FIELDS.creative_hook_type.semanticGroup).toBe("creative_attribute");
  });

  it("does not let an override name a missing legacy or canonical field", () => {
    for (const [legacyKey, migration] of Object.entries(LEGACY_FIELD_MIGRATIONS)) {
      expect(STANDARD_FIELDS[legacyKey], legacyKey).toBeTruthy();
      expect(CANONICAL_FIELDS[migration.canonicalKey], legacyKey).toBeTruthy();
    }
  });
});
