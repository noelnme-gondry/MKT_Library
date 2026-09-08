import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { runReview, kpiFor } from "./reviewPipeline";
import { buildWorkspaceEvidence, campaignComparisonCsv, formatReviewMetric, parseReviewTarget, targetGap, workspaceReportNotes } from "./workspaceEvidence";

function fixture(metric = "cpa") {
  const rows = [
    { date: "2026-08-30", campaign_name: "A", cost: 100, actions: 10, revenue: 300 },
    { date: "2026-08-30", campaign_name: "B", cost: 900, actions: 30, revenue: 900 },
    { date: "2026-09-06", campaign_name: "A", cost: 200, actions: 10, revenue: 400 },
    { date: "2026-09-06", campaign_name: "B", cost: 600, actions: 30, revenue: 900 },
    { date: "2026-09-06", campaign_name: "New, campaign", cost: 50, actions: 0 },
  ];
  const project = { kpi: kpiFor(metric), currency: "KRW", target: { value: metric === "cpa" ? 25 : 2 } };
  const review = runReview({ rows, project });
  expect(review.ok).toBe(true);
  return { project, review, evidence: buildWorkspaceEvidence(review, project) };
}

describe("weekly workspace evidence", () => {
  it("exports formula-like campaign names as text while retaining numeric values", () => {
    const { evidence, review } = fixture();
    evidence.campaigns[0].label = "=1+1";
    const rows = Papa.parse(campaignComparisonCsv(evidence, review, "en")).data;
    expect(rows[1][0]).toBe("'=1+1");
    expect(rows[1][6]).toBe("50");
  });
  it("validates positive targets and accepts thousands separators without truncation", () => {
    expect(parseReviewTarget("25,000")).toBe(25000);
    for (const value of ["", "bad", "-1", "0", Infinity, null]) expect(parseReviewTarget(value)).toBeNull();
  });
  it("uses aggregate KPI, not the mean of campaign ratios, for the target gap", () => {
    const { evidence } = fixture();
    expect(evidence.gap).toMatchObject({ actual: 21.25, target: 25, delta: -3.75, met: true });
    expect(evidence.zeroResultSpend).toBe(50);
    expect(evidence.currentCount).toBe(3);
    expect(evidence.previousCount).toBe(2);
    expect(evidence.campaigns[0]).toMatchObject({ label: "New, campaign", previous: null, deltaPct: null, status: "new", withoutResults: true });
  });
  it("keeps missing revenue and unobserved campaigns unavailable", () => {
    const { evidence } = fixture("roas");
    expect(evidence.campaigns[0].current.roas).toBeNull();
    expect(targetGap(null, 2, "higher_is_better")).toBeNull();
    expect(formatReviewMetric(2, "roas", "KRW", "en")).toBe("200%");
    expect(formatReviewMetric(40, "conversions", "USD", "en")).toBe("40");
  });
  it.each(["ko", "en"])("exports the same observed KPI and blank absent values (%s)", locale => {
    const { evidence, review } = fixture();
    const rows = Papa.parse(campaignComparisonCsv(evidence, review, locale)).data;
    expect(rows[1][0]).toBe("New, campaign");
    expect(rows[1][5]).toBe("");
    expect(rows[1][6]).toBe("50");
    expect(rows[1][7]).toBe("");
    expect(workspaceReportNotes(evidence, review, locale).join(" ")).toContain("21.25 KRW");
    if (locale === "en") expect(workspaceReportNotes(evidence, review, locale).join(" ")).not.toMatch(/[가-힣]/);
  });
});
