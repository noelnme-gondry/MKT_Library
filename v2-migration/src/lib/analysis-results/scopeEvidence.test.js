// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { scopedInputQuality, scopeEvidenceTable } from "./scopeEvidence";
import { buildDashboardVerdict } from "@/utils/dashboardVerdict";
import { buildPvmCache } from "@/components/tools/CampaignPvm";

describe("actual result scope", () => {
  it("counts blanks and invalid numbers, preserving true zero and formatted numbers", () => {
    expect(scopedInputQuality([{ cost: "0", installs: "" }, { cost: "1,000", installs: "bad" }], ["cost", "installs"])).toEqual({ missing: 2, checked: 4, ratio: 0.5 });
  });
  it("matches dashboard and PVM denominators for explicitly identical dates and filters", () => {
    const raw = Array.from({ length: 14 }, (_, index) => ({ Date: `2026-08-${String(index + 1).padStart(2, "0")}`, Channel: "A", Cost: "1,000", Installs: index < 7 ? "10" : "20" }));
    raw.push(...raw.map((row) => ({ ...row, Channel: "B", Cost: "99,999", Installs: "999" })));
    const csvData = { raw, headers: Object.keys(raw[0]), mapping: { Date: "date", Channel: "channel", Cost: "cost", Installs: "installs" } };
    const filter = { channels: new Set(["A"]) };
    const dashboard = buildDashboardVerdict({ csvData, filterState: filter, windowDays: 7 });
    const pvm = buildPvmCache(csvData, { metric: "cpi", weekBasis: "calendar", lookback: 1, currency: "KRW", denomBasis: "installs", dashboardFilter: filter, locale: "ko", periodOverride: { periodA: { start: "2026-08-01", end: "2026-08-07" }, periodB: { start: "2026-08-08", end: "2026-08-14" } } });
    expect(dashboard.insufficient).toBe(false);
    expect(pvm.insufficientData).toBe(false);
    expect(dashboard.scopeEvidence.periods.map((period) => [period.start, period.end, period.denominator, period.cost])).toEqual(pvm.scopeEvidence.periods.map((period) => [period.start, period.end, period.denominator, period.cost]));
    expect(dashboard.scopeEvidence.periods.map((period) => period.denominator)).toEqual([70, 140]);
    expect(dashboard.scopeEvidence.periods.map((period) => period.observations)).toEqual([7, 7]);
    expect(dashboard.scopeEvidence.filters.channels).toEqual(["A"]);
    expect(scopeEvidenceTable(pvm.scopeEvidence).rows[1]).toContain(70);
  });
});
