import { expect, it } from "vitest";
import * as XLSX from "xlsx";
import { unzipSync, strFromU8 } from "fflate";
import { buildSampleReport } from "./sampleReport";
import { writeAnalysisWorkbook } from "./analysisWorkbook";
import { createAnalysisDocument } from "./analysisDocument";
it.each(["ko", "en"])("creates editable %s sample files from real demo totals", async locale => {
  const payload = buildSampleReport(locale);
  expect(payload.source.rows.length).toBeGreaterThan(0);
  const row = payload.calculationTables[0].rows[1];
  expect(row[1] / row[2]).toBeGreaterThan(0);
  const book = XLSX.read(writeAnalysisWorkbook(payload), { type: "array", cellFormula: true });
  const calculation = Object.values(book.Sheets).find(sheet => sheet.F2?.f === 'IF(C2>0,B2/C2,"")');
  expect(calculation).toBeTruthy();
  expect(calculation.B2.v).toBe(row[1]);
  const blob = await createAnalysisDocument(payload);
  const files = unzipSync(new Uint8Array(await blob.arrayBuffer()));
  expect(strFromU8(files["word/document.xml"])).toContain(row[0]);
});
