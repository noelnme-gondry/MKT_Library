import { describe, expect, it } from "vitest";
import { buildOperationsDemo } from "./operationsDemo";
import { getMappedRows } from "@/utils/dashboardAggregator";
import { operationsSourceRows, operationsPeriods, prepareOperationsIntervals } from "./operationsIntervals";
import { prepareOperationsBrief, planOperationsBudget } from "./operationsBrief";
import { planOperationsScenario } from "./operationsScenario";
import { buildOperationsHistory, compareOperationsChange } from "./changeHistory";
import { operationRecommendations } from "./operationLoop";
import { readOperationAction } from "./actionContract";

const demo = buildOperationsDemo("ko");
const daily = operationsSourceRows(getMappedRows(demo));
const prepare = (rows, extra = {}) => prepareOperationsIntervals({ rows, periods: operationsPeriods(rows), metric: "installs", mappedFields: Object.values(demo.mapping), ...extra });
const row = (date, cost, installs = cost / 10) => ({ date, cost, installs, country: "KR", channel: "A", campaign_name: "Test", creative_id: "C" });

describe("operations source intervals", () => {
  it("preserves the daily same-budget solution and calendar comparisons", () => {
    const brief = prepare(daily), old = prepareOperationsBrief({ rows: daily, periods: operationsPeriods(daily), metric: "installs" });
    const plan = planOperationsScenario(brief), prior = planOperationsBudget(old);
    expect(plan.ok).toBe(true);
    expect(plan.expectedResults).toBeCloseTo(prior.expectedResults, 7);
    expect(brief.current).toEqual(old.current);
    expect(brief.models.size).toBe(4);
    expect(brief.creatives.find(c => c.days === 5)).toMatchObject({ performanceStart: "2026-10-02", performanceEnd: "2026-10-06" });
  });
  it("keeps weekly observations as intervals instead of creating seven daily points", () => {
    const rows = operationsSourceRows([row("2026-W39", 700), row("2026-W40", 1400)]), brief = prepare(rows);
    expect(rows[1]).toMatchObject({ date: "2026-09-28", periodEnd: "2026-10-04", sourceGrain: "week" });
    expect(brief.campaigns[0].trend).toHaveLength(2);
    expect(brief.current.cost).toBe(1400);
    expect(Object.values(brief.currentSpends)[0]).toBe(200);
    expect(brief.creatives[0]).toMatchObject({ days: 7, observationCount: 1 });
    expect(planOperationsScenario(brief).ok).toBe(false);
    expect(prepare(rows, { grain: "day" }).budgetHolds).toContainEqual({ reason: "grain" });
  });
  it("uses real calendar month lengths and normalizes spending comparisons", () => {
    const rows = operationsSourceRows([row("2028-01", 3100), row("2028-02", 2900), row("2028-03", 6200)]), brief = prepare(rows);
    expect(brief.periods.previous).toEqual({ start: "2028-02-01", end: "2028-02-29" });
    expect(brief.campaigns[0].trend.map(d => d.cost)).toEqual([100, 100, 200]);
    expect(brief.campaigns[0].trend).toHaveLength(3);
    const history = buildOperationsHistory(rows);
    expect(history.dates).toEqual(["2028-01-01", "2028-02-01", "2028-03-01"]);
    expect(history.events.filter(e => e.kind === "spend")).toHaveLength(1);
    const event = history.events.find(e => e.kind === "spend");
    expect(event).toMatchObject({ date: "2028-03-01", change: 1, comparison: { ok: true, days: 31, previousDays: 29, costChange: 1 } });
    expect(history.end).toBe("2028-03-31");
  });
  it("withholds partial source intervals rather than displaying a whole month's total as days", () => {
    const rows = operationsSourceRows([row("2026-09", 3000), row("2026-10", 3100)]);
    const periods = { current: { start: "2026-10-01", end: "2026-10-15" }, previous: { start: "2026-09-01", end: "2026-09-30" } };
    const brief = prepare(rows, { periods });
    expect(brief.comparisonAvailable).toBe(false);
    expect(brief.currentAvailable).toBe(false);
    expect(brief.current.cost).toBeNull();
    expect(brief.campaigns[0].current.cost).toBeNull();
    expect(brief.campaigns[0].pvm).toBeNull();
    expect(planOperationsScenario(brief).holds).toContainEqual({ reason: "interval" });
    expect(compareOperationsChange(rows, { date: "2026-10-01", target: brief.campaigns[0].target, days: 7 })).toMatchObject({ ok: false, reason: "coverage" });
  });
  it("retains complete current inputs when the comparison period is invalid", () => {
    const periods = operationsPeriods(daily, { compareEnabled: true, dateStart: "2026-07-01", dateEnd: "2026-07-02", comparisonStart: "2026-09-01", comparisonEnd: "2026-09-07" });
    const brief = prepare(daily, { periods });
    expect(brief.comparisonAvailable).toBe(false);
    expect(brief.currentAvailable).toBe(true);
    expect(planOperationsScenario(brief).ok).toBe(false);
  });
  it("does not use incomplete weekly buckets or unknown values in a curve", () => {
    const weekly = prepare(daily, { grain: "week" });
    expect(weekly.campaigns.every(c => c.incompleteIntervals === 2)).toBe(true);
    expect(weekly.campaigns.every(c => c.trend.length === 13)).toBe(true);
    const invalid = daily.map((r, i) => i === 0 ? { ...r, installs: null } : r);
    expect(prepare(invalid).budgetHolds.some(h => h.reason === "missing")).toBe(true);
  });
  it("keeps full-history change detection independent of the displayed comparison period", () => {
    const periods = operationsPeriods(daily, { compareEnabled: true, dateStart: "2026-08-01", dateEnd: "2026-08-07", comparisonStart: "2026-07-25", comparisonEnd: "2026-07-31" });
    expect(prepare(daily, { periods }).campaigns.every(c => c.trend.every(p => p.date <= periods.current.end))).toBe(true);
    expect(buildOperationsHistory(daily).events.some(e => e.date > periods.current.end)).toBe(true);
  });
  it("does not label mixed daily and monthly totals as daily change events", () => {
    const rows = operationsSourceRows([row("2026-09", 30000), row("2026-10-01", 1000), row("2026-10-02", 2000)]);
    expect(buildOperationsHistory(rows)).toMatchObject({ unknownIntervals: true, events: [], scanned: 0 });
    expect(prepare(rows).budgetHolds).toContainEqual({ reason: "grain" });
  });
  it("carries the chosen period and total through the action allowlist without raw data", () => {
    const brief = prepare(daily), plan = planOperationsScenario(brief), proposal = operationRecommendations(brief, plan, [])[0];
    const saved = readOperationAction({ ...proposal, version: 1, planContext: { ...proposal.planContext, raw: daily } });
    expect(saved.planContext).toEqual({ mode: "maintain", ...plan.planRange, totalBudget: plan.totalBudget * 7 });
    expect(saved.plannedDate).toBe(plan.planRange.start);
    expect(saved.reviewDays).toBe(7);
    expect(saved.afterBudget).toBe(proposal.afterBudget);
    expect(JSON.stringify(saved)).not.toContain('"raw"');
  });
});
