import { describe, expect, it } from "vitest";
import {
  DECISION_REVIEW_SAFE_FIELDS,
  assessDecisionOutcome,
  decisionMetricDirection,
  decisionNumericComparison,
  getDecisionReviewBucket,
  getDecisionReviewStatus,
  normalizeDecisionReviewRows,
  sanitizeDecisionReviewRecords,
  serializeDecisionReviewCsv,
  summarizeDecisionOutcomes,
  toLocalDecisionDate,
} from "@/lib/decisionReview";

describe("decision review CSV contract", () => {
  it("compares sanitized summary values without inferring good or bad", () => {
    expect(decisionNumericComparison({ baseline: "CPA 5,240원", actual: "CPA 4,980원" })).toMatchObject({ delta: -260, changePct: -260 / 5240, isPercentPoint: false });
    const percentage = decisionNumericComparison({ baseline: "18.2%", actual: "15.0%" });
    expect(percentage.isPercentPoint).toBe(true);
    expect(percentage.delta).toBeCloseTo(-3.2);
    expect(decisionNumericComparison({ baseline: "18.2%", actual: "4,980원" })).toBeNull();
  });

  it("scores only a declared or conservative metric direction", () => {
    expect(decisionMetricDirection("평균 CPA")).toBe("lower");
    expect(decisionMetricDirection("ROAS forecast")).toBe("higher");
    expect(decisionMetricDirection("OOS 오차")).toBe("lower");
    expect(decisionMetricDirection("매출")).toBe("");

    expect(assessDecisionOutcome({ metric: "CPA", baseline: "5,240", actual: "4,980" })).toMatchObject({ state: "improved", direction: "lower" });
    expect(assessDecisionOutcome({ metric: "ROAS", baseline: "1.4", actual: "1.1" })).toMatchObject({ state: "declined", direction: "higher" });
    expect(assessDecisionOutcome({ metric: "전환수", targetDirection: "higher", baseline: "100", actual: "120" })).toMatchObject({ state: "improved", direction: "higher" });
    expect(assessDecisionOutcome({ metric: "CPA", targetDirection: "neutral", baseline: "5,240", actual: "4,980" })).toMatchObject({ state: "unscored", direction: "neutral" });
    expect(assessDecisionOutcome({ metric: "매출", baseline: "100", actual: "120" })).toMatchObject({ state: "unscored", direction: "" });
    expect(assessDecisionOutcome({ metric: "CPA", baseline: "5,240", actual: "" }).state).toBe("incomplete");

    expect(summarizeDecisionOutcomes([
      { metric: "CPA", baseline: "5,240", actual: "4,980" },
      { metric: "ROAS", baseline: "1.4", actual: "1.1" },
      { metric: "매출", baseline: "100", actual: "120" },
      { metric: "CPA", baseline: "5,240", actual: "" },
    ])).toEqual({ improved: 1, declined: 1, unchanged: 0, unscored: 1, comparable: 3 });
  });

  it("exports Excel-safe UTF-8 BOM + CRLF rows without losing commas", () => {
    const csv = serializeDecisionReviewCsv([{
      id: "decision_7",
      toolId: "5-3",
      action: "Meta 예산 20% 감액",
      hypothesis: "CPA가 5,000원 아래로 유지된다",
      metric: "CPA",
      targetDirection: "lower",
      baseline: "5,240",
      reviewDate: "2026-08-03",
      actual: "4,980",
      learning: "=SUM(A1:A2)는 값이 아니라 가설 텍스트",
    }]);

    expect(csv.startsWith("\uFEFF\"tool_id\"")).toBe(true);
    expect(csv).toContain("\r\n");
    expect(csv).toContain("\"5,240\"");
    expect(csv).toContain("\"target_direction\"");
    expect(csv).toContain("\"lower\"");
    expect(csv).toContain("\"2026-08-03\"");
    expect(csv).toContain("'=SUM(A1:A2)");
    expect(csv).toContain("\"decision_7\"");
  });

  it("keeps only actionable imported rows and derives review state honestly", () => {
    const rows = normalizeDecisionReviewRows([
      { action: "", metric: "CPA" },
      { "\uFEFFtool_id": "5-2", action: "주간 예산 확인", reviewDate: "2026-08-03", actual: "", learning: "" },
      { action: "소재 교체", actual: "CTR 1.8%", learning: "훅 테스트 지속" },
    ], "9-6");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ toolId: "5-2", reviewDate: "2026-08-03", status: "pending" });
    expect(rows[1]).toMatchObject({ toolId: "9-6", status: "reviewed" });
    expect(getDecisionReviewStatus({ actual: "", learning: "" })).toBe("pending");
  });

  it("classifies review dates without treating missing dates as upcoming", () => {
    expect(getDecisionReviewBucket({ reviewDate: "2026-07-31" }, "2026-08-01")).toBe("overdue");
    expect(getDecisionReviewBucket({ reviewDate: "2026-08-01" }, "2026-08-01")).toBe("today");
    expect(getDecisionReviewBucket({ reviewDate: "2026-08-02" }, "2026-08-01")).toBe("upcoming");
    expect(getDecisionReviewBucket({ reviewDate: "" }, "2026-08-01")).toBe("unscheduled");
    expect(getDecisionReviewBucket({ reviewDate: "2026-08-02", actual: "CPA 4,980" }, "2026-08-01")).toBe("reviewed");
    expect(toLocalDecisionDate(new Date(2026, 7, 1, 0, 30))).toBe("2026-08-01");
  });

  it("restores the exported record id for idempotent imports", () => {
    const [record] = normalizeDecisionReviewRows([{ record_id: "decision_7", tool_id: "5-3", action: "Hold budget" }]);
    expect(record.id).toBe("decision_7");
  });

  it("persists only the decision allowlist and rejects raw analysis payloads", () => {
    const [record] = sanitizeDecisionReviewRecords([{
      id: "decision_1",
      toolId: "5-2",
      locale: "en",
      conclusion: "CPA increased",
      action: "Reduce spend",
      reviewQuestion: "Did CPA recover?",
      reviewDate: "2026-02-30",
      raw: [{ secret: "customer-row" }],
      csvData: { raw: [{ secret: "customer-row" }] },
      inputSignature: "private-file.csv|200",
      chart: { datasets: [1, 2, 3] },
    }]);

    expect(Object.keys(record)).toEqual(DECISION_REVIEW_SAFE_FIELDS);
    expect(record.reviewDate).toBe("");
    expect(record.locale).toBe("en");
    const json = JSON.stringify(record);
    expect(json).not.toContain("customer-row");
    expect(json).not.toContain("private-file.csv");
    expect(json).not.toContain("datasets");
  });
});
