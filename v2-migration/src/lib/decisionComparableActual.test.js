import { describe, expect, it } from "vitest";
import { buildComparableDecisionActual } from "@/lib/decisionComparableActual";
import { createDecisionComparisonScope } from "@/lib/decisionComparisonScope";

const row = (date, cost = 100, actions = 10) => ({ date, metrics: { cost, actions } });
const record = {
  metric: "CPA",
  baseline: "CPA 12원",
  baselineDate: "2026-08-11",
  reviewDate: "2026-08-18",
  comparisonWindowDays: "7",
  comparisonScope: createDecisionComparisonScope({ dataGroup: "efficiency", filter: { channels: new Set(["Meta"]) } }),
};

describe("comparable decision actual", () => {
  it("never treats an old CSV tail as a future review outcome", () => {
    const result = buildComparableDecisionActual(record, {
      today: "2026-08-05",
      canonicalData: { records: [row("2026-06-12"), row("2026-06-18")] },
      dataGroup: "efficiency",
    });
    expect(result).toMatchObject({ state: "not_due", latestDataDate: "2026-06-18", comparisonStart: "2026-08-12" });
  });

  it("requires a complete, same-length post-baseline window before suggesting CPA", () => {
    const partial = buildComparableDecisionActual(record, {
      today: "2026-08-20",
      canonicalData: { records: Array.from({ length: 6 }, (_, index) => ({ ...row(`2026-08-${String(12 + index).padStart(2, "0")}`), dimensions: { channel: "Meta" } })) },
      dataGroup: "efficiency",
    });
    expect(partial).toMatchObject({ state: "incomplete_window", observedDays: 6 });

    const ready = buildComparableDecisionActual(record, {
      today: "2026-08-20",
      canonicalData: { records: Array.from({ length: 7 }, (_, index) => ({ ...row(`2026-08-${String(12 + index).padStart(2, "0")}`), dimensions: { channel: "Meta" } })) },
      dataGroup: "efficiency",
    });
    expect(ready).toMatchObject({ state: "ready", actual: "10원 · CPA", comparisonStart: "2026-08-12", comparisonEnd: "2026-08-18" });
  });

  it("refuses a candidate from a different CSV group or filter", () => {
    const rows = Array.from({ length: 7 }, (_, index) => ({
      ...row(`2026-08-${String(12 + index).padStart(2, "0")}`, 100, 10),
      dimensions: { channel: index === 0 ? "Google" : "Meta" },
    }));
    const wrongGroup = buildComparableDecisionActual(record, { today: "2026-08-20", canonicalData: { records: rows }, dataGroup: "response" });
    expect(wrongGroup.state).toBe("dataset_mismatch");

    const filtered = buildComparableDecisionActual(record, { today: "2026-08-20", canonicalData: { records: rows }, dataGroup: "efficiency" });
    expect(filtered).toMatchObject({ state: "incomplete_window", observedDays: 6 });
  });
});
