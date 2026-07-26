import { tableToRecords } from "./detectHeaderRow";

export const XLSX_WORKER_THRESHOLD_BYTES = 2 * 1024 * 1024;

export function shouldUseXlsxWorker(byteLength, threshold = XLSX_WORKER_THRESHOLD_BYTES) {
  return Number.isFinite(byteLength) && byteLength >= threshold;
}

async function parseOnMainThread(file) {
  const XLSX = await import("xlsx");
  const workbook = XLSX.read(await file.arrayBuffer(), { type: "array" });
  return workbook.SheetNames.map((name) => {
    const table = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "", blankrows: false });
    return { name, ...tableToRecords(table) };
  }).filter((sheet) => sheet.headers.length > 0 && sheet.raw.length > 0);
}

export async function parseXlsxFile(file) {
  const fileSize = Number.isFinite(file?.size) ? file.size : null;
  if ((fileSize != null && !shouldUseXlsxWorker(fileSize)) || typeof Worker === "undefined") return parseOnMainThread(file);
  const arrayBuffer = await file.arrayBuffer();
  if (!shouldUseXlsxWorker(arrayBuffer.byteLength)) return parseOnMainThread(file);
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(new URL("../../workers/xlsxParse.worker.js", import.meta.url), { type: "module" });
    } catch {
      parseOnMainThread(file).then(resolve).catch(reject);
      return;
    }
    worker.onmessage = (event) => {
      worker.terminate();
      if (event.data?.ok) resolve(event.data.sheets);
      else reject(new Error(event.data?.error || "Workbook parsing failed"));
    };
    worker.onerror = () => {
      worker.terminate();
      parseOnMainThread(file).then(resolve).catch(reject);
    };
    worker.postMessage({ arrayBuffer }, [arrayBuffer]);
  });
}
