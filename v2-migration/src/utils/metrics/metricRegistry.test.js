import { describe, it, expect } from "vitest";
import {
  ratio, DERIVED_METRICS, METRIC_BY_ID, getMetricRegistry, computeMetrics,
} from "./metricRegistry.js";
import { calculateKPIs } from "../dashboardAggregator.js";

// 골든 픽스처 — 결정론 상수(§8.3 Math.random 금지). 0나눗셈 케이스도 포함.
const AGG = {
  cost: 100000, impressions: 2000000, clicks: 8000,
  installs: 1600, actions: 900, revenue: 130000, purchases: 240, denom: 1600,
};

describe("metricRegistry · ratio 가드", () => {
  it("분모 falsy(0/NaN)면 null — 거짓 숫자 대신 계산 불가(§8.6)", () => {
    expect(ratio(5, 0)).toBe(null);
    expect(ratio(5, NaN)).toBe(null);
    expect(ratio(5, undefined)).toBe(null);
    expect(ratio(10, 4)).toBe(2.5);
    expect(ratio(1000, 2000000, 1000)).toBeCloseTo(0.5, 12); // CPM 스케일
  });
});

describe("metricRegistry · 파생식 verbatim (calculateKPIs 원본과 byte-identical)", () => {
  const d = computeMetrics(AGG, DERIVED_METRICS);
  // 아래 기대식은 리팩토링 前 calculateKPIs 하드코딩식 그대로 — 레지스트리가 이를 재현해야 함.
  it("cpm", () => expect(d.cpm).toBe((AGG.cost / AGG.impressions) * 1000));
  it("ctr", () => expect(d.ctr).toBe(AGG.clicks / AGG.impressions));
  it("cpc", () => expect(d.cpc).toBe(AGG.cost / AGG.clicks));
  it("cpi", () => expect(d.cpi).toBe(AGG.cost / AGG.denom));
  it("cvr", () => expect(d.cvr).toBe(AGG.denom / AGG.clicks));
  it("purchaseRate", () => expect(d.purchaseRate).toBe(AGG.purchases / AGG.denom));
  it("roas", () => expect(d.roas).toBe(AGG.revenue / AGG.cost));
  it("cpp", () => expect(d.cpp).toBe(AGG.cost / AGG.purchases));
  it("cpa === cpp (동일 식)", () => expect(d.cpa).toBe(d.cpp));
  it("arpu", () => expect(d.arpu).toBe(AGG.revenue / AGG.denom));
  it("arppu", () => expect(d.arppu).toBe(AGG.revenue / AGG.purchases));
});

describe("metricRegistry · calculateKPIs 회귀 잠금", () => {
  // 실제 rows → calculateKPIs가 레지스트리 경유로 같은 값을 내는지(shape·값 불변).
  const rows = [
    { date: "2026-01-01", cost: "60000", impressions: "1200000", clicks: "5000",
      installs: "1000", actions: "500", revenue_d7: "80000", pu_d7: "150", ret_d7: "0.3" },
    { date: "2026-01-02", cost: "40000", impressions: "800000", clicks: "3000",
      installs: "600", actions: "400", revenue_d7: "50000", pu_d7: "90", ret_d7: "0.25" },
  ];
  const k = calculateKPIs(rows, 7, "installs");

  it("base 합계 유지", () => {
    expect(k.cost).toBe(100000);
    expect(k.impressions).toBe(2000000);
    expect(k.installs).toBe(1600);
    expect(k.denom).toBe(1600);
    expect(k.revenue).toBe(130000);
    expect(k.purchases).toBe(240);
  });
  it("파생 지표가 수동식과 일치", () => {
    expect(k.ctr).toBe(8000 / 2000000);
    expect(k.cpi).toBe(100000 / 1600);
    expect(k.roas).toBe(130000 / 100000);
    expect(k.cpm).toBe((100000 / 2000000) * 1000);
    expect(k.arppu).toBe(130000 / 240);
  });
  it("denomBasis=actions면 분모 전환 반영", () => {
    const ka = calculateKPIs(rows, 7, "actions");
    expect(ka.denom).toBe(900);
    expect(ka.cpi).toBe(100000 / 900);
    expect(ka.arpu).toBe(130000 / 900);
  });
  it("retentionAvg는 SSOT(≤1) 유지", () => {
    expect(k.retentionAvg).toBeGreaterThan(0);
    expect(k.retentionAvg).toBeLessThanOrEqual(1);
  });
});

describe("metricRegistry · 커스텀 지표 병합(1급 시민)", () => {
  it("getMetricRegistry에 커스텀 주입 → 어디서든 계산", () => {
    const custom = [{
      id: "profit", label: "이익", unit: "currency", deps: ["revenue", "cost"],
      higherIsBetter: true, compute: (a) => a.revenue - a.cost,
    }];
    const reg = getMetricRegistry(custom);
    const ids = reg.map((m) => m.id);
    expect(ids).toContain("profit");
    expect(ids).toContain("ctr");   // 기존 파생 유지
    expect(ids).toContain("cost");  // base 유지
    const vals = computeMetrics(AGG, reg);
    expect(vals.profit).toBe(AGG.revenue - AGG.cost);
    expect(vals.ctr).toBe(AGG.clicks / AGG.impressions);
  });
  it("같은 id 커스텀은 기본 정의를 오버라이드", () => {
    const reg = getMetricRegistry([{ id: "roas", label: "ROAS*", compute: () => 42 }]);
    const roasDefs = reg.filter((m) => m.id === "roas");
    expect(roasDefs.length).toBe(1);
    expect(computeMetrics(AGG, reg).roas).toBe(42);
  });
  it("커스텀 compute throw → null(앱 안 죽음)", () => {
    const reg = getMetricRegistry([{ id: "boom", compute: () => { throw new Error("x"); } }]);
    expect(computeMetrics(AGG, reg).boom).toBe(null);
  });
  it("Infinity/NaN 결과 → null 정규화", () => {
    const reg = getMetricRegistry([{ id: "inf", compute: () => 1 / 0 }]);
    expect(computeMetrics(AGG, reg).inf).toBe(null);
  });
});

describe("metricRegistry · METRIC_BY_ID 조회", () => {
  it("base·derived 모두 id로 조회, base compute는 agg 값 반환", () => {
    expect(METRIC_BY_ID.cost.compute(AGG)).toBe(AGG.cost);
    expect(METRIC_BY_ID.roas.compute(AGG)).toBe(AGG.revenue / AGG.cost);
    expect(METRIC_BY_ID.ctr.label).toBe("CTR");
  });
});
