// Business-seasonality diagnostics.
// These functions compare observed year-shaped residuals; they do not generate
// a periodic curve and therefore must remain separate from Fourier candidate fit.

const DAY_MS = 24 * 60 * 60 * 1000;

function asUtcDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  const date = new Date(`${String(value).slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function firstSundayOfYear(year) {
  const date = new Date(Date.UTC(year, 0, 1));
  const offset = (7 - date.getUTCDay()) % 7;
  date.setUTCDate(date.getUTCDate() + offset);
  return date;
}

export function businessWeekOfYear(value) {
  const date = asUtcDate(value);
  if (!date) return null;
  const first = firstSundayOfYear(date.getUTCFullYear());
  const diff = Math.floor((date.getTime() - first.getTime()) / DAY_MS);
  if (diff < 0) return 0;
  return Math.floor(diff / 7) + 1;
}

function mean(values) {
  const finite = values.filter(Number.isFinite);
  return finite.length ? finite.reduce((sum, value) => sum + value, 0) / finite.length : 0;
}

function centered(values) {
  const average = mean(values);
  return values.map((value) => Number.isFinite(value) ? value - average : null);
}

function pearson(left, right) {
  const pairs = left.map((value, index) => [value, right[index]])
    .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
  if (pairs.length < 3) return null;
  const leftMean = mean(pairs.map(([a]) => a));
  const rightMean = mean(pairs.map(([, b]) => b));
  let numerator = 0;
  let leftSum = 0;
  let rightSum = 0;
  pairs.forEach(([a, b]) => {
    const leftDelta = a - leftMean;
    const rightDelta = b - rightMean;
    numerator += leftDelta * rightDelta;
    leftSum += leftDelta ** 2;
    rightSum += rightDelta ** 2;
  });
  const denominator = Math.sqrt(leftSum * rightSum);
  return denominator > 1e-12 ? numerator / denominator : null;
}

function circularSmooth(values, radius = 2) {
  return values.map((_, index) => {
    const sample = [];
    for (let offset = -radius; offset <= radius; offset += 1) {
      const value = values[(index + offset + values.length) % values.length];
      if (Number.isFinite(value)) sample.push(value);
    }
    return sample.length ? mean(sample) : null;
  });
}

function circularDistance(left, right, period) {
  const distance = Math.abs(left - right);
  return Math.min(distance, period - distance);
}

export function buildObservedYearShapes(dateLabels, residuals, options = {}) {
  const radius = Math.max(0, options.smoothingRadius ?? 2);
  const byYear = new Map();
  dateLabels.forEach((label, index) => {
    const date = asUtcDate(label);
    const residual = Number(residuals[index]);
    const week = businessWeekOfYear(label);
    if (!date || !Number.isFinite(residual) || !Number.isFinite(week) || week < 1 || week > 53) return;
    const year = date.getUTCFullYear();
    if (!byYear.has(year)) byYear.set(year, new Map());
    byYear.get(year).set(week, residual);
  });
  return [...byYear.entries()]
    .sort(([left], [right]) => left - right)
    .map(([year, values]) => {
      const raw = Array.from({ length: 52 }, (_, index) => values.get(index + 1) ?? null);
      const smoothed = circularSmooth(raw, radius);
      return {
        year,
        observedWeeks: values.size,
        missingWeeks: raw.filter((value) => !Number.isFinite(value)).length,
        raw,
        shape: centered(smoothed),
      };
    });
}

export function compareObservedYearShapes(shapes) {
  if (!Array.isArray(shapes) || shapes.length < 2) {
    return {
      available: false,
      reason: "fewer-than-two-calendar-years",
      yearCount: shapes?.length || 0,
    };
  }
  const comparisons = [];
  for (let leftIndex = 0; leftIndex < shapes.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < shapes.length; rightIndex += 1) {
      const left = shapes[leftIndex];
      const right = shapes[rightIndex];
      const correlation = pearson(left.shape, right.shape);
      const finitePairs = left.shape.map((value, index) => [value, right.shape[index]])
        .filter(([a, b]) => Number.isFinite(a) && Number.isFinite(b));
      const leftMean = mean(finitePairs.map(([a]) => a));
      const rightMean = mean(finitePairs.map(([, b]) => b));
      const signAgreement = finitePairs.length
        ? finitePairs.filter(([a, b]) => (a >= leftMean) === (b >= rightMean)).length / finitePairs.length
        : null;
      const leftPeak = left.shape.reduce((winner, value, index) => Number.isFinite(value) && (!winner || value > winner.value) ? { index, value } : winner, null);
      const rightPeak = right.shape.reduce((winner, value, index) => Number.isFinite(value) && (!winner || value > winner.value) ? { index, value } : winner, null);
      const leftTrough = left.shape.reduce((winner, value, index) => Number.isFinite(value) && (!winner || value < winner.value) ? { index, value } : winner, null);
      const rightTrough = right.shape.reduce((winner, value, index) => Number.isFinite(value) && (!winner || value < winner.value) ? { index, value } : winner, null);
      const leftAmplitude = leftPeak && leftTrough ? leftPeak.value - leftTrough.value : null;
      const rightAmplitude = rightPeak && rightTrough ? rightPeak.value - rightTrough.value : null;
      comparisons.push({
        leftYear: left.year,
        rightYear: right.year,
        correlation,
        signAgreement,
        peakShiftWeeks: leftPeak && rightPeak ? circularDistance(leftPeak.index, rightPeak.index, 52) : null,
        troughShiftWeeks: leftTrough && rightTrough ? circularDistance(leftTrough.index, rightTrough.index, 52) : null,
        amplitudeRatio: leftAmplitude > 1e-9 && rightAmplitude > 1e-9 ? rightAmplitude / leftAmplitude : null,
      });
    }
  }
  const available = comparisons.length > 0;
  return {
    available,
    yearCount: shapes.length,
    comparisons,
    observedYearCorrelation: available ? mean(comparisons.map((item) => item.correlation)) : null,
    signAgreement: available ? mean(comparisons.map((item) => item.signAgreement)) : null,
    peakShiftWeeks: available ? mean(comparisons.map((item) => item.peakShiftWeeks)) : null,
    troughShiftWeeks: available ? mean(comparisons.map((item) => item.troughShiftWeeks)) : null,
    amplitudeRatio: available ? mean(comparisons.map((item) => item.amplitudeRatio)) : null,
  };
}

export function classifyBusinessSeasonality(evidence, observedWeeks, options = {}) {
  if (observedWeeks < (options.minimumHistory ?? 96)) return { level: "none", reason: "insufficient-history" };
  if (!evidence?.available) return { level: "none", reason: "insufficient-calendar-years" };
  const moderateCorrelation = options.moderateCorrelation ?? 0.6;
  const strongCorrelation = options.strongCorrelation ?? 0.75;
  const moderate = evidence.observedYearCorrelation >= moderateCorrelation
    && evidence.signAgreement >= 0.65
    && evidence.peakShiftWeeks <= 6
    && evidence.troughShiftWeeks <= 6
    && evidence.amplitudeRatio >= 0.5
    && evidence.amplitudeRatio <= 2;
  if (!moderate) return { level: "weak", reason: "observed-shape-instability" };
  const strong = observedWeeks >= 156
    && evidence.observedYearCorrelation >= strongCorrelation
    && evidence.signAgreement >= 0.75
    && evidence.peakShiftWeeks <= 4
    && evidence.troughShiftWeeks <= 4;
  return { level: strong ? "strong" : "moderate", reason: strong ? "multi-year-observed-recurrence" : "two-year-observed-recurrence" };
}
