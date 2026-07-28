import { describe, expect, it } from "vitest";
import {
  XLSX_IMPORT_LIMITS,
  assertXlsxFileSize,
  assertXlsxSheetCount,
  sanitizeWorkbookTables,
  xlsxImportErrorMessage,
} from "./xlsxImportPolicy";
import { tableToRecords } from "./detectHeaderRow";

describe("XLSX import policy", () => {
  it("rejects empty and oversized workbooks before parsing", () => {
    expect(() => assertXlsxFileSize(0)).toThrowError("xlsx_empty_file");
    expect(() => assertXlsxFileSize(XLSX_IMPORT_LIMITS.maxFileBytes + 1))
      .toThrowError("xlsx_file_too_large");
  });

  it("rejects workbooks with too many worksheets before materializing them", () => {
    expect(() => assertXlsxSheetCount(XLSX_IMPORT_LIMITS.maxSheets + 1))
      .toThrowError("xlsx_too_many_sheets");
  });

  it("keeps scalar values and neutralizes prototype-like headers", () => {
    const [sheet] = sanitizeWorkbookTables([{
      name: "raw",
      table: [
        ["__proto__", "constructor", "amount"],
        ["safe", true, 100],
      ],
    }]);
    expect(sheet.table).toEqual([
      ["__proto__", "constructor", "amount"],
      ["safe", true, 100],
    ]);
    expect(tableToRecords(sheet.table).headers).toEqual([
      "___proto__",
      "_constructor",
      "amount",
    ]);
  });

  it("enforces row, column, total-cell and cell-length limits", () => {
    const tiny = {
      ...XLSX_IMPORT_LIMITS,
      maxRowsPerSheet: 1,
      maxColumnsPerSheet: 2,
      maxCellsTotal: 3,
      maxCellChars: 4,
    };
    expect(() => sanitizeWorkbookTables([{ name: "x", table: [[], ...Array(22).fill([])] }], tiny))
      .toThrowError("xlsx_too_many_rows");
    expect(() => sanitizeWorkbookTables([{ name: "x", table: [[1, 2, 3]] }], tiny))
      .toThrowError("xlsx_too_many_columns");
    expect(() => sanitizeWorkbookTables([{ name: "x", table: [[1, 2], [3, 4]] }], tiny))
      .toThrowError("xlsx_too_many_cells");
    expect(() => sanitizeWorkbookTables([{ name: "x", table: [["12345"]] }], tiny))
      .toThrowError("xlsx_cell_too_long");
  });

  it("provides localized, actionable failures", () => {
    expect(xlsxImportErrorMessage("xlsx_timeout", "ko")).toContain("30초");
    expect(xlsxImportErrorMessage("xlsx_timeout", "en")).toContain("30 seconds");
  });
});
