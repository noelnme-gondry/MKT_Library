import { describe, expect, it } from "vitest";
import {
  DECISION_REVIEW_SAFE_FIELDS,
  assessDecisionOutcome,
  decisionReviewAgeBucket,
  decisionMetricDirection,
  decisionNumericComparison,
  getDecisionReviewBucket,
  getDecisionReviewStatus,
  normalizeDecisionReviewRows,
  sanitizeDecisionReviewRecords,
  serializeDecisionReviewCsv,
  serializeDecisionReviewIcs,
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
      { action: "소재 교체", actual: "CTR 1.8%", learning: "훅 테스트 지속", status: "reviewed" },
    ], "9-6");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ toolId: "5-2", reviewDate: "2026-08-03", status: "pending" });
    expect(rows[1]).toMatchObject({ toolId: "9-6", status: "reviewed" });
    expect(getDecisionReviewStatus({ actual: "CPA 4,980" })).toBe("pending");
    expect(getDecisionReviewStatus({ reviewedAt: "2026-08-01T00:00:00.000Z" })).toBe("reviewed");
  });

  it("classifies review dates without treating missing dates as upcoming", () => {
    expect(getDecisionReviewBucket({ reviewDate: "2026-07-31" }, "2026-08-01")).toBe("overdue");
    expect(getDecisionReviewBucket({ reviewDate: "2026-08-01" }, "2026-08-01")).toBe("today");
    expect(getDecisionReviewBucket({ reviewDate: "2026-08-02" }, "2026-08-01")).toBe("upcoming");
    expect(getDecisionReviewBucket({ reviewDate: "" }, "2026-08-01")).toBe("unscheduled");
    expect(getDecisionReviewBucket({ reviewDate: "2026-08-02", actual: "CPA 4,980" }, "2026-08-01")).toBe("upcoming");
    expect(getDecisionReviewBucket({ reviewDate: "2026-08-02", actual: "CPA 4,980", status: "reviewed" }, "2026-08-01")).toBe("upcoming");
    expect(getDecisionReviewBucket({ reviewDate: "2026-08-02", status: "reviewed", reviewedAt: "2026-08-01T00:00:00.000Z" }, "2026-08-01")).toBe("reviewed");
    expect(toLocalDecisionDate(new Date(2026, 7, 1, 0, 30))).toBe("2026-08-01");
  });

  it("buckets return timing without exposing raw timestamps to analytics", () => {
    const createdAt = "2026-08-01T00:00:00.000Z";
    expect(decisionReviewAgeBucket({ createdAt }, { now: new Date("2026-08-01T03:00:00.000Z"), isSameSession: true })).toBe("same_session");
    expect(decisionReviewAgeBucket({ createdAt }, { now: new Date("2026-08-03T00:00:00.000Z") })).toBe("1-3d");
    expect(decisionReviewAgeBucket({ createdAt }, { now: new Date("2026-08-07T00:00:00.000Z") })).toBe("4-9d");
    expect(decisionReviewAgeBucket({ createdAt }, { now: new Date("2026-08-12T00:00:00.000Z") })).toBe("10d+");
    expect(decisionReviewAgeBucket({})).toBe("unknown");
  });

  it("exports a privacy-safe all-day calendar reminder", () => {
    const ics = serializeDecisionReviewIcs({
      id: "decision_7",
      reviewDate: "2026-08-11",
      action: "Sensitive campaign name",
      hypothesis: "Private operating note",
    });
    expect(ics).toContain("DTSTART;VALUE=DATE:20260811\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20260812\r\n");
    expect(ics).toContain("URL:https://growthoptplaybook.com/weekly-review");
    expect(ics).not.toContain("Sensitive campaign name");
    expect(ics).not.toContain("Private operating note");
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

  it("keeps only a canonical one-period forecast snapshot", () => {
    const [record] = normalizeDecisionReviewRows([{
      tool_id: "5-18",
      action: "첫 예측 주 실제값 확인",
      comparison_kind: "forecast_actual",
      forecast_period: "2026-08-03",
      forecast_target: "Regs",
      forecast_platform: "all",
      forecast_value: "1,240",
      forecast_lower: "1100",
      forecast_upper: "1380",
      forecast_source_through: "2026-07-27",
      raw: [{ customer: "secret" }],
    }]);
    expect(record).toMatchObject({
      comparisonKind: "forecast_actual",
      forecastPeriod: "2026-08-03",
      forecastTarget: "Regs",
      forecastPlatform: "all",
      forecastValue: "1240",
      forecastLower: "1100",
      forecastUpper: "1380",
      forecastSourceThrough: "2026-07-27",
    });
    expect(JSON.stringify(record)).not.toContain("secret");

    const [invalid] = normalizeDecisionReviewRows([{
      tool_id: "5-18",
      action: "잘못된 예측",
      comparison_kind: "forecast_actual",
      forecast_period: "next week",
      forecast_target: "CustomerEmail",
      forecast_platform: "web",
      forecast_value: "=SUM(A1:A2)",
    }]);
    expect(invalid).toMatchObject({ forecastPeriod: "", forecastTarget: "", forecastPlatform: "", forecastValue: "" });
  });
});
