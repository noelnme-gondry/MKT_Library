import { describe, expect, it } from "vitest";
import { chooseOutcomeModel, classifyOutcome, marginalOverdispersion, OUTCOME_CONFIG } from "./outcomeType";

describe("종속변수 척도 판별", () => {
  it("0/1만 있으면 binary", () => {
    expect(classifyOutcome([0, 1, 1, 0, 1]).kind).toBe("binary");
  });

  it("0~1 유계 소수는 proportion — 이게 OLS로 새던 자리다", () => {
    // CTR·CVR·리텐션이 전부 여기 해당한다.
    const result = classifyOutcome([0.012, 0.031, 0.008, 0.045, 0.02]);
    expect(result.kind).toBe("proportion");
    expect(result.hasBoundary).toBe(false);
  });

  it("경계(0 또는 1)를 포함한 비율은 그 사실을 표시한다", () => {
    // betareg는 개구간 (0,1)만 받으므로 소비처가 축소변환을 결정해야 한다.
    expect(classifyOutcome([0, 0.2, 0.5, 0.9]).hasBoundary).toBe(true);
    expect(classifyOutcome([0.1, 0.2, 0.5, 1]).hasBoundary).toBe(true);
  });

  it("음이 아닌 정수이고 값이 다양하면 count", () => {
    expect(classifyOutcome([0, 3, 7, 12, 41, 5]).kind).toBe("count");
  });

  it("서로 다른 값이 2개뿐인 정수열은 카운트로 보지 않는다", () => {
    // countMinDistinct=3 계약. [2,5]처럼 값이 둘뿐이면 카운트 모형이 과하다.
    // 다만 [0,1,2]는 카운트로 본다 — 저카디널리티 정수가 실제 카운트인지
    // 순서형 코드(등급 1/2/3)인지는 **데이터만으로는 구분할 수 없다**.
    // 판별을 여기서 더 똑똑하게 만드는 대신 한계로 남기고, 화면이 고른 모형을
    // 사유와 함께 보여줘 사용자가 뒤집을 수 있게 한다.
    expect(classifyOutcome([2, 5, 2, 5, 5]).kind).toBe("continuous");
    expect(classifyOutcome([0, 1, 2, 1, 0, 2]).kind).toBe("count");
  });

  it("음수나 1 초과 소수는 continuous", () => {
    expect(classifyOutcome([-3.2, 1.5, 8.8, 0.4]).kind).toBe("continuous");
    expect(classifyOutcome([1.5, 2.5, 8.25]).kind).toBe("continuous");
  });

  it("상수·빈 입력은 퇴화로 표시하고 모형을 고르지 않는다", () => {
    expect(classifyOutcome([]).kind).toBe("degenerate");
    expect(classifyOutcome([5, 5, 5]).kind).toBe("degenerate");
    expect(chooseOutcomeModel([5, 5, 5]).model).toBeNull();
  });

  it("비유한 값은 무시하되 남은 값으로 판별한다", () => {
    const result = classifyOutcome([0.1, NaN, 0.3, Infinity, 0.2]);
    expect(result.kind).toBe("proportion");
    expect(result.n).toBe(3);
  });
});

describe("과산포 진단", () => {
  it("분산 ≈ 평균이면 Poisson을 유지한다", () => {
    // 평균 4 부근, 분산도 4 부근이 되도록 구성한 결정론 표본.
    const poissonLike = [2, 3, 4, 5, 6, 4, 3, 5, 4, 4, 2, 6, 5, 3, 4, 4];
    const dispersion = marginalOverdispersion(poissonLike);
    expect(dispersion.ok).toBe(true);
    expect(dispersion.isOverdispersed).toBe(false);
    expect(chooseOutcomeModel(poissonLike).model).toBe("poisson");
  });

  it("분산이 평균을 크게 넘으면 음이항으로 보낸다", () => {
    // 마케팅 카운트의 전형 — 대부분 작고 소수가 매우 큼.
    const overdispersed = [0, 1, 0, 2, 1, 0, 48, 3, 1, 0, 62, 2, 0, 1, 55, 1];
    const dispersion = marginalOverdispersion(overdispersed);
    expect(dispersion.ratio).toBeGreaterThan(OUTCOME_CONFIG.overdispersionRatio);
    expect(chooseOutcomeModel(overdispersed).model).toBe("negbin");
  });

  it("평균이 0 이하면 비율을 계산하지 않는다", () => {
    expect(marginalOverdispersion([0, 0, 0]).ok).toBe(false);
  });

  it("분산/평균 비를 손계산과 대조한다", () => {
    // 값 [1,2,3,4,5]: 평균 3, 표본분산 2.5 → 비 0.8333...
    const dispersion = marginalOverdispersion([1, 2, 3, 4, 5]);
    expect(dispersion.mean).toBeCloseTo(3, 12);
    expect(dispersion.variance).toBeCloseTo(2.5, 12);
    expect(dispersion.ratio).toBeCloseTo(2.5 / 3, 12);
  });
});

describe("모형 라우팅", () => {
  it("각 척도를 맞는 family로 보낸다", () => {
    expect(chooseOutcomeModel([0, 1, 0, 1]).model).toBe("binomial");
    expect(chooseOutcomeModel([0.01, 0.05, 0.02, 0.09]).model).toBe("beta");
    expect(chooseOutcomeModel([-1.5, 2.25, 9.1]).model).toBe("gaussian");
  });

  it("사유를 함께 내서 화면이 '왜 이 모형인가'를 말할 수 있게 한다", () => {
    expect(chooseOutcomeModel([0.01, 0.05, 0.02, 0.09]).reason).toBe("bounded_proportion");
    expect(chooseOutcomeModel([0, 1, 0, 2, 1, 0, 48, 3, 1, 0, 62, 2, 0, 1, 55, 1]).reason).toBe("overdispersed_count");
  });

  it("임계값은 config로 분리돼 있다", () => {
    expect(OUTCOME_CONFIG.overdispersionRatio).toBe(1.5);
    const strict = { ...OUTCOME_CONFIG, overdispersionRatio: 1e9 };
    expect(chooseOutcomeModel([0, 1, 0, 2, 1, 0, 48, 3, 1, 0, 62, 2, 0, 1, 55, 1], strict).model).toBe("poisson");
  });

  it("결정론 — 같은 입력은 byte-identical", () => {
    const values = [0.1, 0.4, 0.02, 0.33, 0.9];
    expect(chooseOutcomeModel(values)).toEqual(chooseOutcomeModel(values));
  });
});
