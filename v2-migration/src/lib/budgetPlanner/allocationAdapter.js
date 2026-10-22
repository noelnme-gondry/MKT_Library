// 5-3 예산 배분 ↔ 계층형 플래너 연결층.
// 5-3 화면은 단위 키("KR · Meta · iOS")와 기존 모양(modelsMap·allocation.items)을 읽는다.
// 여기서 플래너 결과를 그 모양으로 옮겨, 화면의 곡선·배분·요약·목표 역산이 모두 같은 계산을 쓰게 한다.
import { getRowGroupKey, computeAllocSummary } from "@/utils/budgetAllocTool";
import { deltaOnlyPlan, nodeBounds, planAllocation } from "./plannerAllocate";
import { nodeKey, normalizePlannerRows } from "./plannerData";
import { forecastAllocation, plannerNodesFor, preparePlanner } from "./runBudgetPlanner";
import { creativeOffOverrides, fatigueStarts, learningBudgetWarnings, loserOffCandidates, newCreativeLaunches } from "./plannerScenarios";

/** 실행 방식. 이번 실행안 = config의 일 변경폭 제한, 목표 배분 = 변경폭 제한 없음(곡선·상태 규칙은 같다). */
export const ALLOCATION_PACES = Object.freeze({
  paced: null,
  full: Object.freeze({ maxDailyIncrease: 1000, maxDailyDecrease: 1 }),
});

const LEVELS = ["platform", "country", "channel", "campaign_name", "adgroup_name", "creative_id"];

/** 5-3 단위 → 플래너 배분 레벨. OS를 맨 앞에 두어 5-3처럼 OS별 단위가 갈라지게 한다. */
export function plannerHierarchyFor(unitField) {
  const allocate = unitField === "country" ? "country" : unitField === "campaign_name" ? "campaign_name" : "channel";
  return { levels: LEVELS, allocate };
}

function configPatchFor({ unitField, metric, adv = {}, cadence }) {
  const { levels, allocate } = plannerHierarchyFor(unitField);
  const regimeMode = adv.regimeMode === "manual" && !adv.regimeStart ? "all" : adv.regimeMode || "all";
  return {
    hierarchy: { levels, roles: { allocate, constraint: ["country", "channel"], diagnose: ["adgroup_name", "creative_id"] } },
    metric: { result: metric },
    curve: {
      trendType: adv.trendType || "auto",
      outlier: { method: adv.outlierMethod || "iqr", strength: adv.outlierStrength || "standard" },
      weightMode: adv.weightMode || "none",
      halfLifeDays: adv.halfLifeDays || 30,
      regimeMode,
      regimeStart: regimeMode === "manual" ? adv.regimeStart : "",
    },
    // 5-3은 관측 최대 지출 밖을 추천하지 않는다(기존 계약). 외삽 여유를 0으로 둔다.
    optimizer: { extrapolationHeadroom: 0 },
    // 주간 관측은 하루 단위가 아니라 요일 효과를 잴 수 없다.
    ...(cadence === "weekly" ? { dow: { enabled: false }, forecast: { spendPacing: "flat" } } : {}),
  };
}

/**
 * 5-3 행으로 플래너를 준비한다. 곡선·진단·백테스트는 여기서 한 번만 계산한다.
 * @param {object[]} rows 5-3 observations.rows(필터·성숙도·주간 환산이 끝난 행)
 * @param {{unitField, metric, adv, groupModels, cadence, currentSpends}} settings
 */
export function prepareAllocationPlanner(rows, { unitField, metric, adv = {}, groupModels = {}, cadence = "daily", currentSpends = {} }) {
  const { levels, allocate } = plannerHierarchyFor(unitField);
  // 같은 행에서 두 키를 함께 만들어 짝을 짓는다. 한 대상이 두 이름으로 갈리면 조용히 섞지 않고 거절한다.
  const { rows: normalized } = normalizePlannerRows(rows, { metric });
  const toUnit = new Map();
  const toPlanner = new Map();
  const conflicts = new Set();
  const spendByUnit = new Map();
  for (const row of normalized) {
    const planner = nodeKey(row, allocate, levels);
    const unit = getRowGroupKey(row, unitField);
    if (!unit) continue;
    if (toUnit.has(planner) && toUnit.get(planner) !== unit) conflicts.add(unit).add(toUnit.get(planner));
    if (toPlanner.has(unit) && toPlanner.get(unit) !== planner) conflicts.add(unit);
    toUnit.set(planner, unit);
    toPlanner.set(unit, planner);
    spendByUnit.set(unit, (spendByUnit.get(unit) || 0) + row.cost);
  }
  if (conflicts.size) return { ok: false, code: "UNIT_KEY_CONFLICT", units: [...conflicts].sort() };
  // 지출이 한 번도 없던 대상(오가닉 등)은 배분할 수 없다 — 5-3 목록에도 없던 행이다.
  const unpaid = new Set([...spendByUnit].filter(([, spend]) => !(spend > 0)).map(([unit]) => unit));
  rows = rows.filter((row) => !unpaid.has(getRowGroupKey(row, unitField)));
  const unitOfPath = (path) => toUnit.get(nodeKey(path, allocate, levels));
  const ctx = preparePlanner(rows, {
    configPatch: configPatchFor({ unitField, metric, adv, cadence }),
    trendOverrideOf: (path) => groupModels[unitOfPath(path)],
    currentSpendOf: (path) => currentSpends[unitOfPath(path)],
  });
  if (!ctx.ok) return ctx;
  const modelsMap = new Map();
  for (const node of ctx.allocationNodes) modelsMap.set(toUnit.get(node.key), node.curve ? node.curve.wrapper : null);
  const units = ctx.nodes.map((node) => ({ ...node, unit: toUnit.get(node.key) }));
  return { ...ctx, ok: true, toUnit, toPlanner, modelsMap, units, unitField };
}

function recentCprOf(planner, plannerKey) {
  const days = planner.perNode.get(plannerKey)?.node.days;
  if (!days) return null;
  const dates = [...days.keys()].slice(-7);
  const cost = dates.reduce((acc, date) => acc + days.get(date).cost, 0);
  const result = dates.reduce((acc, date) => acc + days.get(date).result, 0);
  return result > 0 && cost > 0 ? cost / result : null;
}

function patchedNodes(planner, { pace = "paced", holds = {}, curveOverrides = null }) {
  const fixed = {};
  for (const [unit, cost] of Object.entries(holds)) {
    const key = planner.toPlanner.get(unit);
    if (key) fixed[key] = cost;
  }
  return plannerNodesFor(planner, { fixed, optimizerPatch: ALLOCATION_PACES[pace] ?? null, fixedSource: "low_confidence", curveOverrides });
}

/** 노드별 상·하한(5-3의 관측 상한 자리). 곡선이 없는 대상도 현재 지출에 고정되므로 계획을 막지 않는다. */
export function plannerEvidence(planner, { pace = "paced", holds = {} } = {}) {
  const maxSpends = {};
  const minSpends = {};
  const heldWithoutCurve = [];
  let maxBudget = 0;
  let minBudget = 0;
  for (const node of patchedNodes(planner, { pace, holds })) {
    const unit = planner.toUnit.get(node.key);
    const bounds = nodeBounds(node);
    const lower = bounds.fixed ?? bounds.lower.value;
    const upper = bounds.fixed ?? bounds.upper.value;
    if (!node.curve) heldWithoutCurve.push(unit);
    minSpends[unit] = lower;
    maxSpends[unit] = upper;
    minBudget += lower;
    maxBudget += Number.isFinite(upper) ? upper : 0;
  }
  return { maxSpends, minSpends, maxBudget, minBudget, unavailableChannels: [], heldWithoutCurve: heldWithoutCurve.sort() };
}

/**
 * 예산 하나의 배분을 5-3 모양으로. items[].channel은 5-3 단위 키.
 * 곡선이 없어 현재 지출로 고정한 대상의 결과는 최근 7일 평균 CPR로 세고 그 사실을 표시한다.
 */
export function allocationAt(planner, budget, { pace = "paced", holds = {}, withForecast = false, curveOverrides = null, forecastOptions = {} } = {}) {
  const nodes = patchedNodes(planner, { pace, holds, curveOverrides });
  const globalCfg = ALLOCATION_PACES[pace] ? { ...planner.cfg, optimizer: { ...planner.cfg.optimizer, ...ALLOCATION_PACES[pace] } } : planner.cfg;
  const plan = planAllocation(nodes, budget, globalCfg);
  const items = plan.items.map((item) => {
    let results = item.predictedResults;
    let cpr = item.predictedCpr;
    let resultsBasis = "curve";
    if (results == null) {
      cpr = recentCprOf(planner, item.key);
      results = cpr ? item.proposed / cpr : 0;
      resultsBasis = cpr ? "recent_average" : "unknown";
    }
    return {
      channel: planner.toUnit.get(item.key),
      plannerKey: item.key,
      cost: item.proposed,
      results,
      cpr: cpr ?? null,
      resultsBasis,
      current: item.current,
      lower: item.lower,
      upper: item.upper,
      binding: item.binding,
      locked: item.fixed,
      offCandidate: item.offCandidate,
      conflict: item.conflict,
      outsideObserved: item.outsideObserved,
      state: item.state,
      verdict: item.verdict,
    };
  });
  const totalAllocated = items.reduce((acc, item) => acc + item.cost, 0);
  const allocation = {
    items: items.map((item) => ({ ...item, weight: totalAllocated > 0 ? item.cost / totalAllocated : 0 })).sort((a, b) => b.cost - a.cost || a.channel.localeCompare(b.channel)),
    totalAllocated,
    unallocated: Math.max(0, budget - totalAllocated),
    overspent: totalAllocated > budget * (1 + 1e-9) + 1e-6,
    lockedTotal: items.filter((item) => item.locked).reduce((acc, item) => acc + item.cost, 0),
    source: "planner",
    pace,
    warnings: plan.warnings,
    // 배정 예산으로 신규 소재 학습을 끝내기 어려운 경우(spec §6.6.4 [F]).
    learningWarnings: learningBudgetWarnings(planner, plan.items).map((warning) => ({ ...warning, unit: planner.toUnit.get(warning.nodeKey) })),
  };
  if (!withForecast) return { allocation };
  const forecast = forecastAllocation(planner, plan, { ...forecastOptions, curveOverrides });
  return {
    allocation,
    forecast: { ...forecast, nodes: forecast.nodes.map((node) => ({ ...node, unit: planner.toUnit.get(node.key) })) },
  };
}

/** 지금 배분은 그대로 두고 증감분만 움직이는 비교안(5-3 "기존 유지 + 증감분"). */
export function deltaAllocationAt(planner, budget, { pace = "paced", holds = {} } = {}) {
  const plan = deltaOnlyPlan(patchedNodes(planner, { pace, holds }), budget, planner.cfg);
  if (!plan) return { items: [], totalAllocated: 0, unallocated: null, overspent: false, blocked: true };
  return { ...plan, items: plan.items.map((item) => ({ ...item, channel: planner.toUnit.get(item.channel) })) };
}

function projectedValue(summary, metric) {
  return metric === "revenue_d7" ? summary.nextROAS : summary.nextAvgCPR;
}

/** 목표 효율 역산용 사다리. 기존 frontier와 같은 간격(하단 로그 + 상단 선형)으로 플래너 배분을 훑는다. */
export function plannerFrontier(planner, { minBudget, maxBudget, metric, historyByCh = {}, steps = 49, pace = "paced", holds = {} }) {
  const low = Number(minBudget);
  const high = Number(maxBudget);
  if (!(low > 0) || !(high >= low)) return [];
  const count = Math.max(2, Math.floor(steps));
  const logCount = Math.max(2, Math.ceil(count / 2));
  const linearCount = Math.max(2, count - logCount + 2);
  const budgets = new Set([low, high]);
  for (let i = 1; i < logCount - 1; i += 1) budgets.add(low * Math.pow(high / low, i / (logCount - 1)));
  for (let i = 1; i < linearCount - 1; i += 1) budgets.add(low + ((high - low) * i) / (linearCount - 1));
  return [...budgets].sort((a, b) => a - b).map((budget) => {
    const { allocation } = allocationAt(planner, budget, { pace, holds });
    const summary = computeAllocSummary({ items: allocation.items, metric, historyByCh });
    return { budget, allocation, summary, value: projectedValue(summary, metric) };
  });
}

/** 예산 배수 시나리오(0.5×~2×). 가능한 범위를 넘으면 미배분이 생기며 그대로 보여 준다. */
export function plannerScenarios(planner, dailyBudget, { pace = "paced", holds = {}, includeItems = false } = {}) {
  if (!(dailyBudget > 0)) return [];
  return [0.5, 0.75, 1, 1.25, 1.5, 2].map((m) => {
    const { allocation } = allocationAt(planner, dailyBudget * m, { pace, holds });
    const totResults = allocation.items.reduce((acc, item) => acc + (item.results || 0), 0);
    const totCost = allocation.totalAllocated;
    return { m, budget: dailyBudget * m, totResults, totCost, avgCpr: totResults > 0 ? totCost / totResults : null, ...(includeItems ? { items: allocation.items } : {}) };
  });
}

function forecastTotals(forecast) {
  return forecast ? { cost: forecast.total.cost, results: forecast.total.results, cpr: forecast.total.cpr, lo: forecast.total.lo, hi: forecast.total.hi } : null;
}

/**
 * "기존보다 나쁜 소재를 끄면" (spec §6.6.4 [F]·§8.1). 자동 반영하지 않고 별도 안으로만 낸다.
 * 구성 효과만 반영한다 — 남은 소재가 늘어난 몫을 같은 효율로 쓴다는 가정이며, 증액분 효율은 알 수 없다.
 * @returns {null | {offs:object[], base:object, scenario:object, allocation:object}}
 */
export function loserOffScenarioAt(planner, budget, { pace = "paced", holds = {} } = {}) {
  const offs = loserOffCandidates(planner);
  if (!offs.length || !(budget > 0)) return null;
  const { curveOverrides, effects } = creativeOffOverrides(planner, offs);
  const usable = effects.filter((effect) => curveOverrides.has(effect.nodeKey));
  if (!usable.length) return { offs: effects.map((effect) => ({ ...effect, unit: planner.toUnit.get(effect.nodeKey) })), base: null, scenario: null, allocation: null };
  const base = allocationAt(planner, budget, { pace, holds, withForecast: true });
  const scenario = allocationAt(planner, budget, { pace, holds, withForecast: true, curveOverrides });
  return {
    offs: effects.map((effect) => ({ ...effect, unit: planner.toUnit.get(effect.nodeKey) })),
    base: forecastTotals(base.forecast),
    scenario: forecastTotals(scenario.forecast),
    horizonDays: base.forecast.horizonDays,
    allocation: scenario.allocation,
  };
}

/**
 * "이 대상에 새 소재를 넣으면" (spec §8.1). 배분은 그대로 두고 예측에 가상 출시를 더한다.
 * 과거 출시가 모자라면 config 기본 프로파일(가정값)을 쓰고 assumed로 알린다.
 */
export function newCreativeScenarioAt(planner, budget, unit, { pace = "paced", holds = {}, startOffsetDays = 0 } = {}) {
  const key = planner.toPlanner.get(unit);
  if (!key || !(budget > 0)) return null;
  const extraLaunches = newCreativeLaunches(planner, key, { startOffsetDays });
  const launch = extraLaunches.get(key)?.[0];
  const base = allocationAt(planner, budget, { pace, holds, withForecast: true });
  const scenario = allocationAt(planner, budget, { pace, holds, withForecast: true, forecastOptions: { extraLaunches } });
  const baseNode = base.forecast.nodes.find((node) => node.key === key);
  const scenarioNode = scenario.forecast.nodes.find((node) => node.key === key);
  return {
    unit,
    assumed: Boolean(launch?.profile.assumed),
    launches: launch?.profile.launches ?? 0,
    buckets: launch?.profile.buckets ?? [],
    base: forecastTotals(base.forecast),
    scenario: forecastTotals(scenario.forecast),
    node: baseNode && scenarioNode ? { baseResults: baseNode.results, scenarioResults: scenarioNode.results, baseCpr: baseNode.cpr, scenarioCpr: scenarioNode.cpr } : null,
  };
}

/** 주력 소재 피로를 반영한 예측(spec §8 — 시나리오 전용). 피로가 예측 기간에 들어오는 대상이 없으면 null. */
export function fatigueScenarioAt(planner, budget, { pace = "paced", holds = {} } = {}) {
  const starts = fatigueStarts(planner);
  if (!starts.size || !(budget > 0)) return null;
  const base = allocationAt(planner, budget, { pace, holds, withForecast: true });
  const scenario = allocationAt(planner, budget, { pace, holds, withForecast: true, forecastOptions: { applyFatigue: true } });
  return {
    targets: [...starts].map(([key, start]) => ({ unit: planner.toUnit.get(key), ...start })).sort((a, b) => a.date.localeCompare(b.date) || String(a.unit).localeCompare(String(b.unit))),
    penalty: planner.cfg.forecast.fatiguePenalty,
    base: forecastTotals(base.forecast),
    scenario: forecastTotals(scenario.forecast),
  };
}
