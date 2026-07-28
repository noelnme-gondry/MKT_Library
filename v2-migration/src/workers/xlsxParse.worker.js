import * as XLSX from "xlsx";
import { tableToRecords } from "../lib/data-import/detectHeaderRow";
import {
  XLSX_IMPORT_LIMITS,
  XlsxImportPolicyError,
  assertXlsxSheetCount,
  sanitizeWorkbookTables,
} from "../lib/data-import/xlsxImportPolicy";

globalThis.onmessage = (event) => {
  try {
    const workbook = XLSX.read(event.data?.arrayBuffer, {
      type: "array",
      dense: true,
      cellFormula: false,
      cellHTML: false,
      cellStyles: false,
      cellNF: false,
      sheetRows: XLSX_IMPORT_LIMITS.maxRowsPerSheet + 21,
    });
    assertXlsxSheetCount(workbook.SheetNames.length);
    let remainingCells = XLSX_IMPORT_LIMITS.maxCellsTotal;
    const sheets = [];
    for (const name of workbook.SheetNames) {
      const table = XLSX.utils.sheet_to_json(workbook.Sheets[name], {
        header: 1,
        defval: "",
        blankrows: false,
        raw: true,
      });
      const cellCount = table.reduce(
        (total, row) => total + (Array.isArray(row) ? row.length : 0),
        0,
      );
      if (cellCount > remainingCells) {
        throw new XlsxImportPolicyError("xlsx_too_many_cells");
      }
      const [sanitized] = sanitizeWorkbookTables(
        [{ name, table }],
        { ...XLSX_IMPORT_LIMITS, maxCellsTotal: remainingCells },
      );
      remainingCells -= cellCount;
      const sheet = { name: sanitized.name, ...tableToRecords(sanitized.table) };
      if (sheet.raw.length > XLSX_IMPORT_LIMITS.maxRowsPerSheet) {
        throw new XlsxImportPolicyError("xlsx_too_many_rows");
      }
      if (sheet.headers.length > 0 && sheet.raw.length > 0) sheets.push(sheet);
    }
    globalThis.postMessage({ ok: true, sheets });
  } catch (error) {
    globalThis.postMessage({
      ok: false,
      code: error?.code || "xlsx_parse_failed",
    });
  }
};
