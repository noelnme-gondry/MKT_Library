import { describe, expect, it } from "vitest";
import * as XLSX from "xlsx";

// SheetJS 0.20.x 전환 회귀망: 업로드 Worker가 쓰는 read/sheet_to_json과
// 대시보드·MMM 내보내기가 쓰는 sheet 생성/write API를 실제 바이너리 왕복으로 검증한다.
describe("vendored SheetJS runtime compatibility", () => {
  it("XLSX 업로드 Worker 경로와 같은 dense read → table 변환을 유지한다", () => {
    const source = XLSX.utils.aoa_to_sheet([
      ["일자", "비용", "설치"],
      ["2026-08-08", 125000, 42],
    ]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, source, "raw");
    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });

    const parsed = XLSX.read(bytes, { type: "array", dense: true, cellFormula: false, cellHTML: false });
    const table = XLSX.utils.sheet_to_json(parsed.Sheets.raw, { header: 1, defval: "", blankrows: false });

    expect(parsed.SheetNames).toEqual(["raw"]);
    expect(table).toEqual([["일자", "비용", "설치"], ["2026-08-08", 125000, 42]]);
  });

  it("XLSX 내보내기가 쓰는 json_to_sheet·book_append_sheet·write를 유지한다", () => {
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet([
      { channel: "Meta", spend: 100000 },
      { channel: "Google", spend: 80000 },
    ]), "summary");

    const bytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
    const parsed = XLSX.read(bytes, { type: "array", dense: true });
    const rows = XLSX.utils.sheet_to_json(parsed.Sheets.summary, { defval: "" });

    expect(bytes.byteLength).toBeGreaterThan(0);
    expect(rows).toEqual([{ channel: "Meta", spend: 100000 }, { channel: "Google", spend: 80000 }]);
  });
});
