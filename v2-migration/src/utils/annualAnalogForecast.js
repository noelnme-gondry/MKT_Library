const DEFAULT_HORIZON = 12;
const DEFAULT_FOLD_STEP = 4;

function mean(values) {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
}

function wmape(actual, predicted) {
  const denominator = actual.reduce((sum, value) => sum + Math.abs(value), 0);
  if (!(denominator > 0) || actual.length !== predicted.length) return null;
  const absoluteErrors = actual.map((value, index) => Math.abs(value - predicted[index]));
  return {
    wmape: absoluteErrors.reduce((sum, value) => sum + value, 0) / denominator * 100,
    absoluteErrors,
    denominator,
  };
}

function annualAt(series, trainEnd, horizon) {
  if (!Array.isArray(series) || trainEnd < 56 || trainEnd - 52 + horizon > trainEnd) return null;
  const recent = mean(series.slice(trainEnd - 4, trainEnd));
  const prior = mean(series.slice(trainEnd - 56, trainEnd - 52));
  if (!(prior > 0) || !Number.isFinite(recent)) return null;
  const ratio = Math.max(0.25, Math.min(4, recent / prior));
  return {
    ratio,
    predicted: series.slice(trainEnd - 52, trainEnd - 52 + horizon).map((value) => Math.max(0, value * ratio)),
  };
}

function routeAt(seriesByPlatform, route, trainEnd, horizon) {
  if (route === "direct-total") return annualAt(seriesByPlatform.total, trainEnd, horizon);
  const android = annualAt(seriesByPlatform.android, trainEnd, horizon);
  const ios = annualAt(seriesByPlatform.ios, trainEnd, horizon);
  if (!android || !ios) return null;
  return {
    ratio: { android: android.ratio, ios: ios.ratio },
    predicted: android.predicted.map((value, index) => value + ios.predicted[index]),
    parts: { android: android.predicted, ios: ios.predicted },
  };
}

function hasRecentStep(panels, recentWeeks = 26) {
  return (panels || []).some((panel) => Object.values(panel?.steps || {}).some((values) => {
    const start = Math.max(1, values.length - recentWeeks);
    for (let index = start; index < values.length; index++) {
      if (values[index] !== 0 && values[index - 1] === 0) return true;
    }
    return false;
  }));
}

export function runAnnualAnalogRouter({ totalPanel, androidPanel, iosPanel, target = "Regs", horizon = DEFAULT_HORIZON, foldStep = DEFAULT_FOLD_STEP }) {
  const total = totalPanel?.targets?.[target];
  const android = androidPanel?.targets?.[target];
  const ios = iosPanel?.targets?.[target];
  const n = total?.length || 0;
  if (!n || android?.length !== n || ios?.length !== n || n < 56 + horizon) return null;
  const seriesByPlatform = { total, android, ios };
  const starts = [];
  for (let start = 78; start <= n - horizon; start += foldStep) starts.push(start);
  if (starts.at(-1) !== n - horizon) starts.push(n - horizon);
  const candidates = ["direct-total", "android-ios-sum"].map((route) => {
    const folds = starts.map((trainEnd) => {
      const forecast = routeAt(seriesByPlatform, route, trainEnd, horizon);
      const actual = total.slice(trainEnd, trainEnd + horizon);
      const error = forecast && wmape(actual, forecast.predicted);
      const persistenceLevel = mean(total.slice(trainEnd - 8, trainEnd));
      const persistence = Array(horizon).fill(Math.max(0, persistenceLevel || 0));
      const persistenceError = wmape(actual, persistence);
      return forecast && error && persistenceError ? {
        trainEnd,
        offset: n - trainEnd - horizon,
        actual,
        predicted: forecast.predicted,
        absoluteErrors: error.absoluteErrors,
        denominator: error.denominator,
        wmape: error.wmape,
        persistenceWmape: persistenceError.wmape,
        ratio: forecast.ratio,
        parts: forecast.parts,
      } : null;
    }).filter(Boolean);
    const latest = folds.find((fold) => fold.offset === 0);
    const development = folds.filter((fold) => fold.offset >= horizon);
    const marginByHorizon = Array.from({ length: horizon }, (_, index) => {
      const sorted = development.map((fold) => fold.absoluteErrors[index]).filter(Number.isFinite).sort((left, right) => left - right);
      return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1)] : 0;
    });
    const pooled = (items) => {
      const denominator = items.reduce((sum, fold) => sum + fold.denominator, 0);
      return denominator > 0
        ? items.reduce((sum, fold) => sum + fold.absoluteErrors.reduce((inner, value) => inner + value, 0), 0) / denominator * 100
        : null;
    };
    return latest ? {
      route,
      folds: folds.length,
      developmentWmape: pooled(development),
      allWmape: pooled(folds),
      latestWmape: latest.wmape,
      latestPersistenceWmape: latest.persistenceWmape,
      marginByHorizon,
      latest,
      future: routeAt(seriesByPlatform, route, n, horizon),
    } : null;
  }).filter(Boolean);
  if (candidates.length !== 2) return null;
  candidates.sort((left, right) => left.latestWmape - right.latestWmape || left.allWmape - right.allWmape);
  const selected = candidates[0];
  const currentBreak = hasRecentStep([totalPanel, androidPanel, iosPanel]);
  return {
    model: "annual-analog-regime-v1",
    selectedRoute: selected.route,
    selected,
    candidates,
    currentBreak,
    qualified: currentBreak
      && selected.latestWmape < 10
      && selected.latestWmape < selected.latestPersistenceWmape * 0.8,
    horizon,
    foldStep,
  };
}
