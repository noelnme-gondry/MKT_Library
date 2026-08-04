// ── Brand campaign interrupted time-series (ITS) ──────────────────────────
// A deliberately small, auditable counterfactual model for one continuous
// brand-campaign launch. It estimates the post-period outcome that the
// pre-campaign linear trend would imply; it does NOT claim causal proof when
// a concurrent control group is absent.

import { normalizeIncrDate } from "./incrPrePostMath";
import { detectCalendarGrain } from "./seasonalityMath";
import { parseNum } from "./format";
import { studentTcrit, studentTp } from "./statPrimitives";

export const BRAND_ITS_CONTRACT = Object.freeze({
  minPeriodsByGrain: Object.freeze({
    day: Object.freeze({ pre: 21, post: 7 }),
    week: Object.freeze({ pre: 12, post: 4 }),
    month: Object.freeze({ pre: 12, post: 3 }),
  }),
  confidence: 0.95,
  // HAC long-run variance is weakly identified in short histories. We keep the
  // data contract usable, but surface this limit and never let it read as a
  // causal confirmation in the UI.
  hacReliablePrePeriods: 50,
  // Newey–West / Andrews AR(1) plug-in bandwidth for the Bartlett kernel.
  // The legacy n-only rule is retained as a lower bound when AR(1) cannot be
  // estimated. Clamp protects the residual autocovariance calculation.
  hacLag: (n, residualAr1 = 0) => {
    const maxLag = Math.max(1, n - 2);
    const legacyLag = Math.max(1, Math.floor(4 * (n / 100) ** (2 / 9)));
    const rho = Math.min(0.98, Math.max(-0.98, Math.abs(Number(residualAr1) || 0)));
    const alpha = rho > 0 ? (4 * rho ** 2) / (1 - rho) ** 4 : 0;
    const andrewsLag = alpha > 0 ? Math.floor(1.1447 * (alpha * n) ** (1 / 3)) : 0;
    return Math.min(maxLag, Math.max(legacyLag, andrewsLag));
  },
});

export function parseCampaignFlag(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "y", "on", "active", "live", "집행", "진행", "켜짐"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off", "inactive", "paused", "중단", "종료", "꺼짐"].includes(normalized)) return false;
  return null;
}

function toFiniteNumber(value) {
  return parseNum(value);
}

export function prepareBrandItsSeries(rows = []) {
  const byDate = new Map();
  let invalidRows = 0;
  for (const row of rows) {
    const date = normalizeIncrDate(row?.date);
    const value = toFiniteNumber(row?.outcome);
    const isCampaignOn = parseCampaignFlag(row?.campaignOn);
    if (!date || value == null || isCampaignOn == null) {
      invalidRows += 1;
      continue;
    }
    const existing = byDate.get(date);
    if (existing && existing.isCampaignOn !== isCampaignOn) {
      return { ok: false, reason: "mixed_campaign_state_same_date", invalidRows, points: [] };
    }
    byDate.set(date, { date, value: (existing?.value || 0) + value, isCampaignOn });
  }
  const points = [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date));
  return { ok: points.length > 0, reason: points.length ? null : "no_valid_rows", invalidRows, points };
}

function dayIndex(date, firstDate) {
  return (Date.parse(`${date}T00:00:00Z`) - Date.parse(`${firstDate}T00:00:00Z`)) / 86400000;
}

function cadenceDiagnostics(points) {
  const gaps = points.slice(1).map((point, index) => dayIndex(point.date, points[index].date));
  const sorted = [...gaps].sort((a, b) => a - b);
  const medianGapDays = sorted.length ? sorted[Math.floor(sorted.length / 2)] : 0;
  const grain = detectCalendarGrain(points);
  const expectedDays = grain === "month" ? 30.4375 : grain === "week" ? 7 : 1;
  const missingPeriods = gaps.reduce((sum, gap) => sum + (gap > expectedDays * 1.5 ? Math.max(1, Math.round(gap / expectedDays) - 1) : 0), 0);
  return {
    grain: grain === "unknown" ? "day" : grain,
    expectedDays,
    medianGapDays,
    maxGapDays: gaps.length ? Math.max(...gaps) : 0,
    missingPeriods,
    hasPeriodGaps: missingPeriods > 0,
  };
}

function fitPreTrend(pre) {
  const n = pre.length;
  const meanX = pre.reduce((sum, point) => sum + point.time, 0) / n;
  const meanY = pre.reduce((sum, point) => sum + point.value, 0) / n;
  const ssX = pre.reduce((sum, point) => sum + (point.time - meanX) ** 2, 0);
  if (!(ssX > 0)) return null;
  const slope = pre.reduce((sum, point) => sum + (point.time - meanX) * (point.value - meanY), 0) / ssX;
  const intercept = meanY - slope * meanX;
  const rss = pre.reduce((sum, point) => sum + (point.value - (intercept + slope * point.time)) ** 2, 0);
  const centeredTotal = pre.reduce((sum, point) => sum + (point.value - meanY) ** 2, 0);
  const residualVariance = rss / Math.max(1, n - 2);
  const tolerance = Number.EPSILON * Math.max(1, ...pre.map((point) => Math.abs(point.value))) ** 2 * n * 100;
  return { intercept, slope, meanX, ssX, rss, residualVariance, rSquared: centeredTotal > 0 ? 1 - rss / centeredTotal : null, isDegenerate: rss <= tolerance };
}

function matrix2Inverse([[a, b], [c, d]]) {
  const determinant = a * d - b * c;
  if (!Number.isFinite(determinant) || Math.abs(determinant) <= Number.EPSILON * Math.max(1, Math.abs(a * d), Math.abs(b * c)) * 100) return null;
  return [[d / determinant, -b / determinant], [-c / determinant, a / determinant]];
}

function matrix2Multiply(left, right) {
  return [
    [left[0][0] * right[0][0] + left[0][1] * right[1][0], left[0][0] * right[0][1] + left[0][1] * right[1][1]],
    [left[1][0] * right[0][0] + left[1][1] * right[1][0], left[1][0] * right[0][1] + left[1][1] * right[1][1]],
  ];
}

function quadraticForm(matrix, vector) {
  return vector[0] * (matrix[0][0] * vector[0] + matrix[0][1] * vector[1])
    + vector[1] * (matrix[1][0] * vector[0] + matrix[1][1] * vector[1]);
}

function estimateResidualAr1(residuals) {
  if (!Array.isArray(residuals) || residuals.length < 3) return null;
  let numerator = 0;
  let denominator = 0;
  for (let index = 1; index < residuals.length; index += 1) {
    numerator += residuals[index] * residuals[index - 1];
    denominator += residuals[index - 1] ** 2;
  }
  if (!(denominator > 0)) return null;
  const rho = numerator / denominator;
  return Number.isFinite(rho) ? Math.max(-0.98, Math.min(0.98, rho)) : null;
}

// Newey–West sandwich covariance for the pre-period trend coefficients. The
// resulting interval also includes the finite-horizon variance of future
// residual sums, so positive serial correlation cannot masquerade as precision.
function neweyWestUncertainty(pre, trend, postSeries) {
  const n = pre.length;
  const df = n - 2;
  const residuals = pre.map((point) => point.value - (trend.intercept + trend.slope * point.time));
  const residualAr1 = estimateResidualAr1(residuals);
  const lag = BRAND_ITS_CONTRACT.hacLag(n, residualAr1);
  const xtx = [[n, pre.reduce((sum, point) => sum + point.time, 0)], [pre.reduce((sum, point) => sum + point.time, 0), pre.reduce((sum, point) => sum + point.time ** 2, 0)]];
  const bread = matrix2Inverse(xtx);
  if (!bread) return null;
  const meat = [[0, 0], [0, 0]];
  const addOuter = (scale, left, right) => {
    meat[0][0] += scale * left[0] * right[0]; meat[0][1] += scale * left[0] * right[1];
    meat[1][0] += scale * left[1] * right[0]; meat[1][1] += scale * left[1] * right[1];
  };
  pre.forEach((point, index) => addOuter(residuals[index] ** 2, [1, point.time], [1, point.time]));
  for (let offset = 1; offset <= lag; offset += 1) {
    const weight = 1 - offset / (lag + 1);
    for (let index = offset; index < n; index += 1) {
      const scale = weight * residuals[index] * residuals[index - offset];
      const current = [1, pre[index].time];
      const previous = [1, pre[index - offset].time];
      addOuter(scale, current, previous);
      addOuter(scale, previous, current);
    }
  }
  // OLS residuals consume intercept and trend degrees of freedom. Without this
  // n/(n−2) correction HAC is mechanically narrower than the matching iid SE.
  const finiteSampleScale = n / df;
  const correctedMeat = meat.map((row) => row.map((value) => value * finiteSampleScale));
  const covariance = matrix2Multiply(matrix2Multiply(bread, correctedMeat), bread);
  const postCount = postSeries.length;
  const postX = [postCount, postSeries.reduce((sum, point) => sum + point.time, 0)];
  const coefficientVariance = quadraticForm(covariance, postX);
  const autocovariance = (offset) => residuals.slice(offset).reduce((sum, value, index) => sum + value * residuals[index], 0) / df;
  let futureVariance = postCount * autocovariance(0);
  for (let offset = 1; offset <= Math.min(lag, postCount - 1); offset += 1) {
    futureVariance += 2 * (postCount - offset) * (1 - offset / (lag + 1)) * autocovariance(offset);
  }
  const variance = coefficientVariance + futureVariance;
  if (!Number.isFinite(variance) || variance <= 0) return null;
  const iidVariance = trend.residualVariance * (postCount + (postCount * postCount) / n + ((postX[1] - postCount * trend.meanX) ** 2) / trend.ssX);
  return {
    lag,
    residualAr1,
    covariance,
    coefficientVariance,
    futureVariance,
    variance,
    iidVariance,
    finiteSampleScale,
    isSmallSample: n < BRAND_ITS_CONTRACT.hacReliablePrePeriods,
  };
}

export function runBrandInterruptedTimeSeries(input = {}) {
  const prepared = prepareBrandItsSeries(input.rows || []);
  if (!prepared.ok) return { ...prepared, ok: false, status: "INVALID_INPUT" };
  const points = prepared.points;
  const cadence = cadenceDiagnostics(points);
  const minimum = BRAND_ITS_CONTRACT.minPeriodsByGrain[cadence.grain] || BRAND_ITS_CONTRACT.minPeriodsByGrain.day;
  const campaignStart = points.findIndex((point) => point.isCampaignOn);
  if (campaignStart < 0) return { ...prepared, ok: false, status: "INVALID_INPUT", reason: "campaign_on_missing" };
  const hasOffAfterStart = points.slice(campaignStart).some((point) => !point.isCampaignOn);
  if (hasOffAfterStart) return { ...prepared, ok: false, status: "NOT_IDENTIFIED", reason: "multiple_campaign_windows", campaignStartIndex: campaignStart };
  const pre = points.slice(0, campaignStart).map((point) => ({ ...point, time: dayIndex(point.date, points[0].date) }));
  const post = points.slice(campaignStart).map((point) => ({ ...point, time: dayIndex(point.date, points[0].date) }));
  if (pre.length < minimum.pre || post.length < minimum.post) {
    return {
      ...prepared,
      ok: false,
      status: "INSUFFICIENT_DATA",
      reason: pre.length < minimum.pre ? "insufficient_pre_periods" : "insufficient_post_periods",
      prePeriods: pre.length,
      postPeriods: post.length,
      minPrePeriods: minimum.pre,
      minPostPeriods: minimum.post,
      diagnostics: { ...cadence, invalidRows: prepared.invalidRows },
    };
  }
  const trend = fitPreTrend(pre);
  if (!trend) return { ...prepared, ok: false, status: "NOT_IDENTIFIED", reason: "pretrend_not_estimable", prePeriods: pre.length, postPeriods: post.length };
  if (trend.isDegenerate) return { ...prepared, ok: false, status: "NOT_IDENTIFIED", reason: "zero_pretrend_variance", prePeriods: pre.length, postPeriods: post.length, diagnostics: { ...cadence, invalidRows: prepared.invalidRows } };
  const series = points.map((point) => {
    const time = dayIndex(point.date, points[0].date);
    const counterfactual = trend.intercept + trend.slope * time;
    return { ...point, time, counterfactual, incremental: point.value - counterfactual };
  });
  const postSeries = series.slice(campaignStart);
  const actualTotal = postSeries.reduce((sum, point) => sum + point.value, 0);
  const counterfactualTotal = postSeries.reduce((sum, point) => sum + point.counterfactual, 0);
  const incrementalTotal = actualTotal - counterfactualTotal;
  const uncertainty = neweyWestUncertainty(pre, trend, postSeries);
  if (!uncertainty) return { ...prepared, ok: false, status: "NOT_IDENTIFIED", reason: "hac_variance_not_estimable", prePeriods: pre.length, postPeriods: post.length, diagnostics: { ...cadence, invalidRows: prepared.invalidRows } };
  const standardError = Math.sqrt(uncertainty.variance);
  const df = pre.length - 2;
  const tScore = incrementalTotal / standardError;
  const pValue = studentTp(Math.abs(tScore), df);
  const margin = studentTcrit(BRAND_ITS_CONTRACT.confidence, df) * standardError;
  return {
    ok: true,
    status: "ESTIMATED",
    points: series,
    campaignStartDate: points[campaignStart].date,
    prePeriods: pre.length,
    postPeriods: post.length,
    actualTotal,
    counterfactualTotal,
    incrementalTotal,
    incrementalRate: counterfactualTotal !== 0 ? incrementalTotal / Math.abs(counterfactualTotal) : null,
    ci95: [incrementalTotal - margin, incrementalTotal + margin],
    standardError,
    iidStandardError: Math.sqrt(Math.max(0, uncertainty.iidVariance)),
    tScore,
    pValue,
    confidenceMethod: "newey_west_hac",
    trend: { ...trend, slopePerDay: trend.slope },
    diagnostics: {
      ...cadence,
      hasDateGaps: cadence.hasPeriodGaps,
      hacLag: uncertainty.lag,
      hacBandwidthMethod: "andrews_ar1_bartlett",
      residualAr1: uncertainty.residualAr1,
      hacFiniteSampleScale: uncertainty.finiteSampleScale,
      smallSampleHac: uncertainty.isSmallSample,
      hacReliablePrePeriods: BRAND_ITS_CONTRACT.hacReliablePrePeriods,
      invalidRows: prepared.invalidRows,
    },
  };
}
