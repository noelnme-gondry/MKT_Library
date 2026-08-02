import { describe, expect, it } from "vitest";
import { deriveStatisticalStatus, statisticalStatusLabel, STATISTICAL_STATUS } from "./statisticalStatus";

describe("deriveStatisticalStatus", () => {
  it("separates insufficient data, non-identification, abstain, and caution", () => {
    expect(deriveStatisticalStatus()).toBe(STATISTICAL_STATUS.INSUFFICIENT_DATA);
    expect(deriveStatisticalStatus({ rowCount: 10, requiredMissing: ["cost"] })).toBe(STATISTICAL_STATUS.INSUFFICIENT_DATA);
    expect(deriveStatisticalStatus({ rowCount: 10, notIdentified: true })).toBe(STATISTICAL_STATUS.NOT_IDENTIFIED);
    expect(deriveStatisticalStatus({ rowCount: 10, abstain: true })).toBe(STATISTICAL_STATUS.ABSTAIN);
    expect(deriveStatisticalStatus({ rowCount: 10, warnings: ["sparse"] })).toBe(STATISTICAL_STATUS.CAUTION);
    expect(deriveStatisticalStatus({ rowCount: 10 })).toBe(STATISTICAL_STATUS.READY);
  });

  it("uses an explicit engine error state", () => {
    expect(deriveStatisticalStatus({ rowCount: 10, engineError: "inverse failed" })).toBe(STATISTICAL_STATUS.ENGINE_ERROR);
    expect(statisticalStatusLabel(STATISTICAL_STATUS.NOT_IDENTIFIED, "en")).toBe("Not identified");
    expect(statisticalStatusLabel(STATISTICAL_STATUS.INSUFFICIENT_DATA, "ko")).toBe("근거 부족");
  });
});
