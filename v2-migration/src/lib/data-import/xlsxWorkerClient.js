import {
  XLSX_IMPORT_LIMITS,
  XlsxImportPolicyError,
  assertXlsxFileSize,
} from "./xlsxImportPolicy";

export async function parseXlsxFile(file, { signal } = {}) {
  signal?.throwIfAborted();
  const fileSize = Number.isFinite(file?.size) ? file.size : null;
  if (fileSize != null) assertXlsxFileSize(fileSize);
  if (typeof Worker === "undefined") {
    throw new XlsxImportPolicyError("xlsx_worker_unavailable");
  }
  const arrayBuffer = await file.arrayBuffer();
  signal?.throwIfAborted();
  assertXlsxFileSize(arrayBuffer.byteLength);
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL("../../workers/xlsxParse.worker.js", import.meta.url), { type: "module" });
    } catch {
      reject(new XlsxImportPolicyError("xlsx_worker_unavailable"));
      return;
    }
    const cleanup = () => {
      clearTimeout(timeout);
      signal?.removeEventListener("abort", onAbort);
      worker.terminate();
    };
    const onAbort = () => {
      cleanup();
      reject(signal.reason);
    };
    const timeout = setTimeout(() => {
      cleanup();
      reject(new XlsxImportPolicyError("xlsx_timeout"));
    }, XLSX_IMPORT_LIMITS.timeoutMs);
    signal?.addEventListener("abort", onAbort, { once: true });
    worker.onmessage = (event) => {
      cleanup();
      if (event.data?.ok) resolve(event.data.sheets);
      else reject(new XlsxImportPolicyError(event.data?.code || "xlsx_parse_failed"));
    };
    worker.onerror = () => {
      cleanup();
      reject(new XlsxImportPolicyError("xlsx_parse_failed"));
    };
    try {
      worker.postMessage({ arrayBuffer }, [arrayBuffer]);
    } catch {
      cleanup();
      reject(new XlsxImportPolicyError("xlsx_parse_failed"));
    }
  });
}
