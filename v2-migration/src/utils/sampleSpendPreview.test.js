import { expect, it } from "vitest";
import { summarizeSampleSpend, compareSamplePerformance } from "./sampleSpendPreview";

it("compares weighted CPA across equal windows and excludes organic actions", () => {
  const rows = Array.from({ length: 14 }, (_, i) => ({ date: `2024-01-${String(i + 1).padStart(2, "0")}`, source: "paid", channel: "A", cost: i < 7 ? 100 : 200, actions: 10 }));
  rows.push({ date: "2024-01-14", source: "organic", channel: "Organic", cost: 0, actions: 10000 });
  const result = compareSamplePerformance(rows);
  expect(result.prior.cpa).toBe(10);
  expect(result.recent.cpa).toBe(20);
  expect(result.cpaChange).toBe(1);
  expect(result.channels).toHaveLength(1);
  expect(compareSamplePerformance(rows.slice(0, 5))).toBeNull();
  expect(compareSamplePerformance(rows.map(row => ({ ...row, actions: 0 }))).cpaChange).toBeNull();
});

it("sums channels within the latest seven dates, excluding older spend", () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ date: `2024-01-0${i + 1}`, cost: 10 }));
  rows.push({ date: "2024-01-08", cost: 30 });
  const result = summarizeSampleSpend(rows.reverse());
  expect(result.total).toBe(100);
  expect(result.dates).toHaveLength(7);
  expect(result.peakDay).toEqual({ date: "2024-01-08", cost: 40 });
});
