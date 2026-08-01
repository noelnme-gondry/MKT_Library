// ── Pre/Post incrementality (turn-on / turn-off) ────────────────────────────
// For the 증분 분석 tool's ② 신규 켜기(on) / ③ 종료(off) tabs: measure the effect
// of switching something on or off at a cutoff date by comparing the metric
// BEFORE vs AFTER. Optional control group → difference-in-differences (DiD) to
// strip seasonality/trend. (docs/design-system-baseline.md §2)
//
// Pure & deterministic. Significance via STATS.continuousTest (Welch). Golden.

import { STATS } from "./abTestMath";
import { studentTp } from "./statPrimitives";

export const INCR_PREPOST_CONTRACT = Object.freeze({
  minPretrendDates: 5,
  pretrendAlpha: 0.05,
});

function mean(a) {
  return a.length ? a.reduce((s, v) => s + v, 0) / a.length : 0;
}
function sd(a) {
  if (a.length < 2) return 0;
  const m = mean(a);
  const v = a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1);
  return Math.sqrt(v);
}

// DiD는 같은 달력 날짜의 처리군·대조군만 비교해야 한다. 날짜 없는 숫자
// 배열을 인덱스로 짝지으면 누락일·정렬 차이가 서로 다른 날의 차이로 섞인다.
export function normalizeIncrDate(value) {
  const matched = String(value || "").trim().match(/^(\d{4})[-/](\d{1,2})(?:[-/](\d{1,2}))?$/);
  if (!matched) return null;
  const year = Number(matched[1]);
  const month = Number(matched[2]);
  const day = matched[3] == null ? 1 : Number(matched[3]);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (parsed.getUTCFullYear() !== year || parsed.getUTCMonth() !== month - 1 || parsed.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

function normalizeDatedSeries(series) {
  if (!Array.isArray(series)) return null;
  const byDate = new Map();
  for (const point of series) {
    if (!point || typeof point !== "object") return null;
    const date = normalizeIncrDate(point.date);
    const value = point.value;
    if (!date || typeof value !== "number" || !Number.isFinite(value)) return null;
    // 한 날짜에 여러 행이 있으면 일 단위 지표로 먼저 합친 뒤 비교한다.
    byDate.set(date, (byDate.get(date) || 0) + value);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, value }));
}

function numericValues(series) {
  if (!Array.isArray(series)) return [];
  if (series.every((value) => typeof value === "number")) return series.every(Number.isFinite) ? series : [];
  const normalized = normalizeDatedSeries(series);
  return normalized ? normalized.map((point) => point.value) : [];
}

function testParallelPretrend(dates, treatment, control) {
  const n = dates.length;
  if (n < INCR_PREPOST_CONTRACT.minPretrendDates) {
    return {
      ok: false,
      status: "INSUFFICIENT_DATA",
      reason: "insufficient_pretrend_dates",
      n,
      minRequired: INCR_PREPOST_CONTRACT.minPretrendDates,
    };
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const firstMs = Date.parse(`${dates[0]}T00:00:00Z`);
  const x = dates.map((date) => (Date.parse(`${date}T00:00:00Z`) - firstMs) / dayMs);
  const gaps = treatment.map((value, i) => value - control[i]);
  if (x.some((value) => !Number.isFinite(value)) || new Set(x).size !== n) {
    return { ok: false, status: "INVALID_INPUT", reason: "invalid_pretrend_dates", n };
  }
  const xMean = mean(x);
  const gapMean = mean(gaps);
  const ssX = x.reduce((sum, value) => sum + (value - xMean) ** 2, 0);
  if (!(ssX > 0)) return { ok: false, status: "INVALID_INPUT", reason: "invalid_pretrend_dates", n };
  const slopePerDay = x.reduce((sum, value, i) => sum + (value - xMean) * (gaps[i] - gapMean), 0) / ssX;
  const intercept = gapMean - slopePerDay * xMean;
  const residualSq = gaps.reduce((sum, gap, i) => sum + (gap - (intercept + slopePerDay * x[i])) ** 2, 0);
  const df = n - 2;
  const gapScale = Math.max(1, ...gaps.map(Math.abs));
  const residualTolerance = Number.EPSILON * gapScale * gapScale * n * 100;
  const slopeTolerance = Number.EPSILON * gapScale * 100 / Math.max(1, x[x.length - 1] - x[0]);
  let standardError = 0;
  let tStatistic = 0;
  let pValue = 1;
  if (residualSq <= residualTolerance) {
    if (Math.abs(slopePerDay) > slopeTolerance) {
      tStatistic = slopePerDay > 0 ? Infinity : -Infinity;
      pValue = 0;
    }
  } else {
    standardError = Math.sqrt((residualSq / df) / ssX);
    tStatistic = standardError > 0 ? slopePerDay / standardError : 0;
    pValue = studentTp(Math.abs(tStatistic), df);
  }
  if (!Number.isFinite(pValue)) {
    return {
      ok: false,
      status: "INSUFFICIENT_DATA",
      reason: "pretrend_not_estimable",
      n,
      minRequired: INCR_PREPOST_CONTRACT.minPretrendDates,
      slopePerDay,
    };
  }
  const hasViolation = Number.isFinite(pValue) && pValue < INCR_PREPOST_CONTRACT.pretrendAlpha;
  return {
    ok: !hasViolation,
    status: hasViolation ? "FAIL" : "PASS",
    reason: hasViolation ? "pretrend_violation" : null,
    n,
    minRequired: INCR_PREPOST_CONTRACT.minPretrendDates,
    alpha: INCR_PREPOST_CONTRACT.pretrendAlpha,
    slopePerDay,
    standardError,
    tStatistic,
    pValue,
    gapStart: gaps[0],
    gapEnd: gaps[gaps.length - 1],
  };
}

function alignDatedSeries(treatment, control) {
  const treatmentSeries = normalizeDatedSeries(treatment);
  const controlSeries = normalizeDatedSeries(control);
  if (!treatmentSeries || !controlSeries) {
    return { ok: false, reason: "dated_series_required", dates: [], treatment: [], control: [] };
  }
  const treatmentByDate = new Map(treatmentSeries.map((point) => [point.date, point.value]));
  const controlByDate = new Map(controlSeries.map((point) => [point.date, point.value]));
  const dates = [...treatmentByDate.keys()].filter((date) => controlByDate.has(date)).sort();
  return {
    ok: dates.length > 0,
    reason: dates.length > 0 ? null : "no_common_dates",
    dates,
    treatment: dates.map((date) => treatmentByDate.get(date)),
    control: dates.map((date) => controlByDate.get(date)),
    treatmentDateCount: treatmentSeries.length,
    controlDateCount: controlSeries.length,
    unmatchedTreatmentDates: treatmentSeries.length - dates.length,
    unmatchedControlDates: controlSeries.length - dates.length,
  };
}

export const INCR_PREPOST = {
  mean,
  sd,
  // pre/post: arrays of daily metric values (treatment). direction: "on"|"off".
  // DiD의 pre/post/control은 [{date,value}] 계약이다. 단순 전후 비교만 숫자
  // 배열을 허용한다. control (optional): { pre:[], post:[] } — unchanged group.
  compute({ pre, post, direction = "on", control = null }) {
    const preValues = numericValues(pre);
    const postValues = numericValues(post);
    if (preValues.length === 0 || postValues.length === 0) return null;
    const preMean = mean(preValues);
    const postMean = mean(postValues);
    const delta = postMean - preMean;            // raw change (signed)
    const deltaPct = preMean !== 0 ? delta / preMean : null;

    // Counterfactual = pre-period daily rate continues through the post window.
    const counterfactualTotal = preMean * postValues.length;
    const postTotal = postValues.reduce((s, v) => s + v, 0);
    // incremental over the whole post window (signed; on→+ gained, off→− lost)
    const incrementalTotal = postTotal - counterfactualTotal;

    // Significance: is the post daily mean different from pre daily mean?
    const sig = STATS.continuousTest(
      preValues.length, preMean, sd(preValues),
      postValues.length, postMean, sd(postValues),
    );

    // Difference-in-differences with a control group (removes common trend).
    let did = null;
    if (control && control.pre && control.post && control.pre.length && control.post.length) {
      const alignedPre = alignDatedSeries(pre, control.pre);
      const alignedPost = alignDatedSeries(post, control.post);
      if (!alignedPre.ok || !alignedPost.ok) {
        did = {
          ok: false,
          status: "NOT_IDENTIFIED",
          reason: !alignedPre.ok ? alignedPre.reason : alignedPost.reason,
          pairedPreN: alignedPre.dates.length,
          pairedPostN: alignedPost.dates.length,
          commonPreDates: alignedPre.dates,
          commonPostDates: alignedPost.dates,
        };
      } else {
        const pretrend = testParallelPretrend(alignedPre.dates, alignedPre.treatment, alignedPre.control);
        if (!pretrend.ok) {
          did = {
            ok: false,
            status: "NOT_IDENTIFIED",
            reason: pretrend.reason,
            pretrend,
            pairedPreN: alignedPre.dates.length,
            pairedPostN: alignedPost.dates.length,
            commonPreDates: alignedPre.dates,
            commonPostDates: alignedPost.dates,
            unmatchedTreatmentDates: alignedPre.unmatchedTreatmentDates + alignedPost.unmatchedTreatmentDates,
            unmatchedControlDates: alignedPre.unmatchedControlDates + alignedPost.unmatchedControlDates,
          };
        } else {
          const tPre = mean(alignedPre.treatment);
          const tPost = mean(alignedPost.treatment);
          const cPre = mean(alignedPre.control);
          const cPost = mean(alignedPost.control);
          const treatDelta = tPost - tPre;
          const ctrlDelta = cPost - cPre;
          const didDelta = treatDelta - ctrlDelta; // effect net of control's own change
          // DiD를 선택했을 때 유의성도 반드시 처리군의 단순 전후 변화가 아니라
          // (처리군 − 대조군) 일별 차이의 전후 변화에서 계산한다. 그렇지 않으면
          // 공통 계절성만 유의해도 순효과가 유의한 것처럼 화면에 표시될 수 있다.
          const diffPre = alignedPre.treatment.map((value, i) => value - alignedPre.control[i]);
          const diffPost = alignedPost.treatment.map((value, i) => value - alignedPost.control[i]);
          const didSig = STATS.continuousTest(
            diffPre.length, mean(diffPre), sd(diffPre),
            diffPost.length, mean(diffPost), sd(diffPost),
          );
          did = {
            ok: true,
            status: "COMPLETE",
            pretrend,
            treatPreMean: tPre,
            treatPostMean: tPost,
            ctrlPreMean: cPre,
            ctrlPostMean: cPost,
            ctrlDelta,
            didDelta,
            incrementalTotal: didDelta * diffPost.length,
            sig: didSig,
            pairedPreN: diffPre.length,
            pairedPostN: diffPost.length,
            commonPreDates: alignedPre.dates,
            commonPostDates: alignedPost.dates,
            unmatchedTreatmentDates: alignedPre.unmatchedTreatmentDates + alignedPost.unmatchedTreatmentDates,
            unmatchedControlDates: alignedPre.unmatchedControlDates + alignedPost.unmatchedControlDates,
          };
        }
      }
    }

    // Direction framing: "off" measures the LOSS from turning off (magnitude of
    // the drop). We keep raw signed values; the view labels them per direction.
    return {
      preMean, postMean, delta, deltaPct,
      counterfactualTotal, postTotal, incrementalTotal,
      nPre: preValues.length, nPost: postValues.length,
      sig, did, direction,
    };
  },
};
