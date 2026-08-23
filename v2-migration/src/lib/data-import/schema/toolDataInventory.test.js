import { describe, expect, it } from "vitest";
import { ROUTES } from "@/lib/routeMap";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { STANDARD_FIELDS } from "@/utils/csvConstants";
import { buildCsvToolInventory } from "./toolDataInventory";
import { canonicalFieldForLegacyKey } from "./legacyFieldMigration";

describe("CSV tool inventory", () => {
  const inventory = buildCsvToolInventory();

  it("is derived from the routable CSV groups, including preview and subtool routes", () => {
    const expected = ROUTES
      .filter((route) => !route.legacy && Boolean(TOOL_GROUP[route.id]))
      .map((route) => route.id)
      .sort();
    expect(inventory.map((item) => item.toolId).sort()).toEqual(expected);
    expect(inventory.find((item) => item.toolId === "9-3")?.publication).toBe("preview");
    expect(inventory.find((item) => item.toolId === "5-18")?.publication).toBe("subtool");
  });

  it("describes each legacy mapping key from the current input contract", () => {
    for (const tool of inventory) {
      expect(tool.dataGroup, tool.toolId).toBeTruthy();
      for (const requirement of tool.requirements) {
        expect(["all", "one_of"], tool.toolId).toContain(requirement.kind);
        expect(requirement.min, tool.toolId).toBe(1);
        for (const field of requirement.fields) expect(STANDARD_FIELDS[field.legacyKey], `${tool.toolId}:${field.legacyKey}`).toBeTruthy();
      }
      for (const field of tool.optionalFields) expect(STANDARD_FIELDS[field.legacyKey], `${tool.toolId}:${field.legacyKey}`).toBeTruthy();
    }
  });

  it("keeps tool-owned role mapping explicit instead of pretending it uses the common contract", () => {
    expect(inventory.find((item) => item.toolId === "5-20")?.mappingMode).toBe("tool_owned");
    expect(inventory.find((item) => item.toolId === "5-23")?.mappingMode).toBe("tool_owned");
    expect(inventory.find((item) => item.toolId === "9-1")?.mappingMode).toBe("tool_owned");
    expect(inventory.find((item) => item.toolId === "5-2")?.mappingMode).toBe("contract");
  });

  it("keeps tool-owned roles at their actual confirmation boundary", () => {
    const ahaRoles = inventory.find((item) => item.toolId === "5-20")?.toolOwnedRoles || [];
    const incrementalityRoles = inventory.find((item) => item.toolId === "5-23")?.toolOwnedRoles || [];
    const contentRoles = inventory.find((item) => item.toolId === "9-1")?.toolOwnedRoles || [];

    expect(ahaRoles).toEqual(expect.arrayContaining([
      expect.objectContaining({ canonicalKey: "user_id", required: false, automatic: "SUGGEST", validation: "confirm_one_row_per_user_without_id" }),
      expect.objectContaining({ canonicalKey: "numeric_feature", required: true, automatic: "manual" }),
    ]));
    expect(incrementalityRoles).toEqual(expect.arrayContaining([
      expect.objectContaining({ canonicalKey: "intervention_cutoff", source: "user_declared", automatic: "manual" }),
      expect.objectContaining({ canonicalKey: "intervention_group", automatic: "manual" }),
    ]));
    expect(contentRoles).toEqual(expect.arrayContaining([
      expect.objectContaining({ canonicalKey: "outcome_numeric", required: true, automatic: "manual" }),
    ]));
  });

  it("covers the 18 catalogued public tools and the independent action-survival contract", () => {
    const publicTools = inventory.filter((tool) => tool.isPublicAnalysisTool);
    expect(publicTools.map((tool) => tool.toolId).sort()).toEqual([
      "5-2", "5-20", "5-21", "5-22", "5-23", "5-24", "5-25", "5-26", "5-27", "5-28", "5-3", "5-4",
      "5-18-cannibal", "5-18-forecast", "5-18-mmm", "5-18-paid-organic", "5-18-trend", "9-1", "9-6",
    ].sort());

    for (const tool of publicTools) {
      for (const requirement of tool.requirements) {
        for (const { legacyKey } of requirement.fields) {
          expect(canonicalFieldForLegacyKey(legacyKey), `${tool.toolId}:${legacyKey}`).not.toBeNull();
        }
      }
      for (const role of tool.toolOwnedRoles) {
        expect(["SUGGEST", "manual"], `${tool.toolId}:${role.canonicalKey}`).toContain(role.automatic);
      }
    }
  });

  it("gives every published-tool optional field an explicit V2 role or an intentional passthrough", () => {
    for (const tool of inventory.filter((item) => item.isPublicAnalysisTool)) {
      for (const field of tool.optionalFields) {
        const migration = canonicalFieldForLegacyKey(field.legacyKey);
        // 공개 도구에서 결과 범위를 넓히는 필드는 V2 역할을 써야 한다. 역할을
        // 모르는 구 legacy field가 공개 도구의 optional 계약에 섞이면 이 검사가
        // 바로 막는다.
        expect(migration, `${tool.toolId}:${field.legacyKey}`).not.toBeNull();
      }
    }
  });

  it("keeps action-episode event types in the optional input contract", () => {
    const actionSurvival = inventory.find((item) => item.toolId === "5-28");
    expect(actionSurvival?.optionalFields).toEqual(expect.arrayContaining([
      expect.objectContaining({ legacyKey: "event_type" }),
    ]));
    expect(canonicalFieldForLegacyKey("event_type")?.canonicalKey).toBe("event_type");
  });

  it("declares dated subscription episodes as a distinct alternative input route", () => {
    const subscription = inventory.find((item) => item.toolId === "5-28");
    expect(subscription?.requirements).toEqual(expect.arrayContaining([
      expect.objectContaining({ kind: "one_of", fields: expect.arrayContaining([
        expect.objectContaining({ legacyKey: "subscription_start_date" }),
      ]) }),
      expect.objectContaining({ kind: "one_of", fields: expect.arrayContaining([
        expect.objectContaining({ legacyKey: "churn_date" }),
        expect.objectContaining({ legacyKey: "observation_end_date" }),
      ]) }),
    ]));
    expect(subscription?.grain.timeKeys).toEqual(expect.arrayContaining(["subscription_start_date", "churn_date", "observation_end_date"]));
  });
});
