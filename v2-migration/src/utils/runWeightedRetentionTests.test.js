import { describe, it, expect } from "vitest";
import { buildRetentionCurve, computeWeightedRetention, calculateKPIs } from "./dashboardAggregator.js";

// Golden test for computeWeightedRetention (SSOT 가중 리텐션) — index.html §7 이식.
// 검증: (a) 비율컬럼 모수가중 (b) 인원수컬럼 Σret (c) 정수퍼센트 hasWholePct 경고
// (d) 빈/무효 방어 (e) rate clamp (f) 단순평균이 아님(코호트 크기 가중).
describe("computeWeightedRetention (golden)", () => {
  it("T1 · 비율컬럼: 모수 가중 평균 (단순평균 아님)", () => {
    // 두 코호트: 설치 900 @ 0.10, 설치 100 @ 0.50.
    // 가중: (0.10*900 + 0.50*100) / (900+100) = (90+50)/1000 = 0.14
    // 단순평균이면 (0.10+0.50)/2 = 0.30 → 이 값이 나오면 버그.
    const rows = [
      { ret_d7: 0.1, installs: 900 },
      { ret_d7: 0.5, installs: 100 },
    ];
    const r = computeWeightedRetention(rows, 7, "installs");
    expect(r.isRate).toBe(true);
    expect(r.rate).toBeCloseTo(0.14, 12);
    expect(r.denom).toBe(1000);
    expect(r.survivors).toBe(140); // Math.round(90+50)
    expect(r.hasWholePct).toBe(false);
  });

  it("T2 · 인원수컬럼: 분자=Σret, 분모=Σ모수, hasWholePct 경고", () => {
    // ret 값이 인원수(자연수, max>1) → Σret / Σ모수.
    // 30/50 다 1~100 → 정수퍼센트 의심 경고.
    const rows = [
      { ret_d30: 30, installs: 100 },
      { ret_d30: 50, installs: 200 },
    ];
    const r = computeWeightedRetention(rows, 30, "installs");
    expect(r.isRate).toBe(false);
    expect(r.survivors).toBe(80); // 30+50
    expect(r.denom).toBe(300);
    expect(r.rate).toBeCloseTo(80 / 300, 12);
    expect(r.hasWholePct).toBe(true);
  });

  it("T3 · 빈/무효 → null 방어, 0%는 유효 관측", () => {
    expect(computeWeightedRetention([], 7, "installs").rate).toBe(null);
    // 음수/NaN만 있으면 null. 0은 실제 0% 리텐션이라 분모에 포함해야 한다.
    const r = computeWeightedRetention(
      [{ ret_d7: -1, installs: 50 }, { ret_d7: NaN, installs: 10 }],
      7,
      "installs",
    );
    expect(r.rate).toBe(null);
    expect(r.survivors).toBe(0);
    expect(r.denom).toBe(0);

    const zero = computeWeightedRetention(
      [{ ret_d7: 0, installs: 900 }, { ret_d7: 0.5, installs: 100 }],
      7,
      "installs",
    );
    expect(zero.rate).toBeCloseTo(0.05, 12);
    expect(zero.denom).toBe(1000);
    expect(zero.survivors).toBe(50);
  });

  it("T4 · rate 상한 clamp (num > denom → 1)", () => {
    // 인원수컬럼인데 잔존 인원이 모수보다 크면 rate는 1로 clamp(방어).
    const rows = [{ ret_d7: 150, installs: 100 }];
    const r = computeWeightedRetention(rows, 7, "installs");
    expect(r.isRate).toBe(false);
    expect(r.rate).toBe(1);
  });

  it("T5 · basis 토글(installs↔actions) 모수 전환", () => {
    const rows = [
      { ret_d7: 0.2, installs: 100, actions: 50 },
      { ret_d7: 0.4, installs: 100, actions: 50 },
    ];
    const byInst = computeWeightedRetention(rows, 7, "installs");
    const byAct = computeWeightedRetention(rows, 7, "actions");
    // 모수 동일 비율(둘 다 균등)이라 rate는 같지만 denom·survivors는 기준 따라 다름.
    expect(byInst.rate).toBeCloseTo(0.3, 12);
    expect(byAct.rate).toBeCloseTo(0.3, 12);
    expect(byInst.denom).toBe(200);
    expect(byAct.denom).toBe(100);
    expect(byInst.survivors).toBe(60); // 0.2*100 + 0.4*100
    expect(byAct.survivors).toBe(30); // 0.2*50 + 0.4*50
  });

  it("T6 · 코호트 곡선 D0는 정의상 100%, D7/D14는 모수 가중", () => {
    const rows = [
      { installs: 900, ret_d7: 0.1, ret_d14: 0.05 },
      { installs: 100, ret_d7: 0.5, ret_d14: 0.25 },
    ];
    expect(buildRetentionCurve(rows, "installs", [0, 7, 14])).toEqual([1, 0.14, 0.07]);
  });

  it("T7 · calculateKPIs.retentionAvg는 SSOT 재사용 (≤1, 인원수 컬럼도 폭주 안 함)", () => {
    // 회귀: 예전엔 여기서 ret_d7(인원수, 예 50명)을 문자열 아니라고 변환 없이 그대로
    // 평균해 10895% 같은 값이 나오던 버그. 인원수 컬럼이어도 rate는 반드시 0~1.
    const rows = [
      { ret_d7: 50, installs: 100, cost: 1000, impressions: 0, clicks: 0, actions: 0 },
      { ret_d7: 80, installs: 200, cost: 1000, impressions: 0, clicks: 0, actions: 0 },
    ];
    const kpi = calculateKPIs(rows, 7, "installs");
    expect(kpi.retentionAvg).not.toBeNull();
    expect(kpi.retentionAvg).toBeLessThanOrEqual(1);
    expect(kpi.retentionAvg).toBeCloseTo((50 + 80) / (100 + 200), 12); // Σret/Σinstalls
  });

  it("T8 · malformed Infinity values never poison dashboard totals", () => {
    const kpi = calculateKPIs([
      { cost: 100, installs: 10, actions: 5, impressions: 1000, clicks: 20, revenue_d7: 40 },
      { cost: Infinity, installs: Infinity, actions: Infinity, impressions: Infinity, clicks: Infinity, revenue_d7: Infinity },
    ], 7, "installs");
    expect(kpi.cost).toBe(100);
    expect(kpi.installs).toBe(10);
    expect(kpi.revenue).toBe(40);
  });
});
