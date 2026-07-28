const DEFAULT_HORIZON = 12;
const DEFAULT_FOLD_STEP = 4;
const DEFAULT_SELECTION_FOLDS = 6;
const MAX_TRAINING_WEEKS = 104;
const BLEND_WEIGHTS = [0, 0.25, 0.5, 0.75, 1];
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
const ORGANIC_LEVEL_SPECS = [4, 8, 12, 16, 26].map((window) => ({
  id: `flat-${window}`,
  kind: "flat",
  window,
}));
const LOCAL_TREND_SPECS = [8, 12, 26, 52, 78, 104].flatMap((window) =>
  [0.25, 0.5].map((damping) => ({
    id: `trend-${window}-${damping}`,
    kind: "trend",
    window,
    damping,
  })),
);
const LOCAL_HOLT_SPECS = [26, 52, 104].flatMap((window) =>
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
const BOUNDED_SERIES_SPECS = [
  ...ORGANIC_LEVEL_SPECS,
  ...LOCAL_TREND_SPECS,
  ...LOCAL_HOLT_SPECS,
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

function localSeriesAt(series, trainEnd, horizon, spec) {
  if (spec?.kind === "annual") return annualAt(series, trainEnd, horizon, spec)?.predicted || null;
  const window = Math.min(MAX_TRAINING_WEEKS, Math.max(2, spec?.window || 8));
  const start = trainEnd - window;
  if (!Array.isArray(series) || start < 0 || trainEnd > series.length) return null;
  const sample = series.slice(start, trainEnd);
  const level = Math.max(0, mean(sample.slice(-Math.min(4, sample.length))) || 0);
  if (spec?.kind === "flat") return Array(horizon).fill(level);
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
    const lower = level * 0.25;
    const upper = Math.max(level * 4, level + 1);
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
  const lower = level * 0.25;
  const upper = Math.max(level * 4, level + 1);
  return Array.from({ length: horizon }, (_, index) =>
    Math.max(0, Math.min(upper, Math.max(lower, level + slope * (index + 1) * damping))),
  );
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

function foldWmapePercentile(folds, percentile = 0.9) {
  const values = (folds || []).map((fold) => fold.wmape).filter(Number.isFinite)
    .sort((left, right) => left - right);
  return values.length
    ? values[Math.min(values.length - 1, Math.max(0, Math.ceil(values.length * percentile) - 1))]
    : null;
}

function selectStableCandidate(candidates, horizon) {
  const eligible = candidates.map((candidate) => {
    const development = candidate.folds.filter((fold) => fold.offset >= horizon);
    const score = pooledWmape(development);
    if (!development.length || !Number.isFinite(score)) return null;
    const instability = development.reduce((sum, fold) => sum + Math.abs(fold.wmape - score), 0)
      / development.length;
    const tailRisk = foldWmapePercentile(development);
    const selectionPenalty = Math.max(0, Number(candidate.selectionPenalty) || 0);
    return {
      candidate,
      score,
      instability,
      tailRisk,
      selectionScore: score
        + instability * 0.15
        + Math.max(0, tailRisk - score) * 0.1
        + selectionPenalty,
    };
  }).filter(Boolean);
  eligible.sort((left, right) =>
    left.selectionScore - right.selectionScore
    || left.score - right.score
    || left.candidate.route.localeCompare(right.candidate.route)
    || left.candidate.spec.id.localeCompare(right.candidate.spec.id),
  );
  return eligible[0] || null;
}

function selectCandidateAt(
  candidates,
  trainEnd,
  horizon,
  selectionFolds,
  requireCurrent = true,
  maxSelectionFolds = selectionFolds,
) {
  const eligible = candidates.map((candidate) => {
    const current = candidate.folds.find((fold) => fold.trainEnd === trainEnd);
    const prior = candidate.folds.filter((fold) => fold.trainEnd + horizon <= trainEnd);
    if ((requireCurrent && !current) || prior.length < selectionFolds) return null;
    const recent = prior.slice(-Math.max(selectionFolds, maxSelectionFolds));
    const weights = recent.map((_, index) => index + 1);
    const weightTotal = weights.reduce((sum, value) => sum + value, 0);
    const score = recent.reduce((sum, fold, index) => sum + fold.wmape * weights[index], 0) / weightTotal;
    const instability = recent.reduce((sum, fold) => sum + Math.abs(fold.wmape - score), 0) / recent.length;
    const selectionPenalty = Math.max(0, Number(candidate.selectionPenalty) || 0);
    return {
      candidate,
      current,
      score,
      instability,
      selectionScore: score + instability * 0.15 + selectionPenalty,
    };
  }).filter(Boolean);
  eligible.sort((left, right) =>
    left.selectionScore - right.selectionScore
    || left.score - right.score
    || left.candidate.route.localeCompare(right.candidate.route)
    || left.candidate.spec.id.localeCompare(right.candidate.spec.id),
  );
  return eligible[0] || null;
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
  const selectionPenalty = spec.kind === "trend"
    ? 1.5
    : spec.kind === "flat"
      ? 0.5
      : spec.kind === "holt"
        ? 0.25
      : spec.kind === "ridge"
        ? 0.25
        : 0;
  return { route, spec, folds, selectionPenalty };
}

function runComponentTournament(candidates, starts, n, horizon, selectionFolds, productionForecast) {
  const valid = candidates.filter((candidate) => candidate.folds.length >= selectionFolds + 1);
  const nested = nestedTournament(valid, starts, n, horizon, selectionFolds);
  const production = selectCandidateAt(valid, n, horizon, selectionFolds, false);
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
  const stableBlend = selectStableCandidate(blendCandidates, horizon);
  const productionBlend = selectCandidateAt(
    blendCandidates,
    n,
    horizon,
    blendSelectionFolds,
    false,
    blendMaxSelectionFolds,
  );
  if (!blendTournament.latest || !stableBlend || !productionBlend) return null;
  const folds = stableBlend.candidate.folds;
  const latest = folds.find((fold) => fold.offset === 0);
  const development = folds.filter((fold) => fold.offset >= horizon);
  const auditWeight = stableBlend.candidate.spec.blendWeight;
  const productionWeight = productionBlend.candidate.spec.blendWeight;
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
      selectedBlendWeights: [productionWeight],
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
    },
    future: {
      organic: futureOrganic,
      performance: futurePerformance,
      predicted: futureOrganic.map((value, index) => value + futurePerformance[index]),
    },
  };
}

export function runPaidOrganicHybrid(androidPanel, iosPanel, target, starts, n, horizon, selectionFolds) {
  const android = runPaidOrganicPlatform(androidPanel, target, starts, n, horizon, selectionFolds);
  const ios = runPaidOrganicPlatform(iosPanel, target, starts, n, horizon, selectionFolds);
  if (!android?.folds || !ios?.folds) return null;
  const folds = android.folds.map((androidFold) => {
    const iosFold = ios.folds.find((fold) => fold.trainEnd === androidFold.trainEnd);
    if (!iosFold) return null;
    const actual = androidFold.actual.map((value, index) => value + iosFold.actual[index]);
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
      const selectionPenalty = spec.kind === "trend"
        ? 1.5
        : spec.kind === "flat"
          ? 0.5
          : spec.kind === "holt"
            ? 0.25
            : 0;
      return { route, spec, folds, selectionPenalty };
    }),
  ).filter((candidate) => candidate.folds.length >= selectionFolds + 1);
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
  const hybrid = target === "Regs"
    ? runPaidOrganicHybrid(androidPanel, iosPanel, target, starts, n, horizon, selectionFolds)
    : null;
  const finalCandidates = [
    {
      route: "bounded-total-router",
      spec: { id: "bounded-total-router" },
      folds: nested.folds,
    },
    ...(hybrid ? [{
      route: "paid-organic-hybrid",
      spec: { id: "paid-organic-adaptive-blend" },
      folds: hybrid.folds,
    }] : []),
  ].filter((candidate) => candidate.folds.length >= selectionFolds + 1);
  const finalProduction = finalCandidates.length > 1
    ? selectStableCandidate(finalCandidates, horizon)
    : null;
  const useAdaptiveHybrid = finalProduction?.candidate.route === "paid-organic-hybrid";
  const selectedNested = useAdaptiveHybrid ? hybrid : nested;
  const osGuardrail = useAdaptiveHybrid ? hybrid.componentMetrics : annualOsGuardrail;
  const osGuardrailPassed = osGuardrail.length >= 2 && osGuardrail.every((component) => component.passed);
  const selectedFolds = selectedNested.folds;
  const selectedDevelopment = selectedNested.development;
  const selectedLatest = selectedNested.latest;
  const marginByHorizon = Array.from({ length: horizon }, (_, index) => {
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
    allWmape: selectedNested.allWmape,
    latestWmape: selectedLatest.wmape,
    latestPersistenceWmape: nested.latest.persistenceWmape,
    latest: selectedLatest,
    marginByHorizon,
    future: hybrid.future,
    productionPriorWmape: finalProduction.score,
  } : {
    route: productionChoice.candidate.route,
    spec: productionChoice.candidate.spec,
    folds: selectedFolds.length,
    developmentWmape: selectedNested.developmentWmape,
    allWmape: selectedNested.allWmape,
    latestWmape: selectedLatest.wmape,
    latestPersistenceWmape: nested.latest.persistenceWmape,
    latest: selectedLatest,
    marginByHorizon,
    future: routeAt(seriesByPlatform, productionChoice.candidate.route, n, horizon, productionChoice.candidate.spec),
    productionPriorWmape: productionChoice.score,
  };
  const currentBreak = hasRecentStep([totalPanel, androidPanel, iosPanel]);
  const candidateSummaries = routeTournaments.map((candidate) => ({
    route: candidate.route,
    developmentWmape: candidate.developmentWmape,
    allWmape: candidate.allWmape,
    latestWmape: candidate.latestWmape,
    latestPersistenceWmape: candidate.latestPersistenceWmape,
  }));
  if (hybrid) {
    const osIndex = candidateSummaries.findIndex((candidate) => candidate.route === "android-ios-sum");
    const hybridSummary = {
      route: "android-ios-sum",
      developmentWmape: hybrid.developmentWmape,
      allWmape: hybrid.allWmape,
      latestWmape: hybrid.latest.wmape,
      latestPersistenceWmape: nested.latest.persistenceWmape,
    };
    if (osIndex >= 0) candidateSummaries[osIndex] = hybridSummary;
    else candidateSummaries.push(hybridSummary);
  }
  return {
    model: useAdaptiveHybrid ? "paid-organic-adaptive-search-v2" : "bounded-regime-search-v3",
    selectedRoute: selected.route,
    selected,
    candidates: candidateSummaries,
    paidOrganicHybrid: useAdaptiveHybrid,
    adaptiveModelSearch: Boolean(hybrid),
    modelSearch: hybrid ? {
      maxTrainingWeeks: MAX_TRAINING_WEEKS,
      blendWeights: BLEND_WEIGHTS,
      selectedProductionRoute: useAdaptiveHybrid ? "paid-organic-hybrid" : "bounded-total-router",
      android: hybrid.search.android,
      ios: hybrid.search.ios,
    } : {
      maxTrainingWeeks: MAX_TRAINING_WEEKS,
      blendWeights: [],
      selectedProductionRoute: productionChoice.candidate.route,
    },
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
