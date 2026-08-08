import { describe, expect, it } from "vitest";
import { buildAsaKeywordRecommendations } from "./asaKeywordMath";

describe("ASA keyword recommendations", () => {
  it("raises CPT for an under-paced, target-beating discovery term and flags Exact", () => {
    const [row] = buildAsaKeywordRecommendations([{ date: "2026-08-01", search_term: "가계부", match_type: "Search Match", cost: "400", clicks: "40", installs: "8", daily_budget: "1000", target_cpa: "80", current_cpt: "10" }]);
    expect(row.action.code).toBe("raise");
    expect(row.recommendedCpt).toBe(11);
    expect(row.isExactCandidate).toBe(true);
  });

  it("lowers CPT for an over-paced, poor term", () => {
    const [row] = buildAsaKeywordRecommendations([{ date: "2026-08-01", search_term: "무료 게임", match_type: "Broad", cost: "1500", clicks: "100", installs: "5", daily_budget: "1000", target_cpa: "100", current_cpt: "20" }]);
    expect(row.action.code).toBe("lower");
    expect(row.recommendedCpt).toBe(17);
    expect(row.isNegativeCandidate).toBe(true);
  });
});
