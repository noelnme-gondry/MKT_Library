import { describe, expect, it } from "vitest";
import { mapDataset } from "./mapDataset";

describe("semantic mapping baseline", () => {
  it("keeps bindings independent of the route that received the same CSV", () => {
    const input = {
      headers: ["Date", "cost", "spend", "installs", "campaign_id", "actions", "mystery_metric"],
      // Phase 0 must not inspect or return raw values. Rows are deliberately absent.
    };
    expect(mapDataset({ ...input, toolId: "5-2" }).bindings)
      .toEqual(mapDataset({ ...input, toolId: "5-3" }).bindings);
  });

  it("uses only exact migration signals and abstains from unproven headers", () => {
    const result = mapDataset({ headers: ["cost", "revenue_d7", "actions", "fb_amt"] });
    expect(result.bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceColumn: "cost", canonicalKey: "media_spend", decision: "SUGGEST" }),
      expect.objectContaining({ sourceColumn: "revenue_d7", canonicalKey: "outcome_revenue", window: { kind: "cohort_day", value: 7 } }),
      expect.objectContaining({ sourceColumn: "actions", canonicalKey: "outcome_generic", decision: "SUGGEST" }),
      expect.objectContaining({ sourceColumn: "fb_amt", canonicalKey: null, role: "UNKNOWN", decision: "UNKNOWN" }),
    ]));
  });

  it("uses registered legacy aliases globally without a tool-scoped candidate list", () => {
    const result = mapDataset({
      headers: ["광고비", "Source Type", "Total Downloads"],
      rows: [{ 광고비: "₩100", "Source Type": "App Store Search", "Total Downloads": "3" }],
    });
    expect(result.bindings).toEqual(expect.arrayContaining([
      expect.objectContaining({ sourceColumn: "광고비", canonicalKey: "media_spend" }),
      expect.objectContaining({ sourceColumn: "Source Type", canonicalKey: "store_source" }),
      expect.objectContaining({ sourceColumn: "Total Downloads", canonicalKey: "outcome_installs" }),
    ]));
  });

  it("suggests named tool-owned roles, but keeps generic numeric columns unknown and intervention groups confirmation-bound", () => {
    const result = mapDataset({
      headers: ["User ID", "Converted", "Content ID", "behaviour_count", "group"],
      rows: [{ "User ID": "u-1", Converted: "1", "Content ID": "post-1", behaviour_count: "4", group: "treatment" }],
    });
    const actual = Object.fromEntries(result.bindings.map((binding) => [binding.sourceColumn, binding]));

    expect(actual["User ID"]).toMatchObject({ canonicalKey: "user_id", decision: "SUGGEST", requiresConfirmation: true });
    expect(actual.Converted).toMatchObject({ canonicalKey: "outcome_binary", decision: "SUGGEST", requiresConfirmation: true });
    expect(actual["Content ID"]).toMatchObject({ canonicalKey: "content_id", decision: "SUGGEST", requiresConfirmation: true });
    expect(actual.behaviour_count).toMatchObject({ canonicalKey: null, decision: "UNKNOWN" });
    expect(actual.group).toMatchObject({ canonicalKey: "intervention_group", decision: "SUGGEST", requiresConfirmation: true });
  });
});
