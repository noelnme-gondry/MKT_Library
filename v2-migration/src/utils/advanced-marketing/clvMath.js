import { _lgamma, _betai, _Z975 } from "../statPrimitives";
import { ledger } from "./transactionMath";
import {
  DAY, column, empiricalCorrelation, hessian, inverse, mean, metric, nelderMead, number,
  observationEnd, pair as P, positiveDefinite, quadratic, requireInput, result, sum, table,
} from "./commonMath";

const logAdd = (a, b) => Math.max(a, b) + Math.log1p(Math.exp(-Math.abs(a - b)));
export function bgLogLikelihood([r, alpha, a, b], { x, tx, age }) {
  const shared = _lgamma(r + x) - _lgamma(r) + r * Math.log(alpha)
    + _lgamma(a + b) + _lgamma(b + x) - _lgamma(b) - _lgamma(a + b + x);
  const alive = -(r + x) * Math.log(alpha + age);
  return shared + (x > 0 ? logAdd(alive, Math.log(a / (b + x - 1)) - (r + x) * Math.log(alpha + tx)) : alive);
}
export function bgAlive([r, alpha, a, b], { x, tx, age }) {
  if (x === 0) return 1;
  const logOdds = Math.log(a / (b + x - 1)) + (r + x) * Math.log((alpha + age) / (alpha + tx));
  return logOdds > 700 ? 0 : 1 / (1 + Math.exp(logOdds));
}
// E[min(N,K)] = sum_j P(N >= j) P(K >= j), with N negative binomial
// and K beta-geometric. This positive-term form also works at a=1 and a<1,
// where the usual closed form has cancelling singular terms.
export function bgExpected(params, history, horizon) {
  const [r, alpha, a, b] = params, { x, age } = history;
  if (horizon === 0) return 0;
  const shape = r + x, z = horizon / (alpha + age + horizon);
  const nMean = shape * horizon / (alpha + age);
  requireInput(Number.isFinite(nMean) && nMean < 10000, "prediction_range");
  let expected = 0, survival = 1;
  for (let j = 1; j <= 20000; j++) {
    const tail = _betai(j, shape, z);
    expected += survival * tail;
    // Remainder is bounded by E[(N-j)+] (beta-geometric survival <= 1).
    const remainder = Math.max(0, nMean * _betai(j, shape + 1, z) - j * _betai(j + 1, shape, z));
    if (remainder < 1e-10 * Math.max(1, expected)) return bgAlive(params, history) * expected;
    survival *= (b + x + j - 1) / (a + b + x + j - 1);
  }
  requireInput(false, "numerical_convergence");
}
export function ggLogLikelihood([p, q, v], { x, monetary }) {
  return _lgamma(p * x + q) - _lgamma(p * x) - _lgamma(q)
    + (p * x - 1) * Math.log(monetary) + p * x * Math.log(x)
    + q * Math.log(v) - (p * x + q) * Math.log(v + x * monetary);
}
export function ggExpected([p, q, v], { x, monetary }) {
  const denominator = p * x + q - 1;
  return denominator > 0 ? p * (v + x * (monetary || 0)) / denominator : null;
}
export function fitPositiveModel(logLikelihood, data, starts) {
  const objective = (logParams) => {
    // Bounds are numerical guards, not hidden regularization. Boundary fits are
    // refused below rather than presented as a successfully identified model.
    if (logParams.some((p) => p < -12 || p > 16)) return Infinity;
    const params = logParams.map(Math.exp);
    const value = -sum(data.map((row) => logLikelihood(params, row)));
    return Number.isFinite(value) ? value : Infinity;
  };
  const fits = starts.map((start) => nelderMead(objective, start.map(Math.log), { maxIterations: 2400, tolerance: 1e-8, step: 0.25 }));
  const best = fits.filter((fit) => fit.converged && fit.x.every((v) => v > -11.9 && v < 15.9))
    .sort((a, b) => a.value - b.value)[0];
  requireInput(best, "model_not_converged");
  const information = hessian(objective, best.x);
  const covariance = positiveDefinite(information) ? inverse(information) : null;
  requireInput(covariance, "unidentified_model");
  return { parameters: best.x.map(Math.exp), logParameters: best.x, covariance, negativeLogLikelihood: best.value };
}
function deltaLogVariance(fn, model) {
  const step = 1e-4;
  const gradient = model.logParameters.map((_, j) => {
    const plus = [...model.logParameters], minus = [...model.logParameters];
    plus[j] += step; minus[j] -= step;
    return (Math.log(fn(plus.map(Math.exp))) - Math.log(fn(minus.map(Math.exp)))) / (2 * step);
  });
  const value = quadratic(gradient, model.covariance);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
export function runPredictiveClv(rows, options = {}) {
  requireInput(options.historyComplete === true, "confirm_history");
  requireInput(options.noncontractual === true, "confirm_noncontractual");
  requireInput(options.independentValue === true, "confirm_value_independence");
  const cutoff = observationEnd(options.calibrationEnd), end = observationEnd(options.observationEnd);
  requireInput(end > cutoff, "invalid_holdout_period");
  const horizon = number(options.horizonDays ?? 90, "horizonDays", undefined, { min: 1, max: 730 });
  const marginRate = number(options.marginRate ?? 1, "marginRate", undefined, { min: 0, max: 1 });
  const calibration = ledger(rows, cutoff), full = ledger(rows, end);
  // BG/NBD models purchase events, not refunded-away events. Monetary values
  // must be positive; decline the model when refunds make that assumption false.
  requireInput(calibration.orders.every((order) => order.revenue > 0), "nonpositive_order_value");
  const histories = calibration.customers.map((customer) => {
    const orders = customer.orders, x = orders.length - 1;
    requireInput(orders.every((order, i) => i === 0 || order.time > orders[i - 1].time), "tied_purchase_times");
    return { customer: customer.id, x, tx: (orders.at(-1).time - customer.first) / DAY,
      age: (cutoff - customer.first) / DAY, monetary: x ? mean(orders.slice(1).map((order) => order.revenue)) : null };
  });
  requireInput(histories.length >= 30 && histories.length <= 5000, "clv_sample_size");
  requireInput(histories.every((row) => row.age > 0), "zero_customer_age");
  const repeat = histories.filter((row) => row.x > 0);
  requireInput(repeat.length >= 20, "insufficient_repeat_buyers");
  const meanAge = mean(histories.map((row) => row.age)), moneyScale = mean(repeat.map((row) => row.monetary));
  const bg = fitPositiveModel(bgLogLikelihood, histories, [[1, meanAge / 3, 1, 3], [0.5, meanAge, 0.5, 2], [2, meanAge / 2, 2, 4]]);
  // Scale currency before optimization, then undo it only in predictions.
  const gg = fitPositiveModel(ggLogLikelihood, repeat.map((row) => ({ ...row, monetary: row.monetary / moneyScale })),
    [[2, 3, 1], [5, 4, 0.5], [1, 2, 2]]);
  requireInput(gg.parameters[1] > 1, "infinite_population_value");
  const actual = new Map(full.customers.map((customer) => [customer.id, customer.orders.filter((order) => order.time > cutoff).length]));
  const holdoutDays = (end - cutoff) / DAY;
  const customerRows = histories.map((row) => {
    const scaled = { ...row, monetary: row.monetary === null ? null : row.monetary / moneyScale };
    const purchases = bgExpected(bg.parameters, row, horizon), orderValue = ggExpected(gg.parameters, scaled) * moneyScale;
    const value = purchases * orderValue * marginRate;
    const bgVariance = deltaLogVariance((params) => bgExpected(params, row, horizon), bg);
    const ggVariance = deltaLogVariance((params) => ggExpected(params, scaled), gg);
    const half = bgVariance !== null && ggVariance !== null ? _Z975 * Math.sqrt(bgVariance + ggVariance) : null;
    return { customer: row.customer, repeat: row.x, alive: bgAlive(bg.parameters, row), purchases, orderValue, value,
      low: half !== null && Number.isFinite(value * Math.exp(half)) ? value * Math.exp(-half) : null,
      high: half !== null && Number.isFinite(value * Math.exp(half)) ? value * Math.exp(half) : null,
      predictedHoldout: bgExpected(bg.parameters, row, holdoutDays), actualHoldout: actual.get(row.customer) || 0 };
  });
  const correlation = empiricalCorrelation(repeat.map((row) => row.x), repeat.map((row) => row.monetary));
  const observed = sum(customerRows.map((row) => row.actualHoldout)), predicted = sum(customerRows.map((row) => row.predictedHoldout));
  return result({
    headline: P("학습 기간으로 적합하고 이후 구매로 예측을 평가했습니다.", "Models were fitted on calibration data and evaluated on later purchases."),
    action: P("홀드아웃 오차와 빈도·객단가 관계를 확인한 뒤 예산 판단에 활용하세요. 재학습 전 평가 기준을 정하세요.",
      "Review holdout error and frequency–value dependence before using the forecast for budgets. Set evaluation rules before refitting."),
    metrics: [metric("customers", P("학습 고객", "Calibration customers"), histories.length, "integer"),
      metric("mae", P("홀드아웃 구매 건수 MAE", "Holdout purchase-count MAE"), mean(customerRows.map((row) => Math.abs(row.actualHoldout - row.predictedHoldout)))),
      metric("predicted", P("홀드아웃 예상 구매", "Predicted holdout purchases"), predicted),
      metric("actual", P("홀드아웃 실제 구매", "Actual holdout purchases"), observed, "integer")],
    tables: [table("customers", P("지정 기간의 고객 가치 예측", "Customer value over the selected horizon"), [
      column("customer", P("고객", "Customer"), "text"), column("repeat", P("학습 재구매", "Calibration repeat purchases"), "integer"),
      column("alive", P("모형 활동 확률", "Model probability alive"), "rate"), column("purchases", P("예상 구매 건수", "Expected purchases")),
      column("orderValue", P("예상 주문 순매출", "Expected net order value"), "money"), column("value", P("예상 공헌가치", "Expected contribution value"), "money"),
      column("low", P("평균 예측 95% 하한", "Mean prediction 95% lower"), "money"), column("high", P("평균 예측 95% 상한", "Mean prediction 95% upper"), "money"),
      column("predictedHoldout", P("홀드아웃 예측", "Holdout prediction")), column("actualHoldout", P("홀드아웃 실제", "Holdout actual"), "integer"),
    ], customerRows)],
    method: P("BG/NBD와 Gamma–Gamma 최대우도 적합. 지정 기간 예상 순매출×입력 공헌이익률이며 할인·획득비를 반영한 무한기간 CLV가 아닙니다. 구간은 모형 독립 가정하 로그 델타법의 모수 불확실성입니다.",
      "BG/NBD and Gamma–Gamma maximum likelihood. Expected net revenue over the chosen horizon times the supplied contribution rate; not infinite-horizon discounted CLV after acquisition costs. Intervals use log-delta parameter uncertainty under model independence."),
    warnings: [
      P("95% 구간은 개별 고객의 실제 구매 변동을 포함한 예측구간이 아닙니다. 미래 환불·가격·시즌 변화는 별도 검토해야 합니다.",
        "95% intervals are not predictive intervals for an individual's realized purchases. Future refunds, price changes and seasonality require separate review."),
      P("재구매 0회 고객의 활동 확률 100%는 BG/NBD의 가정에서 나오며 실제 재구매 보장이 아닙니다.",
        "Probability alive of 100% for zero-repeat buyers follows the BG/NBD assumption and does not guarantee another purchase."),
      ...(correlation !== null && Math.abs(correlation) >= 0.3 ? [P("구매 빈도와 평균 주문금액의 상관이 커서 독립 가정을 재검토해야 합니다.",
        "Frequency and average order value are substantially correlated; revisit the independence assumption.")] : []),
    ],
    diagnostics: { currency: calibration.currency, bg, gg, moneyScale, frequencyValueCorrelation: correlation,
      calibrationEnd: options.calibrationEnd, observationEnd: options.observationEnd, horizonDays: horizon, marginRate },
    figure: { kind: "scatter", tableId: "customers", label: "actualHoldout", value: "predictedHoldout" },
  });
}
