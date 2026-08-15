import { describe, expect, it } from "vitest";
import { cellMeans, fUpperTail, twoWayAnova, ANOVA_CONFIG } from "./factorialAnovaMath";
import { studentTp } from "./statPrimitives";

// 균형 설계(칸마다 관측 2개)에서는 Type I·II·III 제곱합이 모두 같아 손으로
// 검산할 수 있다. 아래 두 픽스처의 SS는 전부 지면 계산과 대조한 값이다.
const balanced = (values) => ({
  y: values,
  factorA: ["a1", "a1", "a1", "a1", "a2", "a2", "a2", "a2"],
  factorB: ["b1", "b1", "b2", "b2", "b1", "b1", "b2", "b2"],
});

describe("이원배치 분산분석 (Type II)", () => {
  it("가법 설계 — 주효과만 있고 상호작용은 0", () => {
    // 칸 평균 11 / 21 / 15 / 25, 총평균 18.
    // SS_A = 4·((16−18)²+(20−18)²) = 32, SS_B = 4·((13−18)²+(23−18)²) = 200,
    // 상호작용 잔차가 전부 0 → SS_AB = 0, SS_resid = 8 (df 4).
    const result = twoWayAnova({ ...balanced([10, 12, 20, 22, 14, 16, 24, 26]), nameA: "훅", nameB: "포맷" });
    expect(result.ok).toBe(true);
    expect(result.n).toBe(8);
    expect(result.terms[0].ss).toBeCloseTo(32, 10);
    expect(result.terms[1].ss).toBeCloseTo(200, 10);
    expect(result.terms[2].ss).toBeCloseTo(0, 10);
    expect(result.residual.ss).toBeCloseTo(8, 10);
    expect(result.residual.df).toBe(4);
    expect(result.residual.meanSquare).toBeCloseTo(2, 10);
    expect(result.terms.map((term) => term.df)).toEqual([1, 1, 1]);
    expect(result.terms[0].f).toBeCloseTo(16, 10);
    expect(result.terms[1].f).toBeCloseTo(100, 10);
    expect(result.interaction.isSignificant).toBe(false);
    expect(result.ssType).toBe("II");
  });

  it("상호작용 설계 — 주효과 0인 요인이 조합에서는 순위를 뒤집는다", () => {
    // 칸 평균 11 / 21 / 25 / 15. 포맷의 주효과는 정확히 0(b1 평균 = b2 평균 = 18)인데
    // 상호작용 SS는 200이다. 주효과만 보면 "포맷은 무관"이라 결론내지만, 실제로는
    // 훅의 우열이 포맷에 따라 뒤집힌다 — 이 도구를 넣는 이유가 이 케이스다.
    const result = twoWayAnova(balanced([10, 12, 20, 22, 24, 26, 14, 16]));
    expect(result.ok).toBe(true);
    expect(result.terms[0].ss).toBeCloseTo(32, 10);
    expect(result.terms[1].ss).toBeCloseTo(0, 10);
    expect(result.terms[2].ss).toBeCloseTo(200, 10);
    expect(result.terms[1].isSignificant).toBe(false);
    expect(result.interaction.isSignificant).toBe(true);
    expect(result.interaction.f).toBeCloseTo(100, 10);
  });

  it("부분 η²로 효과 크기를 함께 낸다(p만으로 판단하지 않게)", () => {
    const result = twoWayAnova(balanced([10, 12, 20, 22, 24, 26, 14, 16]));
    // 상호작용 SS=200, 잔차 SS=8 → 200/208
    expect(result.interaction.partialEtaSquared).toBeCloseTo(200 / 208, 10);
  });

  it("F 상측확률이 df1=1에서 양측 t와 정확히 일치한다", () => {
    // F(1, k) = t(k)². 이미 Cauchy 닫힌형으로 검증된 studentTp와 대조해
    // 외부 상수 없이 fUpperTail을 검증한다.
    for (const [t, df] of [[4, 4], [1, 3], [2.5, 10], [0.5, 20]]) {
      expect(fUpperTail(t * t, 1, df)).toBeCloseTo(studentTp(t, df), 12);
    }
  });

  it("불균형 설계에서도 Type II 제곱합은 음수가 아니다", () => {
    const result = twoWayAnova({
      y: [10, 12, 11, 20, 22, 14, 24, 26, 25, 27],
      factorA: ["a1", "a1", "a1", "a1", "a1", "a2", "a2", "a2", "a2", "a2"],
      factorB: ["b1", "b1", "b1", "b2", "b2", "b1", "b2", "b2", "b2", "b2"],
    });
    expect(result.ok).toBe(true);
    expect(result.terms.every((term) => term.ss >= 0)).toBe(true);
    expect(result.terms.every((term) => term.p >= 0 && term.p <= 1)).toBe(true);
  });

  it("종속변수가 상수면 '유의 없음'이 아니라 계산 불가로 돌려준다", () => {
    const result = twoWayAnova(balanced([7, 7, 7, 7, 7, 7, 7, 7]));
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("constant_outcome");
  });

  it("수준이 하나뿐인 요인은 분석하지 않는다", () => {
    const result = twoWayAnova({
      y: [1, 2, 3, 4],
      factorA: ["a1", "a1", "a1", "a1"],
      factorB: ["b1", "b1", "b2", "b2"],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("need_two_levels_each");
  });

  it("칸이 모자라면 이유를 남기고 멈춘다", () => {
    const result = twoWayAnova({
      y: [1, 2, 3],
      factorA: ["a1", "a2", "a2"],
      factorB: ["b1", "b1", "b2"],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("too_few_filled_cells");
  });

  it("잔차 자유도가 없으면 가비지 F 대신 이유를 낸다", () => {
    // 2×2 칸에 관측 1개씩 = 파라미터 4개, 관측 4개 → 잔차 df 0.
    const result = twoWayAnova({
      y: [1, 2, 3, 5],
      factorA: ["a1", "a1", "a2", "a2"],
      factorB: ["b1", "b2", "b1", "b2"],
    });
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("no_residual_df");
  });

  it("입력이 어긋나면 조용히 통과시키지 않는다", () => {
    expect(twoWayAnova({ y: [], factorA: [], factorB: [] }).reason).toBe("invalid_input");
    expect(twoWayAnova({ y: [1, 2], factorA: ["a"], factorB: ["b", "b"] }).reason).toBe("invalid_input");
    expect(twoWayAnova({ y: [1, NaN, 3, 4], factorA: ["a", "a", "b", "b"], factorB: ["c", "d", "c", "d"] }).reason).toBe("invalid_input");
  });

  it("임계값은 config로 분리돼 있다", () => {
    expect(ANOVA_CONFIG.alpha).toBe(0.05);
  });

  it("결정론 — 같은 입력은 byte-identical", () => {
    const input = balanced([10, 12, 20, 22, 24, 26, 14, 16]);
    expect(twoWayAnova(input)).toEqual(twoWayAnova(input));
  });
});

describe("칸별 평균", () => {
  it("조합별 평균과 표본 수를 정렬해 낸다", () => {
    const rows = cellMeans(balanced([10, 12, 20, 22, 24, 26, 14, 16]));
    expect(rows).toEqual([
      { levelA: "a1", levelB: "b1", n: 2, mean: 11 },
      { levelA: "a1", levelB: "b2", n: 2, mean: 21 },
      { levelA: "a2", levelB: "b1", n: 2, mean: 25 },
      { levelA: "a2", levelB: "b2", n: 2, mean: 15 },
    ]);
  });
});
