import { describe, expect, it } from "vitest";
import { normalizeDateLabel, normalizeDateValue, normalizeNumericValue } from "./normalizeValues";
import { profileColumns } from "./profileColumns";
import { profileColumnV2 } from "./profiler/profileColumnV2";
import { assessMappingConfidence, scoreMappingCandidates } from "./scoreMappingCandidates";
import { STANDARD_FIELDS } from "@/utils/csvConstants";

describe("data import foundation", () => {
  const rows = [
    { 일자: "2026.07.01", 소진액: "₩1,200,000", 성과: "24", ROAS: "125%" },
    { 일자: "2026.07.02", 소진액: "1,350,000원", 성과: "31", ROAS: "118%" },
  ];

  it("normalizes currency, percent, and common date forms", () => {
    expect(normalizeNumericValue("₩1,200,000")).toMatchObject({ value: 1200000, isPercent: false });
    expect(normalizeNumericValue("1,350,000원")).toMatchObject({ value: 1350000, isPercent: false });
    expect(normalizeNumericValue("USD 1,200")).toMatchObject({ value: 1200, isPercent: false });
    expect(normalizeNumericValue("12.5%")).toMatchObject({ value: 12.5, isPercent: true });
    expect(normalizeNumericValue("abc123")).toBeNull();
    expect(normalizeNumericValue("--123")).toBeNull();
    expect(normalizeDateValue("20260719")).toBe("2026-07-19");
    expect(normalizeDateValue("2026/07/19")).toBe("2026-07-19");
    expect(normalizeDateValue("2026.07.19")).toBe("2026-07-19");
    expect(normalizeDateValue("08/31/2026")).toBe("2026-08-31");
    expect(normalizeDateValue("31/08/2026")).toBe("2026-08-31");
    expect(normalizeDateValue("2026-02-30")).toBeNull();
    expect(normalizeDateValue("02/31/2026")).toBeNull();
    expect(normalizeDateValue("2026-08-31T99:00:00Z")).toBeNull();
    expect(normalizeDateValue("1")).toBeNull();
    expect(normalizeDateLabel("2024-W53")).toBeNull();
    expect(normalizeDateLabel("2026-08")).toBe("2026-08");
  });

  it("does not misclassify plain integer codes as dates", () => {
    const codeRows = [1, 2, 3, 4, 5].map((Code) => ({ Code }));
    const [legacyProfile] = profileColumns(["Code"], codeRows);
    const v2Profile = profileColumnV2("Code", codeRows);
    expect(legacyProfile).toMatchObject({ inferredType: "number", numericRate: 1, dateRate: 0 });
    expect(v2Profile.inferredType).toBe("number");
    expect(v2Profile.rates).toMatchObject({ numeric: 1, date: 0 });
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

  it("maps organic/paid columns to `source` by value, even under a `source` header", () => {
    // channel owns the "source" header alias (google/meta media), but a column whose
    // VALUES are organic/paid must win to `source` via valueVocabulary.
    const srcRows = [
      { source: "Paid", 구분: "페이드" },
      { source: "Organic", 구분: "오가닉" },
      { source: "paid", 구분: "페이드" },
    ];
    const result = scoreMappingCandidates({ headers: ["source", "구분"], rows: srcRows, allowedKeys: ["channel", "source"], fields: STANDARD_FIELDS });
    expect(result.selections.source).toBe("source");
    expect(result.selections.구분).toBe("source");
  });

  it("keeps a `source` header as channel when its values are media names (not organic/paid)", () => {
    const chRows = [{ source: "Google" }, { source: "Meta" }, { source: "TikTok" }];
    const result = scoreMappingCandidates({ headers: ["source"], rows: chRows, allowedKeys: ["channel", "source"], fields: STANDARD_FIELDS });
    expect(result.selections.source).toBe("channel");
  });

  it("reports duplicate automatic assignments as conflicts", () => {
    const result = scoreMappingCandidates({ headers: ["광고비", "소진액"], rows: [{ 광고비: "100", 소진액: "200" }], allowedKeys: ["cost"], fields: STANDARD_FIELDS });
    expect(result.conflicts).toEqual([{ field: "cost", headers: ["광고비", "소진액"] }]);
  });

  it("confirms known campaign-export aliases without a manual review", () => {
    const campaignRows = [{ dt: "2026-07-01", mkt_country: "IT", campaign_platform: "iOS" }];
    const result = scoreMappingCandidates({
      headers: ["dt", "mkt_country", "campaign_platform"],
      rows: campaignRows,
      allowedKeys: ["date", "country", "platform"],
      fields: STANDARD_FIELDS,
    });
    expect(result.selections).toMatchObject({ dt: "date", mkt_country: "country", campaign_platform: "platform" });
    expect(Object.fromEntries(result.assessments.map((item) => [item.header, item.state]))).toMatchObject({
      dt: "confirmed", mkt_country: "confirmed", campaign_platform: "confirmed",
    });
  });

  it("prefers an exact standard field name over an equally named alias", () => {
    const result = scoreMappingCandidates({
      headers: ["cost"],
      rows: [{ cost: "100" }, { cost: "120" }],
      allowedKeys: ["cost", "spend"],
      fields: STANDARD_FIELDS,
    });
    expect(result.selections.cost).toBe("cost");
    expect(result.assessments.find((item) => item.header === "cost")).toMatchObject({ state: "confirmed" });
  });

  it("separates confirmed, review, must-confirm, and conflicting mappings", () => {
    const candidates = {
      일자: [{ field: "date", confidence: 0.94, reasons: ["header + type"] }],
      성과: [{ field: "installs", confidence: 0.7, reasons: ["similar"] }, { field: "actions", confidence: 0.65, reasons: ["similar"] }],
      광고비: [{ field: "cost", confidence: 0.91, reasons: ["header + type"] }],
      소진액: [{ field: "cost", confidence: 0.91, reasons: ["header + type"] }],
    };
    const assessments = assessMappingConfidence({
      selections: { 일자: "date", 성과: "installs", 광고비: "cost", 소진액: "cost" },
      candidates,
    });
    expect(Object.fromEntries(assessments.map((item) => [item.header, item.state]))).toMatchObject({
      일자: "confirmed", 성과: "must_confirm", 광고비: "conflict", 소진액: "conflict",
    });
  });

  it("treats a dropdown change as explicit manual confirmation", () => {
    const [assessment] = assessMappingConfidence({
      selections: { 성과: "actions" },
      initialSelections: { 성과: "installs" },
      candidates: { 성과: [{ field: "installs", confidence: 0.7, reasons: [] }, { field: "actions", confidence: 0.65, reasons: [] }] },
    });
    expect(assessment.state).toBe("manual");
  });
});
