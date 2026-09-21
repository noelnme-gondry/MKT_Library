import { describe, expect, it } from "vitest";
import { buildGrowthFunnel, parseGrowthFunnelRows, buildToolFunnels } from "./growthFunnel";

describe("growth funnel GA4 export parser", () => {
  it("keeps weekly work and commerce separate from analysis counts", () => {
    const report = buildGrowthFunnel(parseGrowthFunnelRows([
      { event_name: "analysis_completed", event_count: 4, source: "csv", result_state: "ready" },
      { event_name: "weekly_review_completed", event_count: 3, source: "csv", result_state: "eligible" },
      { event_name: "weekly_review_completed", event_count: 9, source: "demo", result_state: "eligible" },
      { event_name: "weekly_decision_saved", event_count: 2, source: "weekly_review" },
      { event_name: "weekly_report_saved", event_count: 1, source: "weekly_review" },
      { event_name: "subscription_gate_viewed", event_count: 5 },
      { event_name: "begin_checkout", event_count: 2 },
      { event_name: "checkout_started", event_count: 2 },
      { event_name: "purchase", event_count: 1 },
    ]));
    expect(report.stages.find(stage => stage.id === "completed").count).toBe(4);
    expect(report.weeklyStages.map(stage => stage.count)).toEqual([3, 2, 1]);
    expect(report.commerceStages.map(stage => stage.count)).toEqual([5, 0, 2, 1]);
    expect(report.commerceStages.at(-1).rateFromPrevious).toBe(0.5);
    expect(report.weeklyStages.every(stage => stage.rateFromPrevious === null)).toBe(true);
  });
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

// 도구별 퍼널 — `tool_id`가 파싱만 되고 소비처가 0곳이던 자리를 메운다.
describe("per-tool analysis funnel", () => {
  const rows = (extra = []) => [
    { event_name: "tool_view", event_count: 100, tool_id: "5-2", source: "route", result_state: "" },
    { event_name: "data_import_success", event_count: 40, tool_id: "5-2", source: "csv", result_state: "" },
    { event_name: "mapping_confirmed", event_count: 30, tool_id: "5-2", source: "csv", result_state: "" },
    { event_name: "analysis_completed", event_count: 25, tool_id: "5-2", source: "csv", result_state: "ready" },
    { event_name: "tool_view", event_count: 10, tool_id: "5-3", source: "route", result_state: "" },
    { event_name: "analysis_completed", event_count: 4, tool_id: "5-3", source: "csv", result_state: "ready" },
    ...extra,
  ];

  it("splits the funnel by tool and keeps adjacent ratios only", () => {
    const funnels = buildToolFunnels(parseGrowthFunnelRows(rows()));
    expect(funnels.ok).toBe(true);
    expect(funnels.tools.map((tool) => tool.toolId)).toEqual(["5-2", "5-3"]);

    const dashboard = funnels.tools[0];
    expect(dashboard.stages.map((stage) => [stage.id, stage.count])).toEqual([
      ["viewed", 100], ["imported", 40], ["mapped", 30], ["completed", 25],
    ]);
    // 인접 비율: 40/100 · 30/40 · 25/30
    expect(dashboard.stages[1].rateFromPrevious).toBeCloseTo(0.4, 10);
    expect(dashboard.stages[2].rateFromPrevious).toBeCloseTo(0.75, 10);
    expect(dashboard.stages[3].rateFromPrevious).toBeCloseTo(25 / 30, 10);
    expect(dashboard.completionRate).toBeCloseTo(0.25, 10);
  });

  it("does not count demo runs or unfinished results as completions", () => {
    const funnels = buildToolFunnels(parseGrowthFunnelRows(rows([
      { event_name: "analysis_completed", event_count: 99, tool_id: "5-2", source: "demo", result_state: "ready" },
      { event_name: "analysis_completed", event_count: 7, tool_id: "5-2", source: "csv", result_state: "blocked" },
    ])));
    expect(funnels.tools[0].stages.find((stage) => stage.id === "completed").count).toBe(25);
  });

  it("reports import failures separately instead of as progress", () => {
    const funnels = buildToolFunnels(parseGrowthFunnelRows(rows([
      { event_name: "data_import_failed", event_count: 6, tool_id: "5-2", source: "csv", result_state: "" },
    ])));
    expect(funnels.tools[0].importFailures).toBe(6);
    // 실패가 임포트 단계를 부풀리지 않는다.
    expect(funnels.tools[0].stages.find((stage) => stage.id === "imported").count).toBe(40);
  });

  it("refuses to split when the export has no tool_id column", () => {
    const parsed = parseGrowthFunnelRows([{ event_name: "tool_view", event_count: 5 }]);
    expect(buildToolFunnels(parsed)).toEqual({ ok: false, reason: "missing_tool_id", tools: [] });
  });

  it("leaves the rate unknown rather than 0% when nobody entered the tool", () => {
    const funnels = buildToolFunnels(parseGrowthFunnelRows([
      { event_name: "analysis_completed", event_count: 3, tool_id: "5-4", source: "csv", result_state: "ready" },
    ]));
    expect(funnels.tools[0].completionRate).toBeNull();
    expect(funnels.tools[0].stages[0].count).toBe(0);
  });
});
