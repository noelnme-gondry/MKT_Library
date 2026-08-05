import { describe, expect, it } from "vitest";
import { buildComparableDecisionActual } from "@/lib/decisionComparableActual";

const row = (date, cost = 100, actions = 10) => ({ date, metrics: { cost, actions } });
const record = {
  metric: "CPA",
  baseline: "CPA 12원",
  baselineDate: "2026-06-18",
  reviewDate: "2026-08-12",
  comparisonWindowDays: "7",
};

describe("comparable decision actual", () => {
  it("never treats an old CSV tail as a future review outcome", () => {
    const result = buildComparableDecisionActual(record, {
      today: "2026-08-05",
      canonicalData: { records: [row("2026-06-12"), row("2026-06-18")] },
    });
    expect(result).toMatchObject({ state: "not_due", latestDataDate: "2026-06-18", comparisonStart: "2026-08-12" });
  });

  it("requires a complete, same-length post-review window before suggesting CPA", () => {
    const partial = buildComparableDecisionActual(record, {
      today: "2026-08-20",
      canonicalData: { records: Array.from({ length: 6 }, (_, index) => row(`2026-08-${String(12 + index).padStart(2, "0")}`)) },
    });
    expect(partial).toMatchObject({ state: "incomplete_window", observedDays: 6 });

    const ready = buildComparableDecisionActual(record, {
      today: "2026-08-20",
      canonicalData: { records: Array.from({ length: 7 }, (_, index) => row(`2026-08-${String(12 + index).padStart(2, "0")}`)) },
    });
    expect(ready).toMatchObject({ state: "ready", actual: "CPA 10원", comparisonStart: "2026-08-12", comparisonEnd: "2026-08-18" });
  });
});
