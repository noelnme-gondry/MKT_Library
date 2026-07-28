import { ALLOC_MATH } from "./allocationMath.js";

const DAY_MS = 86400000;
const FOLD_STEP = 4;
const MIN_TRAIN_WEEKS = 60;
const PANEL_CACHE = new WeakMap();

const ORGANIC_SPECS = [
  { id: "endpoint-4-yoy10", kind: "endpoint", window: 4, seasonWeight: 0.1 },
  { id: "flat-8", kind: "flat", window: 8, seasonWeight: 0 },
  { id: "holt-13", kind: "holt", window: 13, alpha: 0.6, beta: 0.2, phi: 0.8, seasonWeight: 0 },
  { id: "holt-26", kind: "holt", window: 26, alpha: 0.6, beta: 0.15, phi: 0.9, seasonWeight: 0 },
  { id: "holt-26-yoy15", kind: "holt", window: 26, alpha: 0.6, beta: 0.15, phi: 0.9, seasonWeight: 0.15 },
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
  { id: "cost-holt13", kind: "holt", window: 13, alpha: 0.6, beta: 0.2, phi: 0.8 },
];

const MODEL_SPECS = ORGANIC_SPECS.flatMap((organic) =>
  PAID_SPECS.flatMap((paid) =>
    COST_SPECS.map((cost) => ({
      id: `${organic.id}__${paid.id}__${cost.id}`,
      organic,
      paid,
      cost,
    })),
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
  const panel = {
    platform,
    weeks: dataset.weeks,
    channels,
    total: rows.map((row) => row.total),
    organic: rows.map((row) => row.organic),
    paid: rows.map((row) => Math.max(0, row.total - row.organic)),
    costs: rows.map((row) => channels.map((channel) => row.costs[channel] || 0)),
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

function organicForecast(panel, trainEnd, horizon, spec) {
  const history = panel.organic.slice(0, trainEnd);
  let forecast;
  if (spec.kind === "flat") {
    const level = mean(history.slice(-Math.min(spec.window, history.length)));
    forecast = Number.isFinite(level) ? Array(horizon).fill(Math.max(0, level)) : null;
  } else if (spec.kind === "endpoint") {
    const level = linearEndpoint(history.slice(-Math.min(spec.window, history.length)));
    forecast = Number.isFinite(level) ? Array(horizon).fill(level) : null;
  } else {
    forecast = holtLogForecast(history, horizon, spec);
  }
  if (!forecast || !(spec.seasonWeight > 0) || trainEnd < 56) return forecast;
  const yearlyBase = panel.organic.slice(trainEnd - 52, trainEnd - 52 + horizon);
  const currentMean = mean(panel.organic.slice(trainEnd - 4, trainEnd));
  const priorMean = mean(panel.organic.slice(trainEnd - 56, trainEnd - 52));
  const ratio = priorMean > 0 ? currentMean / priorMean : 1;
  return forecast.map((value, index) => {
    const yearly = Math.max(0, (yearlyBase[index] || 0) * ratio);
    return Math.max(0, value * (1 - spec.seasonWeight) + yearly * spec.seasonWeight);
  });
}

function forecastCostColumn(values, trainEnd, horizon, spec) {
  const history = values.slice(0, trainEnd);
  if (spec.kind === "holt") return holtLogForecast(history, horizon, spec);
  const level = mean(history.slice(-Math.min(spec.window, history.length)));
  return Number.isFinite(level) ? Array(horizon).fill(Math.max(0, level)) : null;
}

function forecastCostRows(panel, trainEnd, horizon, spec) {
  const columns = panel.channels.map((_, column) =>
    forecastCostColumn(panel.costs.map((row) => row[column]), trainEnd, horizon, spec),
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

function ratePaidForecast(panel, trainEnd, costTotals, spec) {
  let level = null;
  for (let index = 0; index < trainEnd; index++) {
    const cost = panel.costs[index].reduce((sum, value) => sum + Math.max(0, value), 0);
    const paid = Math.max(0, panel.paid[index]);
    if (!(cost > 0) || !(paid > 0)) continue;
    const rate = paid / cost;
    level = level == null ? rate : spec.alpha * rate + (1 - spec.alpha) * level;
  }
  return Number.isFinite(level) ? costTotals.map((cost) => Math.max(0, cost * level)) : null;
}

function saturationPaidForecast(panel, trainEnd, costTotals, spec) {
  const rawHistory = panel.costs.slice(0, trainEnd).map((row) => row.reduce((sum, value) => sum + Math.max(0, value), 0));
  const effectiveHistory = adstock(rawHistory, spec.adstock);
  const start = Math.max(0, trainEnd - spec.window);
  const points = [];
  for (let index = start; index < trainEnd; index++) {
    const cost = effectiveHistory[index];
    const paid = Math.max(0, panel.paid[index]);
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

function paidForecast(panel, trainEnd, futureCosts, spec) {
  const costTotals = futureCosts.map((row) => row.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0));
  const prediction = spec.kind === "saturation"
    ? saturationPaidForecast(panel, trainEnd, costTotals, spec)
    : ratePaidForecast(panel, trainEnd, costTotals, spec);
  return prediction?.every(Number.isFinite) ? prediction : null;
}

function fitPanel(panel, trainEnd, horizon, spec, suppliedCosts = null) {
  const futureCosts = suppliedCosts || forecastCostRows(panel, trainEnd, horizon, spec.cost);
  if (!futureCosts || futureCosts.length !== horizon) return null;
  const organic = organicForecast(panel, trainEnd, horizon, spec.organic);
  const performance = paidForecast(panel, trainEnd, futureCosts, spec.paid);
  if (!organic || !performance) return null;
  return {
    organic,
    performance,
    predicted: organic.map((value, index) => value + performance[index]),
    futureCosts,
    spec,
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
  const actualSeries = [];
  const predictedSeries = [];
  if (route === "direct-total") {
    const panel = panelFor(dataset, "total");
    actualSeries.push(panel.organic.slice(trainEnd, trainEnd + horizon), panel.paid.slice(trainEnd, trainEnd + horizon));
    predictedSeries.push(result.organic, result.performance);
  } else {
    ["android", "ios"].forEach((platform, index) => {
      const panel = panelFor(dataset, platform);
      actualSeries.push(panel.organic.slice(trainEnd, trainEnd + horizon), panel.paid.slice(trainEnd, trainEnd + horizon));
      predictedSeries.push(result.parts[index].organic, result.parts[index].performance);
    });
  }
  let absoluteError = 0;
  let denominator = 0;
  actualSeries.forEach((actual, seriesIndex) => {
    actual.forEach((value, index) => {
      absoluteError += Math.abs(value - predictedSeries[seriesIndex][index]);
      denominator += Math.abs(value);
    });
  });
  return {
    componentWmape: denominator > 0 ? absoluteError / denominator * 100 : null,
    componentAbsoluteError: absoluteError,
    componentDenominator: denominator,
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

function summarizeEvaluation(evaluation, selectionOffsets, holdout) {
  const folds = evaluation.folds;
  const development = folds.filter((fold) => selectionOffsets.has(fold.offset));
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

function recentAverageCosts(panel, count = 8) {
  const rows = panel.costs.slice(-Math.min(count, panel.costs.length));
  return panel.channels.map((_, column) => mean(rows.map((row) => row[column])) || 0);
}

function scenarioCostRows(panel, trainEnd, horizon, spec, budgetByKey, keyPrefix = "") {
  const defaults = forecastCostRows(panel, trainEnd, horizon, spec);
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

export function runAttributedForecastLiveRouter(dataset, options = {}) {
  if (!dataset?.weeks?.length) return null;
  const holdout = options.holdout || 12;
  const horizon = options.horizon || holdout;
  const maxOffset = dataset.weeks.length - holdout - MIN_TRAIN_WEEKS;
  if (maxOffset < 0) return null;
  const foldOffsets = Array.from({ length: Math.floor(maxOffset / FOLD_STEP) + 1 }, (_, index) => index * FOLD_STEP);
  const selectionOffsets = new Set(foldOffsets.filter((offset) => offset >= holdout));
  const evaluated = [];
  ["direct-total", "android-ios-sum"].forEach((route) => {
    MODEL_SPECS.forEach((spec) => {
      const evaluation = evaluateSpec(dataset, route, spec, foldOffsets, holdout);
      if (evaluation?.folds.length === foldOffsets.length) {
        evaluated.push(summarizeEvaluation(
          applyHorizonGuardrail(dataset, evaluation, selectionOffsets, holdout),
          selectionOffsets,
          holdout,
        ));
      }
    });
  });
  if (!evaluated.length) return null;
  const bestByRoute = ["direct-total", "android-ios-sum"].map((route) => {
    const routeCandidates = evaluated.filter((candidate) => candidate.route === route);
    routeCandidates.sort((left, right) =>
      left.developmentPooledWmape - right.developmentPooledWmape
      || left.worstWmape - right.worstWmape
      || left.spec.id.localeCompare(right.spec.id),
    );
    return routeCandidates[0];
  }).filter(Boolean);
  if (bestByRoute.length !== 2) return null;
  bestByRoute.sort((left, right) =>
    left.developmentPooledWmape - right.developmentPooledWmape
    || left.componentPooledWmape - right.componentPooledWmape
    || left.route.localeCompare(right.route),
  );
  const selected = bestByRoute[0];
  const latest = selected.folds.find((fold) => fold.offset === 0);
  const osCandidate = bestByRoute.find((candidate) => candidate.route === "android-ios-sum");
  if (!latest || !osCandidate) return null;
  const eligible = selected.worstWmape < 10 && selected.componentWorstWmape < 10;
  let recommendedHorizon = 0;
  for (const metric of selected.horizonMetrics) {
    if (!(metric.wmape < 10 && metric.mase <= 1)) break;
    recommendedHorizon = metric.horizon;
  }
  const shortTermEligible = recommendedHorizon > 0;
  const osBreakdownEligible = osCandidate.worstWmape < 10 && osCandidate.componentWorstWmape < 10;
  const future = futureForRoute(dataset, selected.route, horizon, selected.spec);
  if (!future) return null;
  const futureNaive = naiveRouteAt(dataset, dataset.weeks.length, horizon, selected.route);
  const futureUseModel = Array.from({ length: horizon }, (_, index) =>
    selected.useModelByHorizon[Math.min(index, selected.useModelByHorizon.length - 1)],
  );
  const guardedFuture = mixResults(future, futureNaive, futureUseModel);
  const marginByHorizon = Array.from({ length: horizon }, (_, index) => {
    const source = selected.horizonMetrics[Math.min(index, selected.horizonMetrics.length - 1)];
    return source?.margin90 || 0;
  });
  const totalPanel = panelFor(dataset, "total");
  const contextLength = 12;
  const lastWeek = dataset.weeks.at(-1);
  return {
    model: "live-oos-organic-paid-v3",
    selectedRoute: selected.route,
    selectedSpec: selected.spec,
    eligible,
    shortTermEligible,
    recommendedHorizon,
    osBreakdownEligible,
    threshold: 10,
    foldStep: FOLD_STEP,
    selectionHoldoutWeeks: holdout,
    candidates: bestByRoute.map((candidate) => ({
      route: candidate.route,
      spec: candidate.spec,
      useModelByHorizon: candidate.useModelByHorizon,
      developmentPooledWmape: candidate.developmentPooledWmape,
      pooledWmape: candidate.pooledWmape,
      conditionalPooledWmape: candidate.conditionalPooledWmape,
      naivePooledWmape: candidate.naivePooledWmape,
      worstWmape: candidate.worstWmape,
      passRate: candidate.passRate,
      componentPooledWmape: candidate.componentPooledWmape,
      componentWorstWmape: candidate.componentWorstWmape,
      componentPassRate: candidate.componentPassRate,
      horizonMetrics: candidate.horizonMetrics,
      folds: candidate.folds.map(({ result, conditionalResult, naiveResult, actual, absoluteErrors, conditionalAbsoluteErrors, naiveAbsoluteErrors, ...fold }) => fold),
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
    },
    diagnostics: regimeDiagnostics(dataset),
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
    return source[Math.min(index, Math.max(0, source.length - 1))] ?? false;
  });
  const mixed = mixResults(modelFuture, naiveFuture, useModelByHorizon);
  const lastWeek = dataset.weeks.at(-1);
  const marginByHorizon = Array.from({ length: useHorizon }, (_, index) => {
    const metrics = selectedCandidate?.horizonMetrics || [];
    return metrics[Math.min(index, Math.max(0, metrics.length - 1))]?.margin90 || 0;
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
