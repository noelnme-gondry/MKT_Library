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

