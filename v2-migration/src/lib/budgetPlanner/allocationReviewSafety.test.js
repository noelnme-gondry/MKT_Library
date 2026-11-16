import { describe, expect, it } from "vitest";
import { actualForPlan } from "./planReview";
import { parseAllocationPlan, serializeAllocationPlan } from "./planSnapshot";
import { allocationHeadline, moveGroups, allocationPredictionChange, allocationPredictionComparison } from "./allocationActions";

const plan = (extra = {}) => parseAllocationPlan(serializeAllocationPlan({
  start: "2026-10-01", days: 7, metric: "installs", unitField: "channel", byPlatform: false,
  targets: [{ unit: "KR · Meta", cost: 700, results: 70 }],
  scope: { countries: ["KR"], channels: ["Meta"], platform: "ios", currency: "KRW", cadence: "daily" }, ...extra,
}));
const rows = Array.from({ length: 7 }, (_, i) => `2026-10-0${i + 1}`).flatMap(date => [
  { date, country: "KR", channel: "Meta", platform: "iOS", cost: 100, installs: 10 },
  { date, country: "KR", channel: "Meta", platform: "Android", cost: 900, installs: 1 },
]);
describe("saved plan comparisons preserve the actual evidence", () => {
  it("keeps the selected OS even when the allocation groups OS together", () => {
    expect(actualForPlan(plan(), rows, { currency: "KRW" })).toEqual([{ unit: "KR · Meta", cost: 700, results: 70 }]);
  });
  it("withholds a comparison with missing days rather than imputing zero spend", () => {
    expect(actualForPlan(plan(), rows.filter(row => row.date !== "2026-10-04"), { currency: "KRW" })).toBeNull();
  });
  it("withholds a different or unconfirmed currency", () => {
    expect(actualForPlan(plan(), rows, { currency: "USD" })).toBeNull();
    expect(actualForPlan(plan(), rows)).toBeNull();
  });
  it("does not call a prediction gap a reallocation effect when nothing moved", () => {
    const result = allocationHeadline({ groups: moveGroups([]), change: -0.2, metricLabel: "CPI", money: String });
    expect(result.text).not.toMatch(/재배분 효과|20.0%/);
  });
  it("compares the current and revised budgets on the same curve", () => {
    const models = new Map([["Meta", { model: { type: "Linear", predict: cost => 10 + cost / 100 } }]]);
    expect(allocationPredictionChange([{ channel: "Meta", current: 100, cost: 100, results: 100 / 11 }], models)).toBeCloseTo(0, 10);
    expect(allocationPredictionChange([{ channel: "Meta", current: 100, cost: 200, results: 200 / 12 }], models)).toBeCloseTo(12 / 11 - 1, 10);
  });
  it("shares modeled amounts and their exact relative change without an observed-to-predicted gap", () => {
    const models = new Map([["Meta", { model: { type: "Linear", predict: cost => 1541 + (cost - 970000) * 34 / 30000 } }]]);
    const items = [{ channel: "Meta", current: 1000000, cost: 970000, results: 970000 / 1541, resultsBasis: "curve" }];
    const result = allocationPredictionComparison(items, models);
    expect(result.current.cpr).toBe(1575);
    expect(result.next.cpr).toBeCloseTo(1541, 10);
    expect(result.change).toBeCloseTo(1541 / 1575 - 1, 12);
    expect((result.change * 100).toFixed(1)).toBe("-2.2");
    expect(result.next.results).toBeLessThan(result.current.results);
    expect(result.byChannel.get("Meta").current.results).toBe(result.current.results);
    const roas = allocationPredictionComparison(items, models, true);
    expect(roas.change).toBeCloseTo(1575 / 1541 - 1, 12);
    expect(allocationPredictionChange(items, models)).toBe(result.change);
  });
  it("withholds aggregate comparisons when one target uses a recent-average fallback", () => {
    const models = new Map(["Meta", "Search"].map(name => [name, { model: { type: "Linear", predict: () => 10 } }]));
    const result = allocationPredictionComparison([
      { channel: "Meta", current: 100, cost: 100, results: 10, resultsBasis: "curve" },
      { channel: "Search", current: 100, cost: 100, results: 50, resultsBasis: "recent_average" },
    ], models);
    expect(result.byChannel.get("Meta").current.results).toBe(10);
    expect(result.byChannel.get("Search").current.results).toBeNull();
    expect(result.current.results).toBeNull();
    expect(result.next.results).toBeNull();
    expect(result.change).toBeNull();
    expect(allocationPredictionComparison([], models).current.results).toBeNull();
    expect(allocationPredictionComparison([{ channel: "Meta", current: 100, cost: 100, results: NaN }], models).change).toBeNull();
  });
  it("does not automatically compare legacy snapshots or weekly aggregates", () => {
    expect(actualForPlan(plan({ scope: null }), rows, { currency: "KRW" })).toBeNull();
    expect(actualForPlan(plan({ scope: { currency: "KRW", cadence: "weekly" } }), rows, { currency: "KRW" })).toBeNull();
    expect(actualForPlan(plan({ scope: { currency: "" } }), rows, { currency: "KRW" })).toBeNull();
    expect(actualForPlan(plan(), rows.map(row => ({ ...row, cost: "" })), { currency: "KRW" })).toBeNull();
  });
});
