// Country-prior selection helpers for the client-side MMM.
//
// These functions deliberately do not fit the MMM themselves. The caller owns the
// model fit and passes only compact coefficient/validation summaries here, which
// keeps the safeguards deterministic, testable, and inexpensive in the browser.

import { mmmExcelSerialDateTimestamp } from "./mmmInputUtils";

export const MMM_COUNTRY_PRIOR_LIMITS = Object.freeze({
  maxReferenceFits: 12,
  maxValidatedCountries: 4,
  maxCombinationSize: 3,
  maxCombinations: 24,
  maxEffectiveCountries: 3,
  minRows: 24,
  minValidationFolds: 2,
  minRelativeImprovement: 0.02,
  minFoldWinRate: 2 / 3,
  complexityPenaltyPerCountry: 0.025,
  singleCountryRelativeSdFloor: 0.5,
  multiCountryRelativeSdFloor: 0.25,
});

function finiteNumber(value) {
  if (value == null || (typeof value === "string" && value.trim() === "")) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mean(values) {
  return values.reduce((sum, value) => sum + value, 0) / Math.max(1, values.length);
}

function sampleSd(values) {
  if (values.length < 2) return 0;
  const center = mean(values);
  return Math.sqrt(values.reduce((sum, value) => sum + (value - center) ** 2, 0) / (values.length - 1));
}

function median(values) {
  const sorted = values.slice().sort((a, b) => a - b);
  if (!sorted.length) return 0;
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function isoWeekStart(year, week) {
  if (!(year >= 1900) || !(week >= 1 && week <= 53)) return null;
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Day = jan4.getUTCDay() || 7;
  return jan4.getTime() - (jan4Day - 1) * 86400000 + (week - 1) * 7 * 86400000;
}

// Dates and relative numeric weeks are intentionally different kinds. Comparing
// `2025-01-01` (epoch milliseconds) with a relative week `37` would look precise
// while silently aligning unrelated clocks.
export function mmmCountryTimeKey(value) {
  if (value instanceof Date && Number.isFinite(value.getTime())) return { kind: "date", value: value.getTime() };
  const text = String(value ?? "").trim();
  if (!text) return null;
  const isoWeek = text.match(/^(\d{4})\s*(?:-|\/|\.)?\s*(?:W|week\s*|주\s*)(\d{1,2})(?:주차?)?$/i);
  if (isoWeek) {
    const timestamp = isoWeekStart(Number(isoWeek[1]), Number(isoWeek[2]));
    return timestamp == null ? null : { kind: "date", value: timestamp };
  }
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}(?:[T\s].*)?$/.test(text)) {
    const timestamp = Date.parse(text.replace(/\./g, "-"));
    if (Number.isFinite(timestamp)) return { kind: "date", value: timestamp };
  }
  const excelTimestamp = mmmExcelSerialDateTimestamp(value);
  if (excelTimestamp != null) return { kind: "date", value: excelTimestamp };
  if (/^-?\d+(?:\.\d+)?$/.test(text)) return { kind: "index", value: Number(text) };
  return null;
}

function countryWeeklyPeriod(value) {
  const key = mmmCountryTimeKey(value);
  if (!key) return null;
  if (key.kind !== "date") return key;
  const date = new Date(key.value);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() - ((date.getUTCDay() + 6) % 7));
  return { kind: "date", value: date.getTime() };
}

function countryWeeklyPeriodKey(value) {
  const period = countryWeeklyPeriod(value);
  return period ? `${period.kind}:${period.value}` : null;
}

// Restrict reference-market evidence to information available before a target
// validation fold. If the two timelines cannot be compared, this fails open but
// explicitly marks the result `retrospective`; callers must not call that strict
// historical validation.
export function mmmCountryRowsAsOfFold(rows, {
  timeHeader,
  targetTimes,
  cut,
} = {}) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const cutoffRaw = Array.isArray(targetTimes) && Number.isInteger(cut) && cut > 0 ? targetTimes[cut - 1] : null;
  const cutoff = mmmCountryTimeKey(cutoffRaw);
  if (!timeHeader || !cutoff) {
    return {
      rows: sourceRows.slice(),
      validationMode: "retrospective",
      isStrictHistorical: false,
      cutoff: cutoffRaw,
      excludedFutureRows: 0,
      reason: "Comparable target/reference dates were not available.",
    };
  }
  const comparable = sourceRows.map((row) => ({ row, key: mmmCountryTimeKey(row?.[timeHeader]) }))
    .filter((item) => item.key?.kind === cutoff.kind);
  if (!comparable.length) {
    return {
      rows: sourceRows.slice(),
      validationMode: "retrospective",
      isStrictHistorical: false,
      cutoff: cutoffRaw,
      excludedFutureRows: 0,
      reason: "Target and reference time columns use incompatible clocks.",
    };
  }
  // 타깃 weekly label은 월요일이지만 그 주의 daily 참고 데이터는 일요일까지
  // earliest-train 정보에 포함된다. 날짜축 cutoff를 해당 ISO 주의 끝으로 맞춘다.
  const cutoffValue = cutoff.kind === "date"
    ? countryWeeklyPeriod(cutoff.value).value + 6 * 86400000
    : cutoff.value;
  const kept = comparable.filter((item) => item.key.value <= cutoffValue).map((item) => item.row);
  return {
    rows: kept,
    validationMode: "as-of-fold",
    isStrictHistorical: true,
    cutoff: cutoffRaw,
    excludedFutureRows: comparable.length - kept.length,
    unparseableRows: sourceRows.length - comparable.length,
    reason: kept.length ? null : "No reference rows existed on or before the target fold cutoff.",
  };
}

// Deterministically cap the expensive first-stage reference fits. Markets with
// more rows inside the target time range are preferred, then total rows and name.
export function planCountryReferenceFits(rows, {
  countryHeader,
  timeHeader = null,
  targetTimes = null,
  minRows = MMM_COUNTRY_PRIOR_LIMITS.minRows,
  maxReferenceFits = MMM_COUNTRY_PRIOR_LIMITS.maxReferenceFits,
} = {}) {
  if (!countryHeader || !Array.isArray(rows)) return { countries: [], totalCountries: 0, capped: false };
  const groups = new Map();
  rows.forEach((row) => {
    const country = String(row?.[countryHeader] ?? "").trim();
    if (!country) return;
    const canonical = country.toLocaleLowerCase("en-US");
    if (!groups.has(canonical)) groups.set(canonical, { country, rows: [] });
    groups.get(canonical).rows.push(row);
  });
  const targetKeys = (targetTimes || []).map(countryWeeklyPeriod).filter(Boolean);
  const targetKind = targetKeys[0]?.kind;
  const targetComparable = targetKeys.filter((key) => key.kind === targetKind);
  const lower = targetComparable.length ? Math.min(...targetComparable.map((key) => key.value)) : null;
  const upper = targetComparable.length ? Math.max(...targetComparable.map((key) => key.value)) : null;
  const assessed = [...groups.values()].map(({ country, rows: countryRows }) => {
    const parsed = timeHeader
      ? countryRows.map((row) => countryWeeklyPeriod(row?.[timeHeader])).filter((key) => key?.kind === targetKind)
      : [];
    const overlapRows = lower == null
      ? new Set(countryRows.map((row) => countryWeeklyPeriodKey(row?.[timeHeader])).filter(Boolean)).size || countryRows.length
      : new Set(parsed.filter((key) => key.value >= lower && key.value <= upper).map((key) => `${key.kind}:${key.value}`)).size;
    const weeklyPeriods = timeHeader
      ? new Set(countryRows.map((row) => countryWeeklyPeriodKey(row?.[timeHeader])).filter(Boolean)).size
      : countryRows.length;
    return { country, rows: countryRows, rowCount: countryRows.length, validPeriodCount: weeklyPeriods, overlapRows, hasComparableDates: parsed.length > 0 };
  });
  const minimumRows = Math.max(1, minRows);
  const eligible = assessed.filter((item) => item.validPeriodCount >= minimumRows);
  const ineligibleCountries = assessed
    .filter((item) => item.validPeriodCount < minimumRows)
    .map(({ country, rowCount, validPeriodCount, overlapRows }) => ({ country, rowCount, validPeriodCount, overlapRows, reason: "minimum-rows", minimumRows }));
  eligible.sort((a, b) => b.overlapRows - a.overlapRows || b.validPeriodCount - a.validPeriodCount || b.rowCount - a.rowCount || a.country.localeCompare(b.country));
  const limit = Math.max(1, Math.floor(maxReferenceFits));
  const omittedCountryDetails = eligible.slice(limit).map(({ country, rowCount, validPeriodCount, overlapRows }) => ({ country, rowCount, validPeriodCount, overlapRows, reason: "browser-fit-cap" }));
  return {
    countries: eligible.slice(0, limit),
    totalCountries: groups.size,
    eligibleCountries: eligible.length,
    capped: eligible.length > limit,
    omittedCountries: Math.max(0, eligible.length - limit),
    ineligibleCountries,
    omittedCountryDetails,
    maxReferenceFits: limit,
    // Every first-stage fit should use this option. Transform-profile uncertainty
    // belongs to the final target model; repeating it per reference country can
    // freeze a browser without improving the screening decision.
    fitOptions: { skipTransformUncertainty: true },
  };
}

export function rescaleCountryPriorToTarget(prior, sourceTargetMean, targetTargetMean) {
  const sourceScale = Math.abs(finiteNumber(sourceTargetMean) || 0);
  const targetScale = Math.abs(finiteNumber(targetTargetMean) || 0);
  if (!(sourceScale > 0) || !(targetScale > 0)) return null;
  const scale = targetScale / sourceScale;
  const result = {};
  Object.entries(prior || {}).forEach(([key, value]) => {
    const variance = finiteNumber(value?.variance) ?? (value?.precision > 0 ? 1 / value.precision : null);
    if (!Number.isFinite(value?.mean) || !(variance > 0)) return;
    const scaledVariance = variance * scale ** 2;
    result[key] = {
      ...value,
      mean: value.mean * scale,
      variance: scaledVariance,
      precision: 1 / scaledVariance,
      sourceTargetScale: sourceScale,
      targetTargetScale: targetScale,
      scaleFactor: scale,
    };
  });
  return result;
}

function randomEffectsChannel(estimates, maxEffectiveCountries) {
  const valid = estimates.map((estimate) => {
    const variance = finiteNumber(estimate.value?.variance)
      ?? (estimate.value?.precision > 0 ? 1 / estimate.value.precision : null);
    return { ...estimate, mean: finiteNumber(estimate.value?.mean), variance };
  }).filter((estimate) => estimate.mean != null && estimate.variance > 0);
  if (!valid.length) return null;
  const fixedWeights = valid.map((estimate) => 1 / estimate.variance);
  const fixedWeightSum = fixedWeights.reduce((sum, weight) => sum + weight, 0);
  const fixedMean = valid.reduce((sum, estimate, index) => sum + estimate.mean * fixedWeights[index], 0) / fixedWeightSum;
  const q = valid.reduce((sum, estimate, index) => sum + fixedWeights[index] * (estimate.mean - fixedMean) ** 2, 0);
  const c = fixedWeightSum - fixedWeights.reduce((sum, weight) => sum + weight ** 2, 0) / fixedWeightSum;
  const tau2 = valid.length > 1 && c > 0 ? Math.max(0, (q - (valid.length - 1)) / c) : 0;
  const randomWeights = valid.map((estimate) => 1 / (estimate.variance + tau2));
  const randomWeightSum = randomWeights.reduce((sum, weight) => sum + weight, 0);
  const pooledMean = valid.reduce((sum, estimate, index) => sum + estimate.mean * randomWeights[index], 0) / randomWeightSum;
  const pooledMeanVariance = 1 / randomWeightSum;
  const typicalWithinVariance = median(valid.map((estimate) => estimate.variance));
  // This prior predicts a *new target market*, not just the pooled source mean.
  // tau² carries observed transfer heterogeneity. The within-variance floor caps
  // effective precision so adding dozens of near-duplicate markets cannot drive
  // variance towards zero.
  const precisionFloorVariance = typicalWithinVariance / Math.max(1, maxEffectiveCountries);
  // 한 나라만으로는 국가 간 이질성을 추정할 수 없다. 모델 SE가 아무리 작아도
  // 새 시장 전이 prior가 확정값이 되지 않도록 명시적 상대 SD floor를 둔다.
  const transferRelativeSdFloor = valid.length === 1
    ? MMM_COUNTRY_PRIOR_LIMITS.singleCountryRelativeSdFloor
    : MMM_COUNTRY_PRIOR_LIMITS.multiCountryRelativeSdFloor;
  const relativeVarianceFloor = (
    transferRelativeSdFloor * Math.max(Math.abs(pooledMean), Math.sqrt(typicalWithinVariance))
  ) ** 2;
  const predictiveVariance = tau2 + Math.max(pooledMeanVariance, precisionFloorVariance, relativeVarianceFloor);
  const transforms = valid.map((estimate) => estimate.value?.targetLockedTransform).filter(Boolean);
  const transformSignatures = new Set(transforms.map((item) => `${item.alpha}|${item.ec}|${item.slope}`));
  const targetLockedTransform = transforms.length === valid.length && transformSignatures.size === 1 ? { ...transforms[0] } : null;
  return {
    mean: pooledMean,
    variance: predictiveVariance,
    precision: 1 / predictiveVariance,
    tau2,
    pooledMeanVariance,
    typicalWithinVariance,
    transferRelativeSdFloor,
    relativeVarianceFloor,
    q,
    countryCount: valid.length,
    effectiveCountryCount: Math.min(valid.length, maxEffectiveCountries),
    countries: valid.map((estimate) => estimate.country),
    source: "country",
    method: "random-effects predictive prior",
    referenceSpendScaleFactors: Object.fromEntries(valid.map((estimate) => [estimate.country, estimate.value?.referenceSpendScaleFactor]).filter(([, value]) => Number.isFinite(value))),
    referenceSpendScaleMethod: valid.every((estimate) => estimate.value?.referenceSpendScaleMethod === "positive-adstock-median-to-target")
      ? "positive-adstock-median-to-target"
      : null,
    targetLockedTransform,
    transformUnitAligned: !!targetLockedTransform,
  };
}

// Convert one or more reference-country coefficient summaries into a target prior.
// At most three countries are applied to one combination. Any extra members are
// reported as dropped rather than silently increasing precision.
export function buildCountryTransferPrior(members, {
  maxCombinationSize = MMM_COUNTRY_PRIOR_LIMITS.maxCombinationSize,
  maxEffectiveCountries = MMM_COUNTRY_PRIOR_LIMITS.maxEffectiveCountries,
  requireTransformAlignment = false,
} = {}) {
  const input = Array.isArray(members) ? members.filter((member) => member?.prior) : [];
  const maxSize = Math.max(1, Math.floor(maxCombinationSize));
  const used = input.slice(0, maxSize);
  const channelKeys = [...new Set(used.flatMap((member) => Object.keys(member.prior || {})))].sort();
  const prior = {};
  channelKeys.forEach((key) => {
    const estimates = used
      .filter((member) => member.prior?.[key])
      .map((member) => ({ country: member.country, value: member.prior[key] }));
    const combined = randomEffectsChannel(estimates, Math.max(1, Math.floor(maxEffectiveCountries)));
    if (combined && (!requireTransformAlignment || combined.transformUnitAligned)) prior[key] = combined;
  });
  return {
    prior,
    countries: used.map((member) => member.country),
    countryCount: used.length,
    inputCountryCount: input.length,
    capped: input.length > used.length,
    droppedCountries: input.slice(used.length).map((member) => member.country),
    maxCombinationSize: maxSize,
  };
}

export function buildCountryCombinations(candidates, {
  maxCandidates = MMM_COUNTRY_PRIOR_LIMITS.maxValidatedCountries,
  maxCombinationSize = MMM_COUNTRY_PRIOR_LIMITS.maxCombinationSize,
  maxCombinations = MMM_COUNTRY_PRIOR_LIMITS.maxCombinations,
} = {}) {
  const pool = (candidates || []).slice(0, Math.max(0, Math.floor(maxCandidates)));
  const sizeCap = Math.min(pool.length, Math.max(1, Math.floor(maxCombinationSize)));
  const result = [];
  const visit = (start, current, size) => {
    if (result.length >= maxCombinations) return;
    if (current.length === size) {
      result.push(current.slice());
      return;
    }
    for (let index = start; index < pool.length && result.length < maxCombinations; index++) {
      current.push(pool[index]);
      visit(index + 1, current, size);
      current.pop();
    }
  };
  for (let size = 1; size <= sizeCap && result.length < maxCombinations; size++) visit(0, [], size);
  return result;
}

export function scoreCountryValidation(candidate, complexity = 1, {
  complexityPenaltyPerCountry = MMM_COUNTRY_PRIOR_LIMITS.complexityPenaltyPerCountry,
} = {}) {
  const rawErrors = Array.isArray(candidate?.foldRmses)
    ? candidate.foldRmses.map((value) => finiteNumber(value) ?? NaN)
    : [];
  const errors = rawErrors.filter(Number.isFinite);
  const failedFolds = rawErrors.length - errors.length;
  const meanRmse = finiteNumber(candidate?.meanRmse) ?? (errors.length ? mean(errors) : null);
  if (!(meanRmse >= 0)) return null;
  const sdRmse = finiteNumber(candidate?.sdRmse) ?? sampleSd(errors);
  const count = Math.max(1, Math.floor(complexity));
  return {
    ...candidate,
    foldRmses: rawErrors.length ? rawErrors : errors,
    finiteFoldRmses: errors,
    failedFolds,
    folds: rawErrors.length || errors.length || candidate?.folds || 1,
    meanRmse,
    sdRmse,
    complexity: count,
    score: failedFolds
      ? Infinity
      : (meanRmse + 0.25 * sdRmse) * (1 + complexityPenaltyPerCountry * Math.max(0, count - 1)),
  };
}

// Select only a materially and repeatedly better reference set. The one-standard-
// error rule then prefers the simplest set statistically indistinguishable from
// the best eligible score. If no candidate clears the guards, base MMM wins.
export function selectCountryPriorCandidate(baselineInput, candidateInputs, {
  minRelativeImprovement = MMM_COUNTRY_PRIOR_LIMITS.minRelativeImprovement,
  minFoldWinRate = MMM_COUNTRY_PRIOR_LIMITS.minFoldWinRate,
  maxCombinationSize = MMM_COUNTRY_PRIOR_LIMITS.maxCombinationSize,
  minValidationFolds = MMM_COUNTRY_PRIOR_LIMITS.minValidationFolds,
} = {}) {
  const baseline = scoreCountryValidation(baselineInput, 1);
  if (!baseline) return { selected: null, baseline: null, evaluated: [], reason: "missing-baseline" };
  if (baseline.failedFolds) return { selected: null, baseline, evaluated: [], reason: "incomplete-baseline-folds" };
  const evaluated = (candidateInputs || []).map((input) => {
    const complexity = input?.complexity || input?.countryCount || String(input?.country || "").split("+").filter(Boolean).length || 1;
    const candidate = scoreCountryValidation(input, complexity);
    if (!candidate) return null;
    const paired = Math.min(baseline.foldRmses.length, candidate.foldRmses.length);
    const wins = Array.from({ length: paired }, (_, index) => candidate.foldRmses[index] < baseline.foldRmses[index])
      .filter(Boolean).length;
    const foldWinRate = paired ? wins / paired : 0;
    const improvement = baseline.meanRmse - candidate.meanRmse;
    const relativeImprovement = baseline.meanRmse > 0 ? improvement / baseline.meanRmse : 0;
    // 같은 fold의 base-candidate 차이를 직접 짝지어야 공통 난이도가 상쇄된다.
    // 평균 개선이 paired differences의 1 SE보다 작으면 몇 개 fold의 우연한 승리로
    // 보고 자동 prior 선택을 보류한다.
    const pairedImprovements = Array.from({ length: paired }, (_, index) => baseline.foldRmses[index] - candidate.foldRmses[index])
      .filter(Number.isFinite);
    const pairedImprovementSd = sampleSd(pairedImprovements);
    const pairedImprovementSe = pairedImprovements.length > 1
      ? pairedImprovementSd / Math.sqrt(pairedImprovements.length)
      : Infinity;
    const oneSeEvidence = improvement > pairedImprovementSe;
    const repeatedEvidence = paired >= minValidationFolds && foldWinRate >= minFoldWinRate;
    const reasons = [];
    if (candidate.failedFolds || candidate.foldRmses.length !== baseline.foldRmses.length) reasons.push("incomplete-folds");
    if (candidate.complexity > maxCombinationSize) reasons.push("combination-cap");
    if (relativeImprovement < minRelativeImprovement) reasons.push("below-material-improvement");
    if (paired < minValidationFolds) reasons.push("insufficient-validation-folds");
    else if (!repeatedEvidence) reasons.push("insufficient-fold-wins");
    if (!oneSeEvidence) reasons.push("improvement-not-above-fold-noise");
    if (!(candidate.score < baseline.score)) reasons.push("penalized-score-not-better");
    return {
      ...candidate,
      relativeImprovement,
      foldWinRate,
      pairedFolds: paired,
      pairedImprovementSd,
      pairedImprovementSe,
      pairedImprovementLowerOneSe: improvement - pairedImprovementSe,
      oneSeEvidence,
      eligible: reasons.length === 0,
      ineligibleReasons: reasons,
    };
  }).filter(Boolean);
  const eligible = evaluated.filter((candidate) => candidate.eligible).sort((a, b) => a.score - b.score || a.complexity - b.complexity);
  if (!eligible.length) {
    const reason = baseline.foldRmses.length < minValidationFolds
      ? "insufficient-validation-folds"
      : "base-preferred";
    return { selected: null, baseline, evaluated, reason };
  }
  const best = eligible[0];
  const bestSe = best.sdRmse / Math.sqrt(Math.max(1, best.folds));
  const withinOneSe = eligible.filter((candidate) => candidate.meanRmse <= best.meanRmse + bestSe);
  withinOneSe.sort((a, b) => a.complexity - b.complexity || a.score - b.score || String(a.country).localeCompare(String(b.country)));
  return { selected: withinOneSe[0], baseline, evaluated, reason: "validated-prior" };
}
