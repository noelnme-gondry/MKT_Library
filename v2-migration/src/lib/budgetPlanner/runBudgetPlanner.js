// 계층형 예산 플래너 실행 (spec §0). 순수 함수: 같은 행 + 같은 config → 같은 결과.
import { buildCreativeLifecycle, identityKeyOf } from "./creativeLifecycle";
import { classifyNodeChange, creativeEvidenceFromPvm, diagnosisWindows, marketShifts, measureNodeChange } from "./changeDiagnosis";
import { assessConformity } from "./conformity";
import { dowFactorsFromSamples, NEUTRAL_DOW, ratioToMovingAverageSamples, withinLookback } from "./dowProfile";
import { planAllocation, deltaOnlyPlan } from "./plannerAllocate";
import { configFor, mergePlannerConfig, plannerConfigSignature, resolvePlannerConfig } from "./plannerConfig";
import { fitNodeCurve } from "./plannerCurve";
import { ancestorKey, dailyByNode, deepestPresentLevel, normalizePlannerRows } from "./plannerData";
import { backtestPlanner, forecastPlan } from "./plannerForecast";
import { decomposePlannerPvm } from "./plannerPvm";
import { addDays, isKrLunarHoliday } from "./plannerStats";

function costSeries(days) {
  return new Map([...days].map(([date, day]) => [date, day.cost]));
}

function costDowFor(days, cfg, asOf, parentFactors, exclude) {
  if (!cfg.dow.enabled) return [...NEUTRAL_DOW];
  const samples = ratioToMovingAverageSamples(withinLookback(costSeries(days), asOf, cfg.dow.lookbackWeeks), { excludeDates: exclude });
  return dowFactorsFromSamples(samples, cfg.dow, parentFactors).factors;
}

function totalsByDate(rows) {
  const out = new Map();
  for (const row of rows) out.set(row.date, (out.get(row.date) || 0) + row.cost);
  return new Map([...out].sort(([a], [b]) => a.localeCompare(b)));
}

function union(...sets) {
  return new Set(sets.flatMap((set) => (set ? [...set] : [])));
}

/**
 * 1단계: 예산과 무관한 계산(곡선·범위 적합성·원인 진단·PVM·소재·백테스트). 비싼 쪽이라 한 번만 돌리고,
 * 예산을 바꿀 때는 allocatePlanner만 다시 부른다(목표 역산·시나리오가 여러 예산을 훑는다).
 * @param {object[]} mappedRows 표준키 행(date·cost·결과·country·platform·channel·campaign_name·adgroup_name·creative_id·impressions·clicks·daily_budget)
 * @param {{configPatch?:object, asOf?:string, trendOverrideOf?:(path)=>string|undefined, currentSpendOf?:(path)=>number|undefined}} opts
 *   trendOverrideOf: 노드별로 확정한 모형 계열 · currentSpendOf: 호출 화면이 이미 쓰는 "현재 일 지출"(두 곳에서 따로 세지 않게)
 */
export function preparePlanner(mappedRows, { configPatch = {}, asOf: asOfInput, trendOverrideOf, currentSpendOf } = {}) {
  const resolved = resolvePlannerConfig(configPatch);
  if (!resolved.ok) return { ok: false, code: "INVALID_CONFIG", errors: resolved.errors };
  const cfg = resolved.config;
  const levels = cfg.hierarchy.levels;
  const allocateLevel = cfg.hierarchy.roles.allocate;
  const { rows, dropped } = normalizePlannerRows(mappedRows, { metric: cfg.metric.result });
  if (!rows.length) return { ok: false, code: "NO_USABLE_ROWS", dropped };

  const dates = rows.map((row) => row.date).sort();
  const dataStart = dates[0];
  const asOf = asOfInput && asOfInput >= dataStart && asOfInput <= dates.at(-1) ? asOfInput : dates.at(-1);
  const inScope = rows.filter((row) => row.date <= asOf);

  const nodes = dailyByNode(inScope, allocateLevel, levels);
  const parentLevel = levels.indexOf("channel") >= 0 && levels.indexOf("channel") < levels.indexOf(allocateLevel) ? "channel" : null;
  const parents = parentLevel ? dailyByNode(inScope, parentLevel, levels) : new Map();
  const parentKeyOf = (node) => (parentLevel ? ancestorKey(node.path, parentLevel, levels) : null);
  const cfgOf = (path) => configFor(cfg, { country: path.country || "", channel: path.channel || "" });

  const holidays = cfg.dow.excludeHolidays ? new Set(dates.filter(isKrLunarHoliday)) : new Set();
  const lifecycle = buildCreativeLifecycle(inScope, cfg, { levels, allocateLevel, asOf, dataStart, nodes, configForPath: cfgOf });
  const excludeOf = (key) => {
    const creative = lifecycle.byNode.get(key);
    const nodeCfg = cfgOf(nodes.get(key).path);
    return union(holidays, nodeCfg.creative.launch.excludeLearningDays ? creative?.learningDates : null);
  };

  // 요일 계수: 전체 → 채널 → 노드로 수축.
  const globalCostDow = costDowFor(new Map([...totalsByDate(inScope)].map(([date, cost]) => [date, { cost }])), cfg, asOf, NEUTRAL_DOW, holidays);
  const parentCostDow = new Map([...parents].map(([key, parent]) => [key, costDowFor(parent.days, cfgOf(parent.path), asOf, globalCostDow, holidays)]));

  const parentCurveCache = new Map();
  const parentCurveAt = (key, to) => {
    if (!key || !parents.has(key)) return null;
    const cacheKey = `${key}@${to}`;
    if (!parentCurveCache.has(cacheKey)) {
      const parent = parents.get(key);
      const parentCfg = cfgOf(parent.path);
      // 부모는 자기 곡선만 맞춘다(더 위에서 빌리지 않는다).
      parentCurveCache.set(cacheKey, fitNodeCurve(parent.days, { ...parentCfg, curve: { ...parentCfg.curve, borrowParentBelow: 0 } }, { to, exclude: holidays }));
    }
    return parentCurveCache.get(cacheKey);
  };

  const windows = diagnosisWindows(asOf, cfg.events.windowDays);
  const perNode = new Map();
  for (const [key, node] of nodes) {
    const nodeCfg = cfgOf(node.path);
    const pKey = parentKeyOf(node);
    const exclude = excludeOf(key);
    const creative = lifecycle.byNode.get(key);
    const trendType = trendOverrideOf?.(node.path) || undefined;
    const judged = assessConformity(node, nodeCfg, { asOf, parent: parentCurveAt(pKey, addDays(asOf, -nodeCfg.conformity.recentDays)), learningDates: creative?.learningDates, exclude, trendType });
    const policy = nodeCfg.optimizer.statePolicy[judged.state];
    const curve = fitNodeCurve(node.days, nodeCfg, { to: asOf, exclude, parent: parentCurveAt(pKey, asOf), regimeMode: policy === "recent_regime" && nodeCfg.curve.regimeMode !== "manual" ? "auto" : undefined, trendType });
    // 범위를 판정할 이력이 모자라도 전체 기간 곡선이 있으면 배분은 할 수 있다 — "판정 불가"와 "곡선 없음"을 가른다.
    const conformity = judged.state === "INSUFFICIENT" && curve ? { ...judged, state: "UNVERIFIED" } : judged;
    const recentFrom = addDays(asOf, -6);
    const given = currentSpendOf?.(node.path);
    const current = Number.isFinite(given) && given >= 0 ? given : [...node.days].filter(([date]) => date >= recentFrom).reduce((acc, [, day]) => acc + day.cost, 0) / 7;
    const measure = measureNodeChange(node, nodeCfg, { windows, parent: parentCurveAt(pKey, windows.B.to), exclude, creativeEntries: creative?.entries ?? [], trendType });
    perNode.set(key, {
      node,
      trendType,
      cfg: nodeCfg,
      conformity,
      curve,
      current,
      measure,
      costDow: costDowFor(node.days, nodeCfg, asOf, parentCostDow.get(pKey) ?? globalCostDow, holidays),
    });
  }

  const measures = new Map([...perNode].map(([key, item]) => [key, item.measure]));
  const markets = marketShifts(nodes, measures, cfg);
  const rateFactors = new Map([...perNode].map(([key, item]) => [key, {
    budget: item.measure.curveFactor ?? 1,
    market: markets.get(key)?.market != null ? Math.exp(markets.get(key).market) : 1,
  }]));

  const finestLevel = cfg.pvm.finestLevel === "auto" ? deepestPresentLevel(inScope, levels) : cfg.pvm.finestLevel;
  const entryById = new Map(lifecycle.entries.map((entry) => [entry.id, entry]));
  const creativeStateOf = (cell) => {
    const values = JSON.parse(cell.key);
    const row = Object.fromEntries(levels.slice(0, values.length).map((name, index) => [name, values[index]]));
    const entry = entryById.get(JSON.stringify([cell.groupKey, identityKeyOf(row, cfg.creative.identityScope)]));
    return entry ? { state: entry.state, fatigued: Boolean(entry.fatigue?.fatigued) } : null;
  };
  const inWindow = (window) => inScope.filter((row) => row.date >= window.from && row.date <= window.to);
  const finestIndex = levels.indexOf(finestLevel);
  const pvm = finestIndex >= levels.indexOf(allocateLevel)
    ? decomposePlannerPvm(inWindow(windows.B), inWindow(windows.R), { levels, finestLevel, groupLevel: allocateLevel, cfg, rateFactors, creativeStateOf })
    : { ok: false, code: "FINEST_ABOVE_ALLOCATION_LEVEL" };

  const pvmRowsByGroup = new Map();
  if (pvm.ok) {
    for (const row of pvm.rows) {
      if (!pvmRowsByGroup.has(row.groupKey)) pvmRowsByGroup.set(row.groupKey, []);
      pvmRowsByGroup.get(row.groupKey).push(row);
    }
  }

  const nodeSummaries = [];
  const allocationNodes = [];
  for (const [key, item] of perNode) {
    const sign = Math.sign(item.measure.total ?? 0) || 1;
    const creative = lifecycle.hasCreatives && finestLevel === "creative_id" ? creativeEvidenceFromPvm(pvmRowsByGroup.get(key), sign) : null;
    const diagnosis = classifyNodeChange(item.measure, markets.get(key), creative, item.cfg);
    const creativeInfo = lifecycle.byNode.get(key);
    const freezeNow = Boolean(creativeInfo?.freezeDates?.has(asOf));
    const summary = {
      key,
      label: item.node.label,
      path: item.node.path,
      state: item.conformity.state,
      conformity: { ...item.conformity, curve: undefined },
      curveSource: item.curve?.source ?? null,
      curveType: item.curve?.wrapper.model.type ?? null,
      current: item.current,
      diagnosis,
      creative: creativeInfo ? {
        learningShareNow: creativeInfo.learningShareNow,
        loserShare: creativeInfo.loserShare,
        fatiguedShare: creativeInfo.fatiguedShare,
        stallRate: creativeInfo.stallRate,
        freezeNow,
        loserAlert: creativeInfo.loserShare >= item.cfg.creative.launch.loserShareAlert,
        stallWarning: creativeInfo.stallRate >= item.cfg.creative.launch.stallRateWarn,
      } : null,
    };
    nodeSummaries.push(summary);
    allocationNodes.push({
      key,
      label: item.node.label,
      path: item.node.path,
      current: item.current,
      curve: item.curve,
      state: item.conformity.state,
      verdict: diagnosis.verdict,
      cfg: item.cfg,
      creative: { freezeNow, fatigued: (creativeInfo?.fatiguedShare ?? 0) > 0 },
    });
  }

  const backtest = backtestPlanner(nodes, (key, to) => {
    const node = nodes.get(key);
    return fitNodeCurve(node.days, cfgOf(node.path), { to, exclude: excludeOf(key), parent: parentCurveAt(parentKeyOf(node), to), trendType: perNode.get(key).trendType });
  }, { asOf, cfg });

  return {
    ok: true,
    cfg,
    allocationNodes,
    perNode,
    lifecycle,
    configSignature: plannerConfigSignature(cfg),
    asOf,
    dataStart,
    dropped,
    levels: { allocate: allocateLevel, parent: parentLevel, finest: finestLevel },
    windows,
    nodes: nodeSummaries,
    backtest,
    pvm,
    creatives: lifecycle.entries.map((entry) => ({
      nodeKey: entry.nodeKey,
      creativeId: entry.creativeId,
      state: entry.state,
      launch: entry.unknownAge ? null : entry.launch,
      age: entry.age,
      ended: entry.ended,
      share: entry.share,
      judgment: entry.judgment ?? null,
      fatigue: entry.fatigue ?? null,
      profileAssumed: entry.profile?.assumed ?? null,
    })),
  };
}

/** 예산 하나에 대한 배분(+선택적으로 예측). optimizerPatch는 실행 방식처럼 예산 단계에서 바꾸는 제약만 받는다. */
export function allocatePlanner(ctx, totalBudget, { fixed = {}, optimizerPatch = null, withForecast = true } = {}) {
  const nodes = plannerNodesFor(ctx, { fixed, optimizerPatch });
  const globalCfg = optimizerPatch ? mergePlannerConfig(ctx.cfg, { optimizer: optimizerPatch }) : ctx.cfg;
  const budget = Number.isFinite(totalBudget) && totalBudget >= 0 ? totalBudget : nodes.reduce((acc, node) => acc + node.current, 0);
  const allocation = planAllocation(nodes, budget, globalCfg);
  const deltaPlan = deltaOnlyPlan(nodes, budget, globalCfg);
  const forecast = withForecast ? forecastAllocation(ctx, allocation) : null;
  return { allocation, deltaPlan, forecast };
}

/** 배분 단계 노드: 실행 방식 제약(optimizerPatch)과 호출 화면의 고정값(fixed)을 입힌다. */
export function plannerNodesFor(ctx, { fixed = {}, optimizerPatch = null, fixedSource = "held" } = {}) {
  return ctx.allocationNodes.map((node) => ({
    ...node,
    cfg: optimizerPatch ? mergePlannerConfig(node.cfg, { optimizer: optimizerPatch }) : node.cfg,
    fixedCost: Object.hasOwn(fixed, node.key) ? fixed[node.key] : undefined,
    fixedSource,
  }));
}

/** 배분 결과의 요일별 성과 예측. 학습·램프 중 신규 소재는 출시 프로파일만큼 비싸게 본다. */
export function forecastAllocation(ctx, allocation) {
  return forecastPlan(allocation.items.map((item) => {
    const data = ctx.perNode.get(item.key);
    const launches = (ctx.lifecycle.byNode.get(item.key)?.entries ?? [])
      .filter((entry) => !entry.ended && !entry.unknownAge && ["LEARNING", "RAMPING"].includes(entry.state))
      .map((entry) => ({ age: entry.age, profile: entry.profile }));
    return { key: item.key, label: item.label, cost: item.proposed, curve: data.curve, costDow: data.costDow, launches };
  }), { startDate: addDays(ctx.asOf, 1), cfg: ctx.cfg });
}

/** 한 번에 실행: 준비 + 배분 + 예측. totalBudget 생략 시 현재 일 지출 합. */
export function runBudgetPlanner(mappedRows, { totalBudget, ...opts } = {}) {
  const ctx = preparePlanner(mappedRows, opts);
  if (!ctx.ok) return ctx;
  const { cfg, allocationNodes, perNode, lifecycle, ...summary } = ctx;
  return { ...summary, ...allocatePlanner(ctx, totalBudget) };
}
