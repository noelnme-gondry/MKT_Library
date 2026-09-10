import { expect, it } from "vitest";
import { summarizeSampleSpend } from "./sampleSpendPreview";

it("sums channels within the latest seven dates, excluding older spend", () => {
  const rows = Array.from({ length: 8 }, (_, i) => ({ date: `2024-01-0${i + 1}`, cost: 10 }));
  rows.push({ date: "2024-01-08", cost: 30 });
  const result = summarizeSampleSpend(rows.reverse());
  expect(result.total).toBe(100);
  expect(result.dates).toHaveLength(7);
  expect(result.peakDay).toEqual({ date: "2024-01-08", cost: 40 });
});
