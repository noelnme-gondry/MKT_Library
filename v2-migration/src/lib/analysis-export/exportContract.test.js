import { describe, expect, it } from "vitest";
import { buildAnalysisExportPayload, workbookFileBase } from "./exportContract";

describe("analysis export contract", () => {
  it("keeps complete local source data while normalizing display-only result fields", () => {
    const payload = buildAnalysisExportPayload({
      toolId: "5-21",
      toolTitle: "성과 변동 원인",
      headline: "CPA가 상승했습니다.",
      stats: [{ label: "CPA", value: "₩12,000", detail: "+20%" }],
      points: [{ label: "최대 영향", text: "Search", detail: "+₩2,000" }],
      source: {
        fileName: "private.csv",
        headers: ["Date", "Secret"],
        rows: [{ Date: "2026-08-01", Secret: "=HYPERLINK(\"bad\")" }],
        mapping: { Date: "date", Secret: "__ignore__" },
      },
      scope: { channels: new Set(["Meta", "Search"]) },
    });
    expect(payload.source.rows).toEqual([{ Date: "2026-08-01", Secret: "=HYPERLINK(\"bad\")" }]);
    expect(payload.summary.stats).toEqual([{ label: "CPA", value: "₩12,000", detail: "+20%" }]);
    expect(payload.scope.channels).toEqual(["Meta", "Search"]);
    expect(payload.calculationMode).toBe("hybrid_engine_output");
  });

  it("resolves a lazy exact-formula addon only when the payload is built", () => {
    let calls = 0;
    const payload = buildAnalysisExportPayload({
      toolId: "5-2",
      addon: () => {
        calls += 1;
        return {
          calculationMode: "exact_after_preprocessing",
          calculationTables: [{ name: "DASHBOARD_METRICS", rows: [["metric", "value"], ["CPA", { formula: "=1+1" }]] }],
        };
      },
    });
    expect(calls).toBe(1);
    expect(payload.calculationMode).toBe("exact_after_preprocessing");
    expect(payload.calculationTables[0].rows[1][1]).toEqual({ formula: "=1+1" });
  });

  it("keeps filenames stable and free of route punctuation", () => {
    expect(workbookFileBase("5-18/mmm")).toBe("5-18-mmm_analysis_workbook");
  });
});
