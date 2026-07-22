import { describe, expect, it } from "vitest";
import { mmmExcelSerialDateTimestamp, mmmParseNumericValue } from "./mmmInputUtils";

describe("mmmParseNumericValue", () => {
  it("converts Excel serial dates with the shared UTC rule", () => {
    expect(mmmExcelSerialDateTimestamp(45658)).toBe(Date.UTC(2025, 0, 1));
    expect(mmmExcelSerialDateTimestamp("45658.4")).toBe(Date.UTC(2025, 0, 1));
    expect(mmmExcelSerialDateTimestamp("45658.75")).toBe(Date.UTC(2025, 0, 1));
    expect(mmmExcelSerialDateTimestamp(104)).toBeNull();
  });

  it("preserves scientific notation and formatted currency values", () => {
    expect(mmmParseNumericValue("1e6")).toBe(1_000_000);
    expect(mmmParseNumericValue("1.2E+06")).toBe(1_200_000);
    expect(mmmParseNumericValue("₩ 1,250.5")).toBe(1250.5);
    expect(mmmParseNumericValue("(2,500)")).toBe(-2500);
    expect(mmmParseNumericValue("1.2M")).toBe(1_200_000);
    expect(mmmParseNumericValue("2K")).toBe(2_000);
    expect(mmmParseNumericValue("3억원")).toBe(300_000_000);
    expect(mmmParseNumericValue("4만")).toBe(40_000);
  });

  it("rejects blanks and strings containing multiple numeric tokens", () => {
    expect(Number.isNaN(mmmParseNumericValue(""))).toBe(true);
    expect(Number.isNaN(mmmParseNumericValue("1-2"))).toBe(true);
    expect(Number.isNaN(mmmParseNumericValue("2025-01-01"))).toBe(true);
    expect(Number.isNaN(mmmParseNumericValue("1.2MB"))).toBe(true);
  });
});
