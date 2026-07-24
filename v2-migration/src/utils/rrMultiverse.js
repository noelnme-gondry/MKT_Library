/*
 * RR specification-multiverse engine.
 *
 * The engine is deliberately pure and deterministic. It records failed specs
 * instead of searching until a preferred conclusion appears. Browser callers
 * may pass the returned rows to a table or a specification-curve chart.
 */
export const RR_MULTIVERSE_VERSION = "rr-multiverse-v1";

export const RR_MULTIVERSE_DEFAULTS = Object.freeze({
  gate: Object.freeze({
    seasonVarShare: 0.02,
    seasonAmplitudeRatio: 0.5,
    seasonCvDelta: 0.01,
    trendShapeDeviation: 0.25,
    industryCorrelation: 0.35,
    industrySharedShare: 0.35,
    vif: 5,
    ciRelativeWidth: 4,
  }),
  grid: Object.freeze({
    trendBasis: ["cv-optimal", "cv-minus-se", "cv-plus-se"],
    seasonalBasis: [1, 2],
    industryHandling: ["idio-only", "idio+explicit"],
    adstock: [0.2, 0.5],
    saturation: ["linear", "hill"],
    channelSet: ["full", "leave-one-out"],
    prior: ["ols", "ridge"],
  }),
});

const finite = (value) => Number.isFinite(Number(value));
const mean = (values) => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
const variance = (values) => {
  const m = mean(values);
  return mean(values.map((value) => (value - m) ** 2));
};
const sd = (values) => Math.sqrt(Math.max(0, variance(values)));
const corr = (a, b) => {
  const n = Math.min(a.length, b.length);
  const x = a.slice(0, n).map(Number), y = b.slice(0, n).map(Number);
  const ax = mean(x), ay = mean(y);
  const den = Math.sqrt(x.reduce((s, v) => s + (v - ax) ** 2, 0) * y.reduce((s, v) => s + (v - ay) ** 2, 0));
  return den > 0 ? x.reduce((s, v, i) => s + (v - ax) * (y[i] - ay), 0) / den : 0;
};
const deepFreeze = (value) => {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
};
const stableJson = (value) => JSON.stringify(value, Object.keys(value || {}).sort());

function mkOriginal(values) {
  let score = 0;
  for (let i = 0; i < values.length - 1; i++) for (let j = i + 1; j < values.length; j++) score += Math.sign(values[j] - values[i]);
  const varianceScore = Math.max(1, values.length * (values.length - 1) * (2 * values.length + 5) / 18);
  const z = score / Math.sqrt(varianceScore);
  const slopes = [];
  for (let i = 0; i < values.length - 1; i++) for (let j = i + 1; j < values.length; j++) slopes.push((values[j] - values[i]) / (j - i));
  slopes.sort((a, b) => a - b);
  return { trend: Math.abs(z) > 1.96 ? (z > 0 ? "increasing" : "decreasing") : "no trend", slope: slopes[Math.floor(slopes.length / 2)] || 0 };
}

function stlWeekly(values, period) {
  const seasonalMeans = Array.from({ length: period }, (_, phase) => mean(values.filter((_, i) => i % period === phase)));
  const seasonal = values.map((_, i) => seasonalMeans[i % period] - mean(seasonalMeans));
  const deseasonalized = values.map((value, i) => value - seasonal[i]);
  const half = Math.max(2, Math.floor(period / 4));
  const trend = deseasonalized.map((_, i) => mean(deseasonalized.slice(Math.max(0, i - half), Math.min(values.length, i + half + 1))));
  return { seasonal, trend, residual: values.map((value, i) => value - seasonal[i] - trend[i]) };
}

function mmmChangePoints(values, opts = {}) {
  const minSeg = opts.minSeg || 4;
  const candidates = [];
  for (let i = minSeg; i <= values.length - minSeg; i++) {
    const left = mean(values.slice(i - minSeg, i));
    const right = mean(values.slice(i, i + minSeg));
    if (Math.abs(right - left) > 2 * sd(values)) candidates.push(i);
  }
  return { points: candidates.filter((value, i) => !i || value - candidates[i - 1] >= minSeg) };
}

export function rrCreatePreRegistration(overrides = {}) {
  const base = RR_MULTIVERSE_DEFAULTS;
  const merged = {
    version: RR_MULTIVERSE_VERSION,
    estimand: { channel: "variance-share", trend: "sign", changepoint: "location" },
    gate: { ...base.gate, ...(overrides.gate || {}) },
    grid: Object.fromEntries(Object.entries({ ...base.grid, ...(overrides.grid || {}) }).map(([key, value]) => [key, [...value]])),
    stop: { method: "exhaustive", ...(overrides.stop || {}) },
    taxonomy: { ...(overrides.taxonomy || {}) },
    seed: String(overrides.seed ?? "rr-multiverse-fixed"),
    codeVersion: overrides.codeVersion || RR_MULTIVERSE_VERSION,
    dataHash: overrides.dataHash || null,
  };
  return deepFreeze(merged);
}

export function rrAssertPreRegistrationFrozen(preReg) {
  if (!preReg || !Object.isFrozen(preReg) || !Object.isFrozen(preReg.gate) || !Object.isFrozen(preReg.grid)) {
    throw new Error("RR pre-registration must be frozen before media coefficients are observed");
  }
  return true;
}

function normalizePanel(panel) {
  const target = (panel?.target || panel?.targets?.RR || []).map(Number);
  const n = target.length;
  const channels = Object.entries(panel?.channels || panel?.ch || {}).map(([key, values]) => ({ key, values: values.map(Number) })).filter((item) => item.values.length === n);
  const industry = panel?.industry?.map(Number) || null;
  if (n < 12 || target.some((value) => !finite(value))) throw new Error("RR panel requires at least 12 finite target observations");
  return { target, channels, industry: industry?.length === n ? industry : null, period: panel.period || 52 };
}

function adstock(values, lambda) {
  let carry = 0;
  return values.map((value) => { carry = value + lambda * carry; return carry; });
}

function transform(values, lambda, form) {
  const x = adstock(values, lambda);
  if (form === "hill") {
    const scale = Math.max(sd(x), 1e-9);
    return x.map((value) => value / (scale + Math.abs(value)));
  }
  const scale = Math.max(sd(x), 1e-9);
  return x.map((value) => (value - mean(x)) / scale);
}

function solve(matrix, vector) {
  const a = matrix.map((row, i) => [...row, vector[i]]);
  for (let col = 0; col < a.length; col++) {
    let pivot = col;
    for (let row = col + 1; row < a.length; row++) if (Math.abs(a[row][col]) > Math.abs(a[pivot][col])) pivot = row;
    if (Math.abs(a[pivot][col]) < 1e-10) return null;
    [a[col], a[pivot]] = [a[pivot], a[col]];
    const scale = a[col][col];
    for (let j = col; j <= a.length; j++) a[col][j] /= scale;
    for (let row = 0; row < a.length; row++) {
      if (row === col) continue;
      const factor = a[row][col];
      for (let j = col; j <= a.length; j++) a[row][j] -= factor * a[col][j];
    }
  }
  return a.map((row) => row.at(-1));
}

function fitLinear(X, y, lambda = 0) {
  if (!X.length || !X[0]?.length) return null;
  const p = X[0].length;
  const xtx = Array.from({ length: p }, (_, i) => Array.from({ length: p }, (_, j) => X.reduce((sum, row) => sum + row[i] * row[j], 0) + (i ? lambda : 1e-9) * (i === j ? 1 : 0)));
  const xty = Array.from({ length: p }, (_, i) => X.reduce((sum, row, r) => sum + row[i] * y[r], 0));
  const beta = solve(xtx, xty);
  if (!beta) return null;
  const fitted = X.map((row) => row.reduce((sum, value, i) => sum + value * beta[i], 0));
  const resid = y.map((value, i) => value - fitted[i]);
  const sigma = Math.sqrt(mean(resid.map((value) => value ** 2)));
  const se = beta.map((_, i) => Math.sqrt(Math.max(0, sigma ** 2 / Math.max(xtx[i][i], 1e-9))));
  const yMean = mean(y), ssTot = y.reduce((sum, value) => sum + (value - yMean) ** 2, 0), ssRes = resid.reduce((sum, value) => sum + value ** 2, 0);
  return { beta, se, fitted, resid, r2: ssTot > 0 ? 1 - ssRes / ssTot : 0 };
}

function trendBasis(n, mode) {
  const x = Array.from({ length: n }, (_, i) => (i - (n - 1) / 2) / Math.max(1, n - 1));
  const bend = mode === "cv-minus-se" ? 0.7 : mode === "cv-plus-se" ? 1.3 : 1;
  return x.map((value, i) => [1, value * bend, (value * value - 1 / 12) * bend]);
}

function buildDesign(panel, config, baseline) {
  const n = panel.target.length;
  const X = trendBasis(n, config.trendBasis);
  const names = ["intercept", "trend", "trend_curvature"];
  const seasonCount = Number(config.seasonalBasis) || 0;
  for (let k = 1; k <= seasonCount; k++) {
    X.forEach((row, i) => row.push(Math.sin(2 * Math.PI * k * i / panel.period), Math.cos(2 * Math.PI * k * i / panel.period)));
    names.push(`season_sin_${k}`, `season_cos_${k}`);
  }
  if (panel.industry) {
    const residual = panel.industry.map((value, i) => value - baseline.industryFit[i]);
    X.forEach((row, i) => row.push(residual[i]));
    names.push("industry_idio");
    if (config.industryHandling === "idio+explicit") {
      X.forEach((row, i) => row.push(panel.industry[i]));
      names.push("industry_explicit");
    }
  }
  const mediaKeys = config.channelSet === "leave-one-out" ? panel.channels.slice(0, -1).map((item) => item.key) : panel.channels.map((item) => item.key);
  panel.channels.filter((item) => mediaKeys.includes(item.key)).forEach((channel) => {
    const values = transform(channel.values, Number(config.adstock), config.saturation);
    X.forEach((row, i) => row.push(values[i]));
    names.push(`media_${channel.key}`);
  });
  return { X, names, mediaKeys };
}

function ridgeFit(X, y, lambda) {
  const scaled = X.map((row, i) => row.map((value, j) => j === 0 ? value : value));
  const regularized = scaled.map((row) => row.slice());
  const p = regularized[0].length;
  const penalty = Array.from({ length: p }, (_, j) => j === 0 ? 1e-9 : lambda);
  const augmentedX = [...regularized, ...Array.from({ length: p }, (_, j) => Array.from({ length: p }, (_, k) => j === k ? Math.sqrt(penalty[j]) : 0))];
  const augmentedY = [...y, ...new Array(p).fill(0)];
  return fitLinear(augmentedX, augmentedY);
}

function fit(panel, config, baseline) {
  const design = buildDesign(panel, config, baseline);
  const result = config.prior === "ridge" ? ridgeFit(design.X, panel.target, 0.2) : fitLinear(design.X, panel.target);
  if (!result?.beta?.every(finite)) return null;
  const fitted = design.X.map((row) => row.reduce((sum, value, i) => sum + value * result.beta[i], 0));
  const trend = design.X.map((row) => row[1] * result.beta[1] + row[2] * result.beta[2]);
  const seasonal = design.X.map((row) => row.slice(3, 3 + 2 * (Number(config.seasonalBasis) || 0)).reduce((sum, value, i) => sum + value * result.beta[3 + i], 0));
  const holdout = Math.max(4, Math.floor(panel.target.length * 0.2));
  const media = Object.fromEntries(design.mediaKeys.map((key, index) => {
    const col = design.names.indexOf(`media_${key}`);
    return [key, design.X.map((row) => row[col] * result.beta[col])];
  }));
  const holdoutSliceSum = (values) => values.slice(-holdout).reduce((sum, value) => sum + value, 0);
  const contributionStart = Math.max(0, Number(panel.contributionStart) || 0);
  const contributionEnd = Math.min(panel.target.length, Number(panel.contributionEnd) || panel.target.length);
  const contributionSliceSum = (values) => values.slice(contributionStart, contributionEnd).reduce((sum, value) => sum + value, 0);
  const mediaContributionUsers = Object.fromEntries(Object.entries(media).map(([key, values]) => [key, holdoutSliceSum(values)]));
  const performanceContributionUsers = Object.entries(mediaContributionUsers)
    .filter(([key]) => /^performance[_-]/i.test(key))
    .reduce((sum, [, value]) => sum + value, 0);
  const brandContributionUsers = Object.entries(mediaContributionUsers)
    .filter(([key]) => /^brand[_-]/i.test(key))
    .reduce((sum, [, value]) => sum + value, 0);
  const industryColumns = design.names.map((name, index) => name.startsWith("industry_") ? index : -1).filter((index) => index >= 0);
  const industryContributionUsers = industryColumns.reduce((sum, index) => sum + holdoutSliceSum(design.X.map((row) => row[index] * result.beta[index])), 0);
  const residual = panel.target.map((value, i) => value - fitted[i]);
  const trainX = design.X.slice(0, -holdout), trainY = panel.target.slice(0, -holdout);
  const train = config.prior === "ridge" ? ridgeFit(trainX, trainY, 0.2) : fitLinear(trainX, trainY);
  const holdoutActual = panel.target.slice(-holdout);
  const holdoutPredicted = train ? design.X.slice(-holdout).map((row) => row.reduce((sum, value, j) => sum + value * train.beta[j], 0)) : [];
  const holdoutErrors = train ? holdoutActual.map((value, i) => Math.abs(value - holdoutPredicted[i])) : [];
  const holdoutError = train ? mean(holdoutErrors) : Infinity;
  return {
    ...result, ...design, fitted, trend, seasonal, media, residual, holdoutError,
    holdoutActualUsers: train ? holdoutActual.reduce((sum, value) => sum + value, 0) : null,
    holdoutPredictedUsers: train ? holdoutPredicted.reduce((sum, value) => sum + value, 0) : null,
    holdoutAbsoluteErrorUsers: train ? holdoutErrors.reduce((sum, value) => sum + value, 0) : null,
    performanceContributionUsers: train ? performanceContributionUsers : null,
    brandContributionUsers: train ? brandContributionUsers : null,
    industryContributionUsers: train ? industryContributionUsers : null,
    trendContributionUsers: train ? holdoutSliceSum(trend) : null,
    seasonalityContributionUsers: train ? holdoutSliceSum(seasonal) : null,
    periodPerformanceContributionUsers: train ? Object.entries(media).filter(([key]) => /^performance[_-]/i.test(key)).reduce((sum, [, values]) => sum + contributionSliceSum(values), 0) : null,
    periodBrandContributionUsers: train ? Object.entries(media).filter(([key]) => /^brand[_-]/i.test(key)).reduce((sum, [, values]) => sum + contributionSliceSum(values), 0) : null,
  };
}

function baselineStage(panel) {
  const stl = stlWeekly(panel.target, panel.period, 2);
  const raw = mkOriginal(panel.target);
  const cps = mmmChangePoints(panel.target, { minSeg: Math.max(3, Math.floor(panel.target.length / 12)) }).points || [];
  const industryFit = panel.industry ? panel.industry.map((_, i) => mean(panel.industry.slice(Math.max(0, i - 2), i + 3))) : [];
  return {
    seasonal: stl.seasonal,
    trend: stl.trend,
    baselineSeasonalAmplitude: sd(stl.seasonal),
    trendSignRaw: raw.trend === "increasing" ? "up" : raw.trend === "decreasing" ? "down" : "flat",
    cpCandidates: cps,
    industryFit,
  };
}

function gateS(panel, baseline, fitResult, threshold) {
  const totalVar = variance(panel.target) || 1;
  const share = variance(fitResult.seasonal) / totalVar;
  const ampRatio = sd(fitResult.seasonal) / Math.max(baseline.baselineSeasonalAmplitude, 1e-9);
  const noSeason = variance(fitResult.residual.map((value, i) => value + fitResult.seasonal[i]));
  const cvDelta = noSeason - variance(fitResult.residual);
  const pass = share > threshold.seasonVarShare && ampRatio >= threshold.seasonAmplitudeRatio && cvDelta > threshold.seasonCvDelta;
  return { pass, status: pass ? "PASS" : "FAIL", S1_var_share: share, S2_amp_ratio: ampRatio, S3_dcv: cvDelta };
}

function gateT(panel, baseline, fitResult, threshold) {
  const full = fitResult.trend;
  const deviations = panel.channels.map((channel) => {
    const without = panel.target.map((value, i) => value - (fitResult.media[channel.key]?.[i] || 0));
    const slope = without.length > 1 ? (without.at(-1) - without[0]) / Math.max(1, without.length - 1) : 0;
    const shape = full.map((value, i) => value - (full[0] + slope * i));
    return { channel: channel.key, maxDeviation: Math.max(...shape.map((value) => Math.abs(value))) / Math.max(sd(panel.target), 1e-9) };
  });
  const maxDev = deviations.length ? Math.max(...deviations.map((item) => item.maxDeviation)) : 0;
  const fittedDirection = fitResult.trend.at(-1) - fitResult.trend[0] >= 0 ? "up" : "down";
  const signStable = baseline.trendSignRaw === "flat" || fittedDirection === baseline.trendSignRaw;
  const pass = maxDev < threshold.trendShapeDeviation && signStable;
  return { pass, status: pass ? "PASS" : "FAIL", T1_max_dev: maxDev, per_channel_dev: deviations, T2_sign_stable: signStable };
}

function gateI(panel, fitResult, threshold) {
  const industryIndex = fitResult.names.indexOf("industry_idio");
  const trendIndex = fitResult.names.indexOf("trend");
  const seasonIndexes = fitResult.names.map((name, i) => name.startsWith("season_") ? i : -1).filter((i) => i >= 0);
  const industry = industryIndex >= 0 ? fitResult.X.map((row) => row[industryIndex]) : [];
  const comparisons = [trendIndex, ...seasonIndexes].filter((i) => i >= 0).map((i) => Math.abs(corr(industry, fitResult.X.map((row) => row[i]))));
  const maxCorr = comparisons.length ? Math.max(...comparisons) : 0;
  const industryShare = fitResult.names.includes("industry_idio") ? variance(fitResult.X.map((row) => row[industryIndex] * fitResult.beta[industryIndex])) / Math.max(variance(panel.target), 1e-9) : 0;
  const pass = !panel.industry || (maxCorr < threshold.industryCorrelation && industryShare < threshold.industrySharedShare);
  return { pass, status: pass ? "PASS" : "FAIL", I1_max_corr: maxCorr, I2_shared_share: industryShare };
}

function gateC(fitResult, threshold) {
  const perChannel = {};
  fitResult.mediaKeys.forEach((key) => {
    const index = fitResult.names.indexOf(`media_${key}`);
    const beta = fitResult.beta[index];
    const se = Math.max(Number(fitResult.se?.[index]) || 0, 1e-9);
    const ci = [beta - 1.96 * se, beta + 1.96 * se];
    const predictors = fitResult.mediaKeys.filter((other) => other !== key).map((other) => fitResult.X.map((row) => row[fitResult.names.indexOf(`media_${other}`)]));
    const vif = predictors.length ? 1 / Math.max(1e-6, 1 - Math.max(...predictors.map((values) => corr(fitResult.X.map((row) => row[index]), values) ** 2))) : 1;
    const tight = Math.abs(ci[1] - ci[0]) <= Math.max(Math.abs(beta), 1e-9) * threshold.ciRelativeWidth;
    perChannel[key] = { coef: beta, ci_lo: ci[0], ci_hi: ci[1], vif, verdict: Math.abs(beta) < se && (vif >= threshold.vif || !tight) ? "ABSTAIN" : beta > 0 ? "FOR" : "AGAINST" };
  });
  return { per_channel: perChannel, status: Object.values(perChannel).some((item) => item.verdict === "ABSTAIN") ? "ABSTAIN" : "PASS" };
}

function estimand(panel, baseline, fitResult) {
  const channelValues = Object.entries(fitResult.media).map(([key, values]) => ({ channel: key, share: variance(values) }));
  const total = channelValues.reduce((sum, item) => sum + item.share, 0) || 1;
  return {
    trend_sign: fitResult.trend.at(-1) - fitResult.trend[0] >= 0 ? "up" : "down",
    changepoints: baseline.cpCandidates.slice(),
    channel_contrib_varshare: channelValues.map((item) => ({ ...item, share: item.share / total })),
  };
}

function conclusion(rows) {
  const passing = rows.filter((row) => row.admissible);
  if (!passing.length) return "INCONCLUSIVE";
  const signs = new Set(passing.map((row) => row.estimand.trend_sign));
  const channels = new Map();
  passing.forEach((row) => row.estimand.channel_contrib_varshare.forEach((item) => {
    if (!channels.has(item.channel)) channels.set(item.channel, []);
    channels.get(item.channel).push(item.share);
  }));
  const stable = signs.size === 1 && [...channels.values()].every((values) => Math.max(...values) - Math.min(...values) <= 0.15);
  return stable ? "ROBUST" : "NOT IDENTIFIED";
}

function failureProfile(result) {
  const rows = result?.rows || [];
  return {
    seasonality: rows.length > 0 && rows.every((row) => row.gate_S?.status === "FAIL"),
    trend: rows.length > 0 && rows.every((row) => row.gate_T?.status === "FAIL"),
    collinearity: rows.some((row) => row.gate_C?.status === "ABSTAIN"),
  };
}

/**
 * Generates only diagnostics-driven hypotheses. Thresholds are intentionally
 * never changed here; each hypothesis starts a fresh pre-registration.
 */
export function rrGenerateHypotheses(result, basePreReg) {
  const profile = failureProfile(result);
  const hypotheses = [];
  if (profile.seasonality) {
    hypotheses.push({
      id: "seasonality-higher-harmonics",
      reason: "Gate S failed for every baseline spec; test whether a wider Fourier basis preserves the observed seasonal component.",
      grid: { seasonalBasis: [1, 2, 3, 4] },
    });
  }
  if (profile.trend) {
    hypotheses.push({
      id: "trend-flexibility-wider-band",
      reason: "Gate T failed for every baseline spec; test a wider frozen trend-basis band without changing the Gate T tolerance.",
      grid: { trendBasis: ["cv-minus-se", "cv-optimal", "cv-plus-se"] },
    });
  }
  if (profile.collinearity) {
    hypotheses.push({
      id: "media-transform-wider-lag-grid",
      reason: "Gate C produced ABSTAIN; test a wider pre-registered adstock/saturation grid while retaining ABSTAIN for wide intervals.",
      grid: { adstock: [0, 0.2, 0.5, 0.8], saturation: ["linear", "hill"] },
    });
  }
  return hypotheses.map((hypothesis) => ({
    ...hypothesis,
    preRegistration: rrCreatePreRegistration({
      ...basePreReg,
      grid: { ...basePreReg.grid, ...hypothesis.grid },
      stop: { ...basePreReg.stop, method: "exhaustive", parentSpec: hypothesis.id },
    }),
  }));
}

export function rrRunHypothesisLoop(input, basePreReg, options = {}) {
  const maxHypotheses = Math.max(0, Number(options.maxHypotheses) || 8);
  const baseResult = rrRunMultiverse(input, basePreReg);
  const generated = rrGenerateHypotheses(baseResult, basePreReg).slice(0, maxHypotheses);
  const attempts = [{ hypothesis: { id: "baseline", reason: "Initial pre-registration baseline." }, result: baseResult }];
  generated.forEach((hypothesis) => {
    attempts.push({ hypothesis: { id: hypothesis.id, reason: hypothesis.reason }, result: rrRunMultiverse(input, hypothesis.preRegistration) });
  });
  const rows = attempts.flatMap(({ hypothesis, result }) => result.rows.map((row) => ({ ...row, hypothesis_id: hypothesis.id, hypothesis_reason: hypothesis.reason })));
  return {
    baseline: baseResult,
    generated: generated.map(({ id, reason }) => ({ id, reason })),
    attempts,
    rows,
    exhaustive: attempts.every(({ result }) => result.exhaustive),
    stoppedByResult: false,
    taxonomy: conclusion(rows),
  };
}

function medianValue(values) {
  const finiteValues = values.filter(Number.isFinite).sort((a, b) => a - b);
  return finiteValues.length ? finiteValues[Math.floor(finiteValues.length / 2)] : null;
}

export function rrSummarizeWave(waveId, result) {
  const rows = result.rows || [];
  const passing = rows.filter((row) => row.admissible);
  const trendCounts = rows.reduce((counts, row) => {
    const sign = row.estimand?.trend_sign || "unknown";
    counts[sign] = (counts[sign] || 0) + 1;
    return counts;
  }, {});
  const channelValues = {};
  passing.forEach((row) => row.estimand?.channel_contrib_varshare?.forEach((item) => {
    (channelValues[item.channel] ||= []).push(item.share);
  }));
  const contributionMedian = Object.fromEntries(Object.entries(channelValues).map(([channel, values]) => [channel, medianValue(values)]));
  return {
    wave_id: waveId,
    taxonomy: result.taxonomy,
    specs: rows.length,
    admissible_specs: passing.length,
    admissible_rate: rows.length ? passing.length / rows.length : 0,
    gate_S_fail: rows.filter((row) => row.gate_S?.status === "FAIL").length,
    gate_T_fail: rows.filter((row) => row.gate_T?.status === "FAIL").length,
    gate_I_fail: rows.filter((row) => row.gate_I?.status === "FAIL").length,
    gate_C_abstain: rows.filter((row) => row.gate_C?.status === "ABSTAIN").length,
    holdout_error_median: medianValue(rows.map((row) => row.holdout?.rolling_origin_error)),
    holdout_actual_users_median: medianValue(rows.map((row) => row.holdout?.actual_users)),
    holdout_predicted_users_median: medianValue(rows.map((row) => row.holdout?.predicted_users)),
    holdout_absolute_error_users_median: medianValue(rows.map((row) => row.holdout?.absolute_error_users)),
    performance_contribution_users_median: medianValue(rows.map((row) => row.holdout?.performance_contribution_users)),
    brand_contribution_users_median: medianValue(rows.map((row) => row.holdout?.brand_contribution_users)),
    industry_contribution_users_median: medianValue(rows.map((row) => row.holdout?.industry_contribution_users)),
    trend_contribution_users_median: medianValue(rows.map((row) => row.holdout?.trend_contribution_users)),
    seasonality_contribution_users_median: medianValue(rows.map((row) => row.holdout?.seasonality_contribution_users)),
    trend_sign_counts: trendCounts,
    channel_contribution_median: contributionMedian,
  };
}

/**
 * A fixed 20-wave plan. It is constructed before any wave is run and does not
 * inspect prior wave results, so the loop cannot stop because a result looks
 * attractive. Every wave gets its own frozen pre-registration.
 */
export function rrBuildWavePlan(basePreReg, waveCount = 20) {
  const compact = {
    trendBasis: ["cv-optimal"], seasonalBasis: [1], industryHandling: ["idio-only"],
    adstock: [0.2], saturation: ["linear"], channelSet: ["full"], prior: ["ols"],
  };
  const trendVariants = [
    ["cv-optimal"], ["cv-minus-se"], ["cv-plus-se"],
    ["cv-minus-se", "cv-optimal"], ["cv-optimal", "cv-plus-se"],
    ["cv-minus-se", "cv-optimal", "cv-plus-se"],
  ];
  const seasonVariants = [[1], [1, 2], [1, 2, 3], [2, 3, 4], [1, 2, 3, 4]];
  const adstockVariants = [[0], [0.2], [0.5], [0.8], [0, 0.5], [0.2, 0.8]];
  const saturationVariants = [["linear"], ["hill"], ["linear", "hill"]];
  const variants = [];
  const seen = new Set();
  for (const trendBasis of trendVariants) for (const seasonalBasis of seasonVariants) {
    for (const adstock of adstockVariants) for (const saturation of saturationVariants) {
      for (const industryHandling of ["idio-only", "idio+explicit"]) for (const channelSet of ["full", "leave-one-out"]) {
        for (const prior of ["ols", "ridge"]) {
          const variant = { trendBasis, seasonalBasis, adstock, saturation, industryHandling: [industryHandling], channelSet: [channelSet], prior: [prior] };
          const key = JSON.stringify(variant);
          if (!seen.has(key)) { seen.add(key); variants.push(variant); }
          if (variants.length >= 50) break;
        }
        if (variants.length >= 50) break;
      }
      if (variants.length >= 50) break;
    }
    if (variants.length >= 50) break;
  }
  return Array.from({ length: Math.max(0, Math.floor(waveCount)) }, (_, index) => {
    const variant = variants[index];
    const grid = { ...compact, ...variant };
    if (index === 0) Object.assign(grid, basePreReg.grid);
    return {
      wave_id: index + 1,
      hypothesis: index === 0 ? "baseline" : `pre-registered-structural-variant-${index + 1}`,
      reason: index === 0 ? "Initial frozen baseline." : "Fixed structural sensitivity wave; selected before execution.",
      preRegistration: rrCreatePreRegistration({
        ...basePreReg,
        grid,
        stop: { ...basePreReg.stop, method: "exhaustive", waveId: index + 1, totalWaves: waveCount },
      }),
    };
  });
}

export function rrRunWaveLoop(input, basePreReg, options = {}) {
  const waveCount = Math.max(0, Math.floor(Number(options.waveCount) || 20));
  const plan = rrBuildWavePlan(basePreReg, waveCount);
  const attempts = plan.map((wave) => {
    const result = rrRunMultiverse(input, wave.preRegistration);
    return { wave_id: wave.wave_id, hypothesis: wave.hypothesis, reason: wave.reason, preRegistration: wave.preRegistration, result, metrics: rrSummarizeWave(wave.wave_id, result) };
  });
  const rows = attempts.flatMap((attempt) => attempt.result.rows.map((row) => ({ ...row, wave_id: attempt.wave_id, hypothesis: attempt.hypothesis })));
  return { waveCount, plan, attempts, rows, exhaustive: attempts.every((attempt) => attempt.result.exhaustive), stoppedByResult: false, taxonomy: conclusion(rows) };
}

export function rrSelectTopWaves(waveLoop, count = 5) {
  return (waveLoop?.attempts || [])
    .filter((attempt) => Number.isFinite(attempt.metrics?.holdout_error_median))
    .slice()
    .sort((left, right) => left.metrics.holdout_error_median - right.metrics.holdout_error_median || left.wave_id - right.wave_id)
    .slice(0, Math.max(0, Math.floor(count)));
}

export function rrBuildPostSelectionWavePlan(topWaves, basePreReg, waveCount = 50) {
  const mutations = [
    {},
    { seasonalBasis: [1, 2] }, { seasonalBasis: [1, 2, 3] },
    { seasonalBasis: [2, 3, 4] }, { seasonalBasis: [1, 2, 3, 4] },
    { adstock: [0, 0.2, 0.5] }, { adstock: [0.5, 0.8] },
    { saturation: ["hill"] }, { prior: ["ridge"] },
    { trendBasis: ["cv-minus-se", "cv-optimal", "cv-plus-se"] },
    { seasonalBasis: [3] }, { seasonalBasis: [4] },
    { adstock: [0.1] }, { adstock: [0.3] }, { adstock: [0.6] }, { adstock: [0.9] },
    { adstock: [0, 0.8] }, { saturation: ["linear", "hill"] },
    { industryHandling: ["idio+explicit"] }, { channelSet: ["leave-one-out"] },
    { trendBasis: ["cv-minus-se"] }, { trendBasis: ["cv-plus-se"] },
  ];
  const plan = [];
  const seen = new Set();
  let index = 0;
  const sources = topWaves || [];
  const baseQuota = sources.length ? Math.floor(waveCount / sources.length) : 0;
  const remainder = sources.length ? waveCount % sources.length : 0;
  sources.forEach((source, sourceIndex) => {
    const quota = baseQuota + (sourceIndex < remainder ? 1 : 0);
    let added = 0;
    for (const mutation of mutations) {
      if (added >= quota) break;
      const grid = { ...source.preRegistration.grid, ...mutation };
      const key = JSON.stringify(grid);
      if (seen.has(key)) continue;
      seen.add(key);
      index += 1;
      added += 1;
      plan.push({
        wave_id: index,
        hypothesis: `post-selection-source-${source.wave_id}-variant-${added}`,
        reason: `Exploratory variant of source wave ${source.wave_id}; selected by holdout error before this wave.`,
        source_wave_id: source.wave_id,
        preRegistration: rrCreatePreRegistration({
          ...basePreReg,
          grid,
          stop: { ...basePreReg.stop, method: "exhaustive", postSelection: true, sourceWaveId: source.wave_id, waveId: index, totalWaves: waveCount },
        }),
      });
    }
  });
  return plan;
}

export function rrRunPostSelectionWaveLoop(input, basePreReg, initialLoop, options = {}) {
  const waveCount = Math.max(0, Math.floor(Number(options.waveCount) || 50));
  const topCount = Math.max(1, Math.floor(Number(options.topCount) || 5));
  const topWaves = rrSelectTopWaves(initialLoop, topCount);
  const plan = rrBuildPostSelectionWavePlan(topWaves, basePreReg, waveCount);
  const attempts = plan.map((wave) => {
    const result = rrRunMultiverse(input, wave.preRegistration);
    return { ...wave, result, metrics: rrSummarizeWave(wave.wave_id, result) };
  });
  const rows = attempts.flatMap((attempt) => attempt.result.rows.map((row) => ({ ...row, wave_id: attempt.wave_id, hypothesis: attempt.hypothesis, source_wave_id: attempt.source_wave_id })));
  return { waveCount, topCount, topWaves, plan, attempts, rows, exhaustive: attempts.length === waveCount && attempts.every((attempt) => attempt.result.exhaustive), stoppedByResult: false, taxonomy: conclusion(rows) };
}

export function rrBuildGroupedCombinationPlan(postSelectionLoop, basePreReg) {
  const groups = new Map();
  (postSelectionLoop?.plan || []).forEach((wave) => {
    const key = String(wave.source_wave_id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(wave);
  });
  return [...groups.entries()].map(([sourceWaveId, waves], index) => {
    const keys = ["trendBasis", "seasonalBasis", "industryHandling", "adstock", "saturation", "channelSet", "prior"];
    const grid = Object.fromEntries(keys.map((key) => [key, [...new Set(waves.flatMap((wave) => wave.preRegistration.grid[key] || []))]]));
    return {
      group_id: index + 1,
      source_wave_id: Number(sourceWaveId),
      hypothesis: `grouped-source-${sourceWaveId}-all-combinations`,
      source_wave_count: waves.length,
      factor_grid: grid,
      preRegistration: rrCreatePreRegistration({
        ...basePreReg,
        grid,
        stop: { ...basePreReg.stop, method: "exhaustive", groupedCombination: true, sourceWaveId: Number(sourceWaveId) },
      }),
    };
  });
}

export function rrRunGroupedCombinationLoop(input, basePreReg, postSelectionLoop) {
  const plan = rrBuildGroupedCombinationPlan(postSelectionLoop, basePreReg);
  const attempts = plan.map((group) => {
    const result = rrRunMultiverse(input, group.preRegistration);
    return { ...group, result, metrics: rrSummarizeWave(group.group_id, result) };
  });
  const rows = attempts.flatMap((attempt) => attempt.result.rows.map((row) => ({ ...row, group_id: attempt.group_id, source_wave_id: attempt.source_wave_id, hypothesis: attempt.hypothesis })));
  return { groups: plan, attempts, rows, exhaustive: attempts.every((attempt) => attempt.result.exhaustive), stoppedByResult: false, taxonomy: conclusion(rows) };
}

export function rrRunMultiverse(input, preReg) {
  rrAssertPreRegistrationFrozen(preReg);
  const panel = normalizePanel(input);
  const baseline = baselineStage(panel);
  const factors = Object.entries(preReg.grid);
  const rows = [];
  const visit = (index, config) => {
    if (index < factors.length) {
      const [key, values] = factors[index];
      values.forEach((value) => visit(index + 1, { ...config, [key]: value }));
      return;
    }
    const fitResult = fit(panel, config, baseline);
    const failReasons = [];
    if (!fitResult) {
      rows.push({ spec_id: stableJson(config), factor_config: config, admissible: false, fail_reasons: ["fit-failed"], seed: preReg.seed, code_version: preReg.codeVersion, data_hash: preReg.dataHash });
      return;
    }
    const gate_S = gateS(panel, baseline, fitResult, preReg.gate);
    const gate_T = gateT(panel, baseline, fitResult, preReg.gate);
    const gate_I = gateI(panel, fitResult, preReg.gate);
    const gate_C = gateC(fitResult, preReg.gate);
    [gate_S, gate_T, gate_I].forEach((gate) => { if (gate.status === "FAIL") failReasons.push(gate.status); });
    if (gate_C.status === "ABSTAIN") failReasons.push("ABSTAIN:collinearity");
    const row = {
      spec_id: stableJson(config), factor_config: config, gate_S, gate_T, gate_I, gate_C,
      estimand: estimand(panel, baseline, fitResult), holdout: {
        rolling_origin_error: fitResult.holdoutError,
        actual_users: fitResult.holdoutActualUsers,
        predicted_users: fitResult.holdoutPredictedUsers,
        absolute_error_users: fitResult.holdoutAbsoluteErrorUsers,
        performance_contribution_users: fitResult.performanceContributionUsers,
        brand_contribution_users: fitResult.brandContributionUsers,
        industry_contribution_users: fitResult.industryContributionUsers,
        trend_contribution_users: fitResult.trendContributionUsers,
        seasonality_contribution_users: fitResult.seasonalityContributionUsers,
        period_performance_contribution_users: fitResult.periodPerformanceContributionUsers,
        period_brand_contribution_users: fitResult.periodBrandContributionUsers,
      },
      admissible: failReasons.length === 0, fail_reasons: failReasons,
      seed: preReg.seed, code_version: preReg.codeVersion, data_hash: preReg.dataHash,
    };
    rows.push(row);
  };
  visit(0, {});
  return { preRegistration: preReg, baseline, rows, curve: rows.map((row) => ({ spec_id: row.spec_id, admissible: row.admissible, trend_sign: row.estimand?.trend_sign, changepoints: row.estimand?.changepoints, channels: row.estimand?.channel_contrib_varshare })), taxonomy: conclusion(rows), exhaustive: true };
}
