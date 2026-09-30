import { describe, expect, it } from "vitest";
import { decisionCostBounds, decisionCostTick } from "./scaleDecisionAxis";

describe("decision cost axis presentation", () => {
  it("pads clustered demo costs without changing their reference or order", () => {
    const values = [587838254, 590996664, 592271171, 622093452];
    const bounds = decisionCostBounds(values);
    expect(bounds.min).toBeLessThan(values[0]);
    expect(bounds.max).toBeGreaterThan(values[3]);
    expect(bounds.min).toBeGreaterThan(0);
    expect(decisionCostBounds([100, 100]).min).toBeLessThan(100);
    expect(decisionCostBounds([100, 100]).max).toBeGreaterThan(100);
    expect(decisionCostBounds([1, 1000]).min).toBe(0);
  });
  it.each(["ko", "en"])("keeps close ticks distinct in %s without changing currency", locale => {
    for (const values of [[580000000, 590000000, 600000000, 610000000, 620000000, 630000000], [590000000, 590010000, 590020000], [0, 0.001, 0.002]]) {
      const ticks = values.map(value => ({ value }));
      const labels = values.map(value => decisionCostTick(value, ticks, "KRW", locale));
      expect(new Set(labels).size).toBe(values.length);
      labels.forEach(label => expect(label.startsWith("₩")).toBe(true));
    }
    expect(decisionCostTick(1500, [{ value: 1000 }, { value: 1500 }], "USD", locale)).toBe("$1.5K");
  });
});
