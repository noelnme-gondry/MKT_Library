const DEFAULT_HORIZON = 12;
const DEFAULT_FOLD_STEP = 4;
const DEFAULT_SELECTION_FOLDS = 6;
const ANNUAL_ANALOG_SPECS = [4, 8, 16].flatMap((anchorWeeks) =>
  [0.5, 1].flatMap((seasonWeight) =>
    [0.75, 1].map((ratioPower) => ({
      id: `anchor-${anchorWeeks}__season-${seasonWeight}__scale-${ratioPower}`,
      anchorWeeks,
      seasonWeight,
      ratioPower,
    })),
  ),
);

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

function annualAt(series, trainEnd, horizon, spec = ANNUAL_ANALOG_SPECS.find((item) =>
  item.anchorWeeks === 4 && item.seasonWeight === 1 && item.ratioPower === 1,
)) {
  const anchorWeeks = spec?.anchorWeeks || 4;
  if (!Array.isArray(series) || trainEnd < 52 + anchorWeeks || trainEnd - 52 + horizon > trainEnd) return null;
  const recent = mean(series.slice(trainEnd - anchorWeeks, trainEnd));
  const prior = mean(series.slice(trainEnd - 52 - anchorWeeks, trainEnd - 52));
  if (!(prior > 0) || !Number.isFinite(recent)) return null;
  const rawRatio = Math.max(0.25, Math.min(4, recent / prior));
  const ratio = rawRatio ** (spec?.ratioPower ?? 1);
  const local = Math.max(0, recent);
  const seasonWeight = Math.max(0, Math.min(1, spec?.seasonWeight ?? 1));
  return {
    ratio,
    predicted: series.slice(trainEnd - 52, trainEnd - 52 + horizon).map((value) =>
      Math.max(0, local * (1 - seasonWeight) + value * ratio * seasonWeight),
    ),
  };
}

function routeAt(seriesByPlatform, route, trainEnd, horizon, spec) {
  if (route === "direct-total") return annualAt(seriesByPlatform.total, trainEnd, horizon, spec);
  const android = annualAt(seriesByPlatform.android, trainEnd, horizon, spec);
  const ios = annualAt(seriesByPlatform.ios, trainEnd, horizon, spec);
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

function pooledWmape(folds) {
  const denominator = (folds || []).reduce((sum, fold) => sum + (fold.denominator || 0), 0);
  return denominator > 0
    ? folds.reduce((sum, fold) => sum + (fold.absoluteErrors || []).reduce((inner, value) => inner + value, 0), 0) / denominator * 100
    : null;
}

function selectCandidateAt(candidates, trainEnd, horizon, selectionFolds, requireCurrent = true) {
  const eligible = candidates.map((candidate) => {
    const current = candidate.folds.find((fold) => fold.trainEnd === trainEnd);
    const prior = candidate.folds.filter((fold) => fold.trainEnd + horizon <= trainEnd);
    if ((requireCurrent && !current) || prior.length < selectionFolds) return null;
    const recent = prior.slice(-selectionFolds);
    const weights = recent.map((_, index) => index + 1);
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    const score = recent.reduce((sum, fold, index) => sum + fold.wmape * weights[index], 0) / weightTotal;
    const instability = recent.reduce((sum, fold) => sum + Math.abs(fold.wmape - score), 0) / recent.length;
    return { candidate, current, score, instability, selectionScore: score + instability * 0.15 };
  }).filter(Boolean);
  eligible.sort((left, right) =>
    left.selectionScore - right.selectionScore
    || left.score - right.score
    || left.candidate.route.localeCompare(right.candidate.route)
    || left.candidate.spec.id.localeCompare(right.candidate.spec.id),
  );
  return eligible[0] || null;
}

function nestedTournament(candidates, starts, n, horizon, selectionFolds) {
  const folds = starts.map((trainEnd) => {
    const chosen = selectCandidateAt(candidates, trainEnd, horizon, selectionFolds);
    return chosen?.current ? {
      ...chosen.current,
      route: chosen.candidate.route,
      spec: chosen.candidate.spec,
      priorScore: chosen.score,
      selectionScore: chosen.selectionScore,
    } : null;
  }).filter(Boolean);
  const latest = folds.find((fold) => fold.offset === 0) || null;
  const development = folds.filter((fold) => fold.offset >= horizon);
  return {
    folds,
    latest,
    development,
    developmentWmape: pooledWmape(development),
    allWmape: pooledWmape(folds),
  };
}

export function runAnnualAnalogRouter({
  totalPanel,
  androidPanel,
  iosPanel,
  target = "Regs",
  horizon = DEFAULT_HORIZON,
  foldStep = DEFAULT_FOLD_STEP,
  selectionFolds = DEFAULT_SELECTION_FOLDS,
}) {
  const total = totalPanel?.targets?.[target];
  const android = androidPanel?.targets?.[target];
  const ios = iosPanel?.targets?.[target];
  const n = total?.length || 0;
  if (!n || android?.length !== n || ios?.length !== n || n < 68 + horizon) return null;
  const seriesByPlatform = { total, android, ios };
  const starts = [];
  for (let start = 78; start <= n - horizon; start += foldStep) starts.push(start);
  if (starts.at(-1) !== n - horizon) starts.push(n - horizon);
  const modelCandidates = ["direct-total", "android-ios-sum"].flatMap((route) =>
    ANNUAL_ANALOG_SPECS.map((spec) => {
      const folds = starts.map((trainEnd) => {
        const forecast = routeAt(seriesByPlatform, route, trainEnd, horizon, spec);
        const actual = total.slice(trainEnd, trainEnd + horizon);
        const error = forecast && wmape(actual, forecast.predicted);
        const persistenceLevel = mean(total.slice(trainEnd - 8, trainEnd));
        const persistence = Array(horizon).fill(Math.max(0, persistenceLevel || 0));
        const persistenceError = wmape(actual, persistence);
        const componentErrors = forecast?.parts ? {
          android: wmape(android.slice(trainEnd, trainEnd + horizon), forecast.parts.android),
          ios: wmape(ios.slice(trainEnd, trainEnd + horizon), forecast.parts.ios),
        } : null;
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
          componentErrors,
        } : null;
      }).filter(Boolean);
      return { route, spec, folds };
    }),
  ).filter((candidate) => candidate.folds.length === starts.length);
  if (!modelCandidates.length) return null;

  const nested = nestedTournament(modelCandidates, starts, n, horizon, selectionFolds);
  const productionChoice = selectCandidateAt(modelCandidates, n, horizon, selectionFolds, false);
  if (!nested.latest || !productionChoice) return null;

  const routeTournaments = ["direct-total", "android-ios-sum"].map((route) => {
    const routeNested = nestedTournament(
      modelCandidates.filter((candidate) => candidate.route === route),
      starts,
      n,
      horizon,
      selectionFolds,
    );
    return routeNested.latest ? {
      route,
      ...routeNested,
      latestWmape: routeNested.latest.wmape,
      latestPersistenceWmape: routeNested.latest.persistenceWmape,
    } : null;
  }).filter(Boolean);
  const osTournament = routeTournaments.find((candidate) => candidate.route === "android-ios-sum");
  const osGuardrail = osTournament?.latest?.componentErrors
    ? ["android", "ios"].map((component) => {
      const developmentDenominator = osTournament.development.reduce((sum, fold) =>
        sum + (fold.componentErrors?.[component]?.denominator || 0), 0);
      const developmentAbsoluteError = osTournament.development.reduce((sum, fold) =>
        sum + (fold.componentErrors?.[component]?.absoluteErrors || []).reduce((inner, value) => inner + value, 0), 0);
      const latestWmape = osTournament.latest.componentErrors[component]?.wmape ?? null;
      const developmentWmape = developmentDenominator > 0 ? developmentAbsoluteError / developmentDenominator * 100 : null;
      return {
        component,
        latestWmape,
        developmentWmape,
        passed: Number.isFinite(latestWmape)
          && Number.isFinite(developmentWmape)
          && latestWmape < 10
          && developmentWmape < 10,
      };
    })
    : [];
  const osGuardrailPassed = osGuardrail.length >= 2 && osGuardrail.every((component) => component.passed);
  const marginByHorizon = Array.from({ length: horizon }, (_, index) => {
    const sorted = nested.development
      .map((fold) => fold.absoluteErrors[index])
      .filter(Number.isFinite)
      .sort((left, right) => left - right);
    return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1)] : 0;
  });
  const selected = {
    route: productionChoice.candidate.route,
    spec: productionChoice.candidate.spec,
    folds: nested.folds.length,
    developmentWmape: nested.developmentWmape,
    allWmape: nested.allWmape,
    latestWmape: nested.latest.wmape,
    latestPersistenceWmape: nested.latest.persistenceWmape,
    latest: nested.latest,
    marginByHorizon,
    future: routeAt(seriesByPlatform, productionChoice.candidate.route, n, horizon, productionChoice.candidate.spec),
    productionPriorWmape: productionChoice.score,
  };
  const currentBreak = hasRecentStep([totalPanel, androidPanel, iosPanel]);
  return {
    model: "annual-analog-regime-v2-nested-tournament",
    selectedRoute: selected.route,
    selected,
    candidates: routeTournaments.map((candidate) => ({
      route: candidate.route,
      developmentWmape: candidate.developmentWmape,
      allWmape: candidate.allWmape,
      latestWmape: candidate.latestWmape,
      latestPersistenceWmape: candidate.latestPersistenceWmape,
    })),
    currentBreak,
    osGuardrail,
    osGuardrailPassed,
    qualified: currentBreak
      && selected.developmentWmape < 10
      && selected.latestWmape < 10
      && selected.latestWmape < selected.latestPersistenceWmape * 0.8
      && osGuardrailPassed,
    horizon,
    foldStep,
    selectionFolds,
  };
}

export function shouldUseAnnualAnalogFallback(annual, routeDecision) {
  return Boolean(
    annual?.currentBreak
    && !annual.qualified
    && Number.isFinite(annual.selected?.latestWmape)
    && annual.selected.latestWmape < annual.selected.latestPersistenceWmape
    && (!Number.isFinite(routeDecision?.latestWmape) || annual.selected.latestWmape < routeDecision.latestWmape)
  );
}
