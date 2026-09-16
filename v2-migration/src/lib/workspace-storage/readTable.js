import Papa from "papaparse";
import { wideToLong } from "@/lib/data-import/wideToLong";
import { prepareCsvParseInput } from "@/lib/data-import/csvParseInput";

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
    const input = await prepareCsvParseInput(entry.sourceBlob);
    table = await new Promise((resolve, reject) => Papa.parse(input, {
      header: true, skipEmptyLines: "greedy", worker: typeof Worker !== "undefined",
      complete: result => {
        if (result.errors?.some(error => error.type === "Quotes" || error.code === "TooManyFields")) return reject(new Error("WORKSPACE_DATASET_PARSE_FAILED"));
        resolve({ raw: result.data, headers: result.meta.fields || [] });
      }, error: reject,
    }));
  }
  // 모르는 변환은 건너뛰지 말고 거절한다. 예전엔 일치하지 않는 값을 조용히
  // 무시해서, 새 버전이 쓴 레코드를 옛 번들이 읽으면 **변환 안 된 표**가 정상인
  // 것처럼 나왔다(헤더 수가 같으면 아래 검증도 통과한다). 못 읽는 건 못 읽는다고
  // 말하는 편이 틀린 표를 그리는 것보다 낫다(§8).
  if (entry.transform === "wide_to_long") table = wideToLong(table);
  else if (entry.transform) throw new Error("WORKSPACE_DATASET_UNKNOWN_TRANSFORM");
  if (!table.headers.length || !table.raw.length || (entry.headers?.length && entry.headers.length !== table.headers.length)) throw new Error("WORKSPACE_DATASET_INVALID");
  const headers = entry.headers?.length ? entry.headers : table.headers;
  return { headers, raw: table.raw.map(row => Object.fromEntries(headers.map((header, index) => [header, row[table.headers[index]]]))) };
}
