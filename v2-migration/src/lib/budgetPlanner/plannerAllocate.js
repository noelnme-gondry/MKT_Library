// 제약 배분 (spec §7). 한계효용 그리디는 기존 calculateAllocationModeB를 그대로 쓰고,
// 여기서는 config·진단 결과에서 노드별 상·하한을 만들고, 그룹 비중 제약과 바인딩 사유를 붙인다.
import { allocationDeltaPlan } from "@/utils/allocationDeltaPlan";
import { calculateAllocationModeB } from "@/utils/budgetAllocTool";
import { ALLOC_MATH } from "@/utils/allocationMath";

const EPS = 1e-6;

function weeklyResults(wrapper, cost) {
  const cpr = ALLOC_MATH.predictSafeCpr(wrapper, cost);
  return cost > 0 && cpr > 0 ? (7 * cost) / cpr : 0;
}

/**
 * 노드 하나의 일예산 상·하한. 어느 규칙이 경계를 만들었는지(source)를 함께 남긴다.
 * @param {object} node {key, current, curve, state, verdict, cfg, creative:{freezeNow, fatigued}}
 */
export function nodeBounds(node) {
  const { cfg, current } = node;
  const opt = cfg.optimizer;
  const policy = opt.statePolicy[node.state] ?? "normal";
  if (opt.locked.includes(node.key)) return { fixed: current, source: "locked" };
  // 호출 화면이 고정한 노드(예: 적합 신뢰도가 낮아 현재 지출 유지).
  if (Number.isFinite(node.fixedCost) && node.fixedCost >= 0) return { fixed: node.fixedCost, source: node.fixedSource || "held" };
  if (!node.curve) return { fixed: current, source: "no_curve" };
  if (policy === "hold") return { fixed: current, source: `state:${node.state}` };

  let lower = { value: current * (1 - opt.maxDailyDecrease), source: "max_daily_decrease" };
  let upper = { value: current > 0 ? current * (1 + opt.maxDailyIncrease) : Infinity, source: "max_daily_increase" };
  const tighten = (bound, value, source, isUpper) => ((isUpper ? value < bound.value : value > bound.value) ? { value, source } : bound);

  upper = tighten(upper, node.curve.observed.xMax * (1 + opt.extrapolationHeadroom), "extrapolation", true);
  const shape = node.curve.wrapper.poly2Shape;
  if (shape?.shape === "bell" && shape.vertex > 0) upper = tighten(upper, shape.vertex, "curve_peak", true);
  if (policy === "decrease_only") upper = tighten(upper, current, `state:${node.state}`, true);
  if (policy === "freeze" || node.creative?.freezeNow) {
    const f = cfg.creative.launch.learningFreezeChangePct;
    lower = tighten(lower, current * (1 - f), "learning_freeze", false);
    upper = tighten(upper, current * (1 + f), "learning_freeze", true);
  }
  if (node.verdict === "CREATIVE" && node.creative?.fatigued) {
    upper = tighten(upper, current * (1 + opt.creativeBlockedIncrease), "creative_fatigue", true);
  }
  let conflict = false;
  if (lower.value > upper.value) {
    lower = { value: upper.value, source: upper.source };
    conflict = true;
  }

  // 학습 하한: 예측 주간 결과가 하한에 못 미치는 중간값은 만들지 않는다.
  let offCandidate = false;
  const minWeekly = opt.learningMinWeeklyResults;
  if (minWeekly > 0 && Number.isFinite(upper.value)) {
    if (weeklyResults(node.curve.wrapper, upper.value) < minWeekly) offCandidate = true;
    else if (weeklyResults(node.curve.wrapper, lower.value) < minWeekly) {
      let lo = lower.value;
      let hi = upper.value;
      for (let i = 0; i < 60; i += 1) {
        const mid = (lo + hi) / 2;
        if (weeklyResults(node.curve.wrapper, mid) >= minWeekly) hi = mid;
        else lo = mid;
      }
      lower = { value: hi, source: "learning_minimum" };
    }
  }
  return { lower, upper, conflict, offCandidate };
}

function runGreedy(free, budget, cfg) {
  if (!free.length) return new Map();
  const modelsMap = new Map(free.map((node) => [node.key, node.curve.wrapper]));
  const minSpends = Object.fromEntries(free.map((node) => [node.key, node.bounds.lower.value]));
  const maxSpends = Object.fromEntries(free.map((node) => [node.key, Number.isFinite(node.bounds.upper.value) ? node.bounds.upper.value : node.curve.observed.xMax * 10]));
  const currentSpends = Object.fromEntries(free.map((node) => [node.key, Math.min(Math.max(node.current, minSpends[node.key]), maxSpends[node.key])]));
  const result = calculateAllocationModeB({ modelsMap, totalBudget: budget, minSpends, maxSpends, currentSpends, stepRatio: cfg.optimizer.stepPct });
  return new Map(result.items.map((item) => [item.channel, item.cost]));
}

function groupOf(node, spec) {
  const [level, ...rest] = spec.split(":");
  return node.path[level] === rest.join(":");
}

/**
 * @param {object[]} nodes {key, label, path, current, curve, state, verdict, cfg, creative}
 * @param {number} totalBudget 총 일예산
 * @param {object} cfg 전역 config (그룹 비중·스텝)
 */
export function planAllocation(nodes, totalBudget, cfg) {
  const prepared = nodes.map((node) => ({ ...node, bounds: nodeBounds(node) }));
  const fixed = prepared.filter((node) => node.bounds.fixed != null);
  const free = prepared.filter((node) => node.bounds.fixed == null);
  const fixedTotal = fixed.reduce((acc, node) => acc + node.bounds.fixed, 0);
  const lowerTotal = free.reduce((acc, node) => acc + node.bounds.lower.value, 0);
  const upperTotal = free.reduce((acc, node) => acc + node.bounds.upper.value, 0);
  const freeBudget = totalBudget - fixedTotal;
  const warnings = [];
  let allocation;
  if (freeBudget < lowerTotal - EPS) {
    warnings.push({ code: "budget_below_minimums", need: fixedTotal + lowerTotal, budget: totalBudget });
    allocation = new Map(free.map((node) => [node.key, node.bounds.lower.value]));
  } else if (freeBudget > upperTotal + EPS) {
    warnings.push({ code: "budget_above_limits", unallocated: freeBudget - upperTotal });
    allocation = new Map(free.map((node) => [node.key, node.bounds.upper.value]));
  } else {
    allocation = runGreedy(free, freeBudget, cfg);
  }

  // 그룹 비중 제약: 벗어난 그룹을 경계값 예산으로 따로 나누고 나머지를 다시 나눈다.
  const settled = new Set();
  for (const [spec, [minShare, maxShare]] of Object.entries(cfg.optimizer.groupShares).sort(([a], [b]) => a.localeCompare(b))) {
    const members = free.filter((node) => groupOf(node, spec) && !settled.has(node.key));
    if (!members.length) continue;
    const allocatedTotal = [...allocation.values()].reduce((a, b) => a + b, 0) + fixedTotal;
    const groupFixed = fixed.filter((node) => groupOf(node, spec)).reduce((acc, node) => acc + node.bounds.fixed, 0);
    const groupTotal = members.reduce((acc, node) => acc + (allocation.get(node.key) || 0), 0) + groupFixed;
    const share = allocatedTotal > 0 ? groupTotal / allocatedTotal : 0;
    if (share >= minShare - EPS && share <= maxShare + EPS) continue;
    const wanted = (share < minShare ? minShare : maxShare) * allocatedTotal - groupFixed;
    const memberLower = members.reduce((acc, node) => acc + node.bounds.lower.value, 0);
    const memberUpper = members.reduce((acc, node) => acc + node.bounds.upper.value, 0);
    const target = Math.min(Math.max(wanted, memberLower), memberUpper);
    if (Math.abs(target - wanted) > EPS) warnings.push({ code: "group_share_unreachable", group: spec, wantedShare: share < minShare ? minShare : maxShare });
    const rest = free.filter((node) => !members.includes(node) && !settled.has(node.key));
    // 이미 정한 그룹은 그대로 두고, 이 그룹이 목표만큼 가져간 나머지를 다른 노드에 다시 나눈다.
    const freeSpend = [...allocation.values()].reduce((a, b) => a + b, 0);
    const settledSpend = [...settled].reduce((acc, key) => acc + (allocation.get(key) || 0), 0);
    const restWanted = freeSpend - settledSpend - target;
    const restLower = rest.reduce((acc, node) => acc + node.bounds.lower.value, 0);
    const restUpper = rest.reduce((acc, node) => acc + node.bounds.upper.value, 0);
    const restBudget = Math.min(Math.max(restWanted, restLower), restUpper);
    if (Math.abs(restBudget - restWanted) > EPS) warnings.push({ code: "group_share_spills_budget", group: spec, difference: restWanted - restBudget });
    const inGroup = runGreedy(members, target, cfg);
    const outside = runGreedy(rest, restBudget, cfg);
    for (const [key, cost] of [...inGroup, ...outside]) allocation.set(key, cost);
    members.forEach((node) => settled.add(node.key));
  }

  const items = prepared.map((node) => {
    const proposed = node.bounds.fixed != null ? node.bounds.fixed : allocation.get(node.key) ?? node.current;
    let binding = null;
    if (node.bounds.fixed != null) binding = node.bounds.source;
    else if (Math.abs(proposed - node.bounds.upper.value) <= Math.max(1, proposed) * 1e-3) binding = node.bounds.upper.source;
    else if (Math.abs(proposed - node.bounds.lower.value) <= Math.max(1, proposed) * 1e-3) binding = node.bounds.lower.source;
    const cpr = node.curve ? ALLOC_MATH.predictSafeCpr(node.curve.wrapper, proposed) : null;
    return {
      key: node.key,
      label: node.label,
      path: node.path,
      current: node.current,
      proposed,
      change: proposed - node.current,
      changePct: node.current > 0 ? proposed / node.current - 1 : null,
      lower: node.bounds.fixed ?? node.bounds.lower.value,
      upper: node.bounds.fixed ?? node.bounds.upper.value,
      binding,
      fixed: node.bounds.fixed != null,
      conflict: Boolean(node.bounds.conflict),
      offCandidate: Boolean(node.bounds.offCandidate),
      predictedResults: cpr > 0 && proposed > 0 ? proposed / cpr : node.curve ? 0 : null,
      predictedCpr: cpr > 0 ? cpr : null,
      outsideObserved: Boolean(node.curve) && (proposed > node.curve.observed.xMax || proposed < node.curve.observed.xMin),
      state: node.state,
      verdict: node.verdict,
    };
  });
  const totalAllocated = items.reduce((acc, item) => acc + item.proposed, 0);
  return { items, totalBudget, totalAllocated, unallocated: Math.max(0, totalBudget - totalAllocated), warnings, source: "from_current_or_greedy" };
}

/** 비교용: 지금 배분을 그대로 두고 총예산 증감분만 움직이는 안(기존 5-3과 같은 엔진). */
export function deltaOnlyPlan(nodes, totalBudget, cfg) {
  const usable = nodes.filter((node) => node.curve);
  const fixedTotal = nodes.filter((node) => !node.curve).reduce((acc, node) => acc + node.current, 0);
  if (!usable.length) return null;
  const plan = allocationDeltaPlan({
    modelsMap: new Map(usable.map((node) => [node.key, node.curve.wrapper])),
    currentSpends: Object.fromEntries(usable.map((node) => [node.key, node.current])),
    totalBudget: totalBudget - fixedTotal,
    maxSpends: Object.fromEntries(usable.map((node) => [node.key, Math.max(node.current, node.curve.observed.xMax * (1 + cfg.optimizer.extrapolationHeadroom))])),
  });
  return plan.blocked ? null : plan;
}
