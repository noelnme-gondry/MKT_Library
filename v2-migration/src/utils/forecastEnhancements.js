// 미래 예측 탭의 검증·시나리오·불확실성 표시를 위한 결정론적 순수 함수.
// 브라우저 메모리에서만 동작하며, 관측 예측과 인과효과를 구분하는 메타데이터를 함께 만든다.

function finite(value) {
  return Number.isFinite(Number(value));
}

export function forecastWmape(actual = [], predicted = []) {
  const pairs = actual.map((value, index) => [Number(value), Number(predicted[index])])
    .filter(([value, prediction]) => finite(value) && finite(prediction));
  const denominator = pairs.reduce((sum, [value]) => sum + Math.abs(value), 0);
  return denominator > 0
    ? pairs.reduce((sum, [value, prediction]) => sum + Math.abs(value - prediction), 0) / denominator * 100
    : null;
}

export function forecastRmse(actual = [], predicted = []) {
  const pairs = actual.map((value, index) => [Number(value), Number(predicted[index])])
    .filter(([value, prediction]) => finite(value) && finite(prediction));
  return pairs.length
    ? Math.sqrt(pairs.reduce((sum, [value, prediction]) => sum + (value - prediction) ** 2, 0) / pairs.length)
    : null;
}

export function forecastMae(actual = [], predicted = []) {
  const pairs = actual.map((value, index) => [Number(value), Number(predicted[index])])
    .filter(([value, prediction]) => finite(value) && finite(prediction));
  return pairs.length ? pairs.reduce((sum, [value, prediction]) => sum + Math.abs(value - prediction), 0) / pairs.length : null;
}

export function forecastResidualAcf(residual = [], lag = 1) {
  const values = residual.map(Number).filter(Number.isFinite);
  if (values.length <= lag + 1) return null;
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  const denominator = values.reduce((sum, value) => sum + (value - mean) ** 2, 0);
  if (!(denominator > 0)) return 0;
  return values.slice(lag).reduce((sum, value, index) => sum + (value - mean) * (values[index] - mean), 0) / denominator;
}

export function forecastResidualDiagnostics(actual = [], predicted = []) {
  const residual = actual.map((value, index) => Number(value) - Number(predicted[index]));
  const valid = residual.filter(Number.isFinite);
  const mean = valid.length ? valid.reduce((sum, value) => sum + value, 0) / valid.length : null;
  const sd = valid.length ? Math.sqrt(valid.reduce((sum, value) => sum + (value - mean) ** 2, 0) / Math.max(1, valid.length - 1)) : null;
  const first = valid.slice(0, Math.floor(valid.length / 2));
  const last = valid.slice(Math.floor(valid.length / 2));
  const meanOf = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
  return {
    n: valid.length,
    mean,
    sd,
    acf1: forecastResidualAcf(valid, 1),
    acf4: forecastResidualAcf(valid, 4),
    firstMean: meanOf(first),
    lastMean: meanOf(last),
    drift: first.length && last.length ? meanOf(last) - meanOf(first) : null,
    heteroscedastic: first.length > 2 && last.length > 2
      ? Math.abs((Math.abs(first.reduce((sum, value) => sum + value, 0) / first.length) || 0)
        - (Math.abs(last.reduce((sum, value) => sum + value, 0) / last.length) || 0)) > (sd || 1) * 0.25
      : false,
  };
}

export function forecastIntervalCalibration(actual = [], lower = [], upper = [], level = 0.9) {
  const rows = actual.map((value, index) => [Number(value), Number(lower[index]), Number(upper[index])])
    .filter(([value, lo, hi]) => finite(value) && finite(lo) && finite(hi));
  const coverage = rows.length ? rows.filter(([value, lo, hi]) => value >= lo && value <= hi).length / rows.length : null;
  const expected = Number(level) || 0.9;
  return {
    n: rows.length,
    coverage,
    expected,
    gap: coverage == null ? null : coverage - expected,
    calibrated: coverage != null && Math.abs(coverage - expected) <= 0.1,
  };
}

export function splitForecastIntervals(predicted = [], lower = [], upper = [], parameterFraction = 0.55) {
  const fraction = Math.min(0.8, Math.max(0.25, Number(parameterFraction) || 0.55));
  return predicted.map((value, index) => {
    const mean = Number(value);
    const lo = Number(lower[index]);
    const hi = Number(upper[index]);
    if (![mean, lo, hi].every(Number.isFinite)) return { mean, parameterLo: null, parameterHi: null, predictiveLo: null, predictiveHi: null };
    const half = Math.max(0, Math.max(mean - lo, hi - mean));
    return {
      mean,
      parameterLo: mean - half * fraction,
      parameterHi: mean + half * fraction,
      predictiveLo: lo,
      predictiveHi: hi,
    };
  });
}

export function clampForecastBudget(value, { min = 0, max = Infinity } = {}) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return null;
  return Math.min(Math.max(numeric, Math.max(0, Number(min) || 0)), Number.isFinite(Number(max)) ? Math.max(Number(min) || 0, Number(max)) : Infinity);
}

export function buildForecastScenarioDefinitions({ baseline = {}, recent = {}, channels = [], totalBudget = null, minBudget = 0, maxBudget = Infinity } = {}) {
  const keys = channels.map((channel) => channel.key);
  const normalize = (input = {}) => {
    const values = Object.fromEntries(keys.map((key) => [key, clampForecastBudget(input[key] ?? recent[key] ?? 0, { min: minBudget, max: maxBudget }) || 0]));
    if (Number.isFinite(Number(totalBudget)) && keys.length) {
      const current = Object.values(values).reduce((sum, value) => sum + value, 0);
      if (current > 0) keys.forEach((key) => { values[key] *= Number(totalBudget) / current; });
    }
    return values;
  };
  const base = normalize(baseline);
  return [
    { key: "baseline", label: "Baseline", budgets: base, delta: 0 },
    { key: "media-off", label: "Media off", budgets: Object.fromEntries(keys.map((key) => [key, 0])), delta: -100 },
    { key: "plus-10", label: "+10% all media", budgets: normalize(Object.fromEntries(keys.map((key) => [key, (base[key] || 0) * 1.1]))), delta: 10 },
    { key: "minus-10", label: "-10% all media", budgets: normalize(Object.fromEntries(keys.map((key) => [key, (base[key] || 0) * 0.9]))), delta: -10 },
  ];
}

export function summarizeForecastScenario(key, forecast, baselineForecast = null) {
  const values = forecast?.predFut || [];
  const average = values.length ? values.reduce((sum, value) => sum + Number(value || 0), 0) / values.length : null;
  const baseline = baselineForecast?.predFut || [];
  const baselineAverage = baseline.length ? baseline.reduce((sum, value) => sum + Number(value || 0), 0) / baseline.length : null;
  return {
    key,
    average,
    total: values.reduce((sum, value) => sum + Number(value || 0), 0),
    deltaFromBaseline: average != null && baselineAverage != null ? average - baselineAverage : null,
    percentFromBaseline: average != null && baselineAverage ? (average / baselineAverage - 1) * 100 : null,
  };
}

export function buildForecastProvenance({ target, horizon, selection, assumptions = {}, validation = null, model = "empirical-bayes-mmm" } = {}) {
  return {
    model,
    target,
    horizon,
    selection: selection ? {
      window: selection.window,
      spec: selection.spec,
      folds: selection.folds,
      wmape: selection.wmape,
      persistenceWmape: selection.persistenceWmape,
    } : null,
    assumptions,
    validation,
    causalInterpretation: "observational-forecast-not-incrementality-proof",
  };
}
