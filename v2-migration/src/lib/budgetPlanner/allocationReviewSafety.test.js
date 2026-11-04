import { describe, expect, it } from "vitest";
import { actualForPlan } from "./planReview";
import { parseAllocationPlan, serializeAllocationPlan } from "./planSnapshot";
import { allocationHeadline, moveGroups, allocationPredictionChange } from "./allocationActions";

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
  it("does not automatically compare legacy snapshots or weekly aggregates", () => {
    expect(actualForPlan(plan({ scope: null }), rows, { currency: "KRW" })).toBeNull();
    expect(actualForPlan(plan({ scope: { currency: "KRW", cadence: "weekly" } }), rows, { currency: "KRW" })).toBeNull();
    expect(actualForPlan(plan({ scope: { currency: "" } }), rows, { currency: "KRW" })).toBeNull();
    expect(actualForPlan(plan(), rows.map(row => ({ ...row, cost: "" })), { currency: "KRW" })).toBeNull();
  });
});
