const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULT_INTERRUPTION_CONFIG = Object.freeze({
  baselinePeriods: 4,
  dropFraction: 0.7,
  minConsecutiveDaily: 3,
  minConsecutiveWeekly: 2,
});

function valueAt(record, key) {
  const value = record?.metrics?.[key] ?? record?.dimensions?.[key] ?? record?.[key];
  return Number(value);
}

function stringAt(record, key) {
  const value = record?.dimensions?.[key] ?? record?.[key];
  return value == null ? null : String(value).trim() || null;
}

function median(values) {
  const sorted = [...values].filter(Number.isFinite).sort((a, b) => a - b);
  if (!sorted.length) return null;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function medianAbsoluteDeviation(values, center) {
  return median(values.map((value) => Math.abs(value - center)));
}

function dateMs(value) {
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

function normalizedRows(records, { unitKeys, spendKeys, supportKeys }) {
  const byUnit = new Map();
  records.forEach((record) => {
    const date = record?.date || record?.week || record?.snapshot_date;
    const ms = dateMs(date);
    const unitValues = unitKeys.map((key) => stringAt(record, key)).filter(Boolean);
    if (!date || ms == null || !unitValues.length) return;
    const unit = unitValues.join("│");
    if (!byUnit.has(unit)) byUnit.set(unit, new Map());
    const aggregate = byUnit.get(unit).get(date) || { unit, date, ms, spend: 0, support: {}, rowCount: 0 };
    aggregate.spend += spendKeys.reduce((sum, key) => sum + (Number.isFinite(valueAt(record, key)) ? valueAt(record, key) : 0), 0);
    supportKeys.forEach((key) => {
      aggregate.support[key] = (aggregate.support[key] || 0) + (Number.isFinite(valueAt(record, key)) ? valueAt(record, key) : 0);
    });
    aggregate.rowCount += 1;
    byUnit.get(unit).set(date, aggregate);
  });
  return new Map([...byUnit.entries()].map(([unit, periods]) => [unit, [...periods.values()].sort((a, b) => a.ms - b.ms)]));
}

function intervalInfo(periods) {
  const gaps = periods.slice(1).map((point, index) => point.ms - periods[index].ms).filter((gap) => gap > 0);
  const expected = median(gaps);
  if (!expected) return { expected: null, hasGap: false, isWeekly: false };
  return {
    expected,
    hasGap: gaps.some((gap) => gap > expected * 1.5),
    isWeekly: expected >= DAY_MS * 6,
  };
}

function totalSeries(units) {
  const totals = new Map();
  units.forEach((periods) => periods.forEach((point) => {
    totals.set(point.date, (totals.get(point.date) || 0) + point.spend);
  }));
  return totals;
}

function looksLikeExportGap(run, supportKeys) {
  if (!supportKeys.length) return false;
  return run.every((point) => supportKeys.every((key) => (point.support[key] || 0) === 0));
}

function wholeMarketDecline(totals, periods, startIndex, baselinePeriods, threshold) {
  const history = periods.slice(Math.max(0, startIndex - baselinePeriods), startIndex)
    .map((point) => totals.get(point.date) || 0);
  const baseline = median(history);
  const current = totals.get(periods[startIndex].date) || 0;
  return baseline > 0 && current <= baseline * (1 - threshold);
}

// 운영상 중단을 자동으로 실험으로 확정하지 않는다. 이 함수는 재현 가능한 후보와
// 차단 사유만 만든다. 확인 전에는 campaign_on·처리군·대조군을 파생하지 않는다.
export function detectBudgetInterruptionCandidates({
  records = [],
  unitKeys = ["channel", "country", "campaign_name"],
  spendKeys = ["cost", "spend", "media_spend"],
  supportKeys = ["impressions", "clicks", "installs", "actions", "revenue"],
  config = {},
} = {}) {
  const settings = { ...DEFAULT_INTERRUPTION_CONFIG, ...config };
  const units = normalizedRows(records, { unitKeys, spendKeys, supportKeys });
  const totals = totalSeries(units);
  const candidates = [];
  const excluded = [];

  for (const [unit, periods] of units) {
    const interval = intervalInfo(periods);
    if (interval.hasGap) {
      excluded.push({ unit, code: "period_gap" });
      continue;
    }
    const minConsecutive = interval.isWeekly ? settings.minConsecutiveWeekly : settings.minConsecutiveDaily;
    for (let startIndex = settings.baselinePeriods; startIndex <= periods.length - minConsecutive; startIndex += 1) {
      const baselineValues = periods.slice(startIndex - settings.baselinePeriods, startIndex).map((point) => point.spend);
      const baselineSpend = median(baselineValues);
      if (!(baselineSpend > 0)) continue;
      const threshold = baselineSpend * (1 - settings.dropFraction);
      let endIndex = startIndex;
      while (endIndex < periods.length && periods[endIndex].spend <= threshold) endIndex += 1;
      const run = periods.slice(startIndex, endIndex);
      if (run.length < minConsecutive) continue;
      const currentSpend = median(run.map((point) => point.spend));
      const dropFraction = 1 - currentSpend / baselineSpend;
      const mad = medianAbsoluteDeviation(baselineValues, baselineSpend);
      // 보조 지표까지 동시에 사라진 경우는 단일 채널이어도 중단으로 단정하지
      // 않는다. 시장 전체 하락보다 먼저 export/tracking 가능성을 보여 준다.
      if (looksLikeExportGap(run, supportKeys.filter((key) => run.some((point) => Object.hasOwn(point.support, key))))) {
        excluded.push({ unit, code: "tracking_or_export_gap", startDate: run[0].date });
      } else if (wholeMarketDecline(totals, periods, startIndex, settings.baselinePeriods, settings.dropFraction)) {
        excluded.push({ unit, code: "whole_market_decline", startDate: run[0].date });
      } else {
        candidates.push({
          unit,
          startDate: run[0].date,
          endDate: run.at(-1).date,
          duration: run.length,
          cadence: interval.isWeekly ? "weekly" : "daily",
          baselineSpend,
          currentSpend,
          dropFraction,
          baselineMad: mad,
          requiresConfirmation: ["actual_interruption", "outcome", "treatment_unit", "intervention_window", "control_unit"],
        });
      }
      startIndex = endIndex - 1;
    }
  }
  return { candidates, excluded, settings };
}

export function buildNaturalExperimentHandoff({ candidate, confirmation = {} } = {}) {
  const required = ["actualInterruption", "outcomeKey", "treatmentUnit", "startDate"];
  const missing = required.filter((key) => !confirmation[key]);
  if (!candidate || missing.length) return { status: "confirm_design", missing };
  if (confirmation.actualInterruption !== true) return { status: "blocked", blockers: [{ code: "interruption_not_confirmed" }] };
  if (confirmation.controlUnit) {
    return {
      status: "confirm_design",
      targetToolId: "5-23",
      method: "did_or_shutdown",
      candidate,
      requiresParallelTrendCheck: true,
    };
  }
  return {
    status: "confirm_design",
    targetToolId: "5-24",
    method: "its_or_observed_pre_post",
    candidate,
    causalClaimAllowed: false,
  };
}
