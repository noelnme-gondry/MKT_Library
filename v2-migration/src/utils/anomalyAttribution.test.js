import { describe, expect, it } from "vitest";
import {
  anomalyAttributionEligibility,
  attributeAnomaly,
  buildAttributionCache,
  buildAttributionPeriods,
} from "./anomalyAttribution";

function sampleRows() {
  const rows = [];
  for (let day = 1; day <= 14; day += 1) {
    const date = `2026-07-${String(day).padStart(2, "0")}`;
    const recent = day >= 8;
    rows.push({ date, channel: "Google", campaign_id: "G1", creative_id: "G-A", cost: recent ? 150 : 100, actions: 10 });
    rows.push({ date, channel: "Meta", campaign_id: "M1", creative_id: "M-A", cost: recent ? 80 : 100, actions: 10 });
  }
  return rows;
}

describe("anomalyAttribution", () => {
  it("이상일 기준 고정 7일×2 기간을 만든다", () => {
    expect(buildAttributionPeriods("2026-07-14")).toEqual({
      periodA: { start: "2026-07-01", end: "2026-07-07" },
      periodB: { start: "2026-07-08", end: "2026-07-14" },
    });
  });

  it("CPA/CPI와 필수 매핑만 허용한다", () => {
    expect(anomalyAttributionEligibility({ metric: "cpa", mappedFields: ["date", "cost", "actions", "channel"] }).eligible).toBe(true);
    expect(anomalyAttributionEligibility({ metric: "cost", mappedFields: ["date", "cost", "actions", "channel"] }).reason).toBe("unsupported_metric");
    expect(anomalyAttributionEligibility({ metric: "cpi", mappedFields: ["date", "cost", "channel"] }).missing).toContain("installs");
  });

  it("채널 rollup 합이 전체 CPA 변화와 일치한다", () => {
    const result = attributeAnomaly(sampleRows(), "2026-07-14", "cpa");
    expect(result.unavailable).not.toBe(true);
    expect(result.identityError).toBeLessThanOrEqual(1e-9);
    expect(result.drivers[0].label).toBe("Google");
    expect(result.drivers.reduce((sum, item) => sum + item.contribution, 0)).toBeCloseTo(result.totalDelta, 10);
  });

  it("천단위 구분 비용은 보존하고 정의되지 않은 0결과 셀은 귀속하지 않는다", () => {
    const formatted = sampleRows().map((row) => ({ ...row, cost: row.cost.toLocaleString("en-US") }));
    expect(attributeAnomaly(formatted, "2026-07-14", "cpa").unavailable).not.toBe(true);

    const zeroResult = [
      ...sampleRows(),
      ...Array.from({ length: 14 }, (_, index) => ({
        date: `2026-07-${String(index + 1).padStart(2, "0")}`,
        channel: "Referral",
        campaign_id: "R1",
        creative_id: "R-A",
        cost: 100,
        actions: 0,
      })),
    ];
    expect(attributeAnomaly(zeroResult, "2026-07-14", "cpa")).toMatchObject({
      unavailable: true,
      reason: "not_identified",
      reasonCode: "POSITIVE_COST_WITH_ZERO_RESULT",
    });
  });

  it("캐시는 anomaly date별 결과를 한 번 구조화한다", () => {
    const cache = buildAttributionCache({
      rows: sampleRows(),
      anomalyDates: ["2026-07-14"],
      metric: "cpa",
      mappedFields: new Set(["date", "cost", "actions", "channel"]),
      inputSignature: "sig-1",
    });
    expect(cache.inputSignature).toBe("sig-1");
    expect(cache.byDate["2026-07-14"].drivers.length).toBeGreaterThan(0);
  });
});
