// 시나리오와 배분 경고 (spec §6.6.4 [F]·§8·§8.1). 배분·예측 엔진은 그대로 쓰고,
// 입력(곡선·출시·피로 시작일)만 바꿔 같은 계산을 다시 돌린다 — 두 번째 계산 경로를 만들지 않는다.
import { ALLOC_MATH } from "@/utils/allocationMath";
import { launchProfileFor } from "./creativeLifecycle";
import { scaleModel } from "./plannerCurve";
import { ancestorKey } from "./plannerData";
import { addDays } from "./plannerStats";

/**
 * 배분안으로 학습을 끝낼 수 있는지 (spec §6.6.4 [F]). 배정된 노드 일예산 × 그 소재의 최근 지출 비중이
 * 필요 일 지출에 못 미치면 경고한다. 필요 일 지출을 모르면(기존 소재 없음) 경고하지 않고 이유를 남긴다.
 * @param {object} ctx preparePlanner 결과
 * @param {{key:string, proposed:number}[]} items planAllocation 항목
 */
export function learningBudgetWarnings(ctx, items) {
  const proposedOf = new Map(items.map((item) => [item.key, item.proposed]));
  const out = [];
  for (const entry of ctx.lifecycle.entries) {
    if (entry.state !== "LEARNING" || entry.ended || !proposedOf.has(entry.nodeKey)) continue;
    const need = entry.learningNeed;
    if (!need) {
      out.push({ nodeKey: entry.nodeKey, creativeId: entry.creativeId, status: "unknown", reason: "no_incumbent" });
      continue;
    }
    if (!(need.neededDaily > 0)) continue;
    const expectedDaily = proposedOf.get(entry.nodeKey) * need.recentShare;
    if (expectedDaily + 1e-9 >= need.neededDaily) continue;
    out.push({
      nodeKey: entry.nodeKey,
      creativeId: entry.creativeId,
      status: "short",
      neededDaily: need.neededDaily,
      expectedDaily,
      remainingResults: need.remainingResults,
      daysLeft: need.daysLeft,
      priorAssumed: need.priorAssumed,
    });
  }
  return out.sort((a, b) => a.nodeKey.localeCompare(b.nodeKey) || String(a.creativeId).localeCompare(String(b.creativeId)));
}

/**
 * 노드 주력 소재(지출 비중이 가장 큰 활성 소재)의 피로 예상 시작일 (spec §8 fatigueMult).
 * 피로 지수가 같은 추세로 임계에 닿는 날 — 이미 닿았으면 예측 첫날부터.
 */
export function fatigueStartOf(ctx, nodeKey) {
  const entries = (ctx.lifecycle.byNode.get(nodeKey)?.entries ?? []).filter((entry) => !entry.ended);
  if (!entries.length) return null;
  const main = [...entries].sort((a, b) => b.share - a.share || String(a.creativeId).localeCompare(String(b.creativeId)))[0];
  const eta = main.fatigue?.etaDays;
  if (!Number.isFinite(eta)) return null;
  return { date: addDays(ctx.asOf, Math.max(1, Math.ceil(eta))), creativeId: main.creativeId, etaDays: eta };
}

/** 예측 기간 안에 피로가 시작될 노드들(applyFatigue 시나리오에서 쓰는 시작일). */
export function fatigueStarts(ctx) {
  const end = addDays(ctx.asOf, ctx.cfg.forecast.horizonDays);
  const out = new Map();
  for (const key of ctx.perNode.keys()) {
    const start = fatigueStartOf(ctx, key);
    if (start && start.date <= end) out.set(key, start);
  }
  return out;
}

function windowTotals(entries, from, to, skip) {
  let cost = 0;
  let result = 0;
  for (const entry of entries) {
    if (skip?.has(entry.creativeId)) continue;
    for (const [date, day] of entry.days) {
      if (date < from || date > to) continue;
      cost += day.cost;
      result += day.result;
    }
  }
  return { cost, result };
}

/**
 * 소재 OFF의 구성 효과 (spec §8.1): 최근 창(ctx.windows.R)에서 그 소재를 뺀 결과 가중 CPR ÷ 지금 CPR.
 * 남은 소재가 늘어난 예산을 같은 효율로 쓴다고 가정한다 — 증액분 효율은 알 수 없다(화면에 그대로 적는다).
 * @param {{nodeKey:string, creativeIds:string[]}[]} offs
 * @returns {{nodeKey:string, creativeIds:string[], multiplier:number|null, reason?:string, offShare:number}[]}
 */
export function creativeOffMultipliers(ctx, offs) {
  const { from, to } = ctx.windows.R;
  return offs.map(({ nodeKey, creativeIds }) => {
    const entries = ctx.lifecycle.byNode.get(nodeKey)?.entries ?? [];
    const all = windowTotals(entries, from, to);
    const kept = windowTotals(entries, from, to, new Set(creativeIds));
    const offShare = all.cost > 0 ? (all.cost - kept.cost) / all.cost : 0;
    if (!(all.cost > 0) || !(all.result > 0)) return { nodeKey, creativeIds, multiplier: null, reason: "no_recent_results", offShare };
    if (!(offShare > 0)) return { nodeKey, creativeIds, multiplier: 1, reason: "no_recent_spend", offShare };
    if (!(kept.cost > 0) || !(kept.result > 0)) return { nodeKey, creativeIds, multiplier: null, reason: "nothing_left", offShare };
    return { nodeKey, creativeIds, multiplier: (kept.cost / kept.result) / (all.cost / all.result), offShare };
  });
}

/** 곡선을 같은 계열로 k배 한 사본(지출 축은 그대로). */
export function scaledCurve(curve, k) {
  if (!curve || !(k > 0)) return curve;
  const model = scaleModel(curve.wrapper.model, k, 1);
  if (!model) return null;
  return { ...curve, wrapper: { ...curve.wrapper, model, poly2Shape: ALLOC_MATH.detectPoly2Shape(model) } };
}

/** "기존보다 나쁜" 소재가 노드 지출의 loserShareAlert 이상인 노드와 그 소재들 (spec §6.6.4 [F]). */
export function loserOffCandidates(ctx) {
  const out = [];
  for (const summary of ctx.nodes) {
    if (!summary.creative?.loserAlert) continue;
    const creativeIds = (ctx.lifecycle.byNode.get(summary.key)?.entries ?? [])
      .filter((entry) => entry.state === "LOSER" && !entry.ended)
      .map((entry) => entry.creativeId)
      .sort();
    if (creativeIds.length) out.push({ nodeKey: summary.key, creativeIds });
  }
  return out;
}

/** 소재 OFF 시나리오의 곡선 덮어쓰기. 계산할 수 없는 노드는 빼고 이유를 남긴다. */
export function creativeOffOverrides(ctx, offs) {
  const effects = creativeOffMultipliers(ctx, offs);
  const curveOverrides = new Map();
  for (const effect of effects) {
    if (!(effect.multiplier > 0) || effect.multiplier === 1) continue;
    const curve = ctx.perNode.get(effect.nodeKey)?.curve;
    const scaled = scaledCurve(curve, effect.multiplier);
    if (scaled) curveOverrides.set(effect.nodeKey, scaled);
  }
  return { curveOverrides, effects };
}

/**
 * 새 소재를 노드에 넣는 시나리오 (spec §8.1·§6.6.5). 과거 출시 프로파일(노드 → 채널 → 전체,
 * 표본이 모자라면 config 기본값 = "가정값")의 나이 구간별 비중·CPR 배율을 예측에 더한다.
 * @returns {Map<string, object[]>} 노드 → 추가 출시 목록(forecastAllocation의 extraLaunches)
 */
export function newCreativeLaunches(ctx, nodeKey, { startOffsetDays = 0 } = {}) {
  const node = ctx.perNode.get(nodeKey);
  if (!node) return new Map();
  const channelKey = ancestorKey(node.node.path, "channel", ctx.cfg.hierarchy.levels);
  const profile = launchProfileFor({ id: "__scenario__", nodeKey, channelKey }, ctx.lifecycle.profileEntries ?? [], node.cfg);
  // 예측 첫날(내일)이 나이 0이 되도록 한다. launchMultiplier가 나이 = age + (t+1)로 센다.
  return new Map([[nodeKey, [{ age: -1 - Math.max(0, Math.floor(startOffsetDays)), profile, scenario: true }]]]);
}
