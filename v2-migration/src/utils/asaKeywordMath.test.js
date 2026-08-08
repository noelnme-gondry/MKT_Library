import { describe, expect, it } from "vitest";
import { buildAsaKeywordRecommendations } from "./asaKeywordMath";
import { buildDemoCsv } from "./demoData";
import { getMappedRows } from "./dashboardAggregator";

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

  it("uses one campaign budget once, rather than treating it as every term's budget", () => {
    const rows = buildAsaKeywordRecommendations([
      { date: "2026-08-01", campaign_name: "KR", search_term: "term-a", match_type: "Broad", cost: "500", clicks: "50", installs: "10", daily_budget: "1000", target_cpa: "100", current_cpt: "10" },
      { date: "2026-08-01", campaign_name: "KR", search_term: "term-b", match_type: "Broad", cost: "500", clicks: "50", installs: "10", daily_budget: "1000", target_cpa: "100", current_cpt: "10" },
    ]);
    expect(rows.every((row) => row.pace === 1 && row.action.code === "hold")).toBe(true);
  });

  it("does not label an unknown match type as an Exact-promotion candidate", () => {
    const [row] = buildAsaKeywordRecommendations([{ date: "2026-08-01", search_term: "brand name", cost: "400", clicks: "40", installs: "8", daily_budget: "1000", target_cpa: "80", current_cpt: "10" }]);
    expect(row.matchType).toBe("unknown");
    expect(row.isExactCandidate).toBe(false);
  });

  it("ASA demo has immediately actionable keyword results", () => {
    const demo = buildDemoCsv("asa_keyword");
    const rows = buildAsaKeywordRecommendations(getMappedRows(demo));
    expect(rows.some((row) => row.isExactCandidate)).toBe(true);
    expect(rows.some((row) => row.action.code === "raise")).toBe(true);
    expect(rows.some((row) => row.action.code === "lower")).toBe(true);
  });
});
