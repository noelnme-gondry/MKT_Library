import { describe, expect, it } from "vitest";
import { ALLOC_MATH } from "@/utils/allocationMath";
import { selectAllocationRegime } from "@/utils/allocationRegime";
import { curveRows } from "./__fixtures__/plannerFixtures";
import { buildCreativeLifecycle } from "./creativeLifecycle";
import { configFor, resolvePlannerConfig } from "./plannerConfig";
import { dailyByNode, normalizePlannerRows } from "./plannerData";
import {
  creativeOffMultipliers, creativeOffOverrides, fatigueStartOf, learningBudgetWarnings, loserOffCandidates, newCreativeLaunches, scaledCurve,
} from "./plannerScenarios";
import { addDays } from "./plannerStats";
import { allocatePlanner, forecastAllocation, preparePlanner } from "./runBudgetPlanner";

const cfg = resolvePlannerConfig().config;
const levels = cfg.hierarchy.levels;
const START = "2026-06-01";

function lifecycleOf(rawRows, asOf) {
  const { rows } = normalizePlannerRows(rawRows, { metric: "installs" });
  const nodes = dailyByNode(rows, "campaign_name", levels);
  return buildCreativeLifecycle(rows, cfg, {
    levels, allocateLevel: "campaign_name", asOf, dataStart: START, nodes,
    configForPath: (path) => configFor(cfg, { country: path.country, channel: path.channel }),
  });
}

const row = (t, id, cost, cpr) => ({ date: addDays(START, t), country: "KR", platform: "iOS", channel: "Meta", campaign_name: "L", creative_id: id, cost, installs: cost / cpr });

describe("학습 종료 필요 예산 (spec §6.6.4 [F])", () => {
  // 기존 소재 하루 10,000·CPR 1,000. 신규 소재는 66일째부터 하루 2,000·CPR 1,500 — 69일째 기준 나이 3, 결과 5.33건.
  const AS_OF = addDays(START, 69);
  const rows = [];
  for (let t = 0; t <= 69; t += 1) rows.push(row(t, "inc", 10000, 1000));
  for (let t = 66; t <= 69; t += 1) rows.push(row(t, "fresh", 2000, 1500));
  const lifecycle = lifecycleOf(rows, AS_OF);
  const nodeKey = JSON.stringify(["KR", "iOS", "Meta", "L"]);

  it("필요 일 지출 = 남은 결과 × CPR_prior ÷ 남은 학습일, CPR_prior = 같은 날 기존 CPR × 기본 배율(과거 출시 없음)", () => {
    const need = lifecycle.entries.find((entry) => entry.creativeId === "fresh").learningNeed;
    const results = (4 * 2000) / 1500;
    const remaining = cfg.creative.launch.minResultsToJudge - results;
    const daysLeft = cfg.creative.learningDays - 3;
    const prior = 1000 * cfg.creative.launch.defaultLaunchPenalty;
    expect(need.priorAssumed).toBe(true);
    expect(need.cprPrior).toBeCloseTo(prior, 9);
    expect(need.remainingResults).toBeCloseTo(remaining, 9);
    expect(need.daysLeft).toBe(daysLeft);
    expect(need.neededDaily).toBeCloseTo((remaining * prior) / daysLeft, 9);
    // 최근 7일(63~69일) 노드 지출 중 신규 소재 몫.
    expect(need.recentShare).toBeCloseTo(8000 / (7 * 10000 + 8000), 12);
  });

  it("배정 일예산 × 최근 비중이 필요 일 지출보다 작을 때만 경고한다", () => {
    const need = lifecycle.entries.find((entry) => entry.creativeId === "fresh").learningNeed;
    const enough = need.neededDaily / need.recentShare;
    const ctx = { lifecycle };
    expect(learningBudgetWarnings(ctx, [{ key: nodeKey, proposed: enough * 1.01 }])).toEqual([]);
    const [warning] = learningBudgetWarnings(ctx, [{ key: nodeKey, proposed: enough * 0.5 }]);
    expect(warning).toMatchObject({ nodeKey, creativeId: "fresh", status: "short" });
    expect(warning.expectedDaily).toBeCloseTo(need.neededDaily * 0.5, 9);
  });

  it("비교할 기존 소재가 없으면 필요 예산을 지어내지 않고 '알 수 없음'으로 남긴다", () => {
    const alone = lifecycleOf([66, 67, 68, 69].map((t) => row(t, "solo", 2000, 1500)), AS_OF);
    expect(alone.entries[0].state).toBe("LEARNING");
    expect(alone.entries[0].learningNeed).toBeNull();
    expect(learningBudgetWarnings({ lifecycle: alone }, [{ key: nodeKey, proposed: 1 }])).toEqual([{ nodeKey, creativeId: "solo", status: "unknown", reason: "no_incumbent" }]);
  });
});

describe("피로 예상일 → 예측 (spec §8)", () => {
  it("이미 임계에 닿은 주력 소재는 예상 일수 0 → 예측 첫날부터", () => {
    const AS_OF = addDays(START, 69);
    const rows = [];
    for (let t = 0; t <= 69; t += 1) {
      const ctr = t < 52 ? 0.02 : 0.02 * Math.pow(0.9, t - 52);
      rows.push({ ...row(t, "tired", 50000, 1000), impressions: 50000, clicks: 50000 * ctr });
    }
    const lifecycle = lifecycleOf(rows, AS_OF);
    const tired = lifecycle.entries[0];
    expect(tired.fatigue).toMatchObject({ fatigued: true, etaDays: 0 });
    const start = fatigueStartOf({ lifecycle, asOf: AS_OF }, tired.nodeKey);
    expect(start).toEqual({ date: addDays(AS_OF, 1), creativeId: "tired", etaDays: 0 });
  });

  it("주력 소재(지출 비중 최대)의 예상일만 쓰고, 추세가 없으면 null", () => {
    const entry = (creativeId, share, etaDays) => ({ creativeId, share, ended: false, fatigue: etaDays === undefined ? null : { etaDays } });
    const ctx = (entries) => ({ asOf: "2026-08-01", lifecycle: { byNode: new Map([["n", { entries }]]) } });
    expect(fatigueStartOf(ctx([entry("small", 0.2, 1), entry("main", 0.8, 4.2)]), "n")).toEqual({ date: "2026-08-06", creativeId: "main", etaDays: 4.2 });
    expect(fatigueStartOf(ctx([entry("small", 0.2, 1), entry("main", 0.8, null)]), "n")).toBeNull();
  });
});

describe("소재 OFF 구성 효과 (spec §8.1)", () => {
  const days = (cost, result) => new Map([["2026-08-01", { cost, result }]]);
  const ctx = {
    windows: { R: { from: "2026-08-01", to: "2026-08-07" } },
    lifecycle: { byNode: new Map([["n", { entries: [
      { creativeId: "good", days: days(1000, 10) },
      { creativeId: "bad", days: days(1000, 5) },
      { creativeId: "idle", days: days(0, 0) },
    ] }]]) },
  };

  it("남은 소재의 결과 가중 CPR ÷ 지금 CPR — (1000/10)/(2000/15) = 0.75", () => {
    const [effect] = creativeOffMultipliers(ctx, [{ nodeKey: "n", creativeIds: ["bad"] }]);
    expect(effect.multiplier).toBeCloseTo(0.75, 12);
    expect(effect.offShare).toBeCloseTo(0.5, 12);
  });

  it("최근 지출이 없던 소재를 끄면 변화 없음, 전부 끄면 계산하지 않는다", () => {
    const [idle, all] = creativeOffMultipliers(ctx, [
      { nodeKey: "n", creativeIds: ["idle"] },
      { nodeKey: "n", creativeIds: ["good", "bad"] },
    ]);
    expect(idle).toMatchObject({ multiplier: 1, reason: "no_recent_spend" });
    expect(all).toMatchObject({ multiplier: null, reason: "nothing_left" });
  });

  it("곡선 배율은 같은 계열을 유지하며 모든 지출에서 CPR을 k배 한다", () => {
    const model = ALLOC_MATH.fitPower([[1000, 100], [2000, 123], [4000, 151], [8000, 185]]);
    const wrapper = { model, kept: [], xMin: 1000, xMax: 8000, poly2Shape: null };
    const scaled = scaledCurve({ wrapper }, 0.75);
    expect(scaled.wrapper.model.type).toBe(model.type);
    for (const x of [1500, 3000, 6000]) {
      expect(ALLOC_MATH.predictSafeCpr(scaled.wrapper, x)).toBeCloseTo(0.75 * ALLOC_MATH.predictSafeCpr(wrapper, x), 9);
    }
  });
});

describe("시나리오 전체 경로 (preparePlanner → 배분·예측)", () => {
  const AS_OF = addDays(START, 83);
  const path = { country: "KR", platform: "iOS", channel: "Meta", campaign_name: "Meta-1" };
  // 기존 소재는 곡선대로, 50일째부터 들어온 신규 소재는 같은 날 기존보다 CPR이 약 1.6배(고정 지출).
  const rows = [
    ...curveRows({ path, spend: (t) => 70000 * (1 + 0.45 * Math.sin(t / 4.3)), a: 40, b: 0.3, seed: 1, extra: () => ({ creative_id: "old" }) }),
    ...curveRows({ path, spend: (t) => (t >= 50 ? 30000 : 0), a: 80, b: 0.3, seed: 2, extra: () => ({ creative_id: "bad" }) }),
    ...curveRows({ path: { ...path, channel: "Google", campaign_name: "G-1" }, spend: (t) => 50000 * (1 + 0.4 * Math.sin(t / 3.1)), a: 30, b: 0.3, seed: 3 }),
  ];
  const ctx = preparePlanner(rows);
  const meta = ctx.nodes.find((node) => node.path.channel === "Meta");

  it("기존보다 나쁜 소재가 노드 지출의 기준 이상이면 OFF 후보가 된다", () => {
    expect(ctx.creatives.find((creative) => creative.creativeId === "bad").state).toBe("LOSER");
    expect(meta.creative.loserAlert).toBe(true);
    expect(loserOffCandidates(ctx)).toEqual([{ nodeKey: meta.key, creativeIds: ["bad"] }]);
  });

  it("OFF 배율은 최근 창 원자료에서 따로 센 값과 같고, 배분·예측이 같은 덮어쓴 곡선을 쓴다", () => {
    const R = ctx.windows.R;
    const sum = (filter) => rows.filter((r) => r.channel === "Meta" && r.date >= R.from && r.date <= R.to && filter(r))
      .reduce((acc, r) => ({ cost: acc.cost + Number(r.cost), result: acc.result + Number(r.installs) }), { cost: 0, result: 0 });
    const all = sum(() => true);
    const kept = sum((r) => r.creative_id !== "bad");
    const { curveOverrides, effects } = creativeOffOverrides(ctx, loserOffCandidates(ctx));
    expect(effects[0].multiplier).toBeCloseTo((kept.cost / kept.result) / (all.cost / all.result), 9);
    expect(effects[0].multiplier).toBeLessThan(1);
    const budget = ctx.allocationNodes.reduce((acc, node) => acc + node.current, 0);
    const base = allocatePlanner(ctx, budget);
    const off = allocatePlanner(ctx, budget, { curveOverrides });
    expect(off.forecast.total.results).toBeGreaterThan(base.forecast.total.results);
    const metaItem = off.allocation.items.find((item) => item.key === meta.key);
    expect(metaItem.predictedCpr).toBeCloseTo(ALLOC_MATH.predictSafeCpr(curveOverrides.get(meta.key).wrapper, metaItem.proposed), 9);
  });

  it("새 소재 투입은 과거 출시가 모자라면 기본 프로파일(가정값)로 첫 2주 결과를 줄인다", () => {
    const budget = ctx.allocationNodes.reduce((acc, node) => acc + node.current, 0);
    const { allocation } = allocatePlanner(ctx, budget, { withForecast: false });
    const extraLaunches = newCreativeLaunches(ctx, meta.key);
    const launch = extraLaunches.get(meta.key)[0];
    expect(launch.age).toBe(-1);
    expect(launch.profile.assumed).toBe(true);
    const base = forecastAllocation(ctx, allocation);
    const withLaunch = forecastAllocation(ctx, allocation, { extraLaunches });
    expect(withLaunch.total.results).toBeLessThan(base.total.results);
    // 다른 노드는 그대로다.
    const google = (forecast) => forecast.nodes.find((node) => node.key !== meta.key).results;
    expect(google(withLaunch)).toBe(google(base));
  });

  it("피로 반영을 끄면(기본) 예측이 바뀌지 않는다 — 시나리오에서만 켠다", () => {
    const budget = ctx.allocationNodes.reduce((acc, node) => acc + node.current, 0);
    const { allocation } = allocatePlanner(ctx, budget, { withForecast: false });
    expect(forecastAllocation(ctx, allocation).total.results).toBe(forecastAllocation(ctx, allocation, { applyFatigue: false }).total.results);
  });
});

describe("출시일을 구간 경계 후보로 (spec §6.6.4 [C])", () => {
  const points = Array.from({ length: 100 }, (_, i) => {
    const x = 1000 + (i % 10) * 100;
    return { x, y: x * 0.1 * (i >= 50 ? 1.5 : 1), date: addDays(START, i) };
  });

  it("후보가 없으면 이전과 같은 결과다", () => {
    expect(selectAllocationRegime(points, { regimeMode: "auto", regimeCandidateDates: [] })).toEqual(selectAllocationRegime(points, { regimeMode: "auto" }));
  });

  it("탐색 간격에 걸려 빠지던 출시일 경계를 평가해 정확한 시작일을 고른다", () => {
    const plain = selectAllocationRegime(points, { regimeMode: "auto" });
    expect(plain.start).not.toBe(addDays(START, 50));
    const withLaunch = selectAllocationRegime(points, { regimeMode: "auto", regimeCandidateDates: [addDays(START, 50)] });
    expect(withLaunch.start).toBe(addDays(START, 50));
    expect(withLaunch.candidate.event).toBe(true);
  });
});
