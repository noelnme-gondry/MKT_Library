import * as XLSX from "xlsx";
import { describe, expect, it } from "vitest";
import { createWeeklyReportWorkbook } from "@/lib/reports/reportWorkbook";

describe("createWeeklyReportWorkbook", () => {
  it("exports conclusions and metadata without source CSV rows", async () => {
    const bytes = await createWeeklyReportWorkbook({
      title: "Growth review",
      period: { start: "2026-08-01", end: "2026-08-07" },
      blocks: [{ toolId: "5-2", toolTitle: "Dashboard", headline: "=Do not evaluate", points: ["Check CPA"], stats: [{ label: "CPA", displayValue: "₩2,000" }], scope: { dateStart: "2026-08-01", dateEnd: "2026-08-07" }, raw: [{ secret: "never" }] }],
      notes: [{ id: "note", text: "Discuss on Monday" }],
    });
    const workbook = XLSX.read(bytes, { type: "array" });
    expect(workbook.SheetNames).toEqual(["00_OVERVIEW", "01_RESULTS", "02_NOTES"]);
    expect(workbook.Sheets["01_RESULTS"].D2).toMatchObject({ t: "s", v: "=Do not evaluate" });
    expect(JSON.stringify(workbook.Sheets)).not.toContain("never");
  });
});
