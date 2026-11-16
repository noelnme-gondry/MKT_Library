import { describe, expect, it } from "vitest";
import { finderCards } from "./analysisFinder";
import { finderPreview } from "./finderPreviews";
import { computeOperationsFinderPreviews } from "./operationsPreview.compute";
import operationsPreview from "./operationsPreview.json";
import examples from "@/lib/blogExamples/data.json";
import { exampleHref } from "@/lib/exampleLink";

describe("finder example evidence", () => {
  it("keeps the static planner preview equal to the planner's current calculation", () => {
    expect(operationsPreview).toEqual(computeOperationsFinderPreviews());
  });

  it.each(["ko", "en"])("uses verified source values and routes each picture to its illustrated tool (%s)", locale => {
    const cards = finderCards(locale);
    const illustrated = cards.filter(card => card.preview);
    expect(illustrated.length).toBeGreaterThan(20);
    for (const card of illustrated) {
      const preview = card.preview;
      expect(preview.rows.length).toBeGreaterThan(0);
      expect(preview.rows.every(row => Number.isFinite(row.value))).toBe(true);
      expect(card.exampleHref).toBeTruthy();
      const source = Object.keys(examples).sort().map(key => examples[key]).find(entry => entry.source === "demo" && entry.toolId === preview.toolId);
      if (source) {
        expect(preview.rows.map(row => row.value)).toEqual(source.bars.map(row => row.value));
        expect(preview.headline).toBe(source[locale].headline);
        expect(preview.caption).toBe(source[locale].caption);
      }
      if (preview.kind === "intervals") for (const row of preview.rows) {
        expect(row.low).toBeLessThanOrEqual(row.value);
        expect(row.high).toBeGreaterThanOrEqual(row.value);
      }
      if (locale === "en") expect(/[가-힣]/.test(JSON.stringify(preview))).toBe(false);
    }
    const grouped = cards.find(card => card.id === "5-18-trend");
    expect(grouped.preview.toolId).toBe("5-18-paid-organic");
    expect(grouped.exampleHref).toBe(exampleHref("5-18-paid-organic", locale));
    expect(finderPreview("unknown-tool", locale)).toBeNull();
  });

  it("preserves zero counts, negative changes and directionless shares", () => {
    const creative = finderPreview("9-6");
    expect(creative.kind).toBe("counts");
    expect(creative.rows.some(row => row.value === 0)).toBe(true);
    expect(creative.rows.reduce((sum, row) => sum + row.value, 0)).toBe(63);
    expect(finderPreview("5-21").rows.some(row => row.value < 0)).toBe(true);
    const parts = finderPreview("5-27");
    expect(parts.kind).toBe("parts");
    expect(parts.rows.reduce((sum, row) => sum + row.value, 0)).toBeCloseTo(1, 8);
    expect(finderPreview("5-42").kind).toBe("range");
  });
});
