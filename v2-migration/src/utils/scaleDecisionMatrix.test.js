import { describe, expect, it } from "vitest";

import { buildScaleDecisionMatrix, classifyScaleDecision, median } from "@/utils/scaleDecisionMatrix";

describe("scaleDecisionMatrix", () => {
  it("중앙값은 짝수·홀수 개수에서 실제 중앙을 반환", () => {
    expect(median([30, 10, 20])).toBe(20);
    expect(median([40, 10, 30, 20])).toBe(25);
    expect(median([])).toBe(null);
  });

  it("ROAS 사분면을 증액·유지·관찰·감액 검토로 분류", () => {
    const base = { metric: "roas", costThreshold: 100, efficiencyThreshold: 1.5 };
    expect(classifyScaleDecision({ ...base, cost: 50, efficiency: 2 })).toBe("scale");
    expect(classifyScaleDecision({ ...base, cost: 150, efficiency: 2 })).toBe("maintain");
    expect(classifyScaleDecision({ ...base, cost: 50, efficiency: 1 })).toBe("watch");
    expect(classifyScaleDecision({ ...base, cost: 150, efficiency: 1 })).toBe("reduce");
  });

  it("CPA 사분면은 저비용·고CPA를 종료 검토, 고비용·고CPA를 감액 검토로 분리", () => {
    const base = { metric: "cpa", costThreshold: 100, efficiencyThreshold: 10 };
    expect(classifyScaleDecision({ ...base, cost: 50, efficiency: 5 })).toBe("scale");
    expect(classifyScaleDecision({ ...base, cost: 150, efficiency: 5 })).toBe("maintain");
    expect(classifyScaleDecision({ ...base, cost: 50, efficiency: 15 })).toBe("stop");
    expect(classifyScaleDecision({ ...base, cost: 150, efficiency: 15 })).toBe("reduce");
  });

  it("행 평균이 아니라 채널별 분자·분모 합계와 포트폴리오 가중 기준을 사용", () => {
    const result = buildScaleDecisionMatrix({
      rows: [
        { channel: "A", cost: "100", actions: "10", revenue_d7: "300" },
        { channel: "A", cost: "300", actions: "10", revenue_d7: "300" },
        { channel: "B", cost: "100", actions: "20", revenue_d7: "100" },
      ],
      grain: "channel",
      metric: "cpa",
      resultField: "actions",
      revenueField: "revenue_d7",
    });

    expect(result.points.find((point) => point.name === "A")).toMatchObject({
      cost: 400,
      results: 20,
      efficiency: 20,
    });
    expect(result.thresholds.cost).toBe(250);
    expect(result.thresholds.efficiency).toBe(12.5);
  });

  it("캠페인은 채널 이름과 결합하고 CPA 분모 0은 거짓 좌표 대신 제외 사유로 남김", () => {
    const result = buildScaleDecisionMatrix({
      rows: [
        { channel: "Meta", campaign_name: "Brand", cost: 100, actions: 0 },
        { channel: "Google", campaign_name: "Search", cost: 200, actions: 20 },
      ],
      grain: "campaign",
      metric: "cpa",
      resultField: "actions",
    });

    expect(result.points.map((point) => point.name)).toEqual(["Google · Search"]);
    expect(result.excluded).toEqual([{ name: "Meta · Brand", reason: "zero_results" }]);
  });

  it("일부 행의 성과·매출이 비어 있으면 부분합을 완전한 지표처럼 표시하지 않음", () => {
    const cpa = buildScaleDecisionMatrix({
      rows: [
        { channel: "A", cost: 100, actions: 10 },
        { channel: "A", cost: 100, actions: "" },
      ],
      metric: "cpa",
      resultField: "actions",
    });
    const roas = buildScaleDecisionMatrix({
      rows: [
        { channel: "B", cost: 100, actions: 10, revenue_d7: 200 },
        { channel: "B", cost: 100, actions: 10, revenue_d7: "" },
      ],
      metric: "roas",
      resultField: "actions",
      revenueField: "revenue_d7",
    });

    expect(cpa.points).toEqual([]);
    expect(cpa.excluded).toEqual([{ name: "A", reason: "missing_results" }]);
    expect(roas.points).toEqual([]);
    expect(roas.excluded).toEqual([{ name: "B", reason: "missing_revenue" }]);
  });
});
