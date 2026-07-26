import * as XLSX from "xlsx";
import { tableToRecords } from "../lib/data-import/detectHeaderRow";

globalThis.onmessage = (event) => {
  try {
    const workbook = XLSX.read(event.data?.arrayBuffer, { type: "array" });
    const sheets = workbook.SheetNames.map((name) => {
      const table = XLSX.utils.sheet_to_json(workbook.Sheets[name], { header: 1, defval: "", blankrows: false });
      return { name, ...tableToRecords(table) };
    }).filter((sheet) => sheet.headers.length > 0 && sheet.raw.length > 0);
    globalThis.postMessage({ ok: true, sheets });
  } catch (error) {
    globalThis.postMessage({ ok: false, error: error?.message || "Workbook parsing failed" });
  }
};
