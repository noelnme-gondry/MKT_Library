export const XLSX_IMPORT_LIMITS = Object.freeze({
  maxFileBytes: 25 * 1024 * 1024,
  maxSheets: 32,
  maxRowsPerSheet: 200_000,
  maxColumnsPerSheet: 256,
  maxCellsTotal: 2_000_000,
  maxCellChars: 10_000,
  timeoutMs: 30_000,
});

export class XlsxImportPolicyError extends Error {
  constructor(code) {
    super(code);
    this.name = "XlsxImportPolicyError";
    this.code = code;
  }
}

export function assertXlsxFileSize(byteLength, limits = XLSX_IMPORT_LIMITS) {
  if (!Number.isFinite(byteLength) || byteLength <= 0) {
    throw new XlsxImportPolicyError("xlsx_empty_file");
  }
  if (byteLength > limits.maxFileBytes) {
    throw new XlsxImportPolicyError("xlsx_file_too_large");
  }
}

export function assertXlsxSheetCount(count, limits = XLSX_IMPORT_LIMITS) {
  if (!Number.isInteger(count) || count < 0) {
    throw new XlsxImportPolicyError("xlsx_invalid_sheet");
  }
  if (count > limits.maxSheets) {
    throw new XlsxImportPolicyError("xlsx_too_many_sheets");
  }
}

function sanitizeCell(value, limits) {
  if (value == null) return "";
  if (typeof value === "number") return Number.isFinite(value) ? value : "";
  if (typeof value === "boolean") return value;
  const text = value instanceof Date ? value.toISOString() : String(value);
  if (text.length > limits.maxCellChars) {
    throw new XlsxImportPolicyError("xlsx_cell_too_long");
  }
  return text;
}

export function sanitizeWorkbookTables(tables, limits = XLSX_IMPORT_LIMITS) {
  if (!Array.isArray(tables) || tables.length === 0) return [];
  assertXlsxSheetCount(tables.length, limits);

  let totalCells = 0;
  return tables.map(({ name, table }) => {
    if (!Array.isArray(table)) {
      throw new XlsxImportPolicyError("xlsx_invalid_sheet");
    }
    if (table.length > limits.maxRowsPerSheet + 20) {
      throw new XlsxImportPolicyError("xlsx_too_many_rows");
    }

    const sanitized = table.map((row) => {
      if (!Array.isArray(row)) return [];
      if (row.length > limits.maxColumnsPerSheet) {
        throw new XlsxImportPolicyError("xlsx_too_many_columns");
      }
      totalCells += row.length;
      if (totalCells > limits.maxCellsTotal) {
        throw new XlsxImportPolicyError("xlsx_too_many_cells");
      }
      return row.map((value) => sanitizeCell(value, limits));
    });

    return {
      name: String(name || "").slice(0, 128) || "Sheet",
      table: sanitized,
    };
  });
}

export function xlsxImportErrorMessage(code, locale = "ko") {
  const messages = {
    ko: {
      xlsx_empty_file: "빈 XLSX 파일은 읽을 수 없습니다.",
      xlsx_file_too_large: "XLSX는 25MB 이하만 업로드할 수 있습니다. CSV로 내보내면 더 큰 데이터도 안정적으로 처리할 수 있습니다.",
      xlsx_too_many_sheets: "XLSX 시트가 32개를 초과합니다. 필요한 시트만 남겨 다시 업로드해 주세요.",
      xlsx_too_many_rows: "한 시트의 데이터가 20만 행을 초과합니다. 기간이나 채널로 나눠 업로드해 주세요.",
      xlsx_too_many_columns: "한 시트의 컬럼이 256개를 초과합니다. 분석에 필요한 컬럼만 남겨 주세요.",
      xlsx_too_many_cells: "통합문서의 전체 셀이 200만 개를 초과합니다. 필요한 시트·컬럼만 남겨 주세요.",
      xlsx_cell_too_long: "10,000자를 초과하는 셀이 있어 가져오기를 중단했습니다.",
      xlsx_timeout: "XLSX를 30초 안에 안전하게 읽지 못했습니다. CSV로 저장해 다시 시도해 주세요.",
      xlsx_worker_unavailable: "이 브라우저에서는 XLSX를 격리해서 읽을 수 없습니다. CSV로 저장해 업로드해 주세요.",
      xlsx_invalid_sheet: "XLSX 시트 구조가 올바르지 않습니다.",
      xlsx_parse_failed: "XLSX를 안전하게 읽지 못했습니다. 손상 여부를 확인하거나 CSV로 저장해 주세요.",
    },
    en: {
      xlsx_empty_file: "An empty XLSX file cannot be imported.",
      xlsx_file_too_large: "XLSX uploads are limited to 25MB. Exporting as CSV is the safest option for larger datasets.",
      xlsx_too_many_sheets: "This workbook has more than 32 worksheets. Keep only the worksheets you need and try again.",
      xlsx_too_many_rows: "A worksheet exceeds 200,000 rows. Split it by period or channel and try again.",
      xlsx_too_many_columns: "A worksheet exceeds 256 columns. Keep only the columns needed for analysis.",
      xlsx_too_many_cells: "The workbook exceeds 2 million cells. Keep only the worksheets and columns you need.",
      xlsx_cell_too_long: "Import stopped because a cell exceeds 10,000 characters.",
      xlsx_timeout: "The workbook could not be parsed safely within 30 seconds. Save it as CSV and try again.",
      xlsx_worker_unavailable: "This browser cannot parse XLSX in an isolated worker. Save the file as CSV and upload it instead.",
      xlsx_invalid_sheet: "The workbook contains an invalid worksheet structure.",
      xlsx_parse_failed: "The workbook could not be parsed safely. Check for corruption or save it as CSV.",
    },
  };
  return (messages[locale] || messages.ko)[code] || (messages[locale] || messages.ko).xlsx_parse_failed;
}
