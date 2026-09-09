import Papa from "papaparse";
import { wideToLong } from "@/lib/data-import/wideToLong";

export async function readStoredTable(entry) {
  if (!entry?.sourceBlob) throw new Error("WORKSPACE_DATASET_MISSING_SOURCE");
  let table;
  if (entry.sourceKind === "xlsx") {
    const { parseXlsxFile } = await import("@/lib/data-import/xlsxWorkerClient");
    const sheets = await parseXlsxFile(entry.sourceBlob);
    const sheet = sheets.find(item => item.name === entry.worksheetName) || (!entry.worksheetName ? sheets[0] : null);
    if (!sheet) throw new Error("WORKSPACE_SHEET_MISSING");
    table = { raw: sheet.raw, headers: sheet.headers };
  } else {
    table = await new Promise((resolve, reject) => Papa.parse(entry.sourceBlob, {
      header: true, skipEmptyLines: "greedy", worker: typeof Worker !== "undefined",
      complete: result => {
        if (result.errors?.some(error => error.type === "Quotes" || error.code === "TooManyFields")) return reject(new Error("WORKSPACE_DATASET_PARSE_FAILED"));
        resolve({ raw: result.data, headers: result.meta.fields || [] });
      }, error: reject,
    }));
  }
  if (entry.transform === "wide_to_long") table = wideToLong(table);
  if (!table.headers.length || !table.raw.length || (entry.headers?.length && entry.headers.length !== table.headers.length)) throw new Error("WORKSPACE_DATASET_INVALID");
  const headers = entry.headers?.length ? entry.headers : table.headers;
  return { headers, raw: table.raw.map(row => Object.fromEntries(headers.map((header, index) => [header, row[table.headers[index]]]))) };
}
