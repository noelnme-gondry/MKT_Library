import { describe, expect, it } from "vitest";
import { normalizeCountResult, prepareCountInput } from "./countRegression";

function countInput(overrides = {}) {
  const X = Array.from({ length: 40 }, (_, index) => [1, index % 2, index % 5]);
  const y = Array.from({ length: 40 }, (_, index) => (index % 9) * 2);
  return { X, y, terms: ["(Intercept)", "hook", "length"], ...overrides };
}

const row = (over = {}) => ({
  estimate: 0.1, std_error: 0.2, statistic: 0.5, p_value: 0.6,
  ci_low: -0.3, ci_high: 0.5, rate_ratio: 1.1, rate_ratio_low: 0.74, rate_ratio_high: 1.65,
  n: 40, aic: 210, dispersion: 1.02, theta: NaN, family: "poisson", converged: true, ...over,
});

describe("카운트 회귀 어댑터", () => {
  it("정상 카운트 입력을 통과시킨다", () => {
    expect(prepareCountInput(countInput())).toMatchObject({ ok: true, parameterCount: 3 });
  });

  it("소수·음수는 카운트가 아니므로 막는다", () => {
    expect(prepareCountInput(countInput({ y: Array(40).fill(1.5) })).reason).toBe("outcome_not_counts");
    const negative = countInput();
    negative.y = negative.y.map((value, index) => (index === 0 ? -1 : value));
    expect(prepareCountInput(negative).reason).toBe("outcome_not_counts");
  });

  it("상수 성과변수는 적합하지 않는다", () => {
    expect(prepareCountInput(countInput({ y: Array(40).fill(4) })).reason).toBe("constant_outcome");
  });

  it("파라미터당 관측이 모자라면 필요 행수를 낸다", () => {
    const short = countInput();
    short.X = short.X.slice(0, 20);
    short.y = short.y.slice(0, 20);
    expect(prepareCountInput(short)).toMatchObject({ ok: false, reason: "insufficient_rows", requiredRows: 30 });
  });

  it("Poisson을 유지한 결과를 그대로 표시한다", () => {
    const result = normalizeCountResult([row(), row({ estimate: 0.9, p_value: 0.001, statistic: 4.5 })],
      ["(Intercept)", "hook"], { y: new Array(40) });
    expect(result.family).toBe("poisson");
    expect(result.switchedToNegativeBinomial).toBe(false);
    expect(result.dispersionRatio).toBeCloseTo(1.02, 12);
    expect(result.theta).toBeNull();
  });

  it("음이항 전환을 결과에 드러낸다", () => {
    // 과산포를 무시하고 Poisson으로 두면 SE가 과소추정돼 없는 유의가 생긴다.
    // 어떤 모형으로 갔는지는 화면이 반드시 말해야 하는 정보다.
    const rows = [
      row({ family: "negbin", dispersion: 6.4, theta: 0.83 }),
      row({ family: "negbin", dispersion: 6.4, theta: 0.83, estimate: 1.2, p_value: 0.002, statistic: 3.1 }),
    ];
    const result = normalizeCountResult(rows, ["(Intercept)", "hook"], { y: new Array(40) });
    expect(result.family).toBe("negbin");
    expect(result.switchedToNegativeBinomial).toBe(true);
    expect(result.dispersionRatio).toBeCloseTo(6.4, 12);
    expect(result.theta).toBeCloseTo(0.83, 12);
  });

  it("발생률비(IRR)를 해석 단위로 함께 낸다", () => {
    const result = normalizeCountResult([row(), row({ rate_ratio: 3.32, estimate: 1.2, p_value: 0.002, statistic: 3.1 })],
      ["(Intercept)", "hook"], { y: new Array(40) });
    expect(result.rows[0].rateRatio).toBeCloseTo(3.32, 12);
    expect(result.link).toBe("log");
  });

  it("수렴 실패는 unstable로 표시하고 유의 판정을 내지 않는다", () => {
    const result = normalizeCountResult(
      [row({ converged: false }), row({ converged: false, p_value: 1e-9, statistic: 9 })],
      ["(Intercept)", "hook"], { y: new Array(40) },
    );
    expect(result.status).toBe("unstable");
    expect(result.rows.every((entry) => entry.isSignificant === false)).toBe(true);
  });

  it("행 수가 계약과 다르면 결과를 신뢰하지 않는다", () => {
    expect(normalizeCountResult([row()], ["(Intercept)", "hook"], {})).toEqual({
      status: "failed",
      reason: "invalid_webr_result",
    });
  });
});
