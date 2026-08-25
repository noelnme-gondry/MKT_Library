import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";
import { buildAnalysisExportPayload } from "./exportContract";
import { ANALYSIS_WORKBOOK_SHEETS, writeAnalysisWorkbook } from "./analysisWorkbook";

function fixture() {
  return buildAnalysisExportPayload({
    toolId: "5-24",
    toolTitle: "브랜드 증분",
    locale: "ko",
    headline: "관찰상 증가 신호가 남았습니다.",
    stats: [
      { label: "추정 증가분", value: "1,250", detail: "+12.5%" },
      { label: "판정", value: "참고용", detail: "대조군 없음" },
    ],
    points: [{ text: "계절성과 프로모션은 분리되지 않습니다." }],
    source: {
      fileName: "brand.csv",
      headers: ["date", "outcome", "note"],
      rows: [
        { date: "2026-08-01", outcome: "100", note: "=HYPERLINK(\"https://bad.example\")" },
        { date: "2026-08-02", outcome: "120", note: "+cmd|' /C calc'!A0" },
      ],
      mapping: { date: "date", outcome: "brand_search", note: "__ignore__" },
    },
    addon: {
      calculationMode: "hybrid_engine_output",
      calculationTables: [{
        name: "BRAND_ITS_OUTPUT",
        rows: [
          ["section", "actual", "counterfactual", "difference", "note", "rate", "decision"],
          ["SERIES", 120, 110, "=B2-C2", "=A1", { formula: "=IFERROR((B2-C2)/ABS(C2),\"\")", numberFormat: "0.0%" }, { formula: "=IF(OR(B2<=0,AND(C2>0,D2=1)),0,1)" }],
        ],
        formulaRules: [{ whenColumn: 0, equals: "SERIES", columns: [3] }],
      }],
      method: { name: "ITS AR(1)", limitations: ["대조군 없는 관찰 추정"] },
    },
  });
}

describe("analysis workbook", () => {
  it("contains the full audit chain and live formula links", () => {
    const bytes = writeAnalysisWorkbook(fixture());
    const workbook = XLSX.read(bytes, { type: "array", cellFormula: true, cellNF: true });
    expect(workbook.SheetNames.slice(0, ANALYSIS_WORKBOOK_SHEETS.length)).toEqual(ANALYSIS_WORKBOOK_SHEETS);
    expect(workbook.SheetNames).toContain("BRAND_ITS_OUTPUT");
    expect(workbook.Sheets["05_CALCULATIONS"].C2.f).toBe("MAX('02_RAW_DATA'!A2:A3)");
    expect(workbook.Sheets["07_RESULTS"].B2.f).toBe("'06_ENGINE_OUTPUT'!C2");
    expect(workbook.Sheets.BRAND_ITS_OUTPUT.D2.f).toBe("B2-C2");
    expect(workbook.Sheets.BRAND_ITS_OUTPUT.F2.f).toBe('IFERROR((B2-C2)/ABS(C2),"")');
    expect(workbook.Sheets.BRAND_ITS_OUTPUT.G2.f).toBe("IF(OR(B2<=0,AND(C2>0,D2=1)),0,1)");
  });

  it("never promotes source strings or non-formula table cells into formulas", () => {
    const bytes = writeAnalysisWorkbook(fixture());
    const workbook = XLSX.read(bytes, { type: "array", cellFormula: true });
    const raw = workbook.Sheets["02_RAW_DATA"];
    expect(raw.D2.t).toBe("s");
    expect(raw.D2.f).toBeUndefined();
    expect(raw.D2.v).toContain("HYPERLINK");
    expect(raw.D3.t).toBe("s");
    expect(raw.D3.f).toBeUndefined();
    expect(workbook.Sheets.BRAND_ITS_OUTPUT.E2.t).toBe("s");
    expect(workbook.Sheets.BRAND_ITS_OUTPUT.E2.f).toBeUndefined();
  });

  it("sets automatic full recalculation metadata", () => {
    const bytes = writeAnalysisWorkbook(fixture());
    const workbook = XLSX.read(bytes, { type: "array" });
    expect(workbook.Workbook?.CalcPr?.calcMode).toBe("auto");
  });
});
