const DAY_MS = 86400000;

function parseNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  const parsed = Number(String(value ?? "").replace(/[,\s]/g, ""));
  return Number.isFinite(parsed) ? parsed : NaN;
}

function mondayTimestamp(value) {
  const match = String(value ?? "").trim().match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (!match) return null;
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const date = new Date(timestamp);
  if (date.getUTCFullYear() !== Number(match[1]) || date.getUTCMonth() !== Number(match[2]) - 1 || date.getUTCDate() !== Number(match[3])) return null;
  return timestamp;
}

function isoDate(timestamp) {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function canonicalPlatform(value) {
  const text = String(value ?? "").trim().toLowerCase();
  if (/android|aos|google.?play|play.?store/.test(text)) return "android";
  if (/ios|iphone|ipad/.test(text)) return "ios";
  return text;
}

function isOrganic(value) {
  return /(^|[\s_-])(organic|오가닉|자연|비광고)([\s_-]|$)/i.test(String(value ?? "").normalize("NFKC"));
}

const ATTRIBUTED_MODEL_SPEC = Object.freeze({
  organicRecentWindow: 4,
  organicYearlyWindow: 4,
  organicYearlyWeight: 0.1,
  yearlyLag: 52,
  paidRateAlpha: 0.9,
});

function average(values) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function localLinearEndpoint(values) {
  if (!values.length) return null;
  if (values.length === 1) return Math.max(0, values[0]);
  const xMean = (values.length - 1) / 2;
  const yMean = average(values);
  let numerator = 0;
  let denominator = 0;
  values.forEach((value, index) => {
    numerator += (index - xMean) * (value - yMean);
    denominator += (index - xMean) ** 2;
  });
  const slope = denominator > 0 ? numerator / denominator : 0;
  return Math.max(0, yMean + slope * ((values.length - 1) - xMean));
}

function organicForecast(panel, trainEnd, horizon) {
  const recentWindow = ATTRIBUTED_MODEL_SPEC.organicRecentWindow;
  const recent = panel.organic.slice(Math.max(0, trainEnd - recentWindow), trainEnd);
  const recentLevel = localLinearEndpoint(recent);
  if (!Number.isFinite(recentLevel)) return null;
  const local = Array(horizon).fill(recentLevel);
  const lag = ATTRIBUTED_MODEL_SPEC.yearlyLag;
  const yearlyWindow = ATTRIBUTED_MODEL_SPEC.organicYearlyWindow;
  if (trainEnd < lag + yearlyWindow) return local;
  const base = panel.organic.slice(trainEnd - lag, trainEnd - lag + horizon);
  const currentMean = average(panel.organic.slice(trainEnd - yearlyWindow, trainEnd));
  const priorMean = average(panel.organic.slice(trainEnd - lag - yearlyWindow, trainEnd - lag));
  const yearlyWeight = ATTRIBUTED_MODEL_SPEC.organicYearlyWeight;
  return local.map((value, index) => {
    const yearly = Math.max(0, (base[index] || 0) + currentMean - priorMean);
    return Math.max(0, value * (1 - yearlyWeight) + yearly * yearlyWeight);
  });
}

function paidRateLevel(panel, trainEnd) {
  let level = null;
  const alpha = ATTRIBUTED_MODEL_SPEC.paidRateAlpha;
  for (let index = 0; index < trainEnd; index++) {
    const cost = panel.costs[index].reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0);
    const paid = Math.max(0, Number(panel.paid[index]) || 0);
    if (!(cost > 0) || !(paid > 0)) continue;
    const rate = paid / cost;
    level = level == null ? rate : alpha * rate + (1 - alpha) * level;
  }
  return level;
}

function panelFor(dataset, platform = "total") {
  const weeks = dataset.weeks;
  const records = platform === "total"
    ? dataset.records
    : dataset.records.filter((record) => record.platform === platform);
  const channels = [...new Set(records.filter((record) => !record.organic).map((record) => record.channel))].sort((a, b) => a.localeCompare(b));
  const byWeek = new Map(weeks.map((week) => [week, { total: 0, organic: 0, costs: Object.fromEntries(channels.map((channel) => [channel, 0])) }]));
  records.forEach((record) => {
    const item = byWeek.get(record.week);
    if (!item) return;
    item.total += record.outcome;
    if (record.organic) item.organic += record.outcome;
    else item.costs[record.channel] = (item.costs[record.channel] || 0) + record.cost;
  });
  const rows = weeks.map((week) => byWeek.get(week));
  return {
    platform,
    weeks,
    channels,
    total: rows.map((row) => row.total),
    organic: rows.map((row) => row.organic),
    paid: rows.map((row) => Math.max(0, row.total - row.organic)),
    costs: rows.map((row) => channels.map((channel) => row.costs[channel] || 0)),
  };
}

function fitAt(panel, trainEnd, horizon, futureCosts = null) {
  if (trainEnd < 39 || horizon < 1) return null;
  const costs = futureCosts || panel.costs.slice(trainEnd, trainEnd + horizon);
  if (costs.length !== horizon) return null;
  const rate = paidRateLevel(panel, trainEnd);
  const organic = organicForecast(panel, trainEnd, horizon);
  if (!Number.isFinite(rate) || !organic) return null;
  const performance = costs.map((row) =>
    Math.max(0, row.reduce((sum, value) => sum + Math.max(0, Number(value) || 0), 0) * rate),
  );
  return {
    organic,
    performance,
    predicted: organic.map((value, index) => value + performance[index]),
    fit: { paidRate: rate, modelSpec: ATTRIBUTED_MODEL_SPEC },
  };
}

function wmape(actual, predicted) {
  const denominator = actual.reduce((sum, value) => sum + Math.abs(value), 0);
  if (!(denominator > 0) || actual.length !== predicted.length) return null;
  return actual.reduce((sum, value, index) => sum + Math.abs(value - predicted[index]), 0) / denominator * 100;
}

function routeAt(dataset, trainEnd, horizon, route) {
  if (route === "direct-total") return fitAt(panelFor(dataset, "total"), trainEnd, horizon);
  const parts = ["android", "ios"].map((platform) => fitAt(panelFor(dataset, platform), trainEnd, horizon));
  if (parts.some((part) => !part)) return null;
  return {
    organic: Array.from({ length: horizon }, (_, index) => parts.reduce((sum, part) => sum + part.organic[index], 0)),
    performance: Array.from({ length: horizon }, (_, index) => parts.reduce((sum, part) => sum + part.performance[index], 0)),
    predicted: Array.from({ length: horizon }, (_, index) => parts.reduce((sum, part) => sum + part.predicted[index], 0)),
    parts,
  };
}

function componentFoldError(dataset, route, result, trainEnd, horizon) {
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

function recentAverageCosts(panel, count = 8) {
  const rows = panel.costs.slice(-Math.min(count, panel.costs.length));
  return panel.channels.map((_, column) => rows.reduce((sum, row) => sum + row[column], 0) / rows.length);
}

function futureForRoute(dataset, route, horizon) {
  const trainEnd = dataset.weeks.length;
  if (route === "direct-total") {
    const panel = panelFor(dataset, "total");
    const average = recentAverageCosts(panel);
    const result = fitAt(panel, trainEnd, horizon, Array.from({ length: horizon }, () => average));
    return result && { ...result, channels: panel.channels, futureCosts: Array.from({ length: horizon }, () => average) };
  }
  const panels = ["android", "ios"].map((platform) => panelFor(dataset, platform));
  const parts = panels.map((panel) => {
    const average = recentAverageCosts(panel);
    const result = fitAt(panel, trainEnd, horizon, Array.from({ length: horizon }, () => average));
    return result && { ...result, panel, futureCosts: Array.from({ length: horizon }, () => average) };
  });
  if (parts.some((part) => !part)) return null;
  return {
    organic: Array.from({ length: horizon }, (_, index) => parts.reduce((sum, part) => sum + part.organic[index], 0)),
    performance: Array.from({ length: horizon }, (_, index) => parts.reduce((sum, part) => sum + part.performance[index], 0)),
    predicted: Array.from({ length: horizon }, (_, index) => parts.reduce((sum, part) => sum + part.predicted[index], 0)),
    parts,
    channels: parts.flatMap((part) => part.panel.channels.map((channel) => `${part.panel.platform}::${channel}`)),
  };
}

function regimeDiagnostics(dataset) {
  const panel = panelFor(dataset, "total");
  const summarize = (start, end) => {
    const totalCost = panel.costs.slice(start, end).flat().reduce((sum, value) => sum + value, 0);
    const paid = panel.paid.slice(start, end).reduce((sum, value) => sum + value, 0);
    const organic = panel.organic.slice(start, end).reduce((sum, value) => sum + value, 0);
    return { cost: totalCost, paid, organic, paidCpa: paid > 0 ? totalCost / paid : null, organicMean: organic / Math.max(1, end - start) };
  };
  const end = panel.weeks.length;
  const recentStart = Math.max(0, end - 12);
  const priorStart = Math.max(0, recentStart - 12);
  const recent = summarize(recentStart, end);
  const prior = summarize(priorStart, recentStart);
  const change = (current, previous) => Number.isFinite(current) && Number.isFinite(previous) && Math.abs(previous) > 1e-9
    ? (current / previous - 1) * 100
    : null;
  return {
    recent,
    prior,
    paidCpaChangePct: change(recent.paidCpa, prior.paidCpa),
    organicMeanChangePct: change(recent.organicMean, prior.organicMean),
    spendChangePct: change(recent.cost, prior.cost),
  };
}

export function buildAttributedForecastDataset(rows, fields, options = {}) {
  const { timeHeader, platformHeader, channelHeader, spendHeader, targetHeader } = fields || {};
  if (!timeHeader || !channelHeader || !spendHeader || !targetHeader) return null;
  const records = [];
  for (const row of rows || []) {
    const week = mondayTimestamp(row[timeHeader]);
    const channel = String(row[channelHeader] ?? "").trim();
    const outcome = parseNumber(row[targetHeader]);
    const cost = parseNumber(row[spendHeader]);
    if (week == null || !channel || !Number.isFinite(outcome)) continue;
    records.push({
      week,
      platform: canonicalPlatform(platformHeader ? row[platformHeader] : "total"),
      channel,
      organic: isOrganic(channel),
      outcome,
      cost: Number.isFinite(cost) ? Math.max(0, cost) : 0,
    });
  }
  if (!records.some((record) => record.organic) || !records.some((record) => !record.organic)) return null;
  let weeks = [...new Set(records.map((record) => record.week))].sort((a, b) => a - b);
  const asOf = options.asOfDate == null ? Date.now() : new Date(options.asOfDate).getTime();
  if (weeks.length && Number.isFinite(asOf) && asOf < weeks.at(-1) + 7 * DAY_MS) weeks = weeks.slice(0, -1);
  const weekSet = new Set(weeks);
  const filtered = records.filter((record) => weekSet.has(record.week));
  const platforms = [...new Set(filtered.map((record) => record.platform))];
  if (weeks.length < 51 || !platforms.includes("android") || !platforms.includes("ios")) return null;
  return { weeks, weekLabels: weeks.map(isoDate), records: filtered, platforms };
}

export function runAttributedForecastRouter(dataset, options = {}) {
  if (!dataset?.weeks?.length) return null;
  const holdout = options.holdout || 12;
  const horizon = options.horizon || 12;
  const trainEnd = dataset.weeks.length - holdout;
  if (trainEnd < 39) return null;
  const totalPanel = panelFor(dataset, "total");
  const actual = totalPanel.total.slice(trainEnd);
  const maxOffset = dataset.weeks.length - holdout - 39;
  const foldOffsets = Array.from({ length: Math.floor(maxOffset / holdout) + 1 }, (_, index) => index * holdout);
  const candidates = ["direct-total", "android-ios-sum"].map((route) => {
    const folds = foldOffsets.map((offset) => {
      const foldTrainEnd = dataset.weeks.length - holdout - offset;
      const foldActual = totalPanel.total.slice(foldTrainEnd, foldTrainEnd + holdout);
      const result = routeAt(dataset, foldTrainEnd, holdout, route);
      if (!result) return null;
      return {
        offset,
        excludedWeeks: offset + holdout,
        start: dataset.weekLabels[foldTrainEnd],
        end: dataset.weekLabels[foldTrainEnd + holdout - 1],
        wmape: wmape(foldActual, result.predicted),
        denominator: foldActual.reduce((sum, value) => sum + Math.abs(value), 0),
        ...componentFoldError(dataset, route, result, foldTrainEnd, holdout),
      };
    }).filter(Boolean);
    const latest = folds.find((fold) => fold.offset === 0);
    const result = routeAt(dataset, trainEnd, holdout, route);
    const denominator = folds.reduce((sum, fold) => sum + fold.denominator, 0);
    const pooledWmape = denominator > 0
      ? folds.reduce((sum, fold) => sum + fold.wmape / 100 * fold.denominator, 0) / denominator * 100
      : null;
    const componentDenominator = folds.reduce((sum, fold) => sum + fold.componentDenominator, 0);
    const componentPooledWmape = componentDenominator > 0
      ? folds.reduce((sum, fold) => sum + fold.componentAbsoluteError, 0) / componentDenominator * 100
      : null;
    return result && latest && {
      route,
      ...result,
      wmape: latest.wmape,
      pooledWmape,
      worstWmape: Math.max(...folds.map((fold) => fold.wmape)),
      passRate: folds.filter((fold) => fold.wmape < 10).length / folds.length,
      componentPooledWmape,
      componentWorstWmape: Math.max(...folds.map((fold) => fold.componentWmape)),
      componentPassRate: folds.filter((fold) => fold.componentWmape < 10).length / folds.length,
      folds,
    };
  }).filter(Boolean);
  if (candidates.length !== 2) return null;
  candidates.sort((left, right) => left.pooledWmape - right.pooledWmape || left.componentPooledWmape - right.componentPooledWmape || left.route.localeCompare(right.route));
  const selected = candidates[0];
  const osCandidate = candidates.find((candidate) => candidate.route === "android-ios-sum");
  const eligible = selected.worstWmape < 10 && selected.componentWorstWmape < 10;
  const osBreakdownEligible = osCandidate.worstWmape < 10 && osCandidate.componentWorstWmape < 10;
  const future = futureForRoute(dataset, selected.route, horizon);
  if (!future) return null;
  const absoluteErrors = actual.map((value, index) => Math.abs(value - selected.predicted[index]));
  const residuals = actual.map((value, index) => Math.abs(value - selected.predicted[index])).sort((a, b) => a - b);
  const margin = residuals[Math.min(residuals.length - 1, Math.ceil(residuals.length * 0.9) - 1)] || 0;
  const lastWeek = dataset.weeks.at(-1);
  return {
    model: "adaptive-yearly-organic-paid-v2",
    modelSpec: ATTRIBUTED_MODEL_SPEC,
    selectedRoute: selected.route,
    eligible,
    osBreakdownEligible,
    threshold: 10,
    candidates: candidates.map(({ route, wmape: value, pooledWmape, worstWmape, passRate, componentPooledWmape, componentWorstWmape, componentPassRate, folds }) => ({
      route,
      wmape: value,
      pooledWmape,
      worstWmape,
      passRate,
      componentPooledWmape,
      componentWorstWmape,
      componentPassRate,
      folds,
    })),
    historicallyStable: eligible,
    backtest: {
      labels: dataset.weekLabels.slice(-(holdout + 12)),
      actual: panelFor(dataset, "total").total.slice(-(holdout + 12)),
      predicted: [
        ...panelFor(dataset, "total").total.slice(-(holdout + 12), -holdout),
        ...selected.predicted,
      ],
      organic: [...Array(12).fill(null), ...selected.organic],
      performance: [...Array(12).fill(null), ...selected.performance],
      validationStartIndex: 12,
      wmape: selected.wmape,
      rmse: Math.sqrt(absoluteErrors.reduce((sum, value) => sum + value ** 2, 0) / absoluteErrors.length),
      mae: absoluteErrors.reduce((sum, value) => sum + value, 0) / absoluteErrors.length,
      reliable: eligible,
    },
    forecast: {
      organic: future.organic,
      performance: future.performance,
      predicted: future.predicted,
      lo: future.predicted.map((value) => Math.max(0, value - margin)),
      hi: future.predicted.map((value) => value + margin),
      labels: Array.from({ length: horizon }, (_, index) => isoDate(lastWeek + (index + 1) * 7 * DAY_MS)),
      channels: future.channels,
      futureCosts: future.futureCosts,
      parts: future.parts,
    },
    diagnostics: regimeDiagnostics(dataset),
  };
}
