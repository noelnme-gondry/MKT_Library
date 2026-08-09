import { describe, expect, it } from "vitest";
import { buildVifSpendPanel } from "./vifReadiness";

describe("VIF spend-panel readiness", () => {
  it("distinguishes fixed channels from independently varying inputs", () => {
    const fixed = buildVifSpendPanel(Array.from({ length: 6 }, (_, day) => ["A", "B"].map((entity) => ({
      date: `2026-08-${String(day + 1).padStart(2, "0")}`, entity, cost: 100,
    }))).flat());
    expect(fixed.variableEntityIndices).toEqual([]);

    const varying = buildVifSpendPanel(Array.from({ length: 6 }, (_, day) => ["A", "B"].map((entity, index) => ({
      date: `2026-08-${String(day + 1).padStart(2, "0")}`, entity, cost: 100 + day * (index + 1),
    }))).flat());
    expect(varying.variableEntityIndices).toEqual([0, 1]);
  });

  it("excludes blank and non-numeric spend from dates and entities", () => {
    const panel = buildVifSpendPanel([
      { date: "2026-08-01", entity: "Null", cost: null },
      { date: "2026-08-02", entity: "Empty", cost: "" },
      { date: "2026-08-03", entity: "Space", cost: "   " },
      { date: "2026-08-04", entity: "Text", cost: "not-a-number" },
      { date: "2026-08-05", entity: "Zero", cost: 0 },
    ]);
    expect(panel.dates).toEqual(["2026-08-05"]);
    expect(panel.entities).toEqual(["Zero"]);
    expect(panel.matrix).toEqual([[0]]);
  });

  it("normalizes equivalent dates and formatted currency before grouping", () => {
    const panel = buildVifSpendPanel([
      { date: "2026-08-01", entity: "A", cost: "₩1,000" },
      { date: "2026/08/01", entity: "A", cost: "$2,000" },
      { date: "not-a-date", entity: "B", cost: 300 },
    ]);
    expect(panel.dates).toEqual(["2026-08-01"]);
    expect(panel.entities).toEqual(["A"]);
    expect(panel.matrix).toEqual([[3000]]);
  });
});
