import { writeAnalysisWorkbook } from "./analysisWorkbook";

export const ANALYSIS_WORKBOOK_TIMEOUT_MS = 120_000;

export function createAnalysisWorkbook(payload = {}) {
  if (typeof Worker === "undefined") return Promise.resolve(writeAnalysisWorkbook(payload));
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL("../../workers/analysisWorkbook.worker.js", import.meta.url), { type: "module" });
    } catch {
      resolve(writeAnalysisWorkbook(payload));
      return;
    }
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new Error("WORKBOOK_EXPORT_TIMEOUT"));
    }, ANALYSIS_WORKBOOK_TIMEOUT_MS);
    worker.onmessage = (event) => {
      clearTimeout(timeout);
      worker.terminate();
      if (event.data?.ok && event.data.arrayBuffer) resolve(event.data.arrayBuffer);
      else reject(new Error(event.data?.error || "WORKBOOK_EXPORT_FAILED"));
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error("WORKBOOK_EXPORT_FAILED"));
    };
    try {
      worker.postMessage(payload);
    } catch {
      clearTimeout(timeout);
      worker.terminate();
      reject(new Error("WORKBOOK_EXPORT_FAILED"));
    }
  });
}
