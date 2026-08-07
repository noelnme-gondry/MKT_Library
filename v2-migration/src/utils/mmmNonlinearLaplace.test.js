import { describe, expect, it } from "vitest";
import { mmmNonlinearLaplace } from "./mmmNonlinearLaplace";

// BIC-가중 프로파일 모델 목록을 만든다. nll = -2 ln w 이므로 원하는 곡률의
// nll을 주고 w = exp(-0.5 nll)로 역산해 넣는다.
function modelFromNll(alpha, ec, slope, nll) {
  return { alpha, ec, slope, weight: Math.exp(-0.5 * nll) };
}

describe("mmmNonlinearLaplace (MMM T2 비선형 파라미터 불확실성)", () => {
  it("빈/무효 입력 → null", () => {
    expect(mmmNonlinearLaplace(null)).toBeNull();
    expect(mmmNonlinearLaplace([])).toBeNull();
  });

  it("단일 후보 → 모든 파라미터 method:'fixed', sd 0", () => {
    const out = mmmNonlinearLaplace([{ alpha: 0.4, ec: 100, slope: 1.2, weight: 1 }]);
    expect(out.alpha.method).toBe("fixed");
    expect(out.alpha.sd).toBe(0);
    expect(out.alpha.ci90).toEqual([0.4, 0.4]);
  });

  it("내부 최빈값 + 대칭 곡률이면 Laplace SD가 알려진 값과 일치", () => {
    // alpha 그리드 0.2/0.4/0.6, 최빈 0.4(nll 0), 이웃 nll +3 대칭(h=0.2).
    // a = 0.5*(3/0.2² + 3/0.2²) = 3/0.04 = 75 → SD = 1/√75 ≈ 0.1155.
    // 1.645·SD ≈ 0.19 < 0.2 이므로 구간이 그리드 [0.2,0.6] 안에 들어와 clamp 없음.
    const models = [
      modelFromNll(0.2, 100, 1, 3),
      modelFromNll(0.4, 100, 1, 0),
      modelFromNll(0.6, 100, 1, 3),
    ];
    const out = mmmNonlinearLaplace(models);
    expect(out.alpha.method).toBe("laplace");
    expect(out.alpha.value).toBe(0.4);
    expect(out.alpha.sd).toBeCloseTo(1 / Math.sqrt(75), 6);
    expect(out.alpha.ci90[0]).toBeCloseTo(0.4 - 1.645 / Math.sqrt(75), 6);
    expect(out.alpha.ci90[1]).toBeCloseTo(0.4 + 1.645 / Math.sqrt(75), 6);
    expect(out.alpha.gridLimited).toBe(false);
  });

  it("구간은 관측 그리드 범위로 clamp되고 gridLimited 표시", () => {
    // 아주 평평한 곡률(작은 nll 차) → 큰 SD → 그리드 밖으로 나가 clamp.
    const models = [
      modelFromNll(0.2, 100, 1, 0.001),
      modelFromNll(0.4, 100, 1, 0),
      modelFromNll(0.6, 100, 1, 0.001),
    ];
    const out = mmmNonlinearLaplace(models);
    expect(out.alpha.ci90[0]).toBeGreaterThanOrEqual(0.2 - 1e-9);
    expect(out.alpha.ci90[1]).toBeLessThanOrEqual(0.6 + 1e-9);
    expect(out.alpha.gridLimited).toBe(true);
  });

  it("최빈값이 그리드 경계면 이산 가중 SD로 폴백(gridLimited)", () => {
    // 최빈값이 최소값(경계) → Laplace 곡률 불가 → grid-weighted.
    const models = [
      modelFromNll(0.2, 100, 1, 0),
      modelFromNll(0.4, 100, 1, 3),
      modelFromNll(0.6, 100, 1, 6),
    ];
    const out = mmmNonlinearLaplace(models);
    expect(out.alpha.value).toBe(0.2);
    expect(out.alpha.method).toBe("grid-weighted");
    expect(out.alpha.gridLimited).toBe(true);
    expect(out.alpha.sd).toBeGreaterThan(0);
  });

  it("결정론 — 동일 입력 두 번 호출 byte-동일", () => {
    const models = [
      modelFromNll(0.2, 80, 0.8, 4),
      modelFromNll(0.4, 100, 1.2, 0),
      modelFromNll(0.6, 120, 1.6, 3),
    ];
    expect(JSON.stringify(mmmNonlinearLaplace(models))).toBe(JSON.stringify(mmmNonlinearLaplace(models)));
  });
});
