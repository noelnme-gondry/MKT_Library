import { describe, expect, it } from "vitest";
import { XLSX_WORKER_THRESHOLD_BYTES, shouldUseXlsxWorker } from "./xlsxWorkerClient";

describe("xlsx worker client", () => {
  it("only moves large workbooks off the main thread", () => {
    expect(shouldUseXlsxWorker(XLSX_WORKER_THRESHOLD_BYTES - 1)).toBe(false);
    expect(shouldUseXlsxWorker(XLSX_WORKER_THRESHOLD_BYTES)).toBe(true);
  });
});
