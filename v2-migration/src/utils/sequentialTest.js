import { STATS } from "@/utils/abTestMath";

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function twoSidedPFromZ(z) {
  return 2 * (1 - STATS.normalCDF(Math.abs(z)));
}

// O'Brien–Fleming의 canonical boundary z_(1-a/2)/sqrt(t)를 같은 정보량 간격으로
// 표시한다. 독립인 반복 z-test로 다시 검정하는 도구가 아니며, 계획된 interim look의
// 보수적인 경계 안내에만 쓴다.
export function obfSequentialPlan({ alpha = 0.05, looks = 4, plannedTotal = 0 } = {}) {
  const safeAlpha = Number(alpha);
  const safeLooks = Math.floor(Number(looks));
  const safeTotal = Math.ceil(Number(plannedTotal));
  if (!(safeAlpha > 0 && safeAlpha < 1) || !(safeLooks >= 2 && safeLooks <= 12) || !(safeTotal >= 2)) return null;
  const terminalZ = STATS.normalInverse(1 - safeAlpha / 2);
  return Array.from({ length: safeLooks }, (_, index) => {
    const informationFraction = (index + 1) / safeLooks;
    const boundaryZ = terminalZ / Math.sqrt(informationFraction);
    return {
      look: index + 1,
      informationFraction,
      plannedTotal: Math.ceil(safeTotal * informationFraction),
      boundaryZ,
      nominalP: twoSidedPFromZ(boundaryZ),
    };
  });
}

export function assessObfSequentialLook({ pValue, observedTotal, alpha = 0.05, looks = 4, plannedTotal = 0 } = {}) {
  const plan = obfSequentialPlan({ alpha, looks, plannedTotal });
  const observed = Number(observedTotal);
  const p = Number(pValue);
  if (!plan || !(observed > 0) || !(p >= 0 && p <= 1)) return { state: "invalid", plan };
  const progress = clamp(observed / Number(plannedTotal), 0, 1);
  const reached = plan.filter((item) => progress >= item.informationFraction);
  if (!reached.length) return { state: "before_first_look", plan, progress, next: plan[0] };
  const current = reached.at(-1);
  const crossed = p <= current.nominalP;
  if (crossed) return { state: current.look === plan.length ? "final_boundary_crossed" : "interim_boundary_crossed", plan, progress, current };
  if (current.look === plan.length) return { state: "final_no_boundary", plan, progress, current };
  return { state: "continue", plan, progress, current, next: plan[current.look] };
}
