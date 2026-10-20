// 노드 반응 곡선 (spec §4·§2 부분 풀링). 곡선 수학은 기존 ALLOC_MATH를 그대로 쓴다.
// 새로 하는 일은 ① CPR 요일 계수를 곡선 잔차에서 뽑아 걷어내는 백피팅
// ② 점이 적은 노드에 부모 곡선 모양을 "상대 지출" 기준으로 빌려 주는 것뿐이다.
import { ALLOC_MATH } from "@/utils/allocationMath";
import { fitAllocationChannel } from "@/utils/allocationModels";
import { dowFactorsFromSamples, NEUTRAL_DOW } from "./dowProfile";
import { addDays, dowOf, median, robustSigma } from "./plannerStats";

function curveOptions(cfg) {
  const { outlier, weightMode, halfLifeDays, regimeMode, regimeStart, trendType } = cfg.curve;
  return {
    outlierMethod: outlier.method,
    outlierStrength: outlier.strength,
    weightMode,
    halfLifeDays,
    regimeMode,
    regimeStart,
    trendType: trendType === "auto" ? undefined : trendType,
  };
}

/** 노드 일별 값 → 곡선 학습 점. 결과 0인 날은 CPR이 정의되지 않으므로 뺀다. */
export function curvePoints(days, { to, exclude } = {}) {
  const points = [];
  for (const [date, day] of days) {
    if (to && date > to) continue;
    if (exclude?.has(date)) continue;
    if (day.cost > 0 && day.result > 0) points.push({ x: day.cost, y: day.cost / day.result, date, dow: dowOf(date) });
  }
  return points;
}

/**
 * 부모 모형 f를 상대 지출로 옮긴 같은 계열 모형: g(x) = k · f(r · x).
 * 같은 계열로 만들어야 Poly2 꼭짓점 보호(detectPoly2Shape)가 그대로 작동한다.
 */
export function scaleModel(model, k, r) {
  const { a, b, c } = model.params || {};
  switch (model.type) {
    case "Linear": {
      const na = k * a * r, nb = k * b;
      return { type: "Linear", predict: (x) => na * x + nb, params: { a: na, b: nb } };
    }
    case "Log": {
      const na = k * a, nb = k * (a * Math.log(r) + b);
      return { type: "Log", predict: (x) => (x > 0 ? na * Math.log(x) + nb : NaN), params: { a: na, b: nb } };
    }
    case "Power": {
      const na = k * a * Math.pow(r, b);
      return { type: "Power", predict: (x) => (x > 0 ? na * Math.pow(x, b) : NaN), params: { a: na, b } };
    }
    case "Poly2": {
      const na = k * a * r * r, nb = k * b * r, nc = k * c;
      return { type: "Poly2", predict: (x) => na * x * x + nb * x + nc, params: { a: na, b: nb, c: nc } };
    }
    default:
      return null;
  }
}

function residualsOf(wrapper, points, cprDow) {
  return points.map((p) => {
    const pred = ALLOC_MATH.predictSafeCpr(wrapper, p.x);
    return pred > 0 ? { date: p.date, dow: p.dow, x: p.x, r: Math.log(p.y / cprDow[p.dow]) - Math.log(pred) } : null;
  }).filter(Boolean);
}

function sigmaOf(residuals, cfg) {
  const sigma = robustSigma(residuals.map((item) => item.r));
  return Math.max(cfg.conformity.minSigma, Number.isFinite(sigma) ? sigma : 0);
}

function fitOwn(points, cfg, parentDow) {
  const options = curveOptions(cfg);
  const lastDate = points.reduce((max, p) => (p.date > max ? p.date : max), "");
  const lookbackStart = addDays(lastDate, -(cfg.dow.lookbackWeeks * 7 - 1));
  const fitAdjusted = (factors) => fitAllocationChannel(points.map((p) => ({ x: p.x, y: p.y / factors[p.dow], date: p.date })), options);
  const residualSamples = (fit) => points.filter((p) => p.date >= lookbackStart).map((p) => {
    const pred = ALLOC_MATH.predictSafeCpr(fit, p.x);
    return { dow: p.dow, logRatio: pred > 0 ? Math.log(p.y / pred) : NaN };
  });
  let curveDow = [...NEUTRAL_DOW];
  let wrapper = fitAdjusted(curveDow);
  if (!wrapper) return null;
  let iterations = 1;
  let converged = !cfg.dow.enabled;
  // 백피팅: 곡선 → 잔차의 요일 중앙값 → 계수 → 계수를 걷어낸 점으로 다시 곡선.
  // 곡선이 설명한 "지출 탓" CPR 상승은 잔차에 남지 않으므로 계수에는 "그 요일이라서" 생긴 몫만 남는다.
  // 반복 중에는 수축하지 않는다: 지출이 큰 요일과 CPR이 높은 요일이 겹칠 때 수축이 요일 효과를
  // 1 쪽으로 당기면, 남은 몫을 곡선이 대신 흡수해 예산 탄력성이 가팔라진다(실측 1.231 → 1.417).
  const unshrunk = { ...cfg.dow, shrinkK: 0 };
  while (!converged && iterations < cfg.dow.backfitMaxIterations) {
    const next = dowFactorsFromSamples(residualSamples(wrapper), unshrunk, parentDow).factors;
    const change = Math.max(...next.map((value, day) => Math.abs(Math.log(value / curveDow[day]))));
    curveDow = next;
    const refit = fitAdjusted(curveDow);
    if (!refit) return null;
    wrapper = refit;
    iterations += 1;
    converged = change < cfg.dow.backfitTolerance;
  }
  // 수축은 예측에 쓰는 계수에만 건다(표본이 적은 요일의 잡음 방지). 곡선은 다시 맞추지 않는다.
  const cprDow = cfg.dow.enabled
    ? dowFactorsFromSamples(residualSamples(wrapper), cfg.dow, parentDow).factors
    : [...NEUTRAL_DOW];
  const residuals = residualsOf(wrapper, points, cprDow);
  return {
    source: "own",
    wrapper,
    cprDow,
    sigma: sigmaOf(residuals, cfg),
    residuals,
    n: wrapper.kept.length,
    observed: { xMin: wrapper.xMin, xMax: wrapper.xMax },
    backfit: { iterations, converged },
  };
}

function fitBorrowed(points, cfg, parent) {
  if (!parent?.wrapper || !points.length) return null;
  const parentCost = median(parent.wrapper.kept.map((p) => p.x));
  const nodeCost = median(points.map((p) => p.x));
  if (!(parentCost > 0) || !(nodeCost > 0)) return null;
  const r = parentCost / nodeCost;
  const ratios = points.map((p) => {
    const pred = ALLOC_MATH.predictSafeCpr(parent.wrapper, p.x * r);
    return pred > 0 ? p.y / parent.cprDow[p.dow] / pred : NaN;
  });
  const k = median(ratios);
  if (!(k > 0)) return null;
  const model = scaleModel(parent.wrapper.model, k, r);
  if (!model) return null;
  const wrapper = {
    model,
    kept: points.map((p) => ({ x: p.x, y: p.y / parent.cprDow[p.dow], date: p.date })),
    xMin: parent.wrapper.xMin / r,
    xMax: parent.wrapper.xMax / r,
    poly2Shape: ALLOC_MATH.detectPoly2Shape(model),
    r2: null,
    regime: null,
    outliersRemoved: 0,
    borrowed: { k, spendRatio: r },
  };
  const residuals = residualsOf(wrapper, points, parent.cprDow);
  return {
    source: "borrowed",
    wrapper,
    cprDow: parent.cprDow,
    sigma: residuals.length >= 3 ? sigmaOf(residuals, cfg) : parent.sigma,
    residuals,
    n: points.length,
    observed: { xMin: Math.min(...points.map((p) => p.x)), xMax: Math.max(...points.map((p) => p.x)) },
  };
}

/**
 * 노드 곡선. 점이 충분하면 자체 적합, 부족하면 부모 모양 차용, 둘 다 안 되면 null(판정 불가).
 * @param {Map} days 노드 일별 합계
 * @param {object} cfg 노드 실효 config
 * @param {{to?:string, exclude?:Set<string>, parent?:object, regimeMode?:string, trendType?:string}} opts
 *   trendType: 이 노드만 모형 계열을 고정한다(5-3 곡선 검증에서 사용자가 확정한 모형).
 */
export function fitNodeCurve(days, cfg, { to, exclude, parent, regimeMode, trendType } = {}) {
  const points = curvePoints(days, { to, exclude });
  const curvePatch = { ...(regimeMode ? { regimeMode } : {}), ...(trendType ? { trendType } : {}) };
  const effective = Object.keys(curvePatch).length ? { ...cfg, curve: { ...cfg.curve, ...curvePatch } } : cfg;
  const threshold = Math.max(cfg.curve.minPoints, cfg.curve.borrowParentBelow);
  if (points.length >= threshold) {
    const own = fitOwn(points, effective, parent?.cprDow ?? NEUTRAL_DOW);
    if (own) return own;
  }
  return fitBorrowed(points, cfg, parent);
}

/** 그 날 요일까지 반영한 CPR 예측. */
export function predictNodeCpr(curve, cost, dow) {
  const base = ALLOC_MATH.predictSafeCpr(curve.wrapper, cost);
  if (!(base > 0)) return null;
  return base * (dow == null ? 1 : curve.cprDow[dow]);
}
