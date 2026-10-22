import { describe, expect, it } from "vitest";
import { ALLOC_MATH } from "@/utils/allocationMath";
import { calculateAllocationModeB } from "@/utils/budgetAllocTool";
import { curveRows } from "./__fixtures__/plannerFixtures";
import { nodeBounds, planAllocation } from "./plannerAllocate";
import { resolvePlannerConfig } from "./plannerConfig";
import { forecastPlan, launchMultiplier } from "./plannerForecast";
import { addDays } from "./plannerStats";
import { runBudgetPlanner } from "./runBudgetPlanner";

const START = "2026-06-01";
const AS_OF = addDays(START, 83);
const R_FROM = addDays(AS_OF, -6);
const B_FROM = addDays(AS_OF, -13);
const inR = (date) => date >= R_FROM;
const inB = (date) => date >= B_FROM && date < R_FROM;
const wavy = (base) => (t) => base * (1 + 0.45 * Math.sin(t / 4.3));
const path = (channel, campaign = `${channel}-1`) => ({ country: "KR", platform: "iOS", channel, campaign_name: campaign });
const funnel = (ctr) => (t, date, cost, results) => {
  const impressions = cost / 5;
  return { impressions: String(impressions), clicks: String(impressions * ctr(date)) };
};
const nodeOf = (out, channel) => out.nodes.find((node) => node.path.channel === channel);

describe("원인 진단 — 예산인가 소재인가", () => {
  it("① 지출만 바뀌고 곡선은 그대로면 BUDGET_CURVE, 예산 항이 변화의 대부분이다", () => {
    const spend = (t, date) => (inR(date) ? 130000 : inB(date) ? 80000 : wavy(100000)(t));
    const out = runBudgetPlanner(curveRows({ path: path("Meta"), spend, a: 40, b: 0.3, jitter: 0.02 }));
    const { diagnosis } = nodeOf(out, "Meta");
    expect(diagnosis.verdict).toBe("BUDGET_CURVE");
    expect(diagnosis.direction).toBe("worse");
    expect(diagnosis.components.budget / diagnosis.components.total).toBeGreaterThan(0.7);
    expect(diagnosis.components.budget / diagnosis.components.total).toBeLessThan(1.3);
  });

  it("② 지출은 같은데 CTR이 30% 떨어지면 CREATIVE(소재 열이 없으면 퍼널 CTR 몫으로)", () => {
    const spend = (t, date) => (inR(date) || inB(date) ? 100000 : wavy(100000)(t));
    const out = runBudgetPlanner(curveRows({
      path: path("Meta"), spend, a: 40, b: 0.3, jitter: 0.02,
      cprShift: (t, date) => (inR(date) ? 1 / 0.7 : 1),
      extra: funnel((date) => (inR(date) ? 0.007 : 0.01)),
    }));
    const { diagnosis } = nodeOf(out, "Meta");
    expect(diagnosis.verdict).toBe("CREATIVE");
    expect(Math.abs(diagnosis.components.budget)).toBeLessThan(0.02);
    expect(diagnosis.evidence.creative).toBeGreaterThan(0.9);
  });

  it("② 소재 열이 있으면 PVM이 그 소재의 효율 변화를 짚고, CTR 하락분만큼 소재 원인으로 센다", () => {
    const spend = (t, date) => (inR(date) || inB(date) ? 50000 : wavy(50000)(t));
    const rows = [
      ...curveRows({ path: path("Meta"), spend, a: 40, b: 0.3, jitter: 0.02, seed: 1, extra: (...args) => ({ creative_id: "steady", ...funnel(() => 0.01)(...args) }) }),
      ...curveRows({ path: path("Meta"), spend, a: 40, b: 0.3, jitter: 0.02, seed: 2,
        cprShift: (t, date) => (inR(date) ? 1 / 0.6 : 1),
        extra: (...args) => ({ creative_id: "dropping", ...funnel((date) => (inR(date) ? 0.006 : 0.01))(...args) }) }),
    ];
    const out = runBudgetPlanner(rows);
    const { diagnosis } = nodeOf(out, "Meta");
    expect(out.pvm.ok).toBe(true);
    expect(out.levels.finest).toBe("creative_id");
    const dropping = out.pvm.rows.find((row) => row.creativeId === "dropping");
    const steady = out.pvm.rows.find((row) => row.creativeId === "steady");
    expect(dropping.creative).toBeGreaterThan(Math.abs(steady.creative) * 5);
    expect(diagnosis.verdict).toBe("CREATIVE");
  });

  it("② 지출·클릭률·전환율은 같은데 노출 단가만 30% 오르면 AUCTION_COST(소재 탓이 아님)", () => {
    const spend = (t, date) => (inR(date) || inB(date) ? 100000 : wavy(100000)(t));
    // 노출 = 비용 ÷ CPM. R 주에 CPM이 1.3배 → 같은 비용으로 노출·클릭·설치가 1/1.3.
    const auction = (t, date, cost) => {
      const impressions = cost / (inR(date) ? 6.5 : 5);
      return { impressions: String(impressions), clicks: String(impressions * 0.01) };
    };
    const out = runBudgetPlanner(curveRows({ path: path("Meta"), spend, a: 40, b: 0.3, jitter: 0.02, cprShift: (t, date) => (inR(date) ? 1.3 : 1), extra: auction }));
    const { diagnosis } = nodeOf(out, "Meta");
    expect(diagnosis).toMatchObject({ verdict: "AUCTION_COST", reason: "impression_cost_up" });
    expect(diagnosis.evidence.auction).toBeGreaterThan(0.9);
    expect(diagnosis.evidence.creative).toBeLessThan(0.1);
  });

  it("③ 같은 국가 세 채널이 같은 주에 함께 나빠지면 MARKET", () => {
    const spend = (base) => (t, date) => (inR(date) || inB(date) ? base : wavy(base)(t));
    const rows = ["Meta", "Google", "TikTok"].flatMap((channel, i) => curveRows({
      path: path(channel), spend: spend(60000 + i * 20000), a: 30 + i * 8, b: 0.3, jitter: 0.02, seed: i + 1,
      cprShift: (t, date) => (inR(date) ? 1.3 : 1),
    }));
    const out = runBudgetPlanner(rows);
    for (const channel of ["Meta", "Google", "TikTok"]) {
      const { diagnosis } = nodeOf(out, channel);
      expect(diagnosis.verdict).toBe("MARKET");
      expect(diagnosis.components.market).toBeGreaterThan(0.2);
    }
  });

  it("④ 같은 창에서 예산과 소재가 함께 바뀌면 나누지 않고 INCONCLUSIVE(혼재)", () => {
    const spend = (t, date) => (inR(date) ? 140000 : inB(date) ? 100000 : wavy(100000)(t));
    const rows = [
      ...curveRows({ path: path("Meta"), spend, a: 40, b: 0.3, seed: 1, extra: () => ({ creative_id: "old" }) }),
      ...curveRows({ path: path("Meta"), spend: (t, date) => (inR(date) ? 40000 : 0), a: 60, b: 0.3, seed: 2, extra: () => ({ creative_id: "new" }) }),
    ];
    const { diagnosis } = nodeOf(runBudgetPlanner(rows), "Meta");
    expect(diagnosis).toMatchObject({ verdict: "INCONCLUSIVE", reason: "budget_and_creative_changed_together" });
  });

  it("⑤ 아무것도 안 바뀌면 노이즈 범위 INCONCLUSIVE", () => {
    const spend = (t, date) => (inR(date) || inB(date) ? 100000 : wavy(100000)(t));
    const { diagnosis } = nodeOf(runBudgetPlanner(curveRows({ path: path("Meta"), spend, a: 40, b: 0.3, jitter: 0.02 })), "Meta");
    expect(diagnosis).toMatchObject({ verdict: "INCONCLUSIVE", reason: "within_noise" });
  });

  it("⑥ 지출은 같은데 학습 중 신규 소재가 비싸게 들어오면 NEW_CREATIVE_LEARNING, 배분은 변경폭을 묶는다", () => {
    const launchDay = addDays(AS_OF, -4);
    const rows = [
      ...curveRows({ path: path("Meta"), spend: (t, date) => (date >= launchDay ? 60000 : inB(date) || inR(date) ? 100000 : wavy(100000)(t)), a: 40, b: 0.3, seed: 1, extra: () => ({ creative_id: "old" }) }),
      ...curveRows({ path: path("Meta"), spend: (t, date) => (date >= launchDay ? 40000 : 0), a: 90, b: 0.3, seed: 2, extra: () => ({ creative_id: "fresh" }) }),
    ];
    const out = runBudgetPlanner(rows);
    const node = nodeOf(out, "Meta");
    expect(out.creatives.find((creative) => creative.creativeId === "fresh").state).toBe("LEARNING");
    expect(node.state).toBe("LEARNING_TRANSITION");
    expect(node.diagnosis.verdict).toBe("NEW_CREATIVE_LEARNING");
    const item = out.allocation.items[0];
    expect(item.upper / item.current).toBeCloseTo(1.1, 9);
    expect(item.lower / item.current).toBeCloseTo(0.9, 9);
  });
});

describe("배분 제약", () => {
  const cfg = resolvePlannerConfig().config;
  const curve = (a, b, xMin, xMax) => {
    const pts = Array.from({ length: 12 }, (_, i) => {
      const x = xMin + ((xMax - xMin) * i) / 11;
      return [x, a * Math.pow(x, b)];
    });
    const model = ALLOC_MATH.fitPower(pts);
    return { wrapper: { model, xMin, xMax, poly2Shape: null, kept: pts.map(([x, y]) => ({ x, y })) }, observed: { xMin, xMax }, cprDow: [1, 1, 1, 1, 1, 1, 1], sigma: 0.05, residuals: [] };
  };
  const node = (key, current, c, extra = {}) => ({ key, label: key, path: { country: "KR", channel: key }, current, curve: c, state: "IN_RANGE", verdict: null, cfg, creative: {}, ...extra });

  it("일 변경폭·외삽 상한·관측 밖 지출 금지·잠금이 경계 사유와 함께 지켜진다", () => {
    expect(nodeBounds(node("a", 100, curve(10, 0.3, 50, 200)))).toMatchObject({ lower: { value: 70, source: "max_daily_decrease" }, upper: { value: 120, source: "max_daily_increase" } });
    expect(nodeBounds(node("a", 100, curve(10, 0.3, 50, 105))).upper).toEqual({ value: 105 * 1.1, source: "extrapolation" });
    expect(nodeBounds(node("a", 100, curve(10, 0.3, 50, 200), { state: "EXTRAPOLATING" })).upper).toEqual({ value: 100, source: "state:EXTRAPOLATING" });
    expect(nodeBounds(node("a", 100, curve(10, 0.3, 50, 200), { state: "INSUFFICIENT" }))).toEqual({ fixed: 100, source: "state:INSUFFICIENT" });
    const locked = resolvePlannerConfig({ optimizer: { locked: ["a"] } }).config;
    expect(nodeBounds(node("a", 100, curve(10, 0.3, 50, 200), { cfg: locked }))).toEqual({ fixed: 100, source: "locked" });
  });

  it("학습 하한: 주간 결과가 하한에 못 미치는 중간값을 만들지 않는다", () => {
    const withMin = (n) => resolvePlannerConfig({ optimizer: { learningMinWeeklyResults: n } }).config;
    const c = curve(1, 0.3, 50, 200); // 지출 100 → CPR 3.98 → 주 176건
    const raised = nodeBounds(node("a", 100, c, { cfg: withMin(190) }));
    expect(raised.lower.source).toBe("learning_minimum");
    expect((7 * raised.lower.value) / ALLOC_MATH.predictSafeCpr(c.wrapper, raised.lower.value)).toBeCloseTo(190, 3);
    expect(nodeBounds(node("a", 100, c, { cfg: withMin(10000) })).offCandidate).toBe(true);
  });

  it("제약이 사실상 없으면 기존 5-3 엔진(calculateAllocationModeB)과 같은 배분이다", () => {
    const loose = resolvePlannerConfig({ optimizer: { maxDailyIncrease: 1000, maxDailyDecrease: 1, extrapolationHeadroom: 0 } }).config;
    const nodes = [node("a", 100, curve(10, 0.3, 50, 400), { cfg: loose }), node("b", 100, curve(14, 0.2, 50, 400), { cfg: loose })];
    const ours = planAllocation(nodes, 300, loose);
    const base = calculateAllocationModeB({
      modelsMap: new Map(nodes.map((n) => [n.key, n.curve.wrapper])), totalBudget: 300,
      minSpends: { a: 0, b: 0 }, maxSpends: { a: 400, b: 400 }, currentSpends: { a: 100, b: 100 }, stepRatio: loose.optimizer.stepPct,
    });
    for (const item of base.items) expect(ours.items.find((it) => it.key === item.channel).proposed).toBeCloseTo(item.cost, 6);
  });

  it("그룹 비중 상한을 넘으면 그 그룹을 상한 예산으로 다시 나눈다", () => {
    const capped = resolvePlannerConfig({ optimizer: { groupShares: { "channel:a": [0, 0.4] }, maxDailyIncrease: 1000, maxDailyDecrease: 1 } }).config;
    const nodes = [node("a", 100, curve(5, 0.3, 50, 400), { cfg: capped }), node("b", 100, curve(20, 0.3, 50, 400), { cfg: capped })];
    const out = planAllocation(nodes, 300, capped);
    const a = out.items.find((item) => item.key === "a").proposed;
    expect(a / out.totalAllocated).toBeLessThanOrEqual(0.4 + 1e-6);
    expect(out.totalAllocated).toBeCloseTo(300, 6);
  });
});

describe("예측", () => {
  const cfg = resolvePlannerConfig({ forecast: { spendPacing: "flat" } }).config;

  it("곡선대로 일 결과를 쌓고, 합산 구간은 보수적(comonotonic)이 독립 가정보다 넓다", () => {
    const pts = Array.from({ length: 12 }, (_, i) => [50 + i * 20, 10 * Math.pow(50 + i * 20, 0.3)]);
    const residuals = Array.from({ length: 20 }, (_, i) => ({ r: ((i % 5) - 2) * 0.05 }));
    const c = { wrapper: { model: ALLOC_MATH.fitPower(pts), xMin: 50, xMax: 270, poly2Shape: null, kept: [] }, observed: { xMin: 50, xMax: 270 }, cprDow: [1, 1, 1, 1, 1, 1, 1], sigma: 0.07, residuals };
    const plans = [{ key: "a", label: "a", cost: 100, curve: c, costDow: [1, 1, 1, 1, 1, 1, 1] }, { key: "b", label: "b", cost: 200, curve: c, costDow: [1, 1, 1, 1, 1, 1, 1] }];
    const como = forecastPlan(plans, { startDate: "2026-09-01", cfg });
    const cprAt = (x) => ALLOC_MATH.predictSafeCpr(c.wrapper, x);
    expect(como.total.results).toBeCloseTo(14 * (100 / cprAt(100) + 200 / cprAt(200)), 9);
    const indep = forecastPlan(plans, { startDate: "2026-09-01", cfg: resolvePlannerConfig({ forecast: { spendPacing: "flat", intervalAggregation: "independent" } }).config });
    expect(como.total.hi - como.total.lo).toBeGreaterThan(indep.total.hi - indep.total.lo);
    expect(como.total.lo).toBeLessThan(como.total.results);
    expect(como.total.hi).toBeGreaterThan(como.total.results);
  });

  it("신규 소재 학습 구간 배율은 결과 가중 혼합이다", () => {
    const profile = { buckets: [{ ages: [0, 2], cprRatio: 1.6, spendShare: 0.2 }, { ages: [3, 6], cprRatio: 1.2, spendShare: 0.25 }] };
    expect(launchMultiplier([{ age: 0, profile }], 1)).toBeCloseTo(1 / (0.8 + 0.2 / 1.6), 12);
    expect(launchMultiplier([{ age: 0, profile }], 4)).toBeCloseTo(1 / (0.75 + 0.25 / 1.2), 12);
    expect(launchMultiplier([{ age: 0, profile }], 9)).toBe(1);
  });
});

describe("전체 실행", () => {
  const rows = ["Meta", "Google", "TikTok"].flatMap((channel, i) => curveRows({ path: path(channel), spend: wavy(60000 + i * 20000), a: 30 + i * 8, b: 0.3, jitter: 0.03, seed: i + 1 }));

  it("백테스트는 정답을 아는 데이터에서 합계 오차가 작다", () => {
    const out = runBudgetPlanner(rows);
    expect(out.backtest.evaluated).toBe(true);
    expect(Math.abs(out.backtest.totalError)).toBeLessThan(0.03);
    expect(out.backtest.dailyCoverage).toBeGreaterThan(0.5);
  });

  it("같은 입력·같은 config → 같은 결과(결정론)", () => {
    expect(JSON.stringify(runBudgetPlanner(rows))).toBe(JSON.stringify(runBudgetPlanner(rows)));
  });

  it("총예산을 주면 그 금액 안에서 나누고, 효율 좋은 채널이 증액 상한까지 간다", () => {
    const out = runBudgetPlanner(rows, { totalBudget: 200000 });
    expect(out.allocation.totalAllocated).toBeLessThanOrEqual(200000 + 1e-6);
    const meta = out.allocation.items.find((item) => item.path.channel === "Meta");
    expect(meta.proposed).toBeGreaterThan(meta.current);
  });

  it("잘못된 config는 실행하지 않고 경로를 돌려준다", () => {
    const out = runBudgetPlanner(rows, { configPatch: { forecast: { horizonDays: 0 } } });
    expect(out).toMatchObject({ ok: false, code: "INVALID_CONFIG" });
    expect(out.errors[0].path).toBe("forecast.horizonDays");
  });

  it("못 읽는 행은 0으로 채우지 않고 사유별로 센다", () => {
    const out = runBudgetPlanner([...rows, { date: "2026/08/01", cost: "1" }, { date: "2026-08-01", cost: "x", installs: "1" }, { date: "2026-08-01", cost: "1", installs: "" }]);
    expect(out.dropped).toEqual({ invalid_date: 1, invalid_cost: 1, invalid_result: 1 });
  });
});
