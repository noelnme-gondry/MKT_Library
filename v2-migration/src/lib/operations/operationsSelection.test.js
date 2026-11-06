import { describe, expect, it } from "vitest";
import { buildOperationsDemo } from "./operationsDemo";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { predictAllocationCost } from "@/utils/allocationModels";
import { operationsPeriods, operationsSourceRows, prepareOperationsIntervals } from "./operationsIntervals";
import { planOperationsScenario } from "./operationsScenario";
import { defaultOperationsSelection, forecastOperationsSelection, isRecommendedSelection, operationsPlanDrafts, operationsSelectionRanges } from "./operationsSelection";
import { createOperationRecord, operationForecastCheck, reviewOperationRecord } from "./operationLoop";
import { readOperationAction } from "./actionContract";
import { sanitizeDecisionReviewRecord } from "@/lib/decisionReview";
import { shiftDate } from "./changeHistory";

// 플래너와 같은 경로로 brief·추천안을 만든다(OperationsPlanner의 입력 조립과 같다).
const demo = buildOperationsDemo("ko");
const rows = operationsSourceRows(getMappedRows(demo));
const periods = operationsPeriods(rows, {}, 7);
const brief = prepareOperationsIntervals({ rows, periods, metric: "installs", mappedFields: Object.values(demo.mapping) });
const plan = planOperationsScenario(brief);

describe("operations selection forecast", () => {
  it("reproduces the recommended plan exactly when every recommendation is kept", () => {
    expect(plan.ok).toBe(true);
    const choices = defaultOperationsSelection(plan);
    const forecast = forecastOperationsSelection(brief, plan, choices);
    expect(forecast.ok).toBe(true);
    expect(isRecommendedSelection(plan, choices)).toBe(true);
    // 고른 대상은 추천안과 같은 예측, 고르지 않은 대상(1% 미만 변화)은 유지안 예측.
    for (const item of forecast.items) {
      const recommended = plan.items.find(row => row.id === item.id);
      expect(item.expectedResults).toBeCloseTo(item.selected ? recommended.expectedResults : recommended.currentResults, 9);
    }
    expect(forecast.totals.baselineResults).toBeCloseTo(plan.baselineResults, 9);
    expect(forecast.changed.length).toBeGreaterThan(0);
  });

  it("keeps unselected campaigns at current spend and predicts the chosen amount with the same model", () => {
    const choices = defaultOperationsSelection(plan);
    const [first, second] = plan.items;
    const ranges = operationsSelectionRanges(brief);
    const amount = (ranges.get(first.id).min + ranges.get(first.id).max) / 2;
    choices[first.id] = { selected: true, budget: amount };
    choices[second.id] = { ...choices[second.id], selected: false };
    const forecast = forecastOperationsSelection(brief, plan, choices);
    const chosen = forecast.items.find(item => item.id === first.id), kept = forecast.items.find(item => item.id === second.id);
    expect(chosen.expectedResults).toBeCloseTo(predictAllocationCost(brief.models.get(first.id), amount).results, 9);
    expect(kept).toMatchObject({ selected: false, budget: second.current, expectedResults: second.currentResults, status: "keep" });
    expect(forecast.totals.spend).toBeCloseTo(forecast.items.reduce((sum, item) => sum + item.budget, 0), 9);
    expect(forecast.totals.expectedCpr).toBeCloseTo(forecast.totals.spend / forecast.totals.expectedResults, 9);
    expect(isRecommendedSelection(plan, choices)).toBe(false);
  });

  it("withholds the total when a chosen amount is outside the observed range instead of extrapolating", () => {
    const choices = defaultOperationsSelection(plan);
    const id = plan.items[0].id, range = operationsSelectionRanges(brief).get(id);
    choices[id] = { selected: true, budget: range.max * 1.5 };
    const forecast = forecastOperationsSelection(brief, plan, choices);
    expect(forecast.ok).toBe(false);
    expect(forecast.invalid).toEqual([id]);
    expect(forecast.totals).toBeNull();
    expect(forecast.items[0]).toMatchObject({ status: "range", expectedResults: null });
  });
});

describe("saved plan forecast", () => {
  const forecast = forecastOperationsSelection(brief, plan, defaultOperationsSelection(plan));
  const drafts = operationsPlanDrafts({ brief, plan, forecast, planId: "plan-1", plannedDate: plan.planRange.start, metric: "installs", currency: "KRW" });

  it("saves one budget action per changed campaign with its daily forecast and the shared plan totals", () => {
    expect(drafts).toHaveLength(forecast.changed.length);
    for (const draft of drafts) {
      const record = sanitizeDecisionReviewRecord(createOperationRecord({ draft, today: plan.planRange.start, sourceThrough: periods.current.end }), "5-31");
      const action = readOperationAction(record.operationAction);
      const item = forecast.items.find(row => row.budget === draft.afterBudget);
      expect(action.forecast).toEqual({ days: 7, dailySpend: item.budget, dailyResults: item.expectedResults, currentDailySpend: item.current, currentDailyResults: item.currentResults });
      expect(action.planContext).toMatchObject({ planId: "plan-1", selected: drafts.length });
      expect(action.planContext.expectedResults).toBeCloseTo(forecast.totals.expectedResults * 7, 6);
      expect(action.beforeBudget).toBeNull();
      expect(action.reviewDays).toBe(7);
      expect(record.action).toContain("예상 CPI");
    }
  });

  it("drops the forecast when the amount is edited, and never stores one on creative actions", () => {
    const edited = readOperationAction(createOperationRecord({ draft: { ...drafts[0], afterBudget: drafts[0].afterBudget + 1000 }, today: plan.planRange.start }).operationAction);
    expect(edited.forecast).toBeUndefined();
    expect(readOperationAction({ ...drafts[0], version: 1, kind: "creative_stop", creative: "A" }).forecast).toBeUndefined();
    expect(readOperationAction({ ...drafts[0], version: 1, forecast: { ...drafts[0].forecast, days: 0 } }).forecast).toBeUndefined();
  });

  it("compares the forecast with the same post-execution window and refuses a different window", () => {
    // 실행 후 7일을 예측과 다른 실제로 채운다: 지출은 계획대로, 결과는 예측의 80%.
    const executed = { ...drafts[0], state: "executed", executedDate: shiftDate(periods.current.end, 1) };
    const target = executed.target, f = executed.forecast;
    const future = Array.from({ length: 7 }, (_, d) => ({ ...rows.find(row => row.campaign_name === target.campaign && row.channel === target.channel), date: shiftDate(executed.executedDate, d), periodEnd: shiftDate(executed.executedDate, d),
      cost: f.dailySpend, installs: f.dailyResults * 0.8, creative_id: "c1" }));
    const record = createOperationRecord({ draft: executed, today: shiftDate(executed.executedDate, 10) });
    const review = reviewOperationRecord(record, [...rows, ...future], { metric: "installs", currency: "KRW", today: shiftDate(executed.executedDate, 10) });
    expect(review.state).toBe("ready");
    expect(review.forecastCheck.ok).toBe(true);
    expect(review.forecastCheck.spendGap).toBeCloseTo(0, 9);
    expect(review.forecastCheck.resultsGap).toBeCloseTo(-0.2, 9);
    expect(review.forecastCheck.cprGap).toBeCloseTo(1 / 0.8 - 1, 9);
    const action = readOperationAction(record.operationAction);
    expect(operationForecastCheck({ ...action, reviewDays: 14 }, review.comparison)).toEqual({ ok: false, reason: "window" });
    expect(operationForecastCheck({ ...action }, { ok: false, reason: "coverage" })).toEqual({ ok: false, reason: "coverage" });
  });
});
