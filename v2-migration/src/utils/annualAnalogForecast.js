const DEFAULT_HORIZON = 12;
const DEFAULT_SELECTION_FOLDS = 6;
const MIN_INITIAL_TRAINING_WEEKS = 26;
const MAX_TRAINING_WEEKS = 208;
const MIN_CERTIFICATION_FOLDS = 3;
const MIN_INTERVAL_FOLDS = 8;
const BLEND_WEIGHTS = [0, 0.25, 0.5, 0.75, 1];
const SELECTION_CRITERIA = {
  overallBase: 1,
  recentDeterioration: 0.1,
  tailRiskDeterioration: 0.1,
  instability: 0.1,
};
const PERFORMANCE_GUARDRAILS = {
  overallTolerancePoints: 0,
  recentTolerancePoints: 0,
  tailRiskToleranceRatio: 1.1,
  minimumFoldWinRate: 0.5,
};
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
const ORGANIC_LEVEL_SPECS = [4, 8, 12, 16, 26, 52, 78, 104, 130, 156, 208].map((window) => ({
  id: `flat-${window}`,
  kind: "flat",
  window,
}));
const LOCAL_TREND_SPECS = [8, 12, 26, 52, 78, 104, 130, 156, 208].flatMap((window) =>
  [0.25, 0.5, 0.75, 1].map((damping) => ({
    id: `trend-${window}-${damping}`,
    kind: "trend",
    window,
    damping,
  })),
);
const LOCAL_HOLT_SPECS = [26, 52, 104, 130, 156, 208].flatMap((window) =>
  [0.3, 0.7].flatMap((alpha) =>
    [0.1, 0.3].flatMap((beta) =>
      [0.8, 0.95].map((damping) => ({
        id: `holt-${window}-${alpha}-${beta}-${damping}`,
        kind: "holt",
        window,
        alpha,
        beta,
        damping,
      })),
    ),
  ),
);
const SIMILAR_SEASON_SPECS = [13, 26].flatMap((matchWeeks) =>
  [0.25, 0.5].flatMap((temperature) =>
    [2, 3].map((neighbors) => ({
      id: `similar-season-${matchWeeks}-${temperature}-k${neighbors}`,
      kind: "similar-season",
      window: 104,
      matchWeeks,
      temperature,
      neighbors,
    })),
  ),
);
const BOUNDED_SERIES_SPECS = [
  ...ORGANIC_LEVEL_SPECS,
  ...LOCAL_TREND_SPECS,
  ...LOCAL_HOLT_SPECS,
  ...SIMILAR_SEASON_SPECS,
  ...ANNUAL_ANALOG_SPECS.map((spec) => ({ ...spec, kind: "annual" })),
];
const PAID_RESPONSE_SPECS = [
  ...[4, 8, 12, 26, 52].flatMap((window) =>
    [0, 0.3, 0.6, 0.8].map((decay) => ({
      id: `rate-${window}-${decay}`,
      kind: "rate",
      window,
      decay,
    })),
  ),
  ...[26, 52, 78].flatMap((window) =>
    [0, 0.3, 0.6, 0.8].flatMap((decay) =>
      ["raw", "sqrt", "log"].flatMap((transform) =>
        [false, true].flatMap((channels) =>
          [1, 10, 100].map((penalty) => ({
            id: `ridge-${window}-${decay}-${transform}-${channels ? "channels" : "total"}-${penalty}`,
            kind: "ridge",
            window,
            decay,
            transform,
            channels,
            penalty,
          })),
        ),
      ),
    ),
  ),
];

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

export function similarSeasonAt(series, trainEnd, horizon, spec) {
  const matchWeeks = spec?.matchWeeks || 13;
  if (!Array.isArray(series) || trainEnd < 104 || trainEnd > series.length) return null;
  const current = series.slice(trainEnd - matchWeeks, trainEnd);
  const currentMean = mean(current);
  if (!(currentMean > 0) || current.length !== matchWeeks) return null;
  const analogs = [26, 52, 78].map((lag) => {
    const origin = trainEnd - lag;
    if (origin + horizon > trainEnd) return null;
    const history = series.slice(origin - matchWeeks, origin);
    const future = series.slice(origin, origin + horizon);
    const historyMean = mean(history);
    if (!(historyMean > 0) || history.length !== matchWeeks || future.length !== horizon) return null;
    const distance = Math.sqrt(history.reduce((sum, value, index) => {
      const currentNormalized = current[index] / currentMean;
      const historyNormalized = value / historyMean;
      return sum + (currentNormalized - historyNormalized) ** 2;
    }, 0) / matchWeeks);
    const scale = Math.max(0.25, Math.min(4, currentMean / historyMean));
    return {
      lag,
      distance,
      predicted: future.map((value) => Math.max(0, value * scale)),
    };
  }).filter(Boolean).sort((left, right) => left.distance - right.distance || left.lag - right.lag)
    .slice(0, Math.max(1, spec?.neighbors || 2));
  if (analogs.length < 2) return null;
  const temperature = Math.max(0.05, spec?.temperature || 0.5);
  const rawWeights = analogs.map((analog) => Math.exp(-analog.distance / temperature));
  const weightTotal = rawWeights.reduce((sum, value) => sum + value, 0);
  if (!(weightTotal > 0)) return null;
  const weights = rawWeights.map((value) => value / weightTotal);
  return {
    predicted: Array.from({ length: horizon }, (_, index) =>
      analogs.reduce((sum, analog, analogIndex) =>
        sum + analog.predicted[index] * weights[analogIndex], 0),
    ),
    analogs: analogs.map((analog, index) => ({
      lag: analog.lag,
      distance: analog.distance,
      weight: weights[index],
    })),
  };
}

function localSeriesAt(series, trainEnd, horizon, spec) {
  if (spec?.kind === "annual") return annualAt(series, trainEnd, horizon, spec)?.predicted || null;
  if (spec?.kind === "similar-season") return similarSeasonAt(series, trainEnd, horizon, spec)?.predicted || null;
  const window = Math.min(MAX_TRAINING_WEEKS, Math.max(2, spec?.window || 8));
  const start = trainEnd - window;
  if (!Array.isArray(series) || start < 0 || trainEnd > series.length) return null;
  const sample = series.slice(start, trainEnd);
  const flatLevel = Math.max(0, mean(sample) || 0);
  const recentLevel = Math.max(0, mean(sample.slice(-Math.min(4, sample.length))) || 0);
  if (spec?.kind === "flat") return Array(horizon).fill(flatLevel);
  if (spec?.kind === "holt") {
    let smoothedLevel = Math.max(0, sample[0]);
    let smoothedTrend = sample.length > 1 ? sample[1] - sample[0] : 0;
    const alpha = Math.max(0.01, Math.min(0.99, spec.alpha));
    const beta = Math.max(0.01, Math.min(0.99, spec.beta));
    const damping = Math.max(0, Math.min(0.99, spec.damping));
    for (let index = 1; index < sample.length; index += 1) {
      const priorLevel = smoothedLevel;
      smoothedLevel = alpha * sample[index]
        + (1 - alpha) * (smoothedLevel + damping * smoothedTrend);
      smoothedTrend = beta * (smoothedLevel - priorLevel)
        + (1 - beta) * damping * smoothedTrend;
    }
    const lower = recentLevel * 0.25;
    const upper = Math.max(recentLevel * 4, recentLevel + 1);
    return Array.from({ length: horizon }, (_, index) => {
      const dampedSteps = damping > 0
        ? damping * (1 - damping ** (index + 1)) / (1 - damping)
        : 0;
      return Math.max(0, Math.min(upper, Math.max(lower, smoothedLevel + dampedSteps * smoothedTrend)));
    });
  }
  const xMean = (sample.length - 1) / 2;
  const yMean = mean(sample);
  const denominator = sample.reduce((sum, _, index) => sum + (index - xMean) ** 2, 0);
  if (!(denominator > 0) || !Number.isFinite(yMean)) return null;
  const slope = sample.reduce((sum, value, index) =>
    sum + (index - xMean) * (value - yMean), 0) / denominator;
  const damping = Math.max(0, Math.min(1, spec?.damping ?? 0.5));
  const trendLevel = yMean + slope * (sample.length - 1 - xMean);
  const lower = recentLevel * 0.25;
  const upper = Math.max(recentLevel * 4, recentLevel + 1);
  return Array.from({ length: horizon }, (_, index) =>
    Math.max(0, Math.min(upper, Math.max(lower, trendLevel + slope * (index + 1) * damping))),
  );
}

// Public test/provenance seam for the bounded univariate candidates. The
// selector and tests call the exact same implementation, so a displayed
// window cannot silently differ from the values the model actually used.
export function forecastBoundedSeriesAt(series, trainEnd, horizon, spec) {
  return localSeriesAt(series, trainEnd, horizon, spec);
}

function seriesComplexityPenalty(spec) {
  if (spec?.kind === "flat" || spec?.kind === "rate") return 0;
  if (spec?.kind === "trend") return 0.05;
  if (spec?.kind === "holt" || spec?.kind === "ridge") return 0.1;
  if (spec?.kind === "similar-season") return 0.15;
  if (spec?.kind === "annual") return 0.2;
  return 0;
}

function specTrainingWindow(spec) {
  if (Number.isFinite(spec?.window)) return spec.window;
  if (spec?.kind === "annual") return 52 + Math.max(1, Number(spec.anchorWeeks) || 4);
  return null;
}

export function annualForecastTrainingWindowFeasibility({
  observedWeeks,
  horizon = DEFAULT_HORIZON,
  foldStride = horizon,
  selectionFolds = DEFAULT_SELECTION_FOLDS,
} = {}) {
  const n = Math.max(0, Math.floor(Number(observedWeeks) || 0));
  const useHorizon = Math.max(1, Math.floor(Number(horizon) || DEFAULT_HORIZON));
  const useStride = Math.max(useHorizon, Math.floor(Number(foldStride) || useHorizon));
  const useSelectionFolds = Math.max(0, Math.floor(Number(selectionFolds) || 0));
  const declaredTrainingWindows = [...new Set(BOUNDED_SERIES_SPECS
    .map(specTrainingWindow)
    .filter(Number.isFinite))]
    .sort((left, right) => left - right);
  // Production spec은 봉인 H주 직전 origin에서 골라야 하고, 그보다 오래된
  // 독립 origin을 selectionFolds개 가져야 한다.
  const maximumWindowByEvidence = Math.max(
    0,
    n - useHorizon - useSelectionFolds * useStride,
  );
  const feasibleTrainingWindows = declaredTrainingWindows.filter((window) =>
    window <= maximumWindowByEvidence);
  const excludedTrainingWindows = declaredTrainingWindows
    .filter((window) => window > maximumWindowByEvidence)
    .map((window) => ({
      window,
      reason: "insufficient-independent-folds",
      minimumObservedWeeks: window + useHorizon + useSelectionFolds * useStride,
    }));
  return {
    observedWeeks: n,
    configuredMaxTrainingWeeks: MAX_TRAINING_WEEKS,
    maximumWindowByEvidence,
    feasibleMaxTrainingWeeks: feasibleTrainingWindows.at(-1) || null,
    feasibleTrainingWindows,
    excludedTrainingWindows,
    horizon: useHorizon,
    foldStride: useStride,
    selectionFolds: useSelectionFolds,
  };
}

function selectionIdentity(route, spec, {
  trainingEndIndex = null,
  refitThroughIndex = null,
  components = null,
} = {}) {
  return {
    route,
    specId: spec?.id || "unknown",
    family: spec?.kind || "adaptive",
    window: specTrainingWindow(spec),
    spec: spec ? { ...spec } : null,
    trainingEndIndex,
    refitThroughIndex,
    ...(components ? { components } : {}),
  };
}

function routeAt(seriesByPlatform, route, trainEnd, horizon, spec) {
  if (route === "direct-total") {
    const predicted = localSeriesAt(seriesByPlatform.total, trainEnd, horizon, spec);
    return predicted ? { predicted, ratio: null } : null;
  }
  const android = localSeriesAt(seriesByPlatform.android, trainEnd, horizon, spec);
  const ios = localSeriesAt(seriesByPlatform.ios, trainEnd, horizon, spec);
  if (!android || !ios) return null;
  return {
    ratio: null,
    predicted: android.map((value, index) => value + ios[index]),
    parts: { android, ios },
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

function summarizeDevelopmentEvidence(folds, series) {
  const development = (folds || []).map((fold) => {
    const trainEnd = Number(fold?.trainEnd);
    const actual = Array.isArray(fold?.actual) ? fold.actual : [];
    const persistenceLevel = Number.isInteger(trainEnd)
      ? mean(series.slice(Math.max(0, trainEnd - 8), trainEnd))
      : null;
    const persistence = actual.map(() => Math.max(0, persistenceLevel || 0));
    const persistenceError = Number.isFinite(persistenceLevel)
      ? wmape(actual, persistence)
      : null;
    return Number.isFinite(fold?.wmape) && Number.isFinite(persistenceError?.wmape)
      ? {
        wmape: fold.wmape,
        persistenceWmape: persistenceError.wmape,
      }
      : null;
  }).filter(Boolean);
  const isComplete = development.length > 0 && development.length === (folds || []).length;
  return {
    foldCount: development.length,
    worstWmape: isComplete
      ? Math.max(...development.map((fold) => fold.wmape))
      : null,
    persistenceWinRate: isComplete
      ? development.filter((fold) => fold.wmape <= fold.persistenceWmape).length / development.length
      : null,
  };
}

function foldWmapePercentile(folds, percentile = 0.9) {
  const values = (folds || []).map((fold) => fold.wmape).filter(Number.isFinite)
    .sort((left, right) => left - right);
  return values.length
    ? values[Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * percentile) - 1))]
    : null;
}

function scoreCandidateFolds(folds, recentCount, selectionPenalty = 0) {
  const ordered = [...(folds || [])].sort((left, right) => left.trainEnd - right.trainEnd);
  const recent = ordered.slice(-Math.min(Math.max(1, recentCount), ordered.length));
  const overallWmape = pooledWmape(ordered);
  const recentWmape = pooledWmape(recent);
  const tailRiskWmape = foldWmapePercentile(ordered);
  if (![overallWmape, recentWmape, tailRiskWmape].every(Number.isFinite)) return null;
  const instabilityWmape = ordered.reduce((sum, fold) =>
    sum + Math.abs(fold.wmape - overallWmape), 0) / ordered.length;
  const complexityPenalty = Math.max(0, Number(selectionPenalty) || 0);
  return {
    overallWmape,
    recentWmape,
    tailRiskWmape,
    instabilityWmape,
    complexityPenalty,
    compositeScore: overallWmape * SELECTION_CRITERIA.overallBase
      + Math.max(0, recentWmape - overallWmape) * SELECTION_CRITERIA.recentDeterioration
      + Math.max(0, tailRiskWmape - overallWmape) * SELECTION_CRITERIA.tailRiskDeterioration
      + instabilityWmape * SELECTION_CRITERIA.instability
      + complexityPenalty,
  };
}

function candidateIdentity(candidate) {
  return {
    route: candidate.route,
    specId: candidate.spec?.id || "unknown",
  };
}

function isGuardrailBaseline(candidate) {
  return candidate?.spec?.id === "flat-8"
    || candidate?.spec?.id === "rate-8-0"
    || candidate?.spec?.id === "blend-0"
    || candidate?.spec?.id === "bounded-total-router";
}

function applyPerformanceGuardrail(evaluated) {
  const baseline = evaluated.filter((item) => isGuardrailBaseline(item.candidate))
    .sort((left, right) =>
      left.metrics.compositeScore - right.metrics.compositeScore
      || left.candidate.route.localeCompare(right.candidate.route),
    )[0] || null;
  if (!baseline) {
    return {
      eligible: evaluated,
      baseline: null,
      rejected: [],
    };
  }
  const rejected = [];
  const eligible = evaluated.filter((item) => {
    if (item === baseline) return true;
    const baselineByTrainEnd = new Map((baseline.history || []).map((fold) => [fold.trainEnd, fold]));
    const comparable = (item.history || []).map((fold) => {
      const baselineFold = baselineByTrainEnd.get(fold.trainEnd);
      return baselineFold ? { candidate: fold.wmape, baseline: baselineFold.wmape } : null;
    }).filter(Boolean);
    const foldWinRate = comparable.length
      ? comparable.filter((fold) => fold.candidate <= fold.baseline).length / comparable.length
      : 0;
    item.metrics.foldWinRate = foldWinRate;
    const reasons = [];
    if (item.metrics.overallWmape > baseline.metrics.overallWmape + PERFORMANCE_GUARDRAILS.overallTolerancePoints) {
      reasons.push("overall-worse-than-baseline");
    }
    if (item.metrics.recentWmape > baseline.metrics.recentWmape + PERFORMANCE_GUARDRAILS.recentTolerancePoints) {
      reasons.push("recent-worse-than-baseline");
    }
    if (item.metrics.tailRiskWmape > baseline.metrics.tailRiskWmape * PERFORMANCE_GUARDRAILS.tailRiskToleranceRatio) {
      reasons.push("tail-risk-worse-than-baseline");
    }
    if (foldWinRate < PERFORMANCE_GUARDRAILS.minimumFoldWinRate) {
      reasons.push("insufficient-fold-wins");
    }
    if (reasons.length) {
      rejected.push({
        ...candidateIdentity(item.candidate),
        ...item.metrics,
        reasons,
      });
      return false;
    }
    return true;
  });
  return { eligible, baseline, rejected };
}

function buildSelectionDecision(eligible, winner, guardrail = null) {
  const isWinner = (item) => item?.candidate === winner?.candidate
    || (
      item?.candidate?.route === winner?.candidate?.route
      && item?.candidate?.spec?.id === winner?.candidate?.spec?.id
    );
  const rank = (key) => [...eligible].sort((left, right) =>
    left.metrics[key] - right.metrics[key]
    || left.metrics.compositeScore - right.metrics.compositeScore,
  ).findIndex(isWinner) + 1;
  const ranks = {
    overall: rank("overallWmape"),
    recent: rank("recentWmape"),
    tailRisk: rank("tailRiskWmape"),
    instability: rank("instabilityWmape"),
  };
  const reasonCodes = Object.entries(ranks).filter(([, value]) => value === 1).map(([key]) => key);
  if (!reasonCodes.length) reasonCodes.push("balanced");
  if (winner.metrics.complexityPenalty === 0) reasonCodes.push("simpler");
  const runnerUp = eligible.find((item) => !isWinner(item)) || null;
  const rejectedByReason = (guardrail?.rejected || []).reduce((counts, item) => {
    item.reasons.forEach((reason) => {
      counts[reason] = (counts[reason] || 0) + 1;
    });
    return counts;
  }, {});
  return {
    criteria: SELECTION_CRITERIA,
    winner: {
      ...candidateIdentity(winner.candidate),
      ...winner.metrics,
      ranks,
      reasonCodes,
    },
    runnerUp: runnerUp ? {
      ...candidateIdentity(runnerUp.candidate),
      ...runnerUp.metrics,
    } : null,
    scoreGap: runnerUp ? runnerUp.metrics.compositeScore - winner.metrics.compositeScore : null,
    candidatesCompared: eligible.length,
    candidatesEvaluated: guardrail?.evaluatedCount ?? eligible.length,
    guardrail: guardrail ? {
      enabled: Boolean(guardrail.baseline),
      thresholds: PERFORMANCE_GUARDRAILS,
      fallbackUsed: guardrail.baseline === winner,
      baseline: guardrail.baseline ? {
        ...candidateIdentity(guardrail.baseline.candidate),
        ...guardrail.baseline.metrics,
      } : null,
      rejectedCount: guardrail.rejected.length,
      rejectedByReason,
      rejected: guardrail.rejected.slice(0, 12),
    } : null,
  };
}

function selectStableCandidate(candidates, horizon) {
  const evaluated = candidates.map((candidate) => {
    const development = candidate.folds.filter((fold) => fold.offset >= horizon);
    const selectionPenalty = Math.max(0, Number(candidate.selectionPenalty) || 0);
    const metrics = scoreCandidateFolds(development, 6, selectionPenalty);
    if (!development.length || !metrics) return null;
    return {
      candidate,
      score: metrics.overallWmape,
      instability: metrics.instabilityWmape,
      tailRisk: metrics.tailRiskWmape,
      selectionScore: metrics.compositeScore,
      metrics,
      history: development,
    };
  }).filter(Boolean);
  const guarded = applyPerformanceGuardrail(evaluated);
  const eligible = guarded.eligible;
  eligible.sort((left, right) =>
    left.selectionScore - right.selectionScore
    || left.score - right.score
    || left.candidate.route.localeCompare(right.candidate.route)
    || left.candidate.spec.id.localeCompare(right.candidate.spec.id),
  );
  const winner = selectDataPreservingAnnualCandidate(eligible);
  return winner ? {
    ...winner,
    decision: buildSelectionDecision(eligible, winner, {
      ...guarded,
      evaluatedCount: evaluated.length,
    }),
  } : null;
}

function annualEvidenceWindow(spec) {
  if (Number.isFinite(spec?.window)) return Number(spec.window);
  if (spec?.kind === "annual" || spec?.kind === "similar-season") return 104;
  return 0;
}

function selectDataPreservingAnnualCandidate(ranked) {
  const rawBest = ranked?.[0] || null;
  if (!rawBest) return null;
  const tolerance = Math.max(0.1, Math.max(0, rawBest.score) * 0.02);
  const equivalent = ranked.filter((item) =>
    item.candidate.route === rawBest.candidate.route
    && item.candidate.spec?.kind === rawBest.candidate.spec?.kind
    && item.score <= rawBest.score + tolerance
    && item.selectionScore <= rawBest.selectionScore + tolerance);
  equivalent.sort((left, right) =>
    annualEvidenceWindow(right.candidate.spec)
      - annualEvidenceWindow(left.candidate.spec)
    || left.selectionScore - right.selectionScore
    || left.candidate.spec.id.localeCompare(right.candidate.spec.id));
  const selected = equivalent[0] || rawBest;
  return {
    ...selected,
    dataPreservation: {
      applied: selected.candidate.spec.id !== rawBest.candidate.spec.id,
      tolerancePoints: tolerance,
      equivalentCandidates: equivalent.length,
      rawBestSpecId: rawBest.candidate.spec.id,
      selectedSpecId: selected.candidate.spec.id,
    },
  };
}

function selectCandidateAt(
  candidates,
  trainEnd,
  horizon,
  selectionFolds,
  requireCurrent = true,
  maxSelectionFolds = selectionFolds,
) {
  const evaluated = candidates.map((candidate) => {
    const current = candidate.folds.find((fold) => fold.trainEnd === trainEnd);
    const prior = candidate.folds.filter((fold) => fold.trainEnd + horizon <= trainEnd);
    if ((requireCurrent && !current) || prior.length < selectionFolds) return null;
    const history = prior.slice(-Math.max(selectionFolds, maxSelectionFolds));
    const selectionPenalty = Math.max(0, Number(candidate.selectionPenalty) || 0);
    const metrics = scoreCandidateFolds(history, selectionFolds, selectionPenalty);
    if (!metrics) return null;
    return {
      candidate,
      current,
      score: metrics.overallWmape,
      instability: metrics.instabilityWmape,
      selectionScore: metrics.compositeScore,
      metrics,
      history,
    };
  }).filter(Boolean);
  const guarded = applyPerformanceGuardrail(evaluated);
  const eligible = guarded.eligible;
  eligible.sort((left, right) =>
    left.selectionScore - right.selectionScore
    || left.score - right.score
    || left.candidate.route.localeCompare(right.candidate.route)
    || left.candidate.spec.id.localeCompare(right.candidate.spec.id),
  );
  const winner = selectDataPreservingAnnualCandidate(eligible);
  return winner ? {
    ...winner,
    decision: buildSelectionDecision(eligible, winner, {
      ...guarded,
      evaluatedCount: evaluated.length,
    }),
  } : null;
}

function nestedTournament(candidates, starts, n, horizon, selectionFolds, maxSelectionFolds = selectionFolds) {
  const folds = starts.map((trainEnd) => {
    const chosen = selectCandidateAt(candidates, trainEnd, horizon, selectionFolds, true, maxSelectionFolds);
    return chosen?.current ? {
      ...chosen.current,
      route: chosen.candidate.route,
      spec: chosen.candidate.spec,
      priorScore: chosen.score,
      selectionScore: chosen.selectionScore,
      selectionDecision: chosen.decision,
      dataPreservation: chosen.dataPreservation || null,
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

function solveLinearSystem(matrix, vector) {
  const size = vector.length;
  const augmented = matrix.map((row, index) => [...row, vector[index]]);
  for (let column = 0; column < size; column += 1) {
    let pivot = column;
    for (let row = column + 1; row < size; row += 1) {
      if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) pivot = row;
    }
    if (Math.abs(augmented[pivot][column]) < 1e-10) return null;
    [augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];
    const divisor = augmented[column][column];
    for (let index = column; index <= size; index += 1) augmented[column][index] /= divisor;
    for (let row = 0; row < size; row += 1) {
      if (row === column) continue;
      const factor = augmented[row][column];
      for (let index = column; index <= size; index += 1) augmented[row][index] -= factor * augmented[column][index];
    }
  }
  return augmented.map((row) => row[size]);
}

function panelCostRows(panel, horizon = 0) {
  const columns = Object.values(panel?.ch || {});
  const n = panel?.week?.length || 0;
  if (!columns.length || columns.some((values) => values.length !== n)) return null;
  const rows = Array.from({ length: n }, (_, index) =>
    columns.map((values) => Math.max(0, Number(values[index]) || 0)),
  );
  if (horizon > 0) {
    const recent = columns.map((values) => {
      const sample = values.slice(-Math.min(4, values.length)).map((value) => Math.max(0, Number(value) || 0));
      return mean(sample) || 0;
    });
    for (let index = 0; index < horizon; index += 1) rows.push(recent.slice());
  }
  return rows;
}

function normalizePaidByCost(panel, total, paid) {
  const costRows = panelCostRows(panel);
  if (!costRows || costRows.length !== total.length) return null;
  const zeroedWeeks = [];
  const adjusted = paid.map((value, index) => {
    const totalCost = costRows[index].reduce((sum, cost) => sum + cost, 0);
    if (totalCost <= 1e-9) {
      if (value > 0) zeroedWeeks.push(index);
      return 0;
    }
    return value;
  });
  if (adjusted.some((value, index) =>
    !Number.isFinite(value) || value < 0 || value > total[index],
  )) return null;
  return { paid: adjusted, zeroedWeeks };
}

function adstockFeatures(costRows, decay, channels, transform) {
  const carry = Array(costRows[0]?.length || 0).fill(0);
  return costRows.map((row) => {
    const effective = row.map((value, index) => {
      carry[index] = Math.max(0, value) + decay * carry[index];
      return carry[index];
    });
    const features = channels ? effective : [effective.reduce((sum, value) => sum + value, 0)];
    return features.map((value) => {
      if (transform === "sqrt") return Math.sqrt(Math.max(0, value));
      if (transform === "log") return Math.log1p(Math.max(0, value));
      return value;
    });
  });
}

function ridgeForecast(features, target, trainEnd, horizon, spec) {
  const start = Math.max(0, trainEnd - spec.window);
  const train = features.slice(start, trainEnd);
  const outcome = target.slice(start, trainEnd);
  const width = train[0]?.length || 0;
  if (train.length < width + 3 || features.length < trainEnd + horizon) return null;
  const means = Array.from({ length: width }, (_, column) =>
    mean(train.map((row) => row[column])) || 0,
  );
  const scales = Array.from({ length: width }, (_, column) => {
    const variance = mean(train.map((row) => (row[column] - means[column]) ** 2)) || 0;
    return Math.sqrt(variance) > 1e-8 ? Math.sqrt(variance) : 1;
  });
  const design = train.map((row) => [1, ...row.map((value, column) => (value - means[column]) / scales[column])]);
  const size = width + 1;
  const xtx = Array.from({ length: size }, () => Array(size).fill(0));
  const xty = Array(size).fill(0);
  design.forEach((row, index) => {
    row.forEach((left, i) => {
      xty[i] += left * outcome[index];
      row.forEach((right, j) => { xtx[i][j] += left * right; });
    });
  });
  for (let index = 1; index < size; index += 1) xtx[index][index] += spec.penalty;
  const beta = solveLinearSystem(xtx, xty);
  if (!beta) return null;
  return features.slice(trainEnd, trainEnd + horizon).map((row) =>
    Math.max(0, beta[0] + row.reduce((sum, value, column) =>
      sum + beta[column + 1] * ((value - means[column]) / scales[column]), 0)),
  );
}

function paidForecast(panel, paid, trainEnd, horizon, spec, costRows = null) {
  const rows = costRows || panelCostRows(panel);
  if (!rows?.length || rows.length < trainEnd + horizon) return null;
  const features = adstockFeatures(rows, spec.decay, spec.channels === true, spec.transform || "raw");
  let predicted;
  if (spec.kind === "ridge") {
    predicted = ridgeForecast(features, paid, trainEnd, horizon, spec);
  } else {
    const total = features.map((row) => row.reduce((sum, value) => sum + value, 0));
    const start = Math.max(0, trainEnd - spec.window);
    const denominator = total.slice(start, trainEnd).reduce((sum, value) => sum + value, 0);
    if (!(denominator > 0)) return null;
    const rate = paid.slice(start, trainEnd).reduce((sum, value) => sum + value, 0) / denominator;
    predicted = total.slice(trainEnd, trainEnd + horizon).map((value) => Math.max(0, value * rate));
  }
  if (!predicted) return null;
  return predicted.map((value, index) =>
    rows[trainEnd + index].reduce((sum, cost) => sum + cost, 0) <= 1e-9 ? 0 : value,
  );
}

function componentCandidate(series, spec, starts, n, horizon, forecastAt, route) {
  const folds = starts.map((trainEnd) => {
    const predicted = forecastAt(trainEnd, horizon, spec);
    const actual = series.slice(trainEnd, trainEnd + horizon);
    const error = predicted && wmape(actual, predicted);
    return error ? {
      trainEnd,
      offset: n - trainEnd - horizon,
      actual,
      predicted,
      absoluteErrors: error.absoluteErrors,
      denominator: error.denominator,
      wmape: error.wmape,
    } : null;
  }).filter(Boolean);
  const selectionPenalty = seriesComplexityPenalty(spec);
  return { route, spec, folds, selectionPenalty };
}

function runComponentTournament(candidates, starts, n, horizon, selectionFolds, productionForecast) {
  const valid = candidates.filter((candidate) => candidate.folds.length >= selectionFolds + 1);
  const nested = nestedTournament(valid, starts, n, horizon, selectionFolds);
  const production = selectCandidateAt(valid, n - horizon, horizon, selectionFolds, true);
  if (!nested.latest || !production) return null;
  return {
    ...nested,
    production,
    future: productionForecast(production.candidate.spec),
  };
}

export function runPaidOrganicPlatform(panel, target, starts, n, horizon, selectionFolds) {
  const total = panel?.targets?.[target];
  const observedPaid = panel?.targets?.PaidRegs;
  if (!total?.length || observedPaid?.length !== total.length) return null;
  const normalized = normalizePaidByCost(panel, total, observedPaid);
  if (!normalized) return null;
  const paid = normalized.paid;
  const organic = total.map((value, index) => value - paid[index]);
  const organicCandidates = BOUNDED_SERIES_SPECS.map((spec) => componentCandidate(
    organic,
    spec,
    starts,
    n,
    horizon,
    (trainEnd, useHorizon, useSpec) => localSeriesAt(organic, trainEnd, useHorizon, useSpec),
    "organic",
  ));
  const productionCosts = panelCostRows(panel, horizon);
  const organicTournament = runComponentTournament(
    organicCandidates,
    starts,
    n,
    horizon,
    selectionFolds,
    (spec) => localSeriesAt(organic, n, horizon, spec),
  );
  const paidCandidates = PAID_RESPONSE_SPECS.map((spec) => componentCandidate(
    paid,
    spec,
    starts,
    n,
    horizon,
    (trainEnd, useHorizon, useSpec) => paidForecast(panel, paid, trainEnd, useHorizon, useSpec),
    "paid",
  ));
  const paidTournament = runComponentTournament(
    paidCandidates,
    starts,
    n,
    horizon,
    selectionFolds,
    (spec) => paidForecast(panel, paid, n, horizon, spec, productionCosts),
  );
  const totalCandidates = BOUNDED_SERIES_SPECS.map((spec) => componentCandidate(
    total,
    spec,
    starts,
    n,
    horizon,
    (trainEnd, useHorizon, useSpec) => localSeriesAt(total, trainEnd, useHorizon, useSpec),
    "bounded-total",
  ));
  const totalTournament = runComponentTournament(
    totalCandidates,
    starts,
    n,
    horizon,
    selectionFolds,
    (spec) => localSeriesAt(total, n, horizon, spec),
  );
  if (!organicTournament || !paidTournament || !totalTournament
    || !organicTournament.future || !paidTournament.future || !totalTournament.future) return null;
  const blendCandidates = BLEND_WEIGHTS.map((blendWeight) => {
    const folds = totalTournament.folds.map((totalFold) => {
      const organicFold = organicTournament.folds.find((fold) => fold.trainEnd === totalFold.trainEnd);
      const paidFold = paidTournament.folds.find((fold) => fold.trainEnd === totalFold.trainEnd);
      if (!organicFold || !paidFold) return null;
      const organicPredicted = totalFold.predicted.map((value, index) =>
        Math.max(0, value * (1 - blendWeight) + organicFold.predicted[index] * blendWeight),
      );
      const performancePredicted = paidFold.predicted.map((value) => Math.max(0, value * blendWeight));
      const predicted = organicPredicted.map((value, index) => value + performancePredicted[index]);
      const error = wmape(totalFold.actual, predicted);
      return error ? {
        trainEnd: totalFold.trainEnd,
        offset: totalFold.offset,
        actual: totalFold.actual,
        predicted,
        organicPredicted,
        performancePredicted,
        absoluteErrors: error.absoluteErrors,
        denominator: error.denominator,
        wmape: error.wmape,
      } : null;
    }).filter(Boolean);
    return {
      route: "paid-organic-blend",
      spec: { id: `blend-${blendWeight}`, blendWeight },
      selectionPenalty: Math.abs(blendWeight - 0.5) * 2,
      folds,
    };
  });
  const blendFoldCount = Math.min(...blendCandidates.map((candidate) => candidate.folds.length));
  const blendSelectionFolds = Math.max(3, Math.min(selectionFolds, blendFoldCount - 1));
  const blendMaxSelectionFolds = Math.max(blendSelectionFolds, Math.min(23, blendFoldCount - 1));
  const blendTournament = nestedTournament(
    blendCandidates,
    starts,
    n,
    horizon,
    blendSelectionFolds,
    blendMaxSelectionFolds,
  );
  const productionBlend = selectCandidateAt(
    blendCandidates,
    n - horizon,
    horizon,
    blendSelectionFolds,
    true,
    blendMaxSelectionFolds,
  );
  if (!blendTournament.latest || !productionBlend) return null;
  // Official development metrics must follow the nested selector itself.
  // Scoring one fixed blend on every outer fold after looking across all of
  // those folds would give the hybrid an optimistic advantage over the
  // bounded router, whose metric is already nested.
  const folds = blendTournament.folds;
  const latest = blendTournament.latest;
  const development = blendTournament.development;
  const auditWeight = latest.spec.blendWeight;
  const productionWeight = productionBlend.candidate.spec.blendWeight;
  const organicAuditSpec = organicTournament.latest.spec;
  const paidAuditSpec = paidTournament.latest.spec;
  const totalAuditSpec = totalTournament.latest.spec;
  const organicProductionSpec = organicTournament.production.candidate.spec;
  const paidProductionSpec = paidTournament.production.candidate.spec;
  const totalProductionSpec = totalTournament.production.candidate.spec;
  const organicSimilarSeason = organicProductionSpec.kind === "similar-season"
    ? similarSeasonAt(organic, n, horizon, organicProductionSpec)
    : null;
  const totalSimilarSeason = totalProductionSpec.kind === "similar-season"
    ? similarSeasonAt(total, n, horizon, totalProductionSpec)
    : null;
  const futureOrganic = totalTournament.future.map((value, index) =>
    Math.max(0, value * (1 - productionWeight) + organicTournament.future[index] * productionWeight),
  );
  const futurePerformance = paidTournament.future.map((value) => Math.max(0, value * productionWeight));
  return {
    folds,
    latest,
    development,
    developmentWmape: pooledWmape(development),
    allWmape: pooledWmape(folds),
    search: {
      maxTrainingWeeks: MAX_TRAINING_WEEKS,
      blendWeights: BLEND_WEIGHTS,
      selectionFolds: blendSelectionFolds,
      maxSelectionFolds: blendMaxSelectionFolds,
      selectionMode: "development-tournament-with-sealed-latest",
      nestedRollingWmape: blendTournament.allWmape,
      productionBlendWeight: productionWeight,
      auditBlendWeight: auditWeight,
      zeroedPaidWeeks: normalized.zeroedWeeks.length,
      selectedBlendWeights: [...new Set([
        ...folds.map((fold) => fold.spec.blendWeight),
        productionWeight,
      ])],
      auditDecision: latest.selectionDecision,
      productionDecision: productionBlend.decision,
      blendScores: blendCandidates.map((candidate) => ({
        blendWeight: candidate.spec.blendWeight,
        developmentWmape: pooledWmape(candidate.folds.filter((fold) => fold.offset >= horizon)),
        developmentP90Wmape: foldWmapePercentile(candidate.folds.filter((fold) => fold.offset >= horizon)),
        allWmape: pooledWmape(candidate.folds),
        latestWmape: candidate.folds.find((fold) => fold.offset === 0)?.wmape ?? null,
      })),
      organicSpec: organicTournament.production.candidate.spec.id,
      paidSpec: paidTournament.production.candidate.spec.id,
      totalSpec: totalTournament.production.candidate.spec.id,
      auditComponents: {
        organic: selectionIdentity("organic", organicAuditSpec, {
          trainingEndIndex: organicTournament.latest.trainEnd - 1,
        }),
        paid: selectionIdentity("paid", paidAuditSpec, {
          trainingEndIndex: paidTournament.latest.trainEnd - 1,
        }),
        total: selectionIdentity("bounded-total", totalAuditSpec, {
          trainingEndIndex: totalTournament.latest.trainEnd - 1,
        }),
      },
      productionComponents: {
        organic: selectionIdentity("organic", organicProductionSpec, {
          trainingEndIndex: organicTournament.latest.trainEnd - 1,
          refitThroughIndex: n - 1,
        }),
        paid: selectionIdentity("paid", paidProductionSpec, {
          trainingEndIndex: paidTournament.latest.trainEnd - 1,
          refitThroughIndex: n - 1,
        }),
        total: selectionIdentity("bounded-total", totalProductionSpec, {
          trainingEndIndex: totalTournament.latest.trainEnd - 1,
          refitThroughIndex: n - 1,
        }),
      },
      componentDecisions: {
        organic: organicTournament.production.decision,
        paid: paidTournament.production.decision,
        total: totalTournament.production.decision,
      },
      similarSeason: {
        organic: organicSimilarSeason ? {
          specId: organicProductionSpec.id,
          analogs: organicSimilarSeason.analogs,
        } : null,
        total: totalSimilarSeason ? {
          specId: totalProductionSpec.id,
          analogs: totalSimilarSeason.analogs,
        } : null,
      },
    },
    future: {
      organic: futureOrganic,
      performance: futurePerformance,
      predicted: futureOrganic.map((value, index) => value + futurePerformance[index]),
    },
  };
}

export function runPaidOrganicHybrid(androidPanel, iosPanel, totalSeries, target, starts, n, horizon, selectionFolds) {
  const android = runPaidOrganicPlatform(androidPanel, target, starts, n, horizon, selectionFolds);
  const ios = runPaidOrganicPlatform(iosPanel, target, starts, n, horizon, selectionFolds);
  if (!android?.folds || !ios?.folds) return null;
  const folds = android.folds.map((androidFold) => {
    const iosFold = ios.folds.find((fold) => fold.trainEnd === androidFold.trainEnd);
    if (!iosFold) return null;
    // 모든 최종 route는 같은 Total 정답을 상대로 비교해야 한다. OS 합산
    // 후보가 자기 Android+iOS 합만 정답으로 사용하면, Total에 다른 플랫폼이나
    // 집계 차이가 있는 CSV에서 일부만 예측하고도 0%에 가까운 점수를 받을 수 있다.
    const actual = totalSeries.slice(androidFold.trainEnd, androidFold.trainEnd + horizon);
    if (actual.length !== androidFold.actual.length) return null;
    const predicted = androidFold.predicted.map((value, index) => value + iosFold.predicted[index]);
    const organicPredicted = androidFold.organicPredicted.map((value, index) => value + iosFold.organicPredicted[index]);
    const performancePredicted = androidFold.performancePredicted.map((value, index) => value + iosFold.performancePredicted[index]);
    const error = wmape(actual, predicted);
    return {
      trainEnd: androidFold.trainEnd,
      offset: androidFold.offset,
      actual,
      predicted,
      organicPredicted,
      performancePredicted,
      absoluteErrors: error.absoluteErrors,
      denominator: error.denominator,
      wmape: error.wmape,
    };
  }).filter(Boolean);
  const latest = folds.find((fold) => fold.offset === 0);
  const development = folds.filter((fold) => fold.offset >= horizon);
  const componentMetrics = [
    { component: "android", model: android },
    { component: "ios", model: ios },
  ].map(({ component, model }) => ({
    component,
    latestWmape: model.latest?.wmape ?? null,
    developmentWmape: model.developmentWmape,
    passed: Number.isFinite(model.latest?.wmape)
      && Number.isFinite(model.developmentWmape)
      && model.latest.wmape < 10
      && model.developmentWmape < 10,
  }));
  const organic = android.future.organic.map((value, index) => value + ios.future.organic[index]);
  const performance = android.future.performance.map((value, index) => value + ios.future.performance[index]);
  return {
    folds,
    latest,
    development,
    developmentWmape: pooledWmape(development),
    allWmape: pooledWmape(folds),
    componentMetrics,
    search: {
      maxTrainingWeeks: MAX_TRAINING_WEEKS,
      android: android.search,
      ios: ios.search,
    },
    future: {
      organic,
      performance,
      predicted: organic.map((value, index) => value + performance[index]),
    },
  };
}

export function runAnnualAnalogRouter({
  totalPanel,
  androidPanel,
  iosPanel,
  target = "Regs",
  horizon = DEFAULT_HORIZON,
  foldStep = horizon,
  selectionFolds = DEFAULT_SELECTION_FOLDS,
  allowedProductionRoutes = ["direct-total", "android-ios-sum"],
}) {
  const total = totalPanel?.targets?.[target];
  const android = androidPanel?.targets?.[target];
  const ios = iosPanel?.targets?.[target];
  const n = total?.length || 0;
  if (!n || android?.length !== n || ios?.length !== n) return null;
  const seriesByPlatform = { total, android, ios };
  const originStride = Math.max(horizon, Number(foldStep) || horizon);
  const latestStart = n - horizon;
  const starts = [];
  for (let start = latestStart; start >= MIN_INITIAL_TRAINING_WEEKS; start -= originStride) starts.push(start);
  starts.sort((left, right) => left - right);
  // Inner model choice and outer audit must both retain multiple disjoint
  // origins. Spending every available origin on inner selection leaves only
  // the latest fold and makes development wMAPE impossible to certify.
  const requestedSelectionFolds = Math.max(
    3,
    Number(selectionFolds) || DEFAULT_SELECTION_FOLDS,
  );
  const effectiveSelectionFolds = Math.min(
    requestedSelectionFolds,
    Math.floor(Math.max(0, starts.length - 1) / 2),
  );
  if (effectiveSelectionFolds < 3) return null;
  const trainingWindowFeasibility = annualForecastTrainingWindowFeasibility({
    observedWeeks: n,
    horizon,
    foldStride: originStride,
    selectionFolds: effectiveSelectionFolds,
  });
  const supportedRoutes = ["direct-total", "android-ios-sum"];
  const allowedRouteSet = new Set((Array.isArray(allowedProductionRoutes)
    ? allowedProductionRoutes
    : supportedRoutes).filter((route) => supportedRoutes.includes(route)));
  if (!allowedRouteSet.size) return null;
  // 모든 route를 같은 Total actual로 계속 계산해 진단 비교는 보존한다.
  // 다만 Web/기타 플랫폼이 있는 CSV에서는 Android+iOS 부분합을 실제 미래
  // Total로 배포할 수 없으므로 아래 production 후보에서만 제외한다.
  const diagnosticModelCandidates = supportedRoutes.flatMap((route) =>
    BOUNDED_SERIES_SPECS.map((spec) => {
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
      const selectionPenalty = seriesComplexityPenalty(spec);
      return { route, spec, folds, selectionPenalty };
    }),
  ).filter((candidate) => candidate.folds.length >= effectiveSelectionFolds + 1);
  const modelCandidates = diagnosticModelCandidates.filter((candidate) =>
    allowedRouteSet.has(candidate.route));
  if (!modelCandidates.length) return null;

  const nested = nestedTournament(modelCandidates, starts, n, horizon, effectiveSelectionFolds);
  // 미래 spec은 봉인 최신 holdout의 정답을 보기 전에 고른 latest-audit spec을
  // 그대로 전체 관측치에 재적합한다.
  const productionChoice = selectCandidateAt(
    modelCandidates,
    latestStart,
    horizon,
    effectiveSelectionFolds,
    true,
  );
  if (!nested.latest || !productionChoice) return null;

  const routeTournaments = ["direct-total", "android-ios-sum"].map((route) => {
    const routeNested = nestedTournament(
      diagnosticModelCandidates.filter((candidate) => candidate.route === route),
      starts,
      n,
      horizon,
      effectiveSelectionFolds,
    );
    return routeNested.latest ? {
      route,
      ...routeNested,
      latestWmape: routeNested.latest.wmape,
      latestPersistenceWmape: routeNested.latest.persistenceWmape,
    } : null;
  }).filter(Boolean);
  const osTournament = routeTournaments.find((candidate) => candidate.route === "android-ios-sum");
  const annualOsGuardrail = osTournament?.latest?.componentErrors
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
  const hybrid = target === "Regs" && allowedRouteSet.has("android-ios-sum")
    ? runPaidOrganicHybrid(androidPanel, iosPanel, total, target, starts, n, horizon, effectiveSelectionFolds)
    : null;
  const rawFinalCandidates = [
    {
      route: "bounded-total-router",
      spec: { id: "bounded-total-router" },
      folds: nested.folds,
      source: nested,
    },
    ...(hybrid ? [{
      route: "paid-organic-hybrid",
      spec: { id: "paid-organic-adaptive-blend" },
      folds: hybrid.folds,
      source: hybrid,
    }] : []),
  ];
  // The bounded selector has one adaptive layer while Paid/Organic has two.
  // Compare only the common outer origins; otherwise the shorter hybrid path
  // and longer bounded path are scored on different calendar periods.
  const commonFinalTrainEnds = rawFinalCandidates.reduce((shared, candidate, index) => {
    const trainEnds = new Set(candidate.folds.map((fold) => fold.trainEnd));
    return index === 0 ? trainEnds : new Set([...shared].filter((trainEnd) => trainEnds.has(trainEnd)));
  }, new Set());
  const finalCandidates = rawFinalCandidates.map((candidate) => ({
    ...candidate,
    folds: candidate.folds.filter((fold) => commonFinalTrainEnds.has(fold.trainEnd)),
  })).filter((candidate) => candidate.folds.length >= MIN_CERTIFICATION_FOLDS + 1);
  const finalProduction = finalCandidates.length
    ? selectStableCandidate(finalCandidates, horizon)
    : null;
  const useAdaptiveHybrid = finalProduction?.candidate.route === "paid-organic-hybrid";
  const selectedFinalCandidate = finalProduction?.candidate
    || finalCandidates.find((candidate) => candidate.route === "bounded-total-router")
    || rawFinalCandidates[0];
  const selectedSource = selectedFinalCandidate.source;
  const selectedFolds = selectedFinalCandidate.folds;
  const selectedDevelopment = selectedFolds.filter((fold) => fold.offset >= horizon);
  const selectedLatest = selectedFolds.find((fold) => fold.offset === 0) || selectedSource.latest;
  const developmentEvidence = summarizeDevelopmentEvidence(selectedDevelopment, total);
  const selectedNested = {
    ...selectedSource,
    folds: selectedFolds,
    development: selectedDevelopment,
    developmentWmape: pooledWmape(selectedDevelopment),
    allWmape: pooledWmape(selectedFolds),
    latest: selectedLatest,
  };
  const osGuardrail = (useAdaptiveHybrid ? hybrid.componentMetrics : annualOsGuardrail)
    .filter((component) => Number.isFinite(component.latestWmape) && Number.isFinite(component.developmentWmape));
  const activeOsComponents = [android, ios].filter((series) =>
    series.reduce((sum, value) => sum + Math.abs(Number(value) || 0), 0) > 0,
  ).length;
  const minimumGuardrailComponents = useAdaptiveHybrid ? 2 : Math.max(1, activeOsComponents);
  const componentGuardrailRequired = allowedRouteSet.has("android-ios-sum");
  const osGuardrailPassed = !componentGuardrailRequired
    || (osGuardrail.length >= minimumGuardrailComponents
      && osGuardrail.every((component) => component.passed));
  const intervalCalibrationEligible = selectedDevelopment.length >= MIN_INTERVAL_FOLDS;
  const marginByHorizon = Array.from({ length: horizon }, (_, index) => {
    if (!intervalCalibrationEligible) return 0;
    const sorted = selectedDevelopment
      .map((fold) => fold.absoluteErrors[index])
      .filter(Number.isFinite)
      .sort((left, right) => left - right);
    return sorted.length ? sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.9) - 1)] : 0;
  });
  const selected = useAdaptiveHybrid ? {
    route: "android-ios-sum",
    spec: {
      id: "paid-organic-adaptive-search",
      paidObserved: true,
      blendWeight: {
        android: hybrid.search.android.productionBlendWeight,
        ios: hybrid.search.ios.productionBlendWeight,
      },
      maxTrainingWeeks: MAX_TRAINING_WEEKS,
    },
    folds: selectedFolds.length,
    developmentWmape: selectedNested.developmentWmape,
    developmentWorstWmape: developmentEvidence.worstWmape,
    developmentPersistenceWinRate: developmentEvidence.persistenceWinRate,
    allWmape: selectedNested.allWmape,
    latestWmape: selectedLatest.wmape,
    latestPersistenceWmape: selectedLatest.persistenceWmape ?? nested.latest.persistenceWmape,
    latest: selectedLatest,
    marginByHorizon,
    future: hybrid.future,
    productionPriorWmape: finalProduction.score,
  } : {
    route: productionChoice.candidate.route,
    spec: productionChoice.candidate.spec,
    folds: selectedFolds.length,
    developmentWmape: selectedNested.developmentWmape,
    developmentWorstWmape: developmentEvidence.worstWmape,
    developmentPersistenceWinRate: developmentEvidence.persistenceWinRate,
    allWmape: selectedNested.allWmape,
    latestWmape: selectedLatest.wmape,
    latestPersistenceWmape: selectedLatest.persistenceWmape ?? nested.latest.persistenceWmape,
    latest: selectedLatest,
    marginByHorizon,
    future: routeAt(seriesByPlatform, productionChoice.candidate.route, n, horizon, productionChoice.candidate.spec),
    productionPriorWmape: productionChoice.score,
  };
  const hybridPhaseComponents = (phase) => Object.fromEntries(
    ["android", "ios"].map((platform) => {
      const search = hybrid?.search?.[platform];
      const isAudit = phase === "audit";
      return [platform, {
        blendWeight: isAudit ? search?.auditBlendWeight : search?.productionBlendWeight,
        series: isAudit ? search?.auditComponents : search?.productionComponents,
      }];
    }),
  );
  const auditSelection = useAdaptiveHybrid
    ? selectionIdentity("android-ios-sum", {
      id: "paid-organic-adaptive-search",
      kind: "adaptive",
      maxTrainingWeeks: MAX_TRAINING_WEEKS,
    }, {
      trainingEndIndex: selectedLatest.trainEnd - 1,
      components: hybridPhaseComponents("audit"),
    })
    : selectionIdentity(
      selectedLatest.route,
      selectedLatest.spec,
      { trainingEndIndex: selectedLatest.trainEnd - 1 },
    );
  const productionSelection = useAdaptiveHybrid
    ? selectionIdentity("android-ios-sum", {
      id: "paid-organic-adaptive-search",
      kind: "adaptive",
      maxTrainingWeeks: MAX_TRAINING_WEEKS,
    }, {
      trainingEndIndex: selectedLatest.trainEnd - 1,
      refitThroughIndex: n - 1,
      components: hybridPhaseComponents("production"),
    })
    : selectionIdentity(
      productionChoice.candidate.route,
      productionChoice.candidate.spec,
      {
        trainingEndIndex: selectedLatest.trainEnd - 1,
        refitThroughIndex: n - 1,
      },
    );
  const interval = {
    method: intervalCalibrationEligible
      ? "rolling-oos-horizon-p90-absolute-error"
      : "point-forecast-no-empirical-interval",
    percentile: 0.9,
    isCoverageGuarantee: false,
    calibrationEligible: intervalCalibrationEligible,
    calibrationFoldCount: intervalCalibrationEligible ? selectedDevelopment.length : 0,
    observedOuterFoldCount: selectedDevelopment.length,
    minimumFolds: MIN_INTERVAL_FOLDS,
    labelKo: intervalCalibrationEligible
      ? "Rolling OOS의 예측 주차별 P90 절대오차 최소 참고폭"
      : "바깥 OOS 8회 미만 · 점 예측",
    labelEn: intervalCalibrationEligible
      ? "Minimum reference width from horizon-specific P90 absolute errors in rolling OOS"
      : "Fewer than 8 outer OOS folds · point forecast",
  };
  const selectedWithProvenance = {
    ...selected,
    auditSelected: auditSelection,
    productionSelected: productionSelection,
    interval,
  };
  const currentBreak = hasRecentStep([totalPanel, androidPanel, iosPanel]);
  const directSimilarSeason = !useAdaptiveHybrid && productionChoice.candidate.spec.kind === "similar-season"
    ? productionChoice.candidate.route === "direct-total"
      ? { total: similarSeasonAt(total, n, horizon, productionChoice.candidate.spec) }
      : {
        android: similarSeasonAt(android, n, horizon, productionChoice.candidate.spec),
        ios: similarSeasonAt(ios, n, horizon, productionChoice.candidate.spec),
      }
    : null;
  // Paid/Organic와 bounded router가 함께 경쟁할 때 화면에 내보내는 숫자도
  // 최종 선택과 동일한 공통 outer origins로 다시 계산한다. 서로 다른 달력
  // 구간의 wMAPE를 나란히 놓는 사과-오렌지 비교를 금지한다.
  const hasAlignedFinalComparison = Boolean(
    hybrid && finalCandidates.length === rawFinalCandidates.length,
  );
  const candidateSummaries = hasAlignedFinalComparison
    ? finalCandidates.map((candidate) => {
      const development = candidate.folds.filter((fold) => fold.offset >= horizon);
      const latest = candidate.folds.find((fold) => fold.offset === 0) || null;
      return {
        route: candidate.route,
        developmentWmape: pooledWmape(development),
        allWmape: pooledWmape(candidate.folds),
        latestWmape: latest?.wmape ?? null,
        latestPersistenceWmape: latest?.persistenceWmape ?? null,
        comparisonOrigins: candidate.folds.length,
        comparisonScope: "common-outer-origins",
      };
    })
    : routeTournaments.map((candidate) => ({
      route: candidate.route,
      developmentWmape: candidate.developmentWmape,
      allWmape: candidate.allWmape,
      latestWmape: candidate.latestWmape,
      latestPersistenceWmape: candidate.latestPersistenceWmape,
      comparisonOrigins: candidate.folds.length,
      comparisonScope: "shared-route-origins",
    }));
  return {
    model: useAdaptiveHybrid ? "paid-organic-adaptive-search-v4" : "bounded-regime-search-v5",
    allowedProductionRoutes: [...allowedRouteSet],
    selectedRoute: selectedWithProvenance.route,
    selected: selectedWithProvenance,
    auditSelected: auditSelection,
    productionSelected: productionSelection,
    provenance: {
      selectionMode: "nested-rolling-origin-with-sealed-latest-audit",
      audit: auditSelection,
      production: productionSelection,
      foldStride: originStride,
      selectionFolds: effectiveSelectionFolds,
      trainingWindowFeasibility,
    },
    interval,
    candidates: candidateSummaries,
    paidOrganicHybrid: useAdaptiveHybrid,
    adaptiveModelSearch: true,
    modelSearch: hybrid ? {
      maxTrainingWeeks: MAX_TRAINING_WEEKS,
      ...trainingWindowFeasibility,
      blendWeights: BLEND_WEIGHTS,
      criteria: SELECTION_CRITERIA,
      performanceGuardrails: PERFORMANCE_GUARDRAILS,
      selectedProductionRoute: useAdaptiveHybrid ? "paid-organic-hybrid" : "bounded-total-router",
      routeDecision: finalProduction?.decision || null,
      android: hybrid.search.android,
      ios: hybrid.search.ios,
    } : {
      maxTrainingWeeks: MAX_TRAINING_WEEKS,
      ...trainingWindowFeasibility,
      blendWeights: [],
      criteria: SELECTION_CRITERIA,
      performanceGuardrails: PERFORMANCE_GUARDRAILS,
      selectedProductionRoute: productionChoice.candidate.route,
      routeDecision: productionChoice.decision,
      similarSeason: directSimilarSeason ? {
        specId: productionChoice.candidate.spec.id,
        ...Object.fromEntries(Object.entries(directSimilarSeason).map(([key, value]) => [
          key,
          value?.analogs || [],
        ])),
      } : null,
    },
    currentBreak,
    osGuardrail,
    osGuardrailPassed,
    componentGuardrailRequired,
    qualified: developmentEvidence.foldCount >= MIN_CERTIFICATION_FOLDS
      && Number.isFinite(selectedWithProvenance.developmentWmape)
      && selectedWithProvenance.developmentWmape < 10
      && Number.isFinite(selectedWithProvenance.developmentWorstWmape)
      && selectedWithProvenance.developmentWorstWmape < 10
      && Number.isFinite(selectedWithProvenance.developmentPersistenceWinRate)
      && selectedWithProvenance.developmentPersistenceWinRate >= PERFORMANCE_GUARDRAILS.minimumFoldWinRate
      && Number.isFinite(selectedWithProvenance.latestWmape)
      && selectedWithProvenance.latestWmape < 10
      && Number.isFinite(selectedWithProvenance.latestPersistenceWmape)
      && selectedWithProvenance.latestWmape <= selectedWithProvenance.latestPersistenceWmape
      && osGuardrailPassed,
    horizon,
    foldStep: originStride,
    selectionFolds: effectiveSelectionFolds,
    requestedSelectionFolds,
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
