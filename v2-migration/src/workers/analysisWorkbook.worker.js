import { writeAnalysisWorkbook } from "../lib/analysis-export/analysisWorkbook";

globalThis.onmessage = (event) => {
  try {
    const bytes = writeAnalysisWorkbook(event.data || {});
    const arrayBuffer = bytes instanceof ArrayBuffer
      ? bytes
      : bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    globalThis.postMessage({ ok: true, arrayBuffer }, [arrayBuffer]);
  } catch (error) {
    globalThis.postMessage({ ok: false, error: error?.message || "WORKBOOK_EXPORT_FAILED" });
  }
};
