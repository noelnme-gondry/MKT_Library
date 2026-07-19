import { describe, expect, it } from "vitest";
import { buildDataQualityReport } from "./buildDataQualityReport";

describe("buildDataQualityReport", () => {
  it("reports duplicates and invalid values as caution", () => {
    const report = buildDataQualityReport({
      records: [{ date: "2026-07-01", dimensions: { channel: "Meta" } }, { date: "2026-07-01", dimensions: { channel: "Meta" } }],
      summary: { invalidValueCount: 1 },
    });
    expect(report).toMatchObject({ grade: "caution", periodCount: 1 });
    expect(report.issues).toHaveLength(2);
  });
});
