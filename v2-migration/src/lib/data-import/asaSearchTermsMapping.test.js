import { describe, expect, it } from "vitest";
import { buildMappingContract } from "@/lib/data-import/mappingContract";
import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { buildAsaKeywordRecommendations } from "@/utils/asaKeywordMath";
import { evaluateEligibility } from "@/lib/analysis-router/evaluateEligibility";

// Apple Ads search-terms export의 표시 헤더를 재현한 비식별 합성 fixture다.
// 계정·캠페인·검색어·금액은 모두 가상의 값이며, 실제 식별자는 포함하지 않는다.
const headers = ["Date", "Campaign Name", "Ad Group Name", "Search Term", "Match Type", "Total Cost", "Taps", "Installs", "Daily Budget", "Target CPA", "Avg CPT"];
const rows = [
  { Date: "2026-08-01", "Campaign Name": "Example KR", "Ad Group Name": "Discovery", "Search Term": "sample planner", "Match Type": "Search Match", "Total Cost": "₩420", Taps: "42", Installs: "8", "Daily Budget": "1,000", "Target CPA": "80", "Avg CPT": "10" },
  { Date: "2026-08-02", "Campaign Name": "Example KR", "Ad Group Name": "Discovery", "Search Term": "sample planner", "Match Type": "Search Match", "Total Cost": "₩380", Taps: "38", Installs: "7", "Daily Budget": "1,000", "Target CPA": "80", "Avg CPT": "10" },
];

describe("5-26 Apple Ads search-terms CSV", () => {
  it("maps the export headers and produces an actionable engine input", () => {
    const contract = buildMappingContract({ toolId: "5-26", headers, rows });
    expect(contract.mapping).toMatchObject({
      Date: "date", "Campaign Name": "campaign_name", "Ad Group Name": "adgroup_name",
      "Search Term": "search_term", "Match Type": "match_type", "Total Cost": "cost",
      Taps: "clicks", Installs: "installs", "Daily Budget": "daily_budget",
      "Target CPA": "target_cpa", "Avg CPT": "current_cpt",
    });
    expect(contract.requiredMissing).toEqual([]);

    const canonical = buildCanonicalDataset({ raw: rows, headers, mapping: contract.mapping });
    const mappedRows = getMappedRows({ raw: rows, mapping: contract.mapping });
    const [recommendation] = buildAsaKeywordRecommendations(mappedRows);
    expect(canonical.summary).toMatchObject({ inputRows: 2, outputRows: 2, invalidValueCount: 0 });
    expect(evaluateEligibility({ toolId: "5-26", mapping: contract.mapping, canonicalData: canonical }).status).not.toBe("blocked");
    expect(recommendation).toMatchObject({ term: "sample planner", action: { code: "raise" }, isExactCandidate: true });
    expect(recommendation.cpt).toBe(10);
  });
});
