// ── Brand campaign interrupted time-series (ITS) ──────────────────────────
// A deliberately small, auditable counterfactual model for one continuous
// brand-campaign launch. It estimates the post-period outcome that the
// pre-campaign linear trend would imply; it does NOT claim causal proof when
// a concurrent control group is absent.

import { normalizeIncrDate } from "./incrPrePostMath";

export const BRAND_ITS_CONTRACT = Object.freeze({
  minPrePeriods: 21,
  minPostPeriods: 7,
  confidenceZ: 1.96,
});

function normalCdf(value) {
  // Abramowitz–Stegun 7.1.26. Deterministic and sufficiently precise for the
  // display-only normal approximation used below.
  const x = Math.abs(value);
  const t = 1 / (1 + 0.2316419 * x);
  const density = 0.3989422804014327 * Math.exp(-(x * x) / 2);
  const poly = t * (0.319381530 + t * (-0.356563782 + t * (1.781477937 + t * (-1.821255978 + t * 1.330274429))));
  const cdf = 1 - density * poly;
  return value < 0 ? 1 - cdf : cdf;
}

export function parseCampaignFlag(value) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "y", "on", "active", "live", "집행", "진행", "켜짐"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off", "inactive", "paused", "중단", "종료", "꺼짐"].includes(normalized)) return false;
  return null;
}

function toFiniteNumber(value) {
  if (value == null || String(value).trim() === "") return null;
  const result = Number(String(value).replace(/[,$₩\s]/g, ""));
  return Number.isFinite(result) ? result : null;
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

function maxGapDays(points) {
  let maximum = 0;
  for (let index = 1; index < points.length; index += 1) {
    maximum = Math.max(maximum, dayIndex(points[index].date, points[index - 1].date));
  }
  return maximum;
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
  return { intercept, slope, meanX, ssX, rss, residualVariance, rSquared: centeredTotal > 0 ? 1 - rss / centeredTotal : null };
}

export function runBrandInterruptedTimeSeries(input = {}) {
  const prepared = prepareBrandItsSeries(input.rows || []);
  if (!prepared.ok) return { ...prepared, ok: false, status: "INVALID_INPUT" };
  const points = prepared.points;
  const campaignStart = points.findIndex((point) => point.isCampaignOn);
  if (campaignStart < 0) return { ...prepared, ok: false, status: "INVALID_INPUT", reason: "campaign_on_missing" };
  const hasOffAfterStart = points.slice(campaignStart).some((point) => !point.isCampaignOn);
  if (hasOffAfterStart) return { ...prepared, ok: false, status: "NOT_IDENTIFIED", reason: "multiple_campaign_windows", campaignStartIndex: campaignStart };
  const pre = points.slice(0, campaignStart).map((point) => ({ ...point, time: dayIndex(point.date, points[0].date) }));
  const post = points.slice(campaignStart).map((point) => ({ ...point, time: dayIndex(point.date, points[0].date) }));
  if (pre.length < BRAND_ITS_CONTRACT.minPrePeriods || post.length < BRAND_ITS_CONTRACT.minPostPeriods) {
    return {
      ...prepared,
      ok: false,
      status: "INSUFFICIENT_DATA",
      reason: pre.length < BRAND_ITS_CONTRACT.minPrePeriods ? "insufficient_pre_periods" : "insufficient_post_periods",
      prePeriods: pre.length,
      postPeriods: post.length,
      minPrePeriods: BRAND_ITS_CONTRACT.minPrePeriods,
      minPostPeriods: BRAND_ITS_CONTRACT.minPostPeriods,
    };
  }
  const trend = fitPreTrend(pre);
  if (!trend) return { ...prepared, ok: false, status: "NOT_IDENTIFIED", reason: "pretrend_not_estimable", prePeriods: pre.length, postPeriods: post.length };
  const series = points.map((point) => {
    const time = dayIndex(point.date, points[0].date);
    const counterfactual = trend.intercept + trend.slope * time;
    return { ...point, time, counterfactual, incremental: point.value - counterfactual };
  });
  const postSeries = series.slice(campaignStart);
  const actualTotal = postSeries.reduce((sum, point) => sum + point.value, 0);
  const counterfactualTotal = postSeries.reduce((sum, point) => sum + point.counterfactual, 0);
  const incrementalTotal = actualTotal - counterfactualTotal;
  const nPost = postSeries.length;
  const sumPostX = postSeries.reduce((sum, point) => sum + point.time, 0);
  // Prediction variance = future residual noise + uncertainty in the fitted
  // pre-period line. Serial correlation is not assumed away; it is surfaced as
  // an explicit evidence limitation in the UI.
  const predictionVariance = trend.residualVariance * (nPost + (nPost * nPost) / pre.length + ((sumPostX - nPost * trend.meanX) ** 2) / trend.ssX);
  const standardError = Math.sqrt(Math.max(0, predictionVariance));
  const zScore = standardError > 0 ? incrementalTotal / standardError : 0;
  const pValue = standardError > 0 ? 2 * (1 - normalCdf(Math.abs(zScore))) : 1;
  const margin = BRAND_ITS_CONTRACT.confidenceZ * standardError;
  const gapDays = maxGapDays(points);
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
    zScore,
    pValue,
    trend: { ...trend, slopePerDay: trend.slope },
    diagnostics: { maxGapDays: gapDays, hasDateGaps: gapDays > 1, invalidRows: prepared.invalidRows },
  };
}
