import { describe, expect, it } from "vitest";

import { buildMarginalEfficiencyGap } from "@/utils/marginalEfficiencyGap";

describe("buildMarginalEfficiencyGap", () => {
  it("CPA는 포화지수가 낮아 다음 예산 효율이 좋은 대상을 먼저 정렬", () => {
    const result = buildMarginalEfficiencyGap([
      { name: "포화", ok: true, avgCpr: 10, marginalCpr: 20, satIndex: 2, verdict: "saturated", raw: 8, r2: 0.7 },
      { name: "여유", ok: true, avgCpr: 10, marginalCpr: 7, satIndex: 0.7, verdict: "scale", raw: 12, r2: 0.9 },
    ], "cpa");

    expect(result.points.map((point) => point.name)).toEqual(["여유", "포화"]);
    expect(result.points[0]).toMatchObject({ average: 10, marginal: 7, observations: 12, r2: 0.9 });
  });

  it("ROAS는 엔진의 ROAS 평균·한계·판정을 사용", () => {
    const result = buildMarginalEfficiencyGap([{
      name: "Search",
      ok: true,
      r2: 0.82,
      roas: { avgRoas: 2, marginalRoas: 3, satIndexRoas: 2 / 3, verdict: "scale" },
    }], "roas");

    expect(result.points[0]).toMatchObject({
      name: "Search",
      average: 2,
      marginal: 3,
      verdict: "scale",
    });
  });

  it("무한 한계 CPA는 거짓 유한값으로 바꾸지 않고 차트 끝의 발산점으로 보존", () => {
    const result = buildMarginalEfficiencyGap([
      { name: "A", ok: true, avgCpr: 10, marginalCpr: 20, satIndex: 2, verdict: "saturated" },
      { name: "B", ok: true, avgCpr: 12, marginalCpr: Infinity, satIndex: Infinity, verdict: "saturated" },
    ], "cpa");

    expect(result.points.find((point) => point.name === "B")).toMatchObject({
      marginal: Infinity,
      isUnbounded: true,
      plotMarginal: result.domainMax,
    });
  });

  it("필수 값이 없는 대상은 0으로 위장하지 않고 제외", () => {
    const result = buildMarginalEfficiencyGap([
      { name: "A", ok: true, avgCpr: null, marginalCpr: 10, satIndex: 1 },
    ], "cpa");

    expect(result.points).toEqual([]);
    expect(result.excluded).toEqual([{ name: "A", reason: "incalculable" }]);
  });
});
