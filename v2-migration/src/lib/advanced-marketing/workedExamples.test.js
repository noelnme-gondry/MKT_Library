import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { computeAdvancedExamples, computeAdvancedGuideSummaries } from "./workedExamples.compute";
import { ADVANCED_IDS } from "./registry";
import { ADVANCED_READING } from "./reading";

const dataPath = fileURLToPath(new URL("./workedExamples.json", import.meta.url));
const summaryPath = fileURLToPath(new URL("./guideSummaries.json", import.meta.url));
describe("advanced worked examples", () => {
  it("derives lightweight shared summaries from the complete tool-specific reading", () => {
    const serialized = `${JSON.stringify(computeAdvancedGuideSummaries(), null, 1)}\n`;
    if (process.env.UPDATE_ADVANCED_EXAMPLES) writeFileSync(summaryPath, serialized);
    expect(readFileSync(summaryPath, "utf8")).toBe(serialized);
  });
  it("matches all twelve real engine runs without changing their outputs", () => {
    const examples = computeAdvancedExamples();
    const serialized = `${JSON.stringify(examples, null, 1)}\n`;
    // Same update pattern as blogExamples; never hand-edit result numbers.
    if (process.env.UPDATE_ADVANCED_EXAMPLES) writeFileSync(dataPath, serialized);
    expect(readFileSync(dataPath, "utf8")).toBe(serialized);
    expect(Object.keys(examples)).toEqual(ADVANCED_IDS);
    for (const id of ADVANCED_IDS) {
      expect(examples[id].rowCount).toBeGreaterThan(3);
      expect(examples[id].metrics.some((metric) => Number.isFinite(metric.value))).toBe(true);
      for (const key of ["method", "check", "prep"]) for (const lang of ["ko", "en"])
        expect(ADVANCED_READING[id][key][lang].length).toBeGreaterThan(40);
    }
    expect(new Set(ADVANCED_IDS.map((id) => ADVANCED_READING[id].method.ko)).size).toBe(12);
  }, 60000);
});
