// 변화 원인 진단 (spec §6.1–6.4). 예산 때문인가, 소재 때문인가.
// 1단: ln CPR_R − ln CPR_B = [곡선 위 이동 = 예산] + [곡선 이동].
// 2단: 곡선 이동에서 시장 공통분(대조군)을 빼고, 남은 몫을 퍼널·소재(PVM)로 해석한다.
// 결과는 원인 "후보"다. 인과 추정이 아니므로 화면 문구는 "가능성이 큼"까지만 쓴다(§8.6).
import { ALLOC_MATH } from "@/utils/allocationMath";
import { sumDays } from "./plannerData";
import { fitNodeCurve } from "./plannerCurve";
import { addDays, median } from "./plannerStats";

/** 최근 R = asOf까지 windowDays일, 기준 B = 그 직전 windowDays일. 7일 배수라 요일 구성이 같다. */
export function diagnosisWindows(asOf, windowDays) {
  const rFrom = addDays(asOf, -(windowDays - 1));
  const bTo = addDays(rFrom, -1);
  return { B: { from: addDays(bTo, -(windowDays - 1)), to: bTo }, R: { from: rFrom, to: asOf } };
}

function funnelParts(totB, totR) {
  const ok = totB.hasFunnel && totR.hasFunnel && totB.impressions > 0 && totR.impressions > 0 && totB.clicks > 0 && totR.clicks > 0;
  if (!ok) return null;
  const cpm = (t) => t.cost / t.impressions;
  const ctr = (t) => t.clicks / t.impressions;
  const cvr = (t) => t.result / t.clicks;
  // CPR = CPM/1000 ÷ (CTR × CVR) 항등식이라 세 항의 합이 Δln CPR과 정확히 같다.
  return { cpm: Math.log(cpm(totR) / cpm(totB)), ctr: -Math.log(ctr(totR) / ctr(totB)), cvr: -Math.log(cvr(totR) / cvr(totB)) };
}

function budgetChanged(days, windows, totB, totR, windowDays, pct) {
  const cB = totB.cost / windowDays;
  const cR = totR.cost / windowDays;
  if (cB > 0 && Math.abs(cR / cB - 1) >= pct) return true;
  const budgets = (from, to) => [...days].filter(([date, day]) => date >= from && date <= to && day.budget != null).map(([, day]) => day.budget);
  const bB = median(budgets(windows.B.from, windows.B.to));
  const bR = median(budgets(windows.R.from, windows.R.to));
  return bB != null && bR != null && bB > 0 && Math.abs(bR / bB - 1) >= pct;
}

/**
 * 노드 하나의 변화를 잰다(판정은 classifyNodeChange).
 * @param {{days:Map}} node
 * @param {object} cfg 노드 실효 config
 * @param {{windows, parent?, exclude?, creativeEntries?:object[]}} opts
 */
export function measureNodeChange(node, cfg, { windows, parent, exclude, creativeEntries = [], trendType }) {
  const { windowDays } = cfg.events;
  const totB = sumDays(node.days, windows.B.from, windows.B.to);
  const totR = sumDays(node.days, windows.R.from, windows.R.to);
  if (!(totB.result > 0) || !(totR.result > 0) || !(totB.cost > 0) || !(totR.cost > 0)) {
    return { identified: false, reason: "no_results_in_window", totB, totR };
  }
  const cprB = totB.cost / totB.result;
  const cprR = totR.cost / totR.result;
  const total = Math.log(cprR / cprB);
  const cB = totB.cost / windowDays;
  const cR = totR.cost / windowDays;

  // 곡선은 B까지만 학습한다 — R의 이동이 곡선에 흡수되면 "곡선 이동"이 0으로 보인다.
  const curve = fitNodeCurve(node.days, cfg, { to: windows.B.to, exclude, parent, trendType });
  let budget = null;
  let extrapolated = false;
  let sigmaPeriod = null;
  if (curve) {
    const pB = ALLOC_MATH.predictSafeCpr(curve.wrapper, cB);
    const pR = ALLOC_MATH.predictSafeCpr(curve.wrapper, cR);
    if (pB > 0 && pR > 0) budget = Math.log(pR / pB);
    const tol = cfg.conformity.extrapolationTol;
    extrapolated = cR > curve.observed.xMax * (1 + tol) || cR < curve.observed.xMin * (1 - tol);
    const nB = [...node.days].filter(([date, day]) => date >= windows.B.from && date <= windows.B.to && day.result > 0).length;
    const nR = [...node.days].filter(([date, day]) => date >= windows.R.from && date <= windows.R.to && day.result > 0).length;
    if (nB && nR) sigmaPeriod = curve.sigma * Math.sqrt(1 / nB + 1 / nR);
  }

  const { minCreativeShare } = cfg.events;
  const creativeEvents = creativeEntries.filter((entry) => {
    const launched = !entry.unknownAge && entry.launch >= windows.B.from && entry.launch <= windows.R.to && entry.share >= minCreativeShare;
    const removed = entry.ended && entry.lastSpend >= windows.B.from && entry.lastSpend <= windows.R.to && entry.share >= minCreativeShare;
    return launched || removed;
  }).map((entry) => ({ creativeId: entry.creativeId, launch: entry.launch, ended: entry.ended, lastSpend: entry.lastSpend }));

  return {
    identified: true,
    totB,
    totR,
    cprB,
    cprR,
    cB,
    cR,
    total,
    budget,
    shift: budget == null ? null : total - budget,
    curveFactor: budget == null ? null : Math.exp(budget),
    extrapolated,
    sigmaPeriod,
    funnel: funnelParts(totB, totR),
    events: {
      budget: budgetChanged(node.days, windows, totB, totR, windowDays, cfg.events.budgetChangePct),
      creatives: creativeEvents,
    },
  };
}

/**
 * 시장 공통분: 이벤트가 없던 대조 노드들의 곡선 이동 중앙값.
 * @returns {Map<string, {market:number|null, controls:string[]}>}
 */
export function marketShifts(nodes, measures, cfg) {
  const out = new Map();
  for (const [key, node] of nodes) {
    const scope = cfg.diagnosis.controlScope;
    const controls = [...nodes.keys()].filter((other) => {
      if (other === key) return false;
      const m = measures.get(other);
      if (!m?.identified || m.shift == null || m.events.budget || m.events.creatives.length) return false;
      const otherPath = nodes.get(other).path;
      if (scope === "same_country_other_channels") return otherPath.country === node.path.country && otherPath.channel !== node.path.channel;
      return true;
    });
    const enough = controls.length >= cfg.diagnosis.minControls;
    out.set(key, { market: enough ? median(controls.map((other) => measures.get(other).shift)) : null, controls });
  }
  return out;
}

// 변화와 같은 방향으로 민 몫만 "원인"으로 센다. 반대로 민 몫은 원인이 아니다.
function directionalShares(parts, sign) {
  const pushed = Object.fromEntries(Object.entries(parts).map(([key, value]) => [key, Number.isFinite(value) ? Math.max(0, value * sign) : 0]));
  const total = Object.values(pushed).reduce((a, b) => a + b, 0);
  return Object.fromEntries(Object.entries(pushed).map(([key, value]) => [key, total > 0 ? value / total : 0]));
}

const CREATIVE_RATE_STATES = new Set(["LOSER", "LEARNING", "RAMPING"]);

/** PVM 그룹 안에서 곡선 이동 중 소재 몫과 신규 소재 학습 몫. */
export function creativeEvidenceFromPvm(pvmRows, sign) {
  if (!pvmRows?.length) return null;
  const parts = { creativeMix: 0, entry: 0, entryLearning: 0, exit: 0, creativeRate: 0, otherRate: 0 };
  for (const row of pvmRows) {
    parts.creativeMix += row.withinMix;
    parts.exit += row.exit;
    if (["LEARNING", "RAMPING"].includes(row.creativeState?.state)) parts.entryLearning += row.entry;
    else parts.entry += row.entry;
    const creativeDriven = row.creativeState && (row.creativeState.fatigued || CREATIVE_RATE_STATES.has(row.creativeState.state));
    if (creativeDriven) parts.creativeRate += row.creative;
    else parts.otherRate += row.creative;
  }
  const shares = directionalShares(parts, sign);
  return {
    parts,
    creativeShare: shares.creativeMix + shares.entry + shares.exit + shares.creativeRate,
    // 상태 표시가 없는 소재의 효율 변화. 판정에서 퍼널 CTR 몫만큼 소재 원인으로 더한다.
    otherRateShare: shares.otherRate,
    newLearningShare: shares.entryLearning,
  };
}

/**
 * 판정 (config diagnosis.priority 순서로 첫 규칙이 이긴다).
 * @param {object} measure measureNodeChange 결과
 * @param {{market:number|null}} market
 * @param {object|null} creative creativeEvidenceFromPvm 결과
 */
export function classifyNodeChange(measure, market, creative, cfg) {
  if (!measure?.identified) return { verdict: null, reason: measure?.reason ?? "not_measured" };
  const d = cfg.diagnosis;
  const sign = Math.sign(measure.total) || 1;
  const marketLog = market?.market ?? null;
  const budgetLog = measure.budget;
  const nodeShift = measure.shift == null ? measure.total - (marketLog ?? 0) : measure.shift - (marketLog ?? 0);
  const top = directionalShares({ budget: budgetLog ?? 0, market: marketLog ?? 0, shift: nodeShift }, sign);
  const funnelShares = measure.funnel ? directionalShares(measure.funnel, sign) : null;
  // 소재 몫 = PVM이 소재로 짚은 몫 + (표시 없는 효율 변화 × 퍼널의 CTR 몫). 소재 열이 없으면 CTR 몫만.
  const creativeShareOfShift = creative
    ? creative.creativeShare + creative.otherRateShare * (funnelShares?.ctr ?? 0)
    : funnelShares?.ctr ?? null;
  const evidence = {
    budget: budgetLog == null ? null : top.budget,
    market: marketLog == null ? null : top.market,
    creative: creativeShareOfShift == null ? null : top.shift * creativeShareOfShift,
    newLearning: creative ? top.shift * creative.newLearningShare : null,
    postClick: funnelShares ? top.shift * funnelShares.cvr : null,
    auction: funnelShares ? top.shift * funnelShares.cpm : null,
  };
  const noise = measure.sigmaPeriod != null && Math.abs(measure.total) <= d.noiseMultiple * measure.sigmaPeriod;
  const mixedEvents = measure.events.budget && measure.events.creatives.length > 0;
  const atLeast = (value, threshold) => value != null && value >= threshold;
  const rules = {
    INCONCLUSIVE: () => (noise ? "within_noise" : mixedEvents ? "budget_and_creative_changed_together" : null),
    NEW_CREATIVE_LEARNING: () => (atLeast(evidence.newLearning, d.newCreativeDominant) ? "new_creative_learning" : null),
    MARKET: () => (atLeast(evidence.market, d.marketDominant) ? "market_wide_shift" : null),
    BUDGET_CURVE: () => (atLeast(evidence.budget, d.budgetDominant) ? "moved_along_curve" : null),
    AUCTION_COST: () => (atLeast(evidence.auction, d.cpmDominant) ? "impression_cost_up" : null),
    CREATIVE: () => (atLeast(evidence.creative, d.creativeDominant) ? "creative_driven" : null),
    FUNNEL_POST_CLICK: () => (atLeast(evidence.postClick, d.cvrDominant) ? "post_click_conversion" : null),
    MIXED: () => {
      const strong = ["budget", "market", "auction", "creative", "postClick"].filter((key) => atLeast(evidence[key], d.mixedFloor));
      return strong.length >= 2 ? `mixed:${strong.join("+")}` : null;
    },
  };
  let verdict = "INCONCLUSIVE";
  let reason = "no_dominant_cause";
  for (const name of d.priority) {
    const hit = rules[name]();
    if (hit) {
      verdict = name;
      reason = hit;
      break;
    }
  }
  return {
    verdict,
    reason,
    direction: measure.total > 0 ? "worse" : measure.total < 0 ? "better" : "flat",
    components: { total: measure.total, budget: budgetLog, market: marketLog, nodeShift },
    evidence,
    extrapolated: measure.extrapolated,
    noMarketControl: marketLog == null,
  };
}
