import { describe, expect, it } from "vitest";
import { normalizeRateResult, prepareRateInput, squeezeProportions } from "./rateRegression";

function rateInput(overrides = {}) {
  const X = Array.from({ length: 40 }, (_, index) => [1, index % 2, index % 5]);
  // 0~1 유계 비율(CTR 같은) — 경계 없음
  const y = Array.from({ length: 40 }, (_, index) => 0.02 + (index % 7) * 0.01);
  return { X, y, terms: ["(Intercept)", "hook", "length"], ...overrides };
}

describe("베타 회귀 어댑터 (0~1 비율)", () => {
  it("정상 비율 입력을 통과시킨다", () => {
    expect(prepareRateInput(rateInput())).toMatchObject({ ok: true, boundaryAdjusted: false });
  });

  it("구간 밖 값은 webR을 시작하기 전에 막는다", () => {
    expect(prepareRateInput(rateInput({ y: Array(40).fill(1.4) }))).toMatchObject({
      ok: false,
      reason: "outcome_out_of_unit_interval",
    });
    const withNegative = rateInput();
    withNegative.y = withNegative.y.map((value, index) => (index === 0 ? -0.01 : value));
    expect(prepareRateInput(withNegative).reason).toBe("outcome_out_of_unit_interval");
  });

  it("상수 성과변수는 적합하지 않는다", () => {
    expect(prepareRateInput(rateInput({ y: Array(40).fill(0.3) })).reason).toBe("constant_outcome");
  });

  it("파라미터당 관측이 모자라면 이유와 필요 행수를 낸다", () => {
    const short = rateInput();
    short.X = short.X.slice(0, 12);
    short.y = short.y.slice(0, 12);
    expect(prepareRateInput(short)).toMatchObject({
      ok: false,
      reason: "insufficient_rows",
      rows: 12,
      requiredRows: 30,
    });
  });

  it("경계(0·1)가 있으면 축소변환하고 그 사실을 남긴다", () => {
    // betareg는 개구간만 받는다. 변환을 조용히 하면 결과가 원자료와 다른데
    // 화면이 그걸 모른다 — boundaryAdjusted로 반드시 드러낸다.
    const withZero = rateInput();
    withZero.y = withZero.y.map((value, index) => (index === 0 ? 0 : value));
    const prepared = prepareRateInput(withZero);
    expect(prepared.ok).toBe(true);
    expect(prepared.boundaryAdjusted).toBe(true);
    expect(prepared.y.every((value) => value > 0 && value < 1)).toBe(true);
    expect(prepared.rawY[0]).toBe(0);
  });

  it("축소변환은 Smithson-Verkuilen 식과 일치한다", () => {
    // y' = (y·(n−1) + 0.5) / n, n=4 → 0 → 0.125, 1 → 0.875
    expect(squeezeProportions([0, 1, 0.5, 0.25])).toEqual([
      0.125,
      (1 * 3 + 0.5) / 4,
      (0.5 * 3 + 0.5) / 4,
      (0.25 * 3 + 0.5) / 4,
    ]);
  });

  it("수렴 실패는 unstable로 표시하고 유의 판정을 내지 않는다", () => {
    const rows = [
      { estimate: 0.1, std_error: 0.2, statistic: 0.5, p_value: 0.6, ci_low: -0.3, ci_high: 0.5, odds_ratio: 1.1, n: 40, pseudo_r2: 0.2, phi: 30, converged: false },
      { estimate: 2, std_error: 0.1, statistic: 20, p_value: 1e-8, ci_low: 1.8, ci_high: 2.2, odds_ratio: 7.4, n: 40, pseudo_r2: 0.2, phi: 30, converged: false },
    ];
    const result = normalizeRateResult(rows, ["(Intercept)", "hook"], { y: new Array(40) });
    expect(result.status).toBe("unstable");
    expect(result.rows[0].isSignificant).toBe(false);
  });

  it("정상 결과는 BH 보정 p와 오즈비를 낸다", () => {
    const rows = [
      { estimate: -3, std_error: 0.2, statistic: -15, p_value: 1e-9, ci_low: -3.4, ci_high: -2.6, odds_ratio: 0.05, n: 40, pseudo_r2: 0.31, phi: 42, converged: true },
      { estimate: 0.7, std_error: 0.2, statistic: 3.5, p_value: 0.0005, ci_low: 0.3, ci_high: 1.1, odds_ratio: 2.01, n: 40, pseudo_r2: 0.31, phi: 42, converged: true },
      { estimate: 0.05, std_error: 0.2, statistic: 0.25, p_value: 0.8, ci_low: -0.35, ci_high: 0.45, odds_ratio: 1.05, n: 40, pseudo_r2: 0.31, phi: 42, converged: true },
    ];
    const result = normalizeRateResult(rows, ["(Intercept)", "hook", "length"], { y: new Array(40) });
    expect(result.status).toBe("complete");
    expect(result.family).toBe("beta");
    expect(result.link).toBe("logit");
    expect(result.precision).toBe(42);
    expect(result.rows[0].name).toBe("hook");
    expect(result.rows[0].isSignificant).toBe(true);
    expect(result.rows[1].isSignificant).toBe(false);
    // BH: 2개 검정, 0.0005·0.8 → 0.001·0.8
    expect(result.rows[0].p).toBeCloseTo(0.001, 12);
  });

  it("행 수가 계약과 다르면 결과를 신뢰하지 않는다", () => {
    expect(normalizeRateResult([], ["(Intercept)", "hook"], {})).toEqual({
      status: "failed",
      reason: "invalid_webr_result",
    });
  });
});
