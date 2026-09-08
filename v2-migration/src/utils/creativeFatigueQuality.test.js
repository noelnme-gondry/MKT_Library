import { describe, expect, it } from "vitest";
import { qualifyCreativeFatigue } from "./creativeFatigueQuality";

describe("fatigue evidence", () => {
  it("withholds low exposure and insufficient history without changing supported diagnoses", () => {
    const result = qualifyCreativeFatigue([
      { creative_id: "low", fatigued: true, dropPct: 0.9 },
      { creative_id: "short", fatigued: false, reason: "데이터 부족" },
      { creative_id: "supported", fatigued: true, dropPct: 0.4 },
    ], [{ creative_id: "low", impressions: 10 }, { creative_id: "short", impressions: 1000 }, { creative_id: "supported", impressions: 1000 }], 1000);
    expect(result.map(({ qualityStatus, fatigued }) => [qualityStatus, fatigued])).toEqual([
      ["insufficient_exposure", false], ["insufficient_history", false], ["reviewable", true],
    ]);
    expect(result[2].dropPct).toBe(0.4);
  });
});
