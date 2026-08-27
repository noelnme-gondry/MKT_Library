import { STATS } from "@/utils/abTestMath";

function clamp(value, low, high) {
  return Math.min(high, Math.max(low, value));
}

function twoSidedPFromZ(z) {
  return 2 * (1 - STATS.normalCDF(Math.abs(z)));
}

const OBF_GRID_POINTS = 241;
const OBF_ROOT_STEPS = 24;
const OBF_CACHE_LIMIT = 48;
const boundaryCache = new Map();
// UI가 제공하는 3개 α × 5개 판독 조합은 아래와 같은 독립 적분·이분탐색으로
// 미리 산출했다. 렌더 중 241² 격자 적분을 처음 실행하는 비용만 없애며,
// 다른 프로그래밍 입력은 같은 결정론적 solver로 계산한다.
const OBF_PRECOMPUTED = new Map([
  ["0.1:2", 1.67798847950222], ["0.1:3", 1.70965047883283],
  ["0.1:4", 1.73315300926278], ["0.1:5", 1.75092718260288],
  ["0.1:6", 1.76496073287176], ["0.05:2", 1.97748342699337],
  ["0.05:3", 2.00409844397134], ["0.05:4", 2.02436900689869],
  ["0.05:5", 2.04015688153614], ["0.05:6", 2.05288652451314],
  ["0.01:2", 2.57967302944277], ["0.01:3", 2.59503572036123],
  ["0.01:4", 2.60922611982551], ["0.01:5", 2.62131349596723],
  ["0.01:6", 2.6315210836695],
]);

function normalPdf(value, standardDeviation) {
  const scaled = value / standardDeviation;
  return Math.exp(-0.5 * scaled * scaled) / (Math.sqrt(2 * Math.PI) * standardDeviation);
}

// 등간격 정보 시점에서 표준 브라운 운동 S(t)가 ±constant 경계를 한 번이라도
// 넘을 확률을 결정론적 격자 적분으로 구한다. 각 단계의 생존 밀도를 다음 정규
// 증분과 합성하므로 독립 z-test로 오인하지 않는다.
export function obfFamilywiseAlpha(constant, looks, gridPoints = OBF_GRID_POINTS) {
  const c = Number(constant);
  const k = Math.floor(Number(looks));
  const points = Math.max(81, Math.floor(Number(gridPoints)) | 1);
  if (!(c > 0) || !(k >= 2 && k <= 12)) return NaN;
  const step = (2 * c) / (points - 1);
  const incrementSd = Math.sqrt(1 / k);
  let density = new Float64Array(points);
  for (let index = 0; index < points; index += 1) {
    density[index] = normalPdf(-c + index * step, incrementSd);
  }
  for (let look = 2; look <= k; look += 1) {
    const next = new Float64Array(points);
    for (let targetIndex = 0; targetIndex < points; targetIndex += 1) {
      const target = -c + targetIndex * step;
      let integral = 0;
      for (let sourceIndex = 0; sourceIndex < points; sourceIndex += 1) {
        const source = -c + sourceIndex * step;
        const weight = sourceIndex === 0 || sourceIndex === points - 1 ? 0.5 : 1;
        integral += weight * density[sourceIndex] * normalPdf(target - source, incrementSd);
      }
      next[targetIndex] = integral * step;
    }
    density = next;
  }
  let survival = 0;
  for (let index = 0; index < points; index += 1) {
    survival += (index === 0 || index === points - 1 ? 0.5 : 1) * density[index];
  }
  return clamp(1 - survival * step, 0, 1);
}

export function obfBoundaryConstant(alpha, looks) {
  const safeAlpha = Number(alpha);
  const safeLooks = Math.floor(Number(looks));
  if (!(safeAlpha > 0 && safeAlpha < 1) || !(safeLooks >= 2 && safeLooks <= 12)) return NaN;
  const precomputed = OBF_PRECOMPUTED.get(`${safeAlpha}:${safeLooks}`);
  if (precomputed != null) return precomputed;
  const cacheKey = `${safeAlpha.toPrecision(12)}:${safeLooks}`;
  if (boundaryCache.has(cacheKey)) return boundaryCache.get(cacheKey);
  let low = STATS.normalInverse(1 - safeAlpha / 2);
  let high = STATS.normalInverse(1 - safeAlpha / (2 * safeLooks));
  for (let step = 0; step < OBF_ROOT_STEPS; step += 1) {
    const midpoint = (low + high) / 2;
    if (obfFamilywiseAlpha(midpoint, safeLooks) > safeAlpha) low = midpoint;
    else high = midpoint;
  }
  const result = (low + high) / 2;
  if (boundaryCache.size >= OBF_CACHE_LIMIT) boundaryCache.delete(boundaryCache.keys().next().value);
  boundaryCache.set(cacheKey, result);
  return result;
}

// O'Brien–Fleming의 canonical boundary c_K/sqrt(t)를 같은 정보량 간격으로
// 표시한다. c_K는 계획한 모든 판독의 상관을 포함한 전체 양측 α가 입력값과
// 같아지도록 위 생존확률 적분으로 푼다.
export function obfSequentialPlan({ alpha = 0.05, looks = 4, plannedTotal = 0 } = {}) {
  const safeAlpha = Number(alpha);
  const safeLooks = Math.floor(Number(looks));
  const safeTotal = Math.ceil(Number(plannedTotal));
  if (!(safeAlpha > 0 && safeAlpha < 1) || !(safeLooks >= 2 && safeLooks <= 12) || !(safeTotal >= 2)) return null;
  const boundaryConstant = obfBoundaryConstant(safeAlpha, safeLooks);
  return Array.from({ length: safeLooks }, (_, index) => {
    const informationFraction = (index + 1) / safeLooks;
    const boundaryZ = boundaryConstant / Math.sqrt(informationFraction);
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
