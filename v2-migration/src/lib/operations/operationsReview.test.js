import { describe, expect, it } from "vitest";
import { operationsDailyTrend, prepareOperationsBrief, planOperationsBudget } from "./operationsBrief";
import { operationsReviewCandidates, stageWaterfall } from "./operationsReview";
import { buildOperationsDemo } from "./operationsDemo";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { dashboardPeriods } from "@/lib/analysis-results/dashboardPeriods";
import { fmtCurrency } from "@/utils/format";

describe("chart evidence and review handoff", () => {
  it("aggregates portfolio daily ratios by outcome counts and leaves a missing day unavailable", () => {
    const trend = operationsDailyTrend([
      { date: "2026-10-01", cost: 100, installs: 10 }, { date: "2026-10-01", cost: 900, installs: 30 },
      { date: "2026-10-03", cost: 200, installs: "" },
    ], "installs");
    expect(trend).toEqual([
      { date: "2026-10-01", cost: 1000, results: 40, cpr: 25 },
      { date: "2026-10-02", cost: null, results: null, cpr: null },
      { date: "2026-10-03", cost: null, results: null, cpr: null },
    ]);
    expect(operationsDailyTrend([], "installs")).toEqual([]);
  });

  it("keeps signed waterfall contributions on the correct cumulative level", () => {
    const bars = stageWaterfall({ ok: true, start: 100, finish: 130, stages: [
      { key: "cpm", contribution: 50 }, { key: "conversion", contribution: -20 },
    ] }, value => typeof value === "string" ? value : value.key);
    expect(bars.map(row => row.range)).toEqual([[0, 100], [100, 150], [150, 130], [0, 130]]);
    expect(bars.map(row => row.amount)).toEqual([100, 50, -20, 130]);
    expect(stageWaterfall({ ok: false }, String)).toEqual([]);
  });

  it.each(["ko", "en"])("separates observed baselines, scoped manual review and demo predictions (%s)", locale => {
    const csv = buildOperationsDemo(locale), periods = dashboardPeriods(csv, {}, 7);
    const brief = prepareOperationsBrief({ rows: getMappedRows(csv), periods, mappedFields: Object.values(csv.mapping) });
    const plan = planOperationsBudget(brief);
    const candidates = operationsReviewCandidates({ brief, plan, currency: "KRW", locale });
    const budget = candidates.find(row => row.id === "budget");
    expect(budget.automatic).toBe(true);
    expect(budget.prefill.baseline).toBe(fmtCurrency(brief.current.cpr, { currency: "KRW", precise: true }));
    expect(budget.prefill.baseline).not.toBe(fmtCurrency(plan.baselineCpr, { currency: "KRW", precise: true }));
    expect(budget.prefill.baselineDate).toBe("2026-10-06");
    expect(budget.prefill.reviewDate).toBe("2026-10-13");
    expect(budget.prefill.comparisonWindowDays).toBe(7);
    expect(candidates.filter(row => row.kind === "creative")).toHaveLength(2);
    expect(candidates.filter(row => row.kind !== "budget").every(row => !row.automatic)).toBe(true);
    const zero = operationsReviewCandidates({ brief, plan: planOperationsBudget(brief, { changeLimit: 0 }), currency: "KRW", locale })[0];
    expect(zero.prefill.actionKind).toBe("hold");
    expect(zero.prefill.action).not.toContain("→");
    expect(operationsReviewCandidates({ brief, plan: { ok: false }, currency: "KRW", locale }).some(row => row.id === "budget")).toBe(false);
  });
});
