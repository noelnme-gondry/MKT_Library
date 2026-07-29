import { describe, expect, it } from "vitest";
import { filterMaturedCohorts } from "./cohortMath";
import { LOW_CONFIDENCE_BUFFER_DAYS, maturityCutoffDate, resolveRetentionSnapshot, snapshotDateForRow } from "./retentionSnapshot";

describe("retention snapshot resolution", () => {
  it("uses a mapped snapshot column before every inferred fallback and applies it per row", () => {
    const rows = [
      { date: "2026-07-19", snapshot_date: "2026-07-26" },
      { date: "2026-07-20", snapshot_date: "2026-07-26" },
    ];
    const snapshot = resolveRetentionSnapshot({ rows, fileName: "retention_2026-08-01.csv" });
    expect(snapshot).toMatchObject({ date: "2026-07-26", source: "snapshot_column", confidence: "high", perRow: true });
    expect(maturityCutoffDate(7, { ...snapshot, perRow: false })).toBe("2026-07-19");
    const matured = filterMaturedCohorts(rows, 7, true, { ...snapshot, getDateForRow: (row) => snapshotDateForRow(snapshot, row) });
    expect(matured).toEqual([rows[0]]);
  });

  it("uses the rightmost YYYYMMDD/ISO filename date before data max", () => {
    const snapshot = resolveRetentionSnapshot({
      rows: [{ date: "2026-07-30" }],
      fileName: "retention_20260701_2026-07-26.csv",
    });
    expect(snapshot).toMatchObject({ date: "2026-07-26", source: "filename", confidence: "high" });
  });

  it("uses the data maximum date as a medium-confidence estimate, never today's date", () => {
    const snapshot = resolveRetentionSnapshot({ rows: [{ date: "2024-02-01" }, { date: "2024-02-05" }], fileName: "old_export.csv" });
    expect(snapshot).toMatchObject({ date: "2024-02-05", source: "data_max_date", confidence: "medium", bufferDays: 0 });
  });

  it("uses file modified time only as a low-confidence fallback with a two-day buffer", () => {
    const snapshot = resolveRetentionSnapshot({ rows: [], fileName: "no-date.csv", fileModifiedAt: Date.UTC(2026, 6, 26) });
    expect(snapshot).toMatchObject({ date: "2026-07-26", source: "file_modified", confidence: "low", bufferDays: LOW_CONFIDENCE_BUFFER_DAYS });
    expect(maturityCutoffDate(7, snapshot)).toBe("2026-07-17");
  });

  it("keeps maturity closed when no evidence exists instead of falling back to the current date", () => {
    const snapshot = resolveRetentionSnapshot({ rows: [], fileName: "no-date.csv" });
    expect(snapshot).toMatchObject({ date: null, source: "unknown", confidence: "unknown" });
    expect(filterMaturedCohorts([{ date: "2020-01-01" }], 7, true, snapshot)).toEqual([]);
  });
});
