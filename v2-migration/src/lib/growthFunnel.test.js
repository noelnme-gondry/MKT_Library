import { describe, expect, it } from "vitest";
import { buildGrowthFunnel, parseGrowthFunnelRows } from "./growthFunnel";

describe("growth funnel GA4 export parser", () => {
  it("reads KR GA4 headers and excludes demo and non-ready completions", () => {
    const parsed = parseGrowthFunnelRows([
      { "이벤트 이름": "landing_data_start_clicked", "이벤트 수": "100", 날짜: "20260801", 소스: "landing" },
      { "이벤트 이름": "data_import_success", "이벤트 수": "60", 날짜: "20260802", 소스: "csv" },
      { "이벤트 이름": "analysis_completed", "이벤트 수": "40", 날짜: "20260802", 소스: "csv", "결과 상태": "ready", "첫 결과 소요시간 구간": "1_3m" },
      { "이벤트 이름": "analysis_completed", "이벤트 수": "9", 날짜: "20260802", 소스: "demo", "결과 상태": "ready" },
      { "이벤트 이름": "analysis_completed", "이벤트 수": "3", 날짜: "20260802", 소스: "csv", "결과 상태": "blocked" },
      { "이벤트 이름": "decision_record_added", "이벤트 수": "12", 날짜: "20260803", 소스: "decision_review" },
      { "이벤트 이름": "decision_review_completed", "이벤트 수": "5", 날짜: "20260808", 소스: "weekly_review" },
    ]);
    const report = buildGrowthFunnel(parsed);
    expect(report.ok).toBe(true);
    expect(report.stages.map((stage) => stage.count)).toEqual([100, 60, 40, 12, 5]);
    expect(report.dateRange).toEqual({ start: "2026-08-01", end: "2026-08-08" });
    expect(report.decisionReviewRate).toBeCloseTo(5 / 12);
    expect(report.activationBuckets).toEqual([{ bucket: "1_3m", count: 40 }]);
  });

  it("is explicit when source and result-state dimensions are absent", () => {
    const report = buildGrowthFunnel(parseGrowthFunnelRows([
      { "Event name": "blog_tool_cta_clicked", "Event count": "10" },
      { "Event name": "analysis_completed", "Event count": "4" },
    ]));
    expect(report.warnings).toEqual(["missing_source", "missing_result_state", "aggregate_not_cohort"]);
    expect(report.stages[2].count).toBe(4);
  });

  it("rejects exports without an event-name dimension", () => {
    expect(parseGrowthFunnelRows([{ date: "20260801", count: 2 }])).toMatchObject({ ok: false, reason: "missing_event_name" });
  });
});
