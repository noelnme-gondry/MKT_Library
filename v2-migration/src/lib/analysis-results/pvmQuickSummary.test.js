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

  it("preserves formatted costs and withholds a zero-result PVM contract", () => {
    const base = Array.from({ length: 14 }, (_, index) => ({
      date: `2026-07-${String(index + 1).padStart(2, "0")}`,
      channel: "Meta",
      campaign: "Always on",
      cost: index < 7 ? "1,000" : "1 200",
      installs: 100,
    }));
    const mapping = { date: "date", channel: "channel", campaign: "campaign_name", cost: "cost", installs: "installs" };
    expect(buildPvmQuickSummary({ csvData: { raw: base, mapping } })).toMatchObject({ available: true, prior: 10, current: 12 });

    const invalid = [
      ...base,
      ...Array.from({ length: 14 }, (_, index) => ({
        date: `2026-07-${String(index + 1).padStart(2, "0")}`,
        channel: "Referral",
        campaign: "Zero result",
        cost: 100,
        installs: 0,
      })),
    ];
    expect(buildPvmQuickSummary({ csvData: { raw: invalid, mapping } })).toEqual({ available: false });
  });

  it("대용량 행(12.5만+)에서 스프레드 인자 한계 없이 요약 (Math.max RangeError 회귀)", () => {
    // maxT = Math.max(...rows.map(...)) 스프레드가 대용량서 RangeError로 결론카드를 죽였다.
    const N = 130000;
    const raw = new Array(N);
    for (let i = 0; i < N; i++) {
      const day = String((i % 28) + 1).padStart(2, "0");
      raw[i] = { date: `2026-07-${day}`, channel: i % 2 ? "Meta" : "Google", cost: 100, installs: 10 };
    }
    const mapping = { date: "date", channel: "channel", cost: "cost", installs: "installs" };
    expect(() => buildPvmQuickSummary({ csvData: { raw, mapping }, dashboardFilter: {} })).not.toThrow();
  });
});
