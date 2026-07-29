import { ALLOC_MATH } from "./allocationMath.js";

const DAY_MS = 86400000;
const LOOKBACK_WEEKS = [26, 52, 78];
const MIN_TRAIN_WEEKS = Math.min(...LOOKBACK_WEEKS);
const MIN_SELECTION_FOLDS = 3;
const MIN_CERTIFICATION_FOLDS = 3;
const MIN_INTERVAL_FOLDS = 8;
const PANEL_CACHE = new WeakMap();

const ORGANIC_SPECS = [
  { id: "endpoint-4-yoy10", kind: "endpoint", window: 4, seasonWeight: 0.1 },
  { id: "flat-lookback", kind: "flat", window: "lookback", seasonWeight: 0 },
  { id: "holt-lookback-phi80", kind: "holt", window: "lookback", alpha: 0.6, beta: 0.2, phi: 0.8, seasonWeight: 0 },
  { id: "holt-lookback-phi90-yoy15", kind: "holt", window: "lookback", alpha: 0.6, beta: 0.15, phi: 0.9, seasonWeight: 0.15 },
];

const PAID_SPECS = [
  { id: "rate-03", kind: "rate", alpha: 0.3 },
  { id: "rate-06", kind: "rate", alpha: 0.6 },
  { id: "rate-09", kind: "rate", alpha: 0.9 },
  { id: "saturation-52", kind: "saturation", window: 52, adstock: 0 },
  { id: "saturation-52-ad03", kind: "saturation", window: 52, adstock: 0.3 },
];

const COST_SPECS = [
  { id: "cost-mean8", kind: "mean", window: 8 },
  { id: "cost-mean-lookback", kind: "mean", window: "lookback" },
  { id: "cost-holt-lookback", kind: "holt", window: "lookback", alpha: 0.6, beta: 0.2, phi: 0.8 },
];

const STEP_POLICIES = ["none", "reset", "level"];

const MODEL_SPECS = LOOKBACK_WEEKS.flatMap((trainingWindow) =>
  ORGANIC_SPECS.flatMap((organic) =>
    PAID_SPECS.flatMap((paid) =>
      COST_SPECS.flatMap((cost) =>
        STEP_POLICIES.map((stepPolicy) => ({
          id: `lb${trainingWindow}__${organic.id}__${paid.id}__${cost.id}__step-${stepPolicy}`,
          trainingWindow,
          organic,
          paid,
          cost,
          stepPolicy,
        })),
      ),
    ),
  ),
);

function isoDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function quantile(values, probability) {
  const sorted = values.filter(Number.isFinite).sort((left, right) => left - right);
  if (!sorted.length) return 0;
  return sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * probability) - 1))];
}

function wmapeParts(actual, predicted) {
  if (actual.length !== predicted.length) return null;
  const denominator = actual.reduce((sum, value) => sum + Math.abs(value), 0);
  if (!(denominator > 0)) return null;
  const absoluteErrors = actual.map((value, index) => Math.abs(value - predicted[index]));
  return {
    wmape: absoluteErrors.reduce((sum, value) => sum + value, 0) / denominator * 100,
    absoluteError: absoluteErrors.reduce((sum, value) => sum + value, 0),
    denominator,
    absoluteErrors,
  };
}

function panelFor(dataset, platform = "total") {
  let cached = PANEL_CACHE.get(dataset);
  if (!cached) {
    cached = new Map();
    PANEL_CACHE.set(dataset, cached);
  }
  if (cached.has(platform)) return cached.get(platform);
  const records = platform === "total"
    ? dataset.records
    : dataset.records.filter((record) => record.platform === platform);
  const channels = [...new Set(records.filter((record) => !record.organic).map((record) => record.channel))].sort((a, b) => a.localeCompare(b));
  const byWeek = new Map(dataset.weeks.map((week) => [week, {
    total: 0,
    organic: 0,
    costs: Object.fromEntries(channels.map((channel) => [channel, 0])),
  }]));
  records.forEach((record) => {
    const item = byWeek.get(record.week);
    if (!item) return;
    item.total += record.outcome;
    if (record.organic) item.organic += record.outcome;
    else item.costs[record.channel] = (item.costs[record.channel] || 0) + record.cost;
  });
  const rows = dataset.weeks.map((week) => byWeek.get(week));
  const relevantEvents = (dataset.events || []).filter((event) =>
    platform === "total" || event.platform === platform || event.platform === "total",
  );
  const eventSeries = {};
  relevantEvents.forEach((event) => {
    const key = platform === "total" && event.platform !== "total" ? `${event.platform}::${event.key}` : event.key;
    if (!eventSeries[key]) eventSeries[key] = Array(dataset.weeks.length).fill(0);
    const index = dataset.weeks.indexOf(event.week);
    if (index >= 0 && Math.abs(event.value) > Math.abs(eventSeries[key][index])) eventSeries[key][index] = event.value;
  });
  const eventBoundaries = [...new Set(Object.values(eventSeries).flatMap((values) =>
    values.flatMap((value, index) => value !== 0 && (index === 0 || values[index - 1] === 0) ? [index] : []),
  ))].sort((left, right) => left - right);
  const panel = {
    platform,
    weeks: dataset.weeks,
    channels,
    total: rows.map((row) => row.total),
    organic: rows.map((row) => row.organic),
    paid: rows.map((row) => Math.max(0, row.total - row.organic)),
    costs: rows.map((row) => channels.map((channel) => row.costs[channel] || 0)),
    eventSeries,
    eventBoundaries,
  };
  cached.set(platform, panel);
  return panel;
}

function holtLogForecast(values, horizon, spec) {
  const sample = values.slice(-Math.min(spec.window, values.length)).map((value) => Math.log1p(Math.max(0, value)));
  if (sample.length < 3) return null;
  let level = sample[0];
  let trend = sample[1] - sample[0];
  for (let index = 1; index < sample.length; index++) {
    const previousLevel = level;
    level = spec.alpha * sample[index] + (1 - spec.alpha) * (level + spec.phi * trend);
    trend = spec.beta * (level - previousLevel) + (1 - spec.beta) * spec.phi * trend;
  }
  let accumulatedTrend = 0;
  return Array.from({ length: horizon }, (_, index) => {
    accumulatedTrend += spec.phi ** (index + 1);
    return Math.max(0, Math.expm1(level + accumulatedTrend * trend));
  });
}

function linearEndpoint(values) {
  if (!values.length) return null;
  if (values.length === 1) return Math.max(0, values[0]);
  const xMean = (values.length - 1) / 2;
  const yMean = mean(values);
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - xMean) * (value - yMean);
    denominator += (index - xMean) ** 2;
  });
  const slope = denominator > 0 ? numerator / denominator : 0;
  return Math.max(0, yMean + slope * ((values.length - 1) - xMean));
}

function organicForecast(panel, trainEnd, horizon, spec, trainingWindow) {
  const historyStart = Math.max(0, trainEnd - trainingWindow);
  const history = panel.organic.slice(historyStart, trainEnd);
  const window = spec.window === "lookback" ? trainingWindow : spec.window;
  const resolvedSpec = { ...spec, window };
  let forecast;
  if (spec.kind === "flat") {
    const level = mean(history.slice(-Math.min(window, history.length)));
    forecast = Number.isFinite(level) ? Array(horizon).fill(Math.max(0, level)) : null;
  } else if (spec.kind === "endpoint") {
    const level = linearEndpoint(history.slice(-Math.min(window, history.length)));
    forecast = Number.isFinite(level) ? Array(horizon).fill(level) : null;
  } else {
    forecast = holtLogForecast(history, horizon, resolvedSpec);
  }
  if (!forecast || !(spec.seasonWeight > 0) || trainingWindow < 56 || trainEnd < 56) return forecast;
  const yearlyBase = panel.organic.slice(trainEnd - 52, trainEnd - 52 + horizon);
  const currentMean = mean(panel.organic.slice(trainEnd - 4, trainEnd));
  const priorMean = mean(panel.organic.slice(trainEnd - 56, trainEnd - 52));
  const ratio = priorMean > 0 ? currentMean / priorMean : 1;
  return forecast.map((value, index) => {
    const yearly = Math.max(0, (yearlyBase[index] || 0) * ratio);
    return Math.max(0, value * (1 - spec.seasonWeight) + yearly * spec.seasonWeight);
  });
}

function forecastCostColumn(values, trainEnd, horizon, spec, trainingWindow) {
  const history = values.slice(Math.max(0, trainEnd - trainingWindow), trainEnd);
  const window = spec.window === "lookback" ? trainingWindow : spec.window;
  if (spec.kind === "holt") return holtLogForecast(history, horizon, { ...spec, window });
  const level = mean(history.slice(-Math.min(window, history.length)));
  return Number.isFinite(level) ? Array(horizon).fill(Math.max(0, level)) : null;
}

function forecastCostRows(panel, trainEnd, horizon, spec) {
  const columns = panel.channels.map((_, column) =>
    forecastCostColumn(panel.costs.map((row) => row[column]), trainEnd, horizon, spec.cost, spec.trainingWindow),
  );
  if (columns.some((column) => !column)) return null;
  return Array.from({ length: horizon }, (_, index) => columns.map((column) => column[index]));
}

function adstock(values, decay, initial = 0) {
  let carry = initial;
  return values.map((value) => {
    carry = Math.max(0, value) + decay * carry;
    return carry;
  });
}

function ratePaidForecast(panel, trainEnd, costTotals, spec, trainingWindow) {
  let level = null;
  for (let index = Math.max(0, trainEnd - trainingWindow); index < trainEnd; index++) {
    const cost = panel.costs[index].reduce((sum, value) => sum + Math.max(0, value), 0);
    const paid = Math.max(0, panel.paid[index]);
    if (!(cost > 0) || !(paid > 0)) continue;
    const rate = paid / cost;
    level = level == null ? rate : spec.alpha * rate + (1 - spec.alpha) * level;
  }
  return Number.isFinite(level) ? costTotals.map((cost) => Math.max(0, cost * level)) : null;
}

function saturationPaidForecast(panel, trainEnd, costTotals, spec, trainingWindow) {
  const historyStart = Math.max(0, trainEnd - trainingWindow);
  const rawHistory = panel.costs.slice(historyStart, trainEnd).map((row) => row.reduce((sum, value) => sum + Math.max(0, value), 0));
  const effectiveHistory = adstock(rawHistory, spec.adstock);
  const start = Math.max(0, effectiveHistory.length - spec.window);
  const points = [];
  for (let index = start; index < effectiveHistory.length; index++) {
    const cost = effectiveHistory[index];
    const paid = Math.max(0, panel.paid[historyStart + index]);
    if (cost > 0 && paid > 0) points.push([cost, cost / paid]);
  }
  if (points.length < 8) return null;
  const cleaned = ALLOC_MATH.removeOutliers(points.map(([x, y]) => ({ x, y })), "iqr", { iqrMult: 1.5 });
  const kept = cleaned?.kept?.length >= 8 ? cleaned.kept.map((point) => [point.x, point.y]) : points;
  const model = ALLOC_MATH.fitBest(kept, null);
  if (!model) return null;
  const xs = kept.map(([x]) => x);
  const xMin = Math.min(...xs);
  const xMax = Math.max(...xs);
  if (ALLOC_MATH.isDescending(model, xMin, xMax)) return null;
  const wrapper = { model, poly2Shape: ALLOC_MATH.detectPoly2Shape(model), xMax };
  const lastCarry = effectiveHistory.at(-1) || 0;
  const effectiveFuture = adstock(costTotals, spec.adstock, lastCarry);
  const capCpr = ALLOC_MATH.predictSafeCpr(wrapper, xMax);
  return effectiveFuture.map((cost) => {
    const cpr = ALLOC_MATH.predictSafeCpr(wrapper, cost);
    if (!(cpr > 0)) return NaN;
    if (cost > xMax && capCpr > 0) return Math.max(0, xMax / capCpr);
    return Math.max(0, cost / cpr);
  });
}

function paidForecast(panel, trainEnd, futureCosts, spec, trainingWindow) {
  const costTotals = futureCosts.map((row) => row.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0));
  const prediction = spec.kind === "saturation"
    ? saturationPaidForecast(panel, trainEnd, costTotals, spec, trainingWindow)
    : ratePaidForecast(panel, trainEnd, costTotals, spec, trainingWindow);
  return prediction?.every(Number.isFinite) ? prediction : null;
}

function eventAdjustedTrainingWindow(panel, trainEnd, trainingWindow, stepPolicy) {
  if (stepPolicy !== "reset") return { window: trainingWindow, boundary: null };
  const baseStart = Math.max(0, trainEnd - trainingWindow);
  const latestBoundary = panel.eventBoundaries.filter((index) => index >= baseStart && index < trainEnd).at(-1);
  if (latestBoundary == null) return { window: trainingWindow, boundary: null };
  const observedWeeks = trainEnd - latestBoundary;
  if (observedWeeks < 4) return { window: trainingWindow, boundary: null };
  return { window: Math.min(trainingWindow, observedWeeks), boundary: latestBoundary };
}

function solveLinearSystem(matrix, vector) {
  const n = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < n; column++) {
    let pivot = column;
    for (let row = column + 1; row < n; row++) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-10) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let index = column; index <= n; index++) augmented[column][index] /= divisor;
    for (let row = 0; row < n; row++) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let index = column; index <= n; index++) augmented[row][index] -= factor * augmented[column][index];
    }
  }
  return augmented.map((row) => row[n]);
}

function stepLevelAdjustment(panel, values, trainEnd, trainingWindow, stepPolicy) {
  if (stepPolicy !== "level") return { values, futureScale: 1, controls: [] };
  const start = Math.max(0, trainEnd - trainingWindow);
  const controls = Object.entries(panel.eventSeries || {}).filter(([, series]) => {
    const sample = series.slice(start, trainEnd);
    const active = sample.filter((value) => value !== 0).length;
    return active >= 4 && sample.length - active >= 4;
  });
  if (!controls.length) return { values, futureScale: 1, controls: [] };
  // 절편·완만한 시간 추세를 함께 통제해 장기 성장/하락을 Step 효과로
  // 잘못 흡수하지 않는다. Step 계수만 원계열에서 제거한다.
  const rows = [];
  const outcome = [];
  for (let index = start; index < trainEnd; index++) {
    const value = values[index];
    if (!Number.isFinite(value) || value < 0) continue;
    const trend = trainEnd - start > 1 ? (index - start) / (trainEnd - start - 1) - 0.5 : 0;
    rows.push([1, trend, ...controls.map(([, series]) => series[index] || 0)]);
    outcome.push(Math.log1p(value));
  }
  const width = 2 + controls.length;
  if (rows.length < width + 4) return { values, futureScale: 1, controls: [] };
  const xtx = Array.from({ length: width }, () => Array(width).fill(0));
  const xty = Array(width).fill(0);
  rows.forEach((row, rowIndex) => {
    row.forEach((left, i) => {
      xty[i] += left * outcome[rowIndex];
      row.forEach((right, j) => { xtx[i][j] += left * right; });
    });
  });
  // 중첩 Step(Delist 이후 + Reopen 이후)의 공선성을 안정화한다.
  for (let index = 2; index < width; index++) xtx[index][index] += 0.01;
  const coefficients = solveLinearSystem(xtx, xty);
  if (!coefficients?.every(Number.isFinite)) return { values, futureScale: 1, controls: [] };
  const stepCoefficients = coefficients.slice(2).map((value) => Math.max(-2, Math.min(2, value)));
  const scaleAt = (index) => Math.exp(stepCoefficients.reduce(
    (sum, coefficient, controlIndex) => sum + coefficient * (controls[controlIndex][1][index] || 0),
    0,
  ));
  const adjusted = values.map((value, index) => Number.isFinite(value) ? Math.max(0, value / scaleAt(index)) : value);
  return {
    values: adjusted,
    futureScale: scaleAt(Math.max(0, trainEnd - 1)),
    controls: controls.map(([key], index) => ({ key, logEffect: stepCoefficients[index] })),
  };
}

function stepAdjustedCostRows(panel, trainEnd, horizon, spec) {
  const columns = panel.channels.map((_, column) => {
    const values = panel.costs.map((row) => row[column]);
    const adjustment = stepLevelAdjustment(panel, values, trainEnd, spec.trainingWindow, spec.stepPolicy);
    const forecast = forecastCostColumn(adjustment.values, trainEnd, horizon, spec.cost, spec.trainingWindow);
    return forecast?.map((value) => Math.max(0, value * adjustment.futureScale));
  });
  if (columns.some((column) => !column)) return null;
  return Array.from({ length: horizon }, (_, index) => columns.map((column) => column[index]));
}

function fitPanel(panel, trainEnd, horizon, spec, suppliedCosts = null) {
  const eventWindow = eventAdjustedTrainingWindow(panel, trainEnd, spec.trainingWindow, spec.stepPolicy);
  const effectiveSpec = { ...spec, trainingWindow: eventWindow.window };
  const futureCosts = suppliedCosts || (spec.stepPolicy === "level"
    ? stepAdjustedCostRows(panel, trainEnd, horizon, effectiveSpec)
    : forecastCostRows(panel, trainEnd, horizon, effectiveSpec));
  if (!futureCosts || futureCosts.length !== horizon) return null;
  const organicAdjustment = stepLevelAdjustment(panel, panel.organic, trainEnd, eventWindow.window, spec.stepPolicy);
  const paidAdjustment = stepLevelAdjustment(panel, panel.paid, trainEnd, eventWindow.window, spec.stepPolicy);
  const adjustedPanel = spec.stepPolicy === "level"
    ? { ...panel, organic: organicAdjustment.values, paid: paidAdjustment.values }
    : panel;
  const organicBase = organicForecast(adjustedPanel, trainEnd, horizon, spec.organic, eventWindow.window);
  const performanceBase = paidForecast(adjustedPanel, trainEnd, futureCosts, spec.paid, eventWindow.window);
  const organic = organicBase?.map((value) => Math.max(0, value * organicAdjustment.futureScale));
  const performance = performanceBase?.map((value) => Math.max(0, value * paidAdjustment.futureScale));
  if (!organic || !performance) return null;
  return {
    organic,
    performance,
    predicted: organic.map((value, index) => value + performance[index]),
    futureCosts,
    spec,
    eventBoundary: eventWindow.boundary,
    effectiveTrainingWindow: eventWindow.window,
    stepControls: {
      organic: organicAdjustment.controls,
      performance: paidAdjustment.controls,
    },
  };
}

function sumParts(parts, horizon) {
  return {
    organic: Array.from({ length: horizon }, (_, index) => parts.reduce((sum, part) => sum + part.organic[index], 0)),
    performance: Array.from({ length: horizon }, (_, index) => parts.reduce((sum, part) => sum + part.performance[index], 0)),
    predicted: Array.from({ length: horizon }, (_, index) => parts.reduce((sum, part) => sum + part.predicted[index], 0)),
    parts,
  };
}

function routeAt(dataset, trainEnd, horizon, route, spec, suppliedByPlatform = null) {
  if (route === "direct-total") {
    return fitPanel(panelFor(dataset, "total"), trainEnd, horizon, spec, suppliedByPlatform?.total || null);
  }
  const parts = ["android", "ios"].map((platform) =>
    fitPanel(panelFor(dataset, platform), trainEnd, horizon, spec, suppliedByPlatform?.[platform] || null),
  );
  return parts.some((part) => !part) ? null : sumParts(parts, horizon);
}

function naivePanelAt(panel, trainEnd, horizon) {
  if (trainEnd < 1) return null;
  const organic = Array(horizon).fill(Math.max(0, panel.organic[trainEnd - 1] || 0));
  const performance = Array(horizon).fill(Math.max(0, panel.paid[trainEnd - 1] || 0));
  return {
    organic,
    performance,
    predicted: organic.map((value, index) => value + performance[index]),
  };
}

function naiveRouteAt(dataset, trainEnd, horizon, route) {
  if (route === "direct-total") return naivePanelAt(panelFor(dataset, "total"), trainEnd, horizon);
  const parts = ["android", "ios"].map((platform) => naivePanelAt(panelFor(dataset, platform), trainEnd, horizon));
  return parts.some((part) => !part) ? null : sumParts(parts, horizon);
}

function mixResults(model, naive, useModelByHorizon) {
  const mixed = {
    organic: useModelByHorizon.map((useModel, index) => (useModel ? model.organic[index] : naive.organic[index])),
    performance: useModelByHorizon.map((useModel, index) => (useModel ? model.performance[index] : naive.performance[index])),
  };
  mixed.predicted = mixed.organic.map((value, index) => value + mixed.performance[index]);
  if (model.parts && naive.parts) {
    mixed.parts = model.parts.map((part, index) => mixResults(part, naive.parts[index], useModelByHorizon));
  }
  if (model.futureCosts) mixed.futureCosts = model.futureCosts;
  if (model.recentCosts) mixed.recentCosts = model.recentCosts;
  if (model.panel) mixed.panel = model.panel;
  if (model.channels) mixed.channels = model.channels;
  if (model.spec) mixed.spec = model.spec;
  return mixed;
}

function actualCostRows(panel, trainEnd, horizon) {
  const rows = panel.costs.slice(trainEnd, trainEnd + horizon);
  return rows.length === horizon ? rows : null;
}

function conditionalCosts(dataset, route, trainEnd, horizon) {
  if (route === "direct-total") return { total: actualCostRows(panelFor(dataset, "total"), trainEnd, horizon) };
  return Object.fromEntries(["android", "ios"].map((platform) => [
    platform,
    actualCostRows(panelFor(dataset, platform), trainEnd, horizon),
  ]));
}

function componentError(dataset, route, result, trainEnd, horizon) {
  const series = [];
  if (route === "direct-total") {
    const panel = panelFor(dataset, "total");
    series.push(
      {
        key: "total-organic",
        actual: panel.organic.slice(trainEnd, trainEnd + horizon),
        predicted: result.organic,
      },
      {
        key: "total-paid",
        actual: panel.paid.slice(trainEnd, trainEnd + horizon),
        predicted: result.performance,
      },
    );
  } else {
    ["android", "ios"].forEach((platform, index) => {
      const panel = panelFor(dataset, platform);
      series.push(
        {
          key: `${platform}-organic`,
          actual: panel.organic.slice(trainEnd, trainEnd + horizon),
          predicted: result.parts[index].organic,
        },
        {
          key: `${platform}-paid`,
          actual: panel.paid.slice(trainEnd, trainEnd + horizon),
          predicted: result.parts[index].performance,
        },
      );
    });
  }
  let absoluteError = 0;
  let denominator = 0;
  const componentBreakdown = {};
  series.forEach(({ key, actual, predicted }) => {
    let seriesAbsoluteError = 0;
    let seriesDenominator = 0;
    actual.forEach((value, index) => {
      seriesAbsoluteError += Math.abs(value - predicted[index]);
      seriesDenominator += Math.abs(value);
    });
    absoluteError += seriesAbsoluteError;
    denominator += seriesDenominator;
    componentBreakdown[key] = {
      absoluteError: seriesAbsoluteError,
      denominator: seriesDenominator,
      wmape: seriesDenominator > 0
        ? seriesAbsoluteError / seriesDenominator * 100
        : null,
    };
  });
  const activeComponents = Object.values(componentBreakdown)
    .filter((component) => component.denominator > 0);
  return {
    componentWmape: denominator > 0 ? absoluteError / denominator * 100 : null,
    componentAbsoluteError: absoluteError,
    componentDenominator: denominator,
    componentBreakdown,
    componentEveryPassed: activeComponents.length > 0
      && activeComponents.every((component) =>
        Number.isFinite(component.wmape) && component.wmape < 10),
  };
}

function foldRegime(panel, trainEnd, horizon) {
  const summarize = (start, end) => {
    const cost = panel.costs.slice(start, end).flat().reduce((sum, value) => sum + value, 0);
    const paid = panel.paid.slice(start, end).reduce((sum, value) => sum + value, 0);
    const organic = panel.organic.slice(start, end).reduce((sum, value) => sum + value, 0);
    const weeks = Math.max(1, end - start);
    return { costPerWeek: cost / weeks, cpa: paid > 0 ? cost / paid : null, organicPerWeek: organic / weeks };
  };
  const prior = summarize(Math.max(0, trainEnd - 8), trainEnd);
  const future = summarize(trainEnd, trainEnd + horizon);
  const ratio = (current, previous) => previous > 0 && Number.isFinite(current) ? current / previous : null;
  const costRatio = ratio(future.costPerWeek, prior.costPerWeek);
  const cpaRatio = ratio(future.cpa, prior.cpa);
  const organicRatio = ratio(future.organicPerWeek, prior.organicPerWeek);
  const reasons = [];
  if (costRatio != null && (costRatio < 0.67 || costRatio > 1.5)) reasons.push("cost");
  if (cpaRatio != null && (cpaRatio < 0.7 || cpaRatio > 1.3)) reasons.push("cpa");
  if (organicRatio != null && (organicRatio < 0.7 || organicRatio > 1.3)) reasons.push("organic");
  return { isBreak: reasons.length > 0, reasons, costRatio, cpaRatio, organicRatio };
}

function evaluateSpec(dataset, route, spec, foldOffsets, holdout) {
  const totalPanel = panelFor(dataset, "total");
  const folds = [];
  for (const offset of foldOffsets) {
    const trainEnd = dataset.weeks.length - holdout - offset;
    if (trainEnd < spec.trainingWindow) continue;
    const actual = totalPanel.total.slice(trainEnd, trainEnd + holdout);
    const live = routeAt(dataset, trainEnd, holdout, route, spec);
    const conditional = routeAt(dataset, trainEnd, holdout, route, spec, conditionalCosts(dataset, route, trainEnd, holdout));
    const naiveResult = naiveRouteAt(dataset, trainEnd, holdout, route);
    if (!live || !conditional || !naiveResult || actual.length !== holdout) continue;
    const liveError = wmapeParts(actual, live.predicted);
    const conditionalError = wmapeParts(actual, conditional.predicted);
    const naive = Array(holdout).fill(totalPanel.total[trainEnd - 1]);
    const naiveError = wmapeParts(actual, naive);
    if (!liveError || !conditionalError || !naiveError) continue;
    folds.push({
      offset,
      excludedWeeks: offset + holdout,
      start: dataset.weekLabels[trainEnd],
      end: dataset.weekLabels[trainEnd + holdout - 1],
      wmape: liveError.wmape,
      conditionalWmape: conditionalError.wmape,
      naiveWmape: naiveError.wmape,
      denominator: liveError.denominator,
      absoluteError: liveError.absoluteError,
      conditionalAbsoluteError: conditionalError.absoluteError,
      naiveAbsoluteError: naiveError.absoluteError,
      actual,
      absoluteErrors: liveError.absoluteErrors,
      conditionalAbsoluteErrors: conditionalError.absoluteErrors,
      naiveAbsoluteErrors: naiveError.absoluteErrors,
      ...componentError(dataset, route, live, trainEnd, holdout),
      regime: foldRegime(totalPanel, trainEnd, holdout),
      result: live,
      conditionalResult: conditional,
      naiveResult,
    });
  }
  if (!folds.length) return null;
  return { route, spec, folds };
}

function applyHorizonGuardrail(dataset, evaluation, selectionOffsets, holdout) {
  const development = evaluation.folds.filter((fold) => selectionOffsets.has(fold.offset));
  const useModelByHorizon = Array.from({ length: holdout }, (_, index) => {
    const modelError = development.reduce((sum, fold) => sum + fold.absoluteErrors[index], 0);
    const naiveError = development.reduce((sum, fold) => sum + fold.naiveAbsoluteErrors[index], 0);
    return modelError < naiveError * 0.98;
  });
  const guardedFolds = evaluation.folds.map((fold) => {
    const trainEnd = dataset.weeks.length - holdout - fold.offset;
    const result = mixResults(fold.result, fold.naiveResult, useModelByHorizon);
    const conditionalResult = mixResults(fold.conditionalResult, fold.naiveResult, useModelByHorizon);
    const liveError = wmapeParts(fold.actual, result.predicted);
    const conditionalError = wmapeParts(fold.actual, conditionalResult.predicted);
    return {
      ...fold,
      wmape: liveError.wmape,
      conditionalWmape: conditionalError.wmape,
      absoluteError: liveError.absoluteError,
      conditionalAbsoluteError: conditionalError.absoluteError,
      absoluteErrors: liveError.absoluteErrors,
      conditionalAbsoluteErrors: conditionalError.absoluteErrors,
      ...componentError(dataset, evaluation.route, result, trainEnd, holdout),
      result,
      conditionalResult,
    };
  });
  return { ...evaluation, folds: guardedFolds, useModelByHorizon };
}

function pooled(folds, errorKey = "absoluteError", denominatorKey = "denominator") {
  const denominator = folds.reduce((sum, fold) => sum + fold[denominatorKey], 0);
  return denominator > 0 ? folds.reduce((sum, fold) => sum + fold[errorKey], 0) / denominator * 100 : null;
}

function summarizeComponentEvidence(folds) {
  const keys = [...new Set((folds || []).flatMap((fold) =>
    Object.keys(fold.componentBreakdown || {})))].sort();
  const components = keys.map((key) => {
    const observations = folds
      .map((fold) => fold.componentBreakdown?.[key])
      .filter((component) => component?.denominator > 0);
    const denominator = observations.reduce((sum, component) =>
      sum + component.denominator, 0);
    const absoluteError = observations.reduce((sum, component) =>
      sum + component.absoluteError, 0);
    const wmapeValue = denominator > 0
      ? absoluteError / denominator * 100
      : null;
    const worstWmape = observations.length
      ? Math.max(...observations.map((component) => component.wmape))
      : null;
    return {
      key,
      folds: observations.length,
      denominator,
      wmape: wmapeValue,
      worstWmape,
      passed: Number.isFinite(wmapeValue)
        && wmapeValue < 10
        && Number.isFinite(worstWmape)
        && worstWmape < 10,
    };
  }).filter((component) => component.denominator > 0);
  return {
    components,
    everyPassed: components.length > 0
      && components.every((component) => component.passed),
  };
}

function summarizeEvaluation(evaluation, selectionOffsets, holdout) {
  const folds = evaluation.folds;
  const development = folds.filter((fold) => selectionOffsets.has(fold.offset));
  const developmentComponentDenominator = development.reduce((sum, fold) => sum + fold.componentDenominator, 0);
  const componentDenominator = folds.reduce((sum, fold) => sum + fold.componentDenominator, 0);
  const horizonMetrics = Array.from({ length: holdout }, (_, index) => {
    const denominator = folds.reduce((sum, fold) => sum + Math.abs(fold.actual[index]), 0);
    const liveAe = folds.reduce((sum, fold) => sum + fold.absoluteErrors[index], 0);
    const conditionalAe = folds.reduce((sum, fold) => sum + fold.conditionalAbsoluteErrors[index], 0);
    const naiveAe = folds.reduce((sum, fold) => sum + fold.naiveAbsoluteErrors[index], 0);
    return {
      horizon: index + 1,
      wmape: denominator > 0 ? liveAe / denominator * 100 : null,
      conditionalWmape: denominator > 0 ? conditionalAe / denominator * 100 : null,
      naiveWmape: denominator > 0 ? naiveAe / denominator * 100 : null,
      mase: naiveAe > 0 ? liveAe / naiveAe : null,
      margin90: quantile(development.map((fold) => fold.absoluteErrors[index]), 0.9),
    };
  });
  return {
    ...evaluation,
    developmentPooledWmape: pooled(development),
    developmentWorstWmape: development.length
      ? Math.max(...development.map((fold) => fold.wmape))
      : null,
    developmentComponentPooledWmape: developmentComponentDenominator > 0
      ? development.reduce((sum, fold) => sum + fold.componentAbsoluteError, 0) / developmentComponentDenominator * 100
      : null,
    developmentComponentWorstWmape: development.length
      ? Math.max(...development.map((fold) => fold.componentWmape))
      : null,
    pooledWmape: pooled(folds),
    conditionalPooledWmape: pooled(folds, "conditionalAbsoluteError"),
    naivePooledWmape: pooled(folds, "naiveAbsoluteError"),
    worstWmape: Math.max(...folds.map((fold) => fold.wmape)),
    passRate: folds.filter((fold) => fold.wmape < 10).length / folds.length,
    componentPooledWmape: componentDenominator > 0
      ? folds.reduce((sum, fold) => sum + fold.componentAbsoluteError, 0) / componentDenominator * 100
      : null,
    componentWorstWmape: Math.max(...folds.map((fold) => fold.componentWmape)),
    componentPassRate: folds.filter((fold) => fold.componentWmape < 10).length / folds.length,
    horizonMetrics,
  };
}

function compareDevelopmentCandidates(left, right) {
  const finite = (value) => Number.isFinite(value) ? value : Infinity;
  return finite(left.developmentPooledWmape) - finite(right.developmentPooledWmape)
    || finite(left.developmentWorstWmape) - finite(right.developmentWorstWmape)
    || finite(left.developmentComponentPooledWmape) - finite(right.developmentComponentPooledWmape)
    || left.route.localeCompare(right.route)
    || left.spec.id.localeCompare(right.spec.id);
}

function selectDataPreservingCandidate(candidates) {
  const ranked = candidates.slice().sort(compareDevelopmentCandidates);
  const rawBest = ranked[0] || null;
  if (!rawBest) return null;
  const tolerance = Math.max(
    0.1,
    Math.max(0, Number(rawBest.developmentPooledWmape) || 0) * 0.02,
  );
  const equivalent = ranked.filter((candidate) =>
    candidate.route === rawBest.route
    && candidate.spec?.organic?.id === rawBest.spec?.organic?.id
    && candidate.spec?.paid?.id === rawBest.spec?.paid?.id
    && candidate.spec?.cost?.id === rawBest.spec?.cost?.id
    && candidate.spec?.stepPolicy === rawBest.spec?.stepPolicy
    && Number.isFinite(candidate.developmentPooledWmape)
    && candidate.developmentPooledWmape
      <= rawBest.developmentPooledWmape + tolerance
    && (
      !Number.isFinite(rawBest.developmentWorstWmape)
      || (
        Number.isFinite(candidate.developmentWorstWmape)
        && candidate.developmentWorstWmape
          <= rawBest.developmentWorstWmape + tolerance
      )
    ));
  equivalent.sort((left, right) =>
    (Number(right.spec?.trainingWindow) || 0)
      - (Number(left.spec?.trainingWindow) || 0)
    || compareDevelopmentCandidates(left, right));
  const selected = equivalent[0] || rawBest;
  return {
    ...selected,
    dataPreservation: {
      applied: selected.spec?.id !== rawBest.spec?.id
        || selected.route !== rawBest.route,
      tolerancePoints: tolerance,
      equivalentCandidates: equivalent.length,
      rawBestSpecId: rawBest.spec?.id || null,
      selectedSpecId: selected.spec?.id || null,
    },
  };
}

function selectCandidateAtOffset(dataset, evaluations, foldOffsets, offset, holdout, predicate = null) {
  const priorOffsets = foldOffsets
    .filter((candidateOffset) => candidateOffset >= offset + holdout)
    .sort((left, right) => left - right)
    .slice(0, MIN_SELECTION_FOLDS);
  if (priorOffsets.length < MIN_SELECTION_FOLDS) return null;
  const selectionOffsets = new Set(priorOffsets);
  const candidates = evaluations.map((evaluation) => {
    if (predicate && !predicate(evaluation)) return null;
    if (!evaluation.folds.some((fold) => fold.offset === offset)) return null;
    if (!priorOffsets.every((priorOffset) =>
      evaluation.folds.some((fold) => fold.offset === priorOffset),
    )) return null;
    return summarizeEvaluation(
      applyHorizonGuardrail(dataset, evaluation, selectionOffsets, holdout),
      selectionOffsets,
      holdout,
    );
  }).filter(Boolean).sort(compareDevelopmentCandidates);
  const selected = selectDataPreservingCandidate(candidates);
  const current = selected?.folds.find((fold) => fold.offset === offset) || null;
  return selected && current ? {
    offset,
    priorOffsets,
    selected,
    current: {
      ...current,
      selectedRoute: selected.route,
      selectedSpec: selected.spec,
      useModelByHorizon: selected.useModelByHorizon.slice(),
    },
    candidates,
  } : null;
}

function summarizeNestedFolds(folds, holdout) {
  const valid = (folds || []).filter((fold) => fold?.actual?.length === holdout);
  const componentDenominator = valid.reduce((sum, fold) => sum + fold.componentDenominator, 0);
  const componentEvidence = summarizeComponentEvidence(valid);
  const calibrationEligible = valid.length >= MIN_INTERVAL_FOLDS;
  const horizonMetrics = Array.from({ length: holdout }, (_, index) => {
    const denominator = valid.reduce((sum, fold) => sum + Math.abs(fold.actual[index]), 0);
    const absoluteError = valid.reduce((sum, fold) => sum + fold.absoluteErrors[index], 0);
    const conditionalAbsoluteError = valid.reduce((sum, fold) => sum + fold.conditionalAbsoluteErrors[index], 0);
    const naiveAbsoluteError = valid.reduce((sum, fold) => sum + fold.naiveAbsoluteErrors[index], 0);
    return {
      horizon: index + 1,
      wmape: denominator > 0 ? absoluteError / denominator * 100 : null,
      conditionalWmape: denominator > 0 ? conditionalAbsoluteError / denominator * 100 : null,
      naiveWmape: denominator > 0 ? naiveAbsoluteError / denominator * 100 : null,
      mase: naiveAbsoluteError > 0 ? absoluteError / naiveAbsoluteError : null,
      margin90: calibrationEligible
        ? quantile(valid.map((fold) => fold.absoluteErrors[index]), 0.9)
        : null,
    };
  });
  return {
    folds: valid,
    foldCount: valid.length,
    pooledWmape: pooled(valid),
    conditionalPooledWmape: pooled(valid, "conditionalAbsoluteError"),
    naivePooledWmape: pooled(valid, "naiveAbsoluteError"),
    worstWmape: valid.length ? Math.max(...valid.map((fold) => fold.wmape)) : null,
    passRate: valid.length ? valid.filter((fold) => fold.wmape < 10).length / valid.length : 0,
    componentPooledWmape: componentDenominator > 0
      ? valid.reduce((sum, fold) => sum + fold.componentAbsoluteError, 0) / componentDenominator * 100
      : null,
    componentWorstWmape: valid.length
      ? Math.max(...valid.map((fold) => fold.componentWmape))
      : null,
    componentPassRate: valid.length
      ? valid.filter((fold) => fold.componentWmape < 10).length / valid.length
      : 0,
    componentEvidence: componentEvidence.components,
    componentEveryPassed: componentEvidence.everyPassed,
    calibrationEligible,
    calibrationFoldCount: calibrationEligible ? valid.length : 0,
    horizonMetrics,
  };
}

function buildNestedPath(dataset, evaluations, foldOffsets, holdout, predicate = null) {
  const selections = foldOffsets.map((offset) =>
    selectCandidateAtOffset(dataset, evaluations, foldOffsets, offset, holdout, predicate),
  ).filter(Boolean);
  const folds = selections.map((selection) => selection.current);
  const latestSelection = selections.find((selection) => selection.offset === 0) || null;
  const developmentFolds = folds.filter((fold) => fold.offset >= holdout);
  return latestSelection ? {
    latestSelection,
    selections,
    folds,
    latest: latestSelection.current,
    development: summarizeNestedFolds(developmentFolds, holdout),
    all: summarizeNestedFolds(folds, holdout),
  } : null;
}

function recentAverageCosts(panel, count = 8) {
  const rows = panel.costs.slice(-Math.min(count, panel.costs.length));
  return panel.channels.map((_, column) => mean(rows.map((row) => row[column])) || 0);
}

function scenarioCostRows(panel, trainEnd, horizon, spec, budgetByKey, keyPrefix = "") {
  // A scenario with no explicit override must be byte-equivalent to the
  // estimator validated in routeAt/fitPanel. In particular, reset changes the
  // effective lookback and level removes/reapplies the mapped step from Cost.
  const eventWindow = eventAdjustedTrainingWindow(panel, trainEnd, spec.trainingWindow, spec.stepPolicy);
  const effectiveSpec = { ...spec, trainingWindow: eventWindow.window };
  const defaults = spec.stepPolicy === "level"
    ? stepAdjustedCostRows(panel, trainEnd, horizon, effectiveSpec)
    : forecastCostRows(panel, trainEnd, horizon, effectiveSpec);
  if (!defaults) return null;
  return defaults.map((row, horizonIndex) => row.map((value, column) => {
    const key = `${keyPrefix}${panel.channels[column]}`;
    const supplied = budgetByKey?.[key];
    const candidate = Array.isArray(supplied) ? supplied[horizonIndex] : supplied;
    return Number.isFinite(candidate) ? Math.max(0, candidate) : value;
  }));
}

function futureForRoute(dataset, route, horizon, spec, budgetByKey = null) {
  const trainEnd = dataset.weeks.length;
  if (route === "direct-total") {
    const panel = panelFor(dataset, "total");
    const costs = scenarioCostRows(panel, trainEnd, horizon, spec, budgetByKey);
    const result = fitPanel(panel, trainEnd, horizon, spec, costs);
    return result && {
      ...result,
      channels: panel.channels,
      recentCosts: recentAverageCosts(panel),
    };
  }
  const panels = ["android", "ios"].map((platform) => panelFor(dataset, platform));
  const parts = panels.map((panel) => {
    const costs = scenarioCostRows(panel, trainEnd, horizon, spec, budgetByKey, `${panel.platform}::`);
    const result = fitPanel(panel, trainEnd, horizon, spec, costs);
    return result && { ...result, panel, recentCosts: recentAverageCosts(panel) };
  });
  if (parts.some((part) => !part)) return null;
  return {
    ...sumParts(parts, horizon),
    channels: parts.flatMap((part) => part.panel.channels.map((channel) => `${part.panel.platform}::${channel}`)),
  };
}

function regimeDiagnostics(dataset) {
  const panel = panelFor(dataset, "total");
  const summarize = (start, end) => {
    const cost = panel.costs.slice(start, end).flat().reduce((sum, value) => sum + value, 0);
    const paid = panel.paid.slice(start, end).reduce((sum, value) => sum + value, 0);
    const organic = panel.organic.slice(start, end).reduce((sum, value) => sum + value, 0);
    const weeks = Math.max(1, end - start);
    return { costPerWeek: cost / weeks, cpa: paid > 0 ? cost / paid : null, organicPerWeek: organic / weeks };
  };
  const end = panel.weeks.length;
  const recent = summarize(Math.max(0, end - 12), end);
  const prior = summarize(Math.max(0, end - 24), Math.max(0, end - 12));
  const ratio = (current, previous) => previous > 0 && Number.isFinite(current) ? current / previous : null;
  const cpaRatio = ratio(recent.cpa, prior.cpa);
  const organicRatio = ratio(recent.organicPerWeek, prior.organicPerWeek);
  const costRatio = ratio(recent.costPerWeek, prior.costPerWeek);
  const reasons = [];
  if (costRatio != null && (costRatio < 0.67 || costRatio > 1.5)) reasons.push("cost");
  if (cpaRatio != null && (cpaRatio < 0.7 || cpaRatio > 1.3)) reasons.push("cpa");
  if (organicRatio != null && (organicRatio < 0.7 || organicRatio > 1.3)) reasons.push("organic");
  return {
    paidCpaChangePct: cpaRatio == null ? null : (cpaRatio - 1) * 100,
    organicMeanChangePct: organicRatio == null ? null : (organicRatio - 1) * 100,
    spendChangePct: costRatio == null ? null : (costRatio - 1) * 100,
    currentBreak: reasons.length > 0,
    breakReasons: reasons,
  };
}

function structuralStepDiagnostics(dataset) {
  const groups = new Map();
  (dataset.events || []).forEach((event) => {
    const groupKey = `${event.platform}::${event.key}`;
    if (!groups.has(groupKey)) {
      groups.set(groupKey, {
        key: event.key,
        label: event.label,
        platform: event.platform,
        firstActiveWeek: event.firstActiveWeek ?? event.week,
        sourceActiveWeeks: event.sourceActiveWeeks || 1,
      });
    }
  });
  return {
    mappedHeaders: dataset.eventHeaders || [],
    conflicts: dataset.eventConflicts || [],
    steps: [...groups.values()].map((step) => ({
      ...step,
      firstActiveLabel: isoDate(step.firstActiveWeek),
      expandedFromPulse: step.sourceActiveWeeks === 1,
    })),
  };
}

export function runAttributedForecastLiveRouter(dataset, options = {}) {
  if (!dataset?.weeks?.length) return null;
  const datasetPlatforms = [...new Set((dataset.platforms || [])
    .map((platform) => String(platform ?? "").normalize("NFKC").trim().toLowerCase())
    .filter(Boolean))];
  const aggregatePlatformAliases = new Set(["total", "all", "common", "전체", "합계", "공통"]);
  const hasAggregatePlatformRows = datasetPlatforms.some((platform) =>
    aggregatePlatformAliases.has(platform));
  const hasDisaggregatedPlatformRows = datasetPlatforms.some((platform) =>
    !aggregatePlatformAliases.has(platform));
  // A Total row and its platform children represent two grains of the same
  // outcome. Summing both would double-count the target before route scoring,
  // so do not let an apparently accurate candidate legitimize the mixed input.
  if (hasAggregatePlatformRows && hasDisaggregatedPlatformRows) return null;
  const requestedHorizon = Number(options.horizon ?? options.holdout);
  const holdout = Math.max(
    1,
    Math.min(52, Math.round(Number.isFinite(requestedHorizon) ? requestedHorizon : 12)),
  );
  const horizon = holdout;
  const foldStep = Math.max(
    holdout,
    Math.round(Number.isFinite(Number(options.foldStep)) ? Number(options.foldStep) : holdout),
  );
  const maxOffset = dataset.weeks.length - holdout - MIN_TRAIN_WEEKS;
  if (maxOffset < 0) return null;
  const foldOffsets = Array.from(
    { length: Math.floor(maxOffset / foldStep) + 1 },
    (_, index) => index * foldStep,
  );
  const modeledPlatforms = datasetPlatforms.filter((platform) =>
    !aggregatePlatformAliases.has(platform));
  const hasOnlyAndroidIos = modeledPlatforms.includes("android")
    && modeledPlatforms.includes("ios")
    && modeledPlatforms.every((platform) =>
      platform === "android" || platform === "ios");
  const allowedProductionRoutes = hasOnlyAndroidIos
    ? ["direct-total", "android-ios-sum"]
    : ["direct-total"];
  const isProductionCandidate = (candidate) =>
    allowedProductionRoutes.includes(candidate.route);
  const evaluated = [];
  ["direct-total", "android-ios-sum"].forEach((route) => {
    MODEL_SPECS.forEach((spec) => {
      const evaluation = evaluateSpec(dataset, route, spec, foldOffsets, holdout);
      if (evaluation?.folds.length) evaluated.push(evaluation);
    });
  });
  if (!evaluated.length) return null;
  // Each outer cutoff re-selects route, window, Organic/Paid/Cost family,
  // structural-step policy and horizon guardrail using only the same three
  // nearest, non-overlapping older origins. The latest H-week outcome is an
  // audit only and can never choose the production estimator.
  const nested = buildNestedPath(
    dataset,
    evaluated,
    foldOffsets,
    holdout,
    isProductionCandidate,
  );
  if (!nested) return null;
  const lookbackCandidates = LOOKBACK_WEEKS.map((trainingWindow) => {
    const path = buildNestedPath(
      dataset,
      evaluated,
      foldOffsets,
      holdout,
      (candidate) =>
        isProductionCandidate(candidate)
        && candidate.spec.trainingWindow === trainingWindow,
    );
    if (!path) {
      return {
        trainingWindow,
        available: false,
        reason: "insufficient-independent-history",
      };
    }
    const candidate = path.latestSelection.selected;
    return {
      trainingWindow,
      available: true,
      route: candidate.route,
      spec: candidate.spec,
      developmentPooledWmape: path.development.pooledWmape,
      pooledWmape: path.all.pooledWmape,
      conditionalPooledWmape: path.development.conditionalPooledWmape,
      naivePooledWmape: path.development.naivePooledWmape,
      worstWmape: path.development.worstWmape,
      outerFolds: path.development.foldCount,
    };
  });
  const bestByRoute = ["direct-total", "android-ios-sum"].map((route) => ({
    route,
    path: buildNestedPath(
      dataset,
      evaluated,
      foldOffsets,
      holdout,
      (candidate) => candidate.route === route,
    ),
  })).filter((item) => item.path);
  if (!bestByRoute.length) return null;
  const selected = nested.latestSelection.selected;
  const stepPolicyCandidates = STEP_POLICIES.map((stepPolicy) => {
    const path = buildNestedPath(
      dataset,
      evaluated,
      foldOffsets,
      holdout,
      (candidate) =>
        isProductionCandidate(candidate)
        && candidate.spec.stepPolicy === stepPolicy,
    );
    const candidate = path?.latestSelection?.selected;
    return candidate ? {
      stepPolicy,
      route: candidate.route,
      spec: candidate.spec,
      developmentPooledWmape: path.development.pooledWmape,
      pooledWmape: path.all.pooledWmape,
      conditionalPooledWmape: path.development.conditionalPooledWmape,
      naivePooledWmape: path.development.naivePooledWmape,
      worstWmape: path.development.worstWmape,
      componentPooledWmape: path.development.componentPooledWmape,
      outerFolds: path.development.foldCount,
    } : null;
  }).filter(Boolean);
  const latest = nested.latest;
  const development = nested.development;
  const osCandidate = bestByRoute.find((candidate) => candidate.route === "android-ios-sum")?.path || null;
  if (!latest) return null;
  const osBreakdownEligible = !!osCandidate
    && osCandidate.development.foldCount >= MIN_CERTIFICATION_FOLDS
    && Number.isFinite(osCandidate.development.worstWmape)
    && osCandidate.development.worstWmape < 10
    && Number.isFinite(osCandidate.development.componentWorstWmape)
    && osCandidate.development.componentWorstWmape < 10
    && osCandidate.development.componentEveryPassed
    && Number.isFinite(osCandidate.latest.wmape)
    && osCandidate.latest.wmape < 10
    && Number.isFinite(osCandidate.latest.componentWmape)
    && osCandidate.latest.componentWmape < 10
    && osCandidate.latest.componentEveryPassed;
  // Direct Total만 잘 맞고 Android/iOS 하위 성분이 서로 상쇄되는 모델을 공식
  // 인증하지 않는다. Web/기타 플랫폼이 있으면 Direct Total만 배포하되, 모든
  // 플랫폼 하위 예측을 닫을 수 없으므로 참고 예측으로만 남긴다.
  const componentCertificationComplete = hasOnlyAndroidIos
    && osBreakdownEligible;
  const eligible = componentCertificationComplete
    && development.foldCount >= MIN_CERTIFICATION_FOLDS
    && Number.isFinite(development.worstWmape)
    && development.worstWmape < 10
    && Number.isFinite(development.componentWorstWmape)
    && development.componentWorstWmape < 10
    && development.componentEveryPassed
    && Number.isFinite(latest.wmape)
    && latest.wmape < 10
    && Number.isFinite(latest.componentWmape)
    && latest.componentWmape < 10
    && latest.componentEveryPassed;
  let recommendedHorizon = 0;
  for (const metric of development.horizonMetrics) {
    if (!(Number.isFinite(metric.wmape) && metric.wmape < 10 && Number.isFinite(metric.mase) && metric.mase <= 1)) break;
    recommendedHorizon = metric.horizon;
  }
  const shortTermEligible = componentCertificationComplete
    && development.foldCount >= MIN_CERTIFICATION_FOLDS
    && recommendedHorizon > 0;
  const future = futureForRoute(dataset, selected.route, horizon, selected.spec);
  if (!future) return null;
  const futureNaive = naiveRouteAt(dataset, dataset.weeks.length, horizon, selected.route);
  const futureUseModel = Array.from({ length: horizon }, (_, index) =>
    index < selected.useModelByHorizon.length ? selected.useModelByHorizon[index] : false,
  );
  // 모든 horizon이 naive로 대체되면 화면의 Cost를 바꿔도 예측은 동일하다.
  // 그 상태를 "예측 통과"와 분리해 Cost 시나리오를 열지 않는다.
  const budgetResponseEligible = futureUseModel.some(Boolean)
    && Array.isArray(future.channels)
    && future.channels.length > 0;
  const guardedFuture = mixResults(future, futureNaive, futureUseModel);
  const marginByHorizon = Array.from({ length: horizon }, (_, index) => {
    const source = development.horizonMetrics[index];
    return Number.isFinite(source?.margin90) ? source.margin90 : 0;
  });
  const totalPanel = panelFor(dataset, "total");
  const contextLength = 12;
  const lastWeek = dataset.weeks.at(-1);
  return {
    model: "nested-oos-organic-paid-v5-auto-selection",
    selectedRoute: selected.route,
    allowedProductionRoutes,
    componentCertificationComplete,
    selectedSpec: selected.spec,
    dataPreservation: selected.dataPreservation || null,
    eligible,
    shortTermEligible,
    recommendedHorizon,
    osBreakdownEligible,
    budgetResponseEligible,
    threshold: 10,
    foldStep,
    selectionHoldoutWeeks: holdout,
    outerFoldCount: development.foldCount,
    intervalCalibrationEligible: development.calibrationEligible,
    intervalCalibrationFoldCount: development.calibrationFoldCount,
    intervalCalibrationMinFolds: MIN_INTERVAL_FOLDS,
    intervalObservedOuterFolds: development.foldCount,
    minimumRequiredWeeks: MIN_TRAIN_WEEKS + holdout + MIN_SELECTION_FOLDS * foldStep,
    minimumCertifiedWeeks: MIN_TRAIN_WEEKS + holdout
      + (MIN_SELECTION_FOLDS + MIN_CERTIFICATION_FOLDS) * foldStep,
    minimumIntervalWeeks: MIN_TRAIN_WEEKS + holdout
      + (MIN_SELECTION_FOLDS + MIN_INTERVAL_FOLDS) * foldStep,
    lookbackCandidates,
    stepPolicyCandidates,
    candidates: bestByRoute.map(({ route, path }) => ({
      route,
      spec: path.latestSelection.selected.spec,
      useModelByHorizon: path.latestSelection.selected.useModelByHorizon,
      developmentPooledWmape: path.development.pooledWmape,
      pooledWmape: path.all.pooledWmape,
      conditionalPooledWmape: path.development.conditionalPooledWmape,
      naivePooledWmape: path.development.naivePooledWmape,
      worstWmape: path.development.worstWmape,
      passRate: path.development.passRate,
      componentPooledWmape: path.development.componentPooledWmape,
      componentWorstWmape: path.development.componentWorstWmape,
      componentPassRate: path.development.componentPassRate,
      componentEvidence: path.development.componentEvidence,
      componentEveryPassed: path.development.componentEveryPassed,
      horizonMetrics: path.development.horizonMetrics,
      outerFoldCount: path.development.foldCount,
      folds: path.folds.map(({ result, conditionalResult, naiveResult, actual, absoluteErrors, conditionalAbsoluteErrors, naiveAbsoluteErrors, ...fold }) => fold),
    })),
    historicallyStable: eligible,
    backtest: {
      labels: dataset.weekLabels.slice(-(holdout + contextLength)),
      actual: totalPanel.total.slice(-(holdout + contextLength)),
      predicted: [...totalPanel.total.slice(-(holdout + contextLength), -holdout), ...latest.result.predicted],
      organic: [...Array(contextLength).fill(null), ...latest.result.organic],
      performance: [...Array(contextLength).fill(null), ...latest.result.performance],
      validationStartIndex: contextLength,
      wmape: latest.wmape,
      conditionalWmape: latest.conditionalWmape,
      naiveWmape: latest.naiveWmape,
      reliable: eligible,
    },
    forecast: {
      organic: guardedFuture.organic,
      performance: guardedFuture.performance,
      predicted: guardedFuture.predicted,
      lo: guardedFuture.predicted.map((value, index) => Math.max(0, value - marginByHorizon[index])),
      hi: guardedFuture.predicted.map((value, index) => value + marginByHorizon[index]),
      labels: Array.from({ length: horizon }, (_, index) => isoDate(lastWeek + (index + 1) * 7 * DAY_MS)),
      channels: future.channels,
      futureCosts: future.futureCosts,
      recentCosts: future.recentCosts,
      parts: guardedFuture.parts,
      marginByHorizon,
      useModelByHorizon: futureUseModel,
      intervalCalibrationEligible: development.calibrationEligible,
      intervalCalibrationFoldCount: development.calibrationFoldCount,
    },
    validation: {
      method: "nested-rolling-origin",
      horizon,
      foldStep,
      priorFoldsPerSelection: MIN_SELECTION_FOLDS,
      outerFoldCount: development.foldCount,
      pooledWmape: development.pooledWmape,
      conditionalPooledWmape: development.conditionalPooledWmape,
      naivePooledWmape: development.naivePooledWmape,
      intervalCalibrationEligible: development.calibrationEligible,
      folds: development.folds.map((fold) => ({
        offset: fold.offset,
        start: fold.start,
        end: fold.end,
        selectedRoute: fold.selectedRoute,
        selectedSpecId: fold.selectedSpec?.id || null,
        actual: fold.actual.slice(),
        predicted: fold.result.predicted.slice(),
        absoluteErrors: fold.absoluteErrors.slice(),
        denominator: fold.denominator,
        absoluteError: fold.absoluteError,
        wmape: fold.wmape,
      })),
    },
    diagnostics: regimeDiagnostics(dataset),
    structuralSteps: structuralStepDiagnostics(dataset),
  };
}

export function runAttributedForecastLiveScenario(dataset, router, budgetByKey = {}, horizon = null) {
  if (!dataset || !router?.selectedRoute || !router?.selectedSpec) return null;
  const useHorizon = horizon || router.forecast?.predicted?.length || 12;
  const modelFuture = futureForRoute(dataset, router.selectedRoute, useHorizon, router.selectedSpec, budgetByKey);
  const naiveFuture = naiveRouteAt(dataset, dataset.weeks.length, useHorizon, router.selectedRoute);
  if (!modelFuture || !naiveFuture) return null;
  const selectedCandidate = router.candidates?.find((candidate) => candidate.route === router.selectedRoute);
  const useModelByHorizon = Array.from({ length: useHorizon }, (_, index) => {
    const source = selectedCandidate?.useModelByHorizon || router.forecast?.useModelByHorizon || [];
    return index < source.length ? source[index] : false;
  });
  const mixed = mixResults(modelFuture, naiveFuture, useModelByHorizon);
  const lastWeek = dataset.weeks.at(-1);
  const marginByHorizon = Array.from({ length: useHorizon }, (_, index) => {
    const margin = router.forecast?.marginByHorizon?.[index];
    return Number.isFinite(margin) ? margin : 0;
  });
  return {
    ...mixed,
    lo: mixed.predicted.map((value, index) => Math.max(0, value - marginByHorizon[index])),
    hi: mixed.predicted.map((value, index) => value + marginByHorizon[index]),
    labels: Array.from({ length: useHorizon }, (_, index) => isoDate(lastWeek + (index + 1) * 7 * DAY_MS)),
    channels: modelFuture.channels,
    futureCosts: modelFuture.futureCosts,
    recentCosts: modelFuture.recentCosts,
    parts: mixed.parts,
    marginByHorizon,
    useModelByHorizon,
  };
}
