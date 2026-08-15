import { describe, expect, it } from "vitest";
import { encodeGroups, normalizeMixedResult, prepareMixedInput } from "./mixedModel";

function mixedInput(overrides = {}) {
  const X = Array.from({ length: 60 }, (_, index) => [1, index % 2, index % 5]);
  const y = Array.from({ length: 60 }, (_, index) => 10 + (index % 7) * 1.5);
  // 12개 캠페인 × 5회 관측
  const groups = Array.from({ length: 60 }, (_, index) => `campaign_${index % 12}`);
  return { X, y, terms: ["(Intercept)", "hook", "length"], groups, ...overrides };
}

const row = (over = {}) => ({
  estimate: 0.4, std_error: 0.1, statistic: 4, p_value: 6.3e-5,
  ci_low: 0.2, ci_high: 0.6, n: 60, group_count: 12,
  group_sd: 2, residual_sd: 4, aic: 300, converged: true, singular: false, ...over,
});

describe("군집 라벨 인코딩", () => {
  it("문자열 라벨을 정수 코드로 바꾸고 표시용 라벨은 JS에 남긴다", () => {
    // 사용자 CSV 값을 R 코드에 문자열로 삽입하지 않기 위한 계약이다.
    const encoded = encodeGroups(["b", "a", "b", "c", "a", "b"]);
    expect(encoded.codes).toEqual([1, 2, 1, 3, 2, 1]);
    expect(encoded.labels).toEqual(["b", "a", "c"]);
    expect(encoded.sizes).toEqual([3, 2, 1]);
  });

  it("등장 순서를 보존한다(결정론)", () => {
    expect(encodeGroups(["z", "y", "z"]).labels).toEqual(["z", "y"]);
  });
});

describe("혼합모형 어댑터", () => {
  it("정상 패널 입력을 통과시킨다", () => {
    expect(prepareMixedInput(mixedInput())).toMatchObject({ ok: true, groupCount: 12 });
  });

  it("군집 식별자가 없으면 시작하지 않는다", () => {
    expect(prepareMixedInput(mixedInput({ groups: [] })).reason).toBe("missing_group_identifier");
    const withBlank = mixedInput();
    withBlank.groups = withBlank.groups.map((value, index) => (index === 0 ? "" : value));
    expect(prepareMixedInput(withBlank).reason).toBe("missing_group_identifier");
  });

  it("군집이 너무 적으면 막는다 — 분산 추정이 안 된다", () => {
    const fewGroups = mixedInput();
    fewGroups.groups = fewGroups.groups.map((_, index) => `g_${index % 3}`);
    expect(prepareMixedInput(fewGroups)).toMatchObject({
      ok: false,
      reason: "too_few_groups",
      groups: 3,
      requiredGroups: 4,
    });
  });

  it("반복 측정이 없으면 혼합모형을 쓸 이유가 없다", () => {
    // 군집마다 관측 1개면 random intercept가 잔차와 구분되지 않는다.
    const noRepeats = mixedInput();
    noRepeats.groups = noRepeats.groups.map((_, index) => `g_${index}`);
    expect(prepareMixedInput(noRepeats).reason).toBe("no_repeated_measures");
  });

  it("행 수가 모자라면 필요 행수를 낸다", () => {
    const short = mixedInput();
    short.X = short.X.slice(0, 20);
    short.y = short.y.slice(0, 20);
    short.groups = short.groups.slice(0, 20);
    expect(prepareMixedInput(short)).toMatchObject({ ok: false, reason: "insufficient_rows", requiredRows: 30 });
  });

  it("상수 성과변수는 적합하지 않는다", () => {
    expect(prepareMixedInput(mixedInput({ y: new Array(60).fill(3) })).reason).toBe("constant_outcome");
  });

  it("ICC를 분산성분에서 계산한다", () => {
    const result = normalizeMixedResult([row(), row({ estimate: 1.1 })], ["(Intercept)", "hook"], { groupCount: 12 });
    // group_sd=2, residual_sd=4 → 4 / (4+16) = 0.2
    expect(result.icc).toBeCloseTo(0.2, 12);
    expect(result.groupSd).toBe(2);
    expect(result.residualSd).toBe(4);
  });

  it("싱귤러 적합을 '군집 차이 없음'으로 뭉개지 않는다", () => {
    // 분산이 0으로 수렴하면 사실상 OLS인데 이름만 혼합모형이 된다.
    const result = normalizeMixedResult(
      [row({ singular: true, group_sd: 0 }), row({ singular: true, group_sd: 0 })],
      ["(Intercept)", "hook"], { groupCount: 12 },
    );
    expect(result.status).toBe("unstable");
    expect(result.reason).toBe("singular_fit");
    expect(result.rows.every((entry) => entry.isSignificant === false)).toBe(true);
  });

  it("p값이 Wald 근사임을 결과에 명시한다", () => {
    // lme4는 분모 자유도를 주지 않는다 — 정확한 t검정인 척하면 안 된다.
    const result = normalizeMixedResult([row(), row()], ["(Intercept)", "hook"], { groupCount: 12 });
    expect(result.pValueMethod).toBe("wald_normal_approximation");
  });

  it("수렴 실패는 유의 판정을 내지 않는다", () => {
    const result = normalizeMixedResult(
      [row({ converged: false }), row({ converged: false, p_value: 1e-9 })],
      ["(Intercept)", "hook"], { groupCount: 12 },
    );
    expect(result.status).toBe("unstable");
    expect(result.reason).toBe("nonconvergence");
  });

  it("행 수가 계약과 다르면 결과를 신뢰하지 않는다", () => {
    expect(normalizeMixedResult([row()], ["(Intercept)", "hook"], {})).toEqual({
      status: "failed",
      reason: "invalid_webr_result",
    });
  });
});
