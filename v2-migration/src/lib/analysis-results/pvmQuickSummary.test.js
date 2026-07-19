import { describe, expect, it } from "vitest";
import { buildPvmQuickSummary } from "./pvmQuickSummary";

describe("buildPvmQuickSummary", () => {
  it("stays unavailable instead of inferring a cause without PVM contract fields", () => {
    expect(buildPvmQuickSummary({ csvData: { raw: [], mapping: { Date: "date" } } })).toEqual({ available: false });
  });

  it("keeps campaign-level decomposition when creative fields are absent", () => {
    const raw = Array.from({ length: 14 }, (_, index) => ({
      date: `2026-07-${String(index + 1).padStart(2, "0")}`,
      channel: "Meta",
      campaign: index < 7 ? "Prospecting" : "Retargeting",
      cost: index < 7 ? 100 : 120,
      installs: index < 7 ? 10 : 9,
    }));
    const result = buildPvmQuickSummary({ csvData: { raw, mapping: { date: "date", channel: "channel", campaign: "campaign_name", cost: "cost", installs: "installs" } } });
    expect(result).toMatchObject({ available: true, metric: "CPI" });
  });
});
