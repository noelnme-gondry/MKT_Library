import { describe, expect, it } from "vitest";
import { efficiencyBridge } from "./efficiencyBridge";

const period = (cost, impressions, results) => ({ cost, impressions, results });

describe("efficiencyBridge", () => {
  // 곱셈 항등식이라 잔차가 없어야 한다. 여기가 어긋나면 분해가 아니라 추정이다.
  it("keeps the multiplicative identity exactly", () => {
    const result = efficiencyBridge(period(1000, 500000, 200), period(1500, 600000, 210));
    expect(result.ok).toBe(true);
    expect(result.cpa.ratio).toBeCloseTo(result.cpm.ratio / result.responseRate.ratio, 12);
  });

  it("blames media price when only CPM moved", () => {
    // 노출당 비용만 2배, 반응률은 그대로
    const result = efficiencyBridge(period(1000, 1000000, 100), period(2000, 1000000, 100));
    expect(result.cpm.changePct).toBeCloseTo(100, 10);
    expect(result.responseRate.changePct).toBeCloseTo(0, 10);
    expect(result.driver).toBe("media-price");
    expect(result.cpa.changePct).toBeCloseTo(100, 10);
  });

  it("blames the response rate when only conversion moved", () => {
    // 매체가는 그대로, 같은 노출에서 결과가 절반
    const result = efficiencyBridge(period(1000, 1000000, 100), period(1000, 1000000, 50));
    expect(result.cpm.changePct).toBeCloseTo(0, 10);
    expect(result.responseRate.changePct).toBeCloseTo(-50, 10);
    expect(result.driver).toBe("response-rate");
    expect(result.cpa.changePct).toBeCloseTo(100, 10);
  });

  // 2배와 1/2배는 같은 크기의 변화다. 백분율로 크기를 재면 비대칭이라 판정이 기운다.
  it("treats a doubling and a halving as equally large", () => {
    const up = efficiencyBridge(period(1000, 1000000, 100), period(2000, 1000000, 100));
    const down = efficiencyBridge(period(2000, 1000000, 100), period(1000, 1000000, 100));
    expect(up.mediaShare).toBeCloseTo(down.mediaShare, 12);
  });

  it("flags two factors that moved in the same direction and cancelled out", () => {
    // 매체가 +25%, 반응률 +25% → CPA는 거의 그대로지만 안에서는 둘 다 움직였다
    const result = efficiencyBridge(period(1000, 1000000, 100), period(1250, 1000000, 125));
    expect(Math.abs(result.cpa.changePct)).toBeLessThan(1);
    expect(result.offsetting).toBe(true);
  });

  it("refuses to compute instead of inventing zeros", () => {
    for (const bad of [period(0, 1000, 10), period(1000, 0, 10), period(1000, 1000, 0), null, {}]) {
      const result = efficiencyBridge(bad, period(1000, 1000, 10));
      expect(result.ok, JSON.stringify(bad)).toBe(false);
      expect(result.reason).toBe("needs-cost-impressions-results");
    }
  });
});
