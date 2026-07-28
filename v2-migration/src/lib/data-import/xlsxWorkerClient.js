import {
  XLSX_IMPORT_LIMITS,
  XlsxImportPolicyError,
  assertXlsxFileSize,
} from "./xlsxImportPolicy";

export async function parseXlsxFile(file) {
  const fileSize = Number.isFinite(file?.size) ? file.size : null;
  if (fileSize != null) assertXlsxFileSize(fileSize);
  if (typeof Worker === "undefined") {
    throw new XlsxImportPolicyError("xlsx_worker_unavailable");
  }
  const arrayBuffer = await file.arrayBuffer();
  assertXlsxFileSize(arrayBuffer.byteLength);
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL("../../workers/xlsxParse.worker.js", import.meta.url), { type: "module" });
    } catch {
      reject(new XlsxImportPolicyError("xlsx_worker_unavailable"));
      return;
    }
    const timeout = setTimeout(() => {
      worker.terminate();
      reject(new XlsxImportPolicyError("xlsx_timeout"));
    }, XLSX_IMPORT_LIMITS.timeoutMs);
    worker.onmessage = (event) => {
      clearTimeout(timeout);
      worker.terminate();
      if (event.data?.ok) resolve(event.data.sheets);
      else reject(new XlsxImportPolicyError(event.data?.code || "xlsx_parse_failed"));
    };
    worker.onerror = () => {
      clearTimeout(timeout);
      worker.terminate();
      reject(new XlsxImportPolicyError("xlsx_parse_failed"));
    };
    worker.postMessage({ arrayBuffer }, [arrayBuffer]);
  });
}
