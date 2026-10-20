// 성과 예측과 백테스트 (spec §8). 몬테카를로 없이 학습 잔차의 분위수로 구간을 만든다.
import { CREATIVE_STATS } from "@/utils/creativeMath";
import { predictNodeCpr } from "./plannerCurve";
import { addDays, dowOf, quantile } from "./plannerStats";

const MIN_EMPIRICAL_RESIDUALS = 10;

/** 로그 잔차 구간 [qL, qU]. 잔차가 적으면 정규 근사(±z·σ)로 대신한다. */
export function residualBand(curve, cfg) {
  const { lowerQ, upperQ } = cfg.forecast;
  const values = curve.residuals.map((item) => item.r);
  if (values.length >= MIN_EMPIRICAL_RESIDUALS) return { lo: quantile(values, lowerQ), hi: quantile(values, upperQ), method: "empirical" };
  return { lo: CREATIVE_STATS.stdNormalInv(lowerQ) * curve.sigma, hi: CREATIVE_STATS.stdNormalInv(upperQ) * curve.sigma, method: "normal" };
}

/**
 * 학습·램프 중인 신규 소재가 있는 노드의 CPR 배율: 결과 가중 혼합.
 * 노드 곡선은 학습일을 빼고 적합했으므로 성숙 상태를 뜻한다. 신규 소재 몫만 출시 프로파일만큼 비싸게 본다.
 */
export function launchMultiplier(launches, daysAhead) {
  let share = 0;
  let weighted = 0;
  for (const launch of launches) {
    const age = launch.age + daysAhead;
    const bucket = launch.profile.buckets.find((item) => age >= item.ages[0] && age <= item.ages[1]);
    if (!bucket) continue;
    share += bucket.spendShare;
    weighted += bucket.spendShare / bucket.cprRatio;
  }
  if (share <= 0) return 1;
  const capped = Math.min(1, share);
  const scale = capped / share;
  return 1 / (1 - capped + weighted * scale);
}

/**
 * @param {object[]} plans {key, label, cost(계획 일예산), curve, costDow, launches?, fatigueFrom?}
 * @param {{startDate:string, cfg:object}} opts
 */
export function forecastPlan(plans, { startDate, cfg }) {
  const { horizonDays, spendPacing, applyFatigue, fatiguePenalty, intervalAggregation, upperQ } = cfg.forecast;
  const daily = new Map();
  const nodes = [];
  let assumedProfiles = 0;
  for (const plan of plans) {
    if (!plan.curve) {
      nodes.push({ key: plan.key, label: plan.label, cost: plan.cost * horizonDays, results: null, lo: null, hi: null, predictable: false });
      continue;
    }
    const band = residualBand(plan.curve, cfg);
    const total = { cost: 0, results: 0, lo: 0, hi: 0, extrapolatedDays: 0 };
    let predictable = true;
    if ((plan.launches || []).some((launch) => launch.profile.assumed)) assumedProfiles += 1;
    for (let t = 0; t < horizonDays; t += 1) {
      const date = addDays(startDate, t);
      const dow = dowOf(date);
      const cost = spendPacing === "dow" ? plan.cost * plan.costDow[dow] : plan.cost;
      if (!(cost > 0)) continue;
      const base = predictNodeCpr(plan.curve, cost, dow);
      if (!(base > 0)) {
        predictable = false;
        continue;
      }
      const fatigue = applyFatigue && plan.fatigueFrom && date >= plan.fatigueFrom ? 1 + fatiguePenalty : 1;
      const cpr = base * launchMultiplier(plan.launches || [], t + 1) * fatigue;
      const results = cost / cpr;
      const lo = cost / (cpr * Math.exp(band.hi));
      const hi = cost / (cpr * Math.exp(band.lo));
      total.cost += cost;
      total.results += results;
      total.lo += lo;
      total.hi += hi;
      if (cost > plan.curve.observed.xMax || cost < plan.curve.observed.xMin) total.extrapolatedDays += 1;
      if (!daily.has(date)) daily.set(date, { date, dow, cost: 0, results: 0 });
      const day = daily.get(date);
      day.cost += cost;
      day.results += results;
    }
    nodes.push({ key: plan.key, label: plan.label, ...total, cpr: total.results > 0 ? total.cost / total.results : null, predictable, bandMethod: band.method });
  }

  const predicted = nodes.filter((node) => node.results != null);
  const cost = predicted.reduce((acc, node) => acc + node.cost, 0);
  const results = predicted.reduce((acc, node) => acc + node.results, 0);
  let lo;
  let hi;
  if (intervalAggregation === "comonotonic") {
    // 시장 충격은 노드끼리 같이 온다. 분위수를 그대로 더하면 보수적인(넓은) 구간이 된다.
    lo = predicted.reduce((acc, node) => acc + node.lo, 0);
    hi = predicted.reduce((acc, node) => acc + node.hi, 0);
  } else {
    // 독립 가정: 노드 구간 폭을 표준편차로 환산해 분산을 더한다(대칭 근사). 실제보다 좁을 수 있다.
    const z = CREATIVE_STATS.stdNormalInv(upperQ);
    const sd = Math.sqrt(predicted.reduce((acc, node) => acc + ((node.hi - node.lo) / (2 * z)) ** 2, 0));
    lo = Math.max(0, results - z * sd);
    hi = results + z * sd;
  }
  return {
    startDate,
    horizonDays,
    total: { cost, results, cpr: results > 0 ? cost / results : null, lo, hi, aggregation: intervalAggregation },
    nodes,
    daily: [...daily.values()].sort((a, b) => a.date.localeCompare(b.date)),
    flags: {
      extrapolatedNodes: nodes.filter((node) => node.extrapolatedDays > 0).length,
      unpredictableNodes: nodes.filter((node) => !node.predictable).length,
      assumedLaunchProfiles: assumedProfiles,
    },
  };
}

/**
 * 백테스트: 마지막 holdoutDays일을 빼고 곡선을 다시 맞춘 뒤, 실제 지출을 넣어 결과를 맞히는지 본다.
 * 배분이 아니라 CPR 모형을 검사한다(실제로 쓴 지출 그대로 넣는다).
 * @param {Map} nodes 배분 노드 일별 합계
 * @param {(key:string, to:string)=>object|null} fitAt 노드 곡선을 to까지의 데이터로 적합
 */
export function backtestPlanner(nodes, fitAt, { asOf, cfg }) {
  const { holdoutDays, minCoverage } = cfg.backtest;
  const cut = addDays(asOf, -holdoutDays);
  const rows = [];
  let inside = 0;
  let checked = 0;
  for (const [key, node] of nodes) {
    const curve = fitAt(key, cut);
    if (!curve) continue;
    const band = residualBand(curve, cfg);
    let predicted = 0;
    let actual = 0;
    for (const [date, day] of node.days) {
      if (date <= cut || date > asOf || !(day.cost > 0)) continue;
      const cpr = predictNodeCpr(curve, day.cost, dowOf(date));
      if (!(cpr > 0)) continue;
      const result = day.cost / cpr;
      predicted += result;
      actual += day.result;
      const lo = day.cost / (cpr * Math.exp(band.hi));
      const hi = day.cost / (cpr * Math.exp(band.lo));
      checked += 1;
      if (day.result >= lo && day.result <= hi) inside += 1;
    }
    if (actual > 0) rows.push({ key, label: node.label, predicted, actual, error: predicted / actual - 1 });
  }
  if (!rows.length) return { evaluated: false, reason: "no_holdout_nodes", holdoutDays };
  const predictedTotal = rows.reduce((acc, row) => acc + row.predicted, 0);
  const actualTotal = rows.reduce((acc, row) => acc + row.actual, 0);
  const coverage = checked ? inside / checked : null;
  return {
    evaluated: true,
    holdoutDays,
    from: addDays(cut, 1),
    to: asOf,
    mape: rows.reduce((acc, row) => acc + Math.abs(row.error), 0) / rows.length,
    totalError: predictedTotal / actualTotal - 1,
    dailyCoverage: coverage,
    belowCoverage: coverage != null && coverage < minCoverage,
    nodes: rows,
  };
}
