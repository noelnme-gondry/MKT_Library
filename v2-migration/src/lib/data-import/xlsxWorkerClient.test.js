import { afterEach, describe, expect, it, vi } from "vitest";
import { parseXlsxFile } from "./xlsxWorkerClient";
import {
  XLSX_IMPORT_LIMITS,
  assertXlsxFileSize,
  assertXlsxSheetCount,
  sanitizeWorkbookTables,
  xlsxImportErrorMessage,
} from "./xlsxImportPolicy";
import { tableToRecords } from "./detectHeaderRow";

describe("XLSX worker cancellation", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("does not start a worker when cancelled while reading the file", async () => {
    const WorkerMock = vi.fn();
    vi.stubGlobal("Worker", WorkerMock);
    const controller = new AbortController();
    let finishRead;
    const parsing = parseXlsxFile({ size: 1, arrayBuffer: () => new Promise(resolve => { finishRead = resolve; }) }, { signal: controller.signal });
    const rejected = expect(parsing).rejects.toMatchObject({ name: "AbortError" });
    controller.abort();
    finishRead(new ArrayBuffer(1));
    await rejected;
    expect(WorkerMock).not.toHaveBeenCalled();
  });

  it("terminates an active worker and rejects the pending import on cancellation", async () => {
    const worker = { postMessage: vi.fn(), terminate: vi.fn() };
    vi.stubGlobal("Worker", class { constructor() { return worker; } });
    const controller = new AbortController();
    const parsing = parseXlsxFile({ size: 1, arrayBuffer: async () => new ArrayBuffer(1) }, { signal: controller.signal });
    const rejected = expect(parsing).rejects.toMatchObject({ name: "AbortError" });
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledOnce());
    controller.abort();
    await rejected;
    expect(worker.terminate).toHaveBeenCalledOnce();
  });

  it("removes the cancellation listener after successful completion", async () => {
    const worker = { postMessage: vi.fn(), terminate: vi.fn() };
    vi.stubGlobal("Worker", class { constructor() { return worker; } });
    const controller = new AbortController();
    const parsing = parseXlsxFile({ size: 1, arrayBuffer: async () => new ArrayBuffer(1) }, { signal: controller.signal });
    await vi.waitFor(() => expect(worker.postMessage).toHaveBeenCalledOnce());
    worker.onmessage({ data: { ok: true, sheets: [{ name: "data", raw: [] }] } });
    await expect(parsing).resolves.toEqual([{ name: "data", raw: [] }]);
    controller.abort();
    expect(worker.terminate).toHaveBeenCalledOnce();
  });
});

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
