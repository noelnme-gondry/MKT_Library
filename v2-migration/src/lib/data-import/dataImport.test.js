import { describe, expect, it } from "vitest";
import { normalizeDateValue, normalizeNumericValue } from "./normalizeValues";
import { profileColumns } from "./profileColumns";
import { scoreMappingCandidates } from "./scoreMappingCandidates";
import { STANDARD_FIELDS } from "@/utils/csvConstants";

describe("data import foundation", () => {
  const rows = [
    { 일자: "2026.07.01", 소진액: "₩1,200,000", 성과: "24", ROAS: "125%" },
    { 일자: "2026.07.02", 소진액: "1,350,000원", 성과: "31", ROAS: "118%" },
  ];

  it("normalizes currency, percent, and common date forms", () => {
    expect(normalizeNumericValue("₩1,200,000")).toMatchObject({ value: 1200000, isPercent: false });
    expect(normalizeNumericValue("12.5%")).toMatchObject({ value: 12.5, isPercent: true });
    expect(normalizeDateValue("20260719")).toBe("2026-07-19");
  });

  it("profiles values without retaining raw rows", () => {
    const [date, spend] = profileColumns(["일자", "소진액"], rows);
    expect(date.inferredType).toBe("date");
    expect(spend.numericRate).toBe(1);
    expect(spend.sampleValues).toEqual(["₩1,200,000", "1,350,000원"]);
  });

  it("scores only fields allowed by the active tool", () => {
    const result = scoreMappingCandidates({ headers: ["일자", "소진액", "성과"], rows, allowedKeys: ["date", "cost", "installs"], fields: STANDARD_FIELDS });
    expect(result.selections).toMatchObject({ 일자: "date", 소진액: "cost" });
    expect(result.candidates.성과.every((candidate) => ["date", "cost", "installs"].includes(candidate.field))).toBe(true);
  });

  it("reports duplicate automatic assignments as conflicts", () => {
    const result = scoreMappingCandidates({ headers: ["광고비", "소진액"], rows: [{ 광고비: "100", 소진액: "200" }], allowedKeys: ["cost"], fields: STANDARD_FIELDS });
    expect(result.conflicts).toEqual([{ field: "cost", headers: ["광고비", "소진액"] }]);
  });
});
