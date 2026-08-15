import { describe, expect, it } from "vitest";
import { STATS } from "./abTestMath";
import { correlationMatrix, DIAG_THRESHOLDS } from "./modelDiagnostics";

const col = (name, values) => ({ name, values });

describe("상관행렬 + Holm 보정", () => {
  it("완전 양의 상관과 완전 음의 상관을 정확히 낸다", () => {
    const result = correlationMatrix([
      col("a", [1, 2, 3, 4, 5]),
      col("b", [2, 4, 6, 8, 10]),
      col("c", [5, 4, 3, 2, 1]),
    ]);
    const ab = result.pairs.find((pair) => pair.left === "a" && pair.right === "b");
    const ac = result.pairs.find((pair) => pair.left === "a" && pair.right === "c");
    expect(ab.r).toBeCloseTo(1, 12);
    expect(ac.r).toBeCloseTo(-1, 12);
  });

  it("손으로 계산되는 r을 재현한다", () => {
    // Σ(x-x̄)(y-ȳ)=7, Σ(x-x̄)²=10, Σ(y-ȳ)²=10 → r = 7/√100 = 0.7
    const result = correlationMatrix([
      col("x", [-2, -1, 0, 1, 2]),
      col("y", [-2, 1, -1, 0, 2]),
    ]);
    expect(result.pairs[0].r).toBeCloseTo(0.7, 12);
    expect(result.pairs[0].df).toBe(3);
  });

  it("df=1에서 양측 p가 Cauchy 닫힌형과 정확히 일치한다", () => {
    // n=3이면 t분포는 자유도 1 = Cauchy라 p = 1 − (2/π)·atan|t| 로 닫힌형이 있다.
    // 이 데이터는 r=1/2 → t=1/√3 → atan(1/√3)=π/6 → p = 1 − 1/3 = 2/3 (정확값).
    // studentTp(불완전 베타)를 외부 상수 없이 검증하는 경로다.
    const result = correlationMatrix([col("x", [-1, 0, 1]), col("y", [-1, 1, 0])]);
    const pair = result.pairs[0];
    expect(pair.r).toBeCloseTo(0.5, 15);
    expect(pair.df).toBe(1);
    expect(pair.t).toBeCloseTo(1 / Math.sqrt(3), 15);
    expect(pair.rawP).toBeCloseTo(2 / 3, 15);
    expect(pair.rawP).toBeCloseTo(1 - (2 / Math.PI) * Math.atan(Math.abs(pair.t)), 15);
  });

  it("Holm 보정이 abTestMath의 공용 구현과 같은 값을 낸다", () => {
    const result = correlationMatrix([
      col("a", [1, 2, 3, 4, 5, 6, 7, 8]),
      col("b", [2, 4, 5, 9, 10, 12, 13, 16]),
      col("c", [5, 3, 8, 1, 9, 2, 7, 4]),
      col("d", [1, 9, 2, 8, 3, 7, 4, 6]),
    ]);
    const raw = result.pairs.map((pair) => pair.rawP);
    const shared = STATS.holmAdjust(raw);
    expect(result.pairs.map((pair) => pair.holmP)).toEqual(shared);
  });

  it("보정 전에는 유의하던 쌍이 보정 후 떨어진다", () => {
    // 채널 4개 = 쌍 6개. 이 데이터에서 a-d(raw 0.0497)와 b-d(raw 0.0424)는
    // 보정 전엔 "유의"지만 Holm 후 0.127로 떨어진다 — 5-25가 p 없이 r만 보여주던
    // 시절 "함께 움직인다"고 읽혔을 바로 그 쌍들이다.
    const result = correlationMatrix([
      col("a", [15, 6, 0, 7, 17, 15, 9, 2, 0, 3]),
      col("b", [31, 15, 2, 17, 36, 30, 18, 5, 3, 6]),
      col("c", [26, 8, 5, 19, 22, 17, 14, 14, 10, 13]),
      col("d", [15, 18, 4, 15, 17, 19, 6, 11, 8, 14]),
    ]);
    expect(result.comparisons).toBe(6);
    expect(result.pairs.every((pair) => pair.holmP >= pair.rawP)).toBe(true);

    const flipped = result.pairs.filter((pair) => pair.rawP < 0.05 && pair.holmP >= 0.05);
    expect(flipped.map((pair) => `${pair.left}-${pair.right}`).sort()).toEqual(["a-d", "b-d"]);

    const kept = result.pairs.filter((pair) => pair.isSignificant).map((pair) => `${pair.left}-${pair.right}`).sort();
    expect(kept).toEqual(["a-b", "a-c", "b-c"]);
  });

  it("분산 0인 열은 r=null (0으로 접어 '무관'이라 말하지 않는다)", () => {
    const result = correlationMatrix([
      col("flat", [3, 3, 3, 3, 3]),
      col("varies", [1, 2, 3, 4, 5]),
    ]);
    expect(result.pairs[0].r).toBeNull();
    expect(result.pairs[0].holmP).toBeNull();
    expect(result.pairs[0].isSignificant).toBe(false);
  });

  it("계산 불가 쌍은 보정 분모에서 빠진다", () => {
    const withFlat = correlationMatrix([
      col("a", [1, 2, 3, 4, 5, 6]),
      col("b", [2, 4, 5, 9, 10, 12]),
      col("flat", [7, 7, 7, 7, 7, 7]),
    ]);
    // 쌍은 3개지만 검정 가능한 건 a·b 하나뿐 → 보정 배수가 1이어야 한다.
    expect(withFlat.comparisons).toBe(1);
    const ab = withFlat.pairs.find((pair) => pair.left === "a" && pair.right === "b");
    expect(ab.holmP).toBeCloseTo(ab.rawP, 12);
  });

  it("Fisher z 신뢰구간은 pointwise이며 n>3에서만 나온다", () => {
    const small = correlationMatrix([col("a", [1, 2, 3]), col("b", [2, 4, 5])]);
    expect(small.pairs[0].ciLow).toBeNull();
    expect(small.ciKind).toBe("pointwise");

    const enough = correlationMatrix([
      col("a", [1, 2, 3, 4, 5, 6, 7, 8]),
      col("b", [2, 4, 5, 9, 10, 12, 13, 16]),
    ]);
    const pair = enough.pairs[0];
    expect(pair.ciLow).toBeLessThan(pair.r);
    expect(pair.ciHigh).toBeGreaterThan(pair.r);
    expect(pair.ciLow).toBeGreaterThanOrEqual(-1);
    expect(pair.ciHigh).toBeLessThanOrEqual(1);
  });

  it("입력이 부족하면 이유를 남기고 빈 결과를 낸다", () => {
    expect(correlationMatrix([]).reason).toBe("insufficient_columns");
    expect(correlationMatrix([col("a", [1, 2])]).reason).toBe("insufficient_columns");
    expect(correlationMatrix([col("a", [1, 2]), col("b", [1, 2])]).reason).toBe("insufficient_rows");
    expect(correlationMatrix([col("a", [1, 2, 3]), col("b", [1, 2])]).reason).toBe("ragged_columns");
  });

  it("임계값은 config로 분리돼 있다", () => {
    expect(DIAG_THRESHOLDS.correlationAlpha).toBe(0.05);
  });

  it("결정론 — 같은 입력은 byte-identical", () => {
    const input = [col("a", [1, 5, 2, 8, 3, 9]), col("b", [2, 4, 1, 7, 3, 8])];
    expect(correlationMatrix(input)).toEqual(correlationMatrix(input));
  });
});
