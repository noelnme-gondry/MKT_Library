import { describe, expect, it } from "vitest";
import { ALLOC_MATH } from "@/utils/allocationMath";
import { curveRows } from "./__fixtures__/plannerFixtures";
import { assessConformity } from "./conformity";
import { dowFactorsFromSamples, ratioToMovingAverageSamples } from "./dowProfile";
import { resolvePlannerConfig } from "./plannerConfig";
import { fitNodeCurve, predictNodeCpr, scaleModel } from "./plannerCurve";
import { dailyByNode, normalizePlannerRows } from "./plannerData";
import { addDays, dowOf } from "./plannerStats";

const cfg = resolvePlannerConfig().config;
const levels = cfg.hierarchy.levels;
const PATH = { country: "KR", platform: "iOS", channel: "Meta", campaign_name: "C1" };

function nodeFrom(rawRows) {
  const { rows } = normalizePlannerRows(rawRows, { metric: "installs" });
  return [...dailyByNode(rows, "campaign_name", levels).values()][0];
}
// 지출이 7일 주기가 아닌 사인파로 움직여 요일과 지출이 얽히지 않게 한다.
const wavy = (base) => (t) => base * (1 + 0.45 * Math.sin(t / 4.3));

describe("요일 계수", () => {
  it("주말 CPR ×1.3을 심으면 백피팅이 그 비율을 되찾는다(수축 없음)", () => {
    const weekend = [1.3, 1, 1, 1, 1, 1, 1.3];
    const node = nodeFrom(curveRows({ path: PATH, spend: wavy(100000), a: 40, b: 0.3, dowCpr: weekend, jitter: 0.01 }));
    const noShrink = resolvePlannerConfig({ dow: { shrinkK: 0 } }).config;
    const curve = fitNodeCurve(node.days, noShrink, {});
    const weekdayMean = curve.cprDow.slice(1, 6).reduce((a, b) => a + b, 0) / 5;
    for (const day of [0, 6]) {
      expect(curve.cprDow[day] / weekdayMean).toBeGreaterThan(1.27);
      expect(curve.cprDow[day] / weekdayMean).toBeLessThan(1.33);
    }
  });

  it("기본 수축(K=4)에서는 요일당 표본 8개면 (8·1.3 + 4·1)/12 ≈ 1.2 쪽으로 당겨진다", () => {
    const weekend = [1.3, 1, 1, 1, 1, 1, 1.3];
    const node = nodeFrom(curveRows({ path: PATH, spend: wavy(100000), a: 40, b: 0.3, dowCpr: weekend, jitter: 0.01 }));
    const curve = fitNodeCurve(node.days, cfg, {});
    const weekdayMean = curve.cprDow.slice(1, 6).reduce((a, b) => a + b, 0) / 5;
    expect(curve.cprDow[6] / weekdayMean).toBeGreaterThan(1.15);
    expect(curve.cprDow[6] / weekdayMean).toBeLessThan(1.24);
  });

  it("주말에 지출만 크고 CPR 요일 효과가 없으면 계수는 1 근처다(지출 탓을 요일 탓으로 돌리지 않음)", () => {
    const spend = (t, date) => ([0, 6].includes(dowOf(date)) ? 160000 : 80000) * (1 + 0.3 * Math.sin(t / 9));
    const node = nodeFrom(curveRows({ path: PATH, spend, a: 40, b: 0.3, jitter: 0.01 }));
    const raw = [...node.days].map(([date, day]) => ({ dow: dowOf(date), cpr: day.cost / day.result }));
    const weekendRaw = raw.filter((p) => [0, 6].includes(p.dow)).reduce((a, p) => a + p.cpr, 0) / raw.filter((p) => [0, 6].includes(p.dow)).length;
    const weekdayRaw = raw.filter((p) => ![0, 6].includes(p.dow)).reduce((a, p) => a + p.cpr, 0) / raw.filter((p) => ![0, 6].includes(p.dow)).length;
    expect(weekendRaw / weekdayRaw).toBeGreaterThan(1.15); // 원자료로만 보면 주말이 비싸 보인다
    const curve = fitNodeCurve(node.days, cfg, {});
    for (const factor of curve.cprDow) expect(Math.abs(factor - 1)).toBeLessThan(0.04);
    // 대조: 같은 지출 패턴에 진짜 주말 CPR 효과를 심으면 계수가 움직인다(추정이 꺼져 있으면 여기서 실패).
    const control = nodeFrom(curveRows({ path: PATH, spend, a: 40, b: 0.3, jitter: 0.01, dowCpr: [1.3, 1, 1, 1, 1, 1, 1.3] }));
    const controlCurve = fitNodeCurve(control.days, cfg, {});
    expect(controlCurve.cprDow[6] / controlCurve.cprDow[3]).toBeGreaterThan(1.15);
    // 요일 효과를 곡선이 흡수하지 않았는지: 지출 2배에서 CPR 비율이 정답 2^0.3에 가깝다.
    const elasticity = predictNodeCpr(controlCurve, 150000) / predictNodeCpr(controlCurve, 75000);
    expect(Math.abs(elasticity / Math.pow(2, 0.3) - 1)).toBeLessThan(0.03);
  });

  it("표본이 minPerDay보다 적은 요일은 부모 값, 계수 평균은 1", () => {
    const parent = [0.9, 1.1, 1, 1, 1, 1, 1];
    const samples = [{ dow: 1, logRatio: Math.log(1.5) }, ...Array.from({ length: 6 }, (_, i) => ({ dow: 3, logRatio: Math.log(i % 2 ? 1.2 : 1.2) }))];
    const { factors, counts } = dowFactorsFromSamples(samples, { minPerDay: 3, shrinkK: 4 }, parent);
    expect(counts[1]).toBe(1);
    expect(factors.reduce((a, b) => a + b, 0) / 7).toBeCloseTo(1, 12);
    // 수축: (6·1.2 + 4·1) / 10 = 1.12 (정규화 전)
    const mean = (0.9 + 1.1 + 1 + 1.12 + 1 + 1 + 1) / 7;
    expect(factors[3]).toBeCloseTo(1.12 / mean, 12);
    expect(factors[1]).toBeCloseTo(1.1 / mean, 12);
  });

  it("이동평균 비율은 앞뒤 3일이 다 있는 날만 쓴다", () => {
    const series = new Map(Array.from({ length: 14 }, (_, i) => [addDays("2026-07-01", i), 100]));
    series.delete("2026-07-06");
    const samples = ratioToMovingAverageSamples(series);
    // 앞뒤 3일이 있는 날은 7/4~7/11. 그중 7/6 결측이 창에 걸리지 않는 날은 7/10·7/11뿐이다.
    expect(samples).toHaveLength(2);
    expect(samples.map((sample) => sample.dow)).toEqual([dowOf("2026-07-10"), dowOf("2026-07-11")]);
  });
});

describe("부모 곡선 차용", () => {
  it("scaleModel은 네 계열 모두 g(x) = k·f(r·x)이고 계열을 유지한다", () => {
    const pts = [[100, 50], [200, 60], [300, 75], [400, 95], [500, 120]];
    for (const fit of [ALLOC_MATH.fitLinear, ALLOC_MATH.fitLog, ALLOC_MATH.fitPower, ALLOC_MATH.fitPoly2]) {
      const model = fit(pts);
      const scaled = scaleModel(model, 1.7, 4);
      expect(scaled.type).toBe(model.type);
      for (const x of [20, 60, 110]) expect(scaled.predict(x)).toBeCloseTo(1.7 * model.predict(4 * x), 9);
    }
    const bell = ALLOC_MATH.fitPoly2([[100, 50], [200, 30], [300, 25], [400, 30], [500, 50]].map(([x, y]) => [x, 100 - y]));
    const shape = ALLOC_MATH.detectPoly2Shape(bell);
    expect(ALLOC_MATH.detectPoly2Shape(scaleModel(bell, 2, 4)).vertex).toBeCloseTo(shape.vertex / 4, 9);
  });

  it("점이 적은 캠페인은 채널 곡선 모양을 상대 지출로 빌려 온다", () => {
    const parentNode = nodeFrom(curveRows({ path: { ...PATH, campaign_name: "" }, spend: wavy(400000), a: 40, b: 0.3, jitter: 0.01 }));
    const parent = fitNodeCurve(parentNode.days, cfg, {});
    // 같은 탄력성, 지출 규모 1/4, 같은 상대 지출에서 CPR 1.5배.
    const child = nodeFrom(curveRows({ path: PATH, days: 4, spend: wavy(100000), a: 40 * 1.5 * Math.pow(4, 0.3), b: 0.3, jitter: 0 }));
    const curve = fitNodeCurve(child.days, cfg, { parent });
    expect(curve.source).toBe("borrowed");
    expect(curve.wrapper.model.type).toBe(parent.wrapper.model.type);
    const x = 100000;
    expect(predictNodeCpr(curve, x) / (40 * 1.5 * Math.pow(4, 0.3) * Math.pow(x, 0.3))).toBeGreaterThan(0.95);
    expect(predictNodeCpr(curve, x) / (40 * 1.5 * Math.pow(4, 0.3) * Math.pow(x, 0.3))).toBeLessThan(1.05);
    expect(curve.observed.xMax).toBeLessThan(parent.observed.xMax / 2);
  });

  it("부모도 없고 점도 부족하면 null(판정 불가)", () => {
    const child = nodeFrom(curveRows({ path: PATH, days: 3, spend: wavy(100000), a: 40, b: 0.3 }));
    expect(fitNodeCurve(child.days, cfg, {})).toBeNull();
  });
});

describe("범위 적합성", () => {
  const asOf = addDays("2026-06-01", 83);
  const recentStart = addDays(asOf, -6);

  it("같은 곡선이면 IN_RANGE", () => {
    const node = nodeFrom(curveRows({ path: PATH, spend: wavy(100000), a: 40, b: 0.3 }));
    expect(assessConformity(node, cfg, { asOf }).state).toBe("IN_RANGE");
  });

  it("최근 7일 CPR이 같은 지출에서 1.4배면 DRIFT_WORSE, 0.7배면 DRIFT_BETTER", () => {
    const worse = nodeFrom(curveRows({ path: PATH, spend: wavy(100000), a: 40, b: 0.3, cprShift: (t, date) => (date >= recentStart ? 1.4 : 1) }));
    const better = nodeFrom(curveRows({ path: PATH, spend: wavy(100000), a: 40, b: 0.3, cprShift: (t, date) => (date >= recentStart ? 0.7 : 1) }));
    const w = assessConformity(worse, cfg, { asOf });
    expect(w.state).toBe("DRIFT_WORSE");
    expect(w.medianResidual).toBeGreaterThan(0.25);
    expect(assessConformity(better, cfg, { asOf }).state).toBe("DRIFT_BETTER");
  });

  it("최근 지출이 관측 최대의 2배면 EXTRAPOLATING(위)", () => {
    const node = nodeFrom(curveRows({ path: PATH, spend: (t, date) => (date >= recentStart ? 300000 : wavy(100000)(t)), a: 40, b: 0.3 }));
    expect(assessConformity(node, cfg, { asOf })).toMatchObject({ state: "EXTRAPOLATING", direction: "above" });
  });

  it("최근 창에 신규 소재 학습일이 있으면 곡선 이탈 대신 LEARNING_TRANSITION", () => {
    const node = nodeFrom(curveRows({ path: PATH, spend: wavy(100000), a: 40, b: 0.3, cprShift: (t, date) => (date >= recentStart ? 1.4 : 1) }));
    const out = assessConformity(node, cfg, { asOf, learningDates: new Set([asOf]) });
    expect(out.state).toBe("LEARNING_TRANSITION");
  });

  it("학습 이력이 부족하면 INSUFFICIENT", () => {
    const node = nodeFrom(curveRows({ path: PATH, days: 10, spend: wavy(100000), a: 40, b: 0.3 }));
    expect(assessConformity(node, cfg, { asOf: addDays("2026-06-01", 9) }).state).toBe("INSUFFICIENT");
  });
});
