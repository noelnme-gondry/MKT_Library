// 범위 적합성 (spec §5): 최근 소진이 과거 cost–CPR 곡선·관측 범위를 따르는가.
// 최근 창을 학습에 넣으면 자기 자신과 비교하게 되므로 곡선은 그 이전 구간으로만 적합한다.
import { fitNodeCurve, predictNodeCpr } from "./plannerCurve";
import { addDays, dowOf, median } from "./plannerStats";

/**
 * @param {{days: Map}} node 노드 일별 합계
 * @param {object} cfg 노드 실효 config
 * @param {{asOf:string, parent?:object, learningDates?:Set<string>, exclude?:Set<string>}} opts
 */
export function assessConformity(node, cfg, { asOf, parent, learningDates, exclude } = {}) {
  const { recentDays, zBand, breachShare, medianShift, extrapolationTol } = cfg.conformity;
  const recentStart = addDays(asOf, -(recentDays - 1));
  const trainEnd = addDays(recentStart, -1);
  const recentDates = [...node.days.keys()].filter((date) => date >= recentStart && date <= asOf);

  const learningInWindow = recentDates.filter((date) => learningDates?.has(date));
  if (learningInWindow.length) {
    return { state: "LEARNING_TRANSITION", reason: "new_creative_learning", learningDays: learningInWindow.length, recentStart };
  }

  const curve = fitNodeCurve(node.days, cfg, { to: trainEnd, exclude, parent });
  if (!curve) return { state: "INSUFFICIENT", reason: "too_few_history_points", recentStart };

  const recent = recentDates.map((date) => ({ date, ...node.days.get(date) })).filter((day) => day.cost > 0 && day.result > 0);
  if (!recent.length) return { state: "INSUFFICIENT", reason: "no_recent_results", recentStart, curve };

  const residuals = recent.map((day) => {
    const pred = predictNodeCpr(curve, day.cost, dowOf(day.date));
    return pred > 0 ? Math.log(day.cost / day.result / pred) : NaN;
  }).filter(Number.isFinite);
  const recentMedianCost = median(recent.map((day) => day.cost));
  const { xMin, xMax } = curve.observed;
  const base = { recentStart, curve, recentMedianCost, xMin, xMax, sigma: curve.sigma, n: residuals.length };

  if (recentMedianCost > xMax * (1 + extrapolationTol)) return { ...base, state: "EXTRAPOLATING", direction: "above" };
  if (recentMedianCost < xMin * (1 - extrapolationTol)) return { ...base, state: "EXTRAPOLATING", direction: "below" };
  if (!residuals.length) return { ...base, state: "INSUFFICIENT", reason: "unpredictable_recent_days" };

  const medianResidual = median(residuals);
  const breaches = residuals.filter((r) => Math.abs(r / curve.sigma) > zBand && Math.sign(r) === Math.sign(medianResidual));
  const share = breaches.length / residuals.length;
  const out = { ...base, medianResidual, breachShare: share };
  // 양의 잔차 = 같은 지출에서 CPR이 곡선보다 높다 = 나빠졌다.
  if (share >= breachShare && Math.abs(medianResidual) >= medianShift) {
    return { ...out, state: medianResidual > 0 ? "DRIFT_WORSE" : "DRIFT_BETTER" };
  }
  return { ...out, state: "IN_RANGE" };
}
