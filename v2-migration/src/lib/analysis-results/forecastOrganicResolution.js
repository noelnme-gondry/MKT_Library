// Choose input resolution on common OLDER outer folds. The latest sealed fold
// is evaluation-only, regardless of how well either representation fits it.
export function selectOrganicForecastResolution(aggregate, detailed) {
  const folds = model => model?.selection?.nested?.developmentFolds || [];
  const horizon = aggregate?.selection?.horizon;
  const older = folds(aggregate).filter(fold => Number.isFinite(fold.offset) && fold.offset >= horizon);
  const pairs = older.map(left => [left, folds(detailed).find(right => right.offset === left.offset)])
    .filter(([left, right]) => right && Array.isArray(left.actual) && left.actual.length > 0
      && left.actual.length === right.actual?.length
      && left.predicted?.length === left.actual.length && right.predicted?.length === left.actual.length
      && left.actual.every((value, i) => Number.isFinite(value) && value === right.actual[i]
        && Number.isFinite(left.predicted[i]) && Number.isFinite(right.predicted[i])));
  const offsets = [...new Set(pairs.map(([fold]) => fold.offset))].sort((a, b) => a - b);
  const independent = Number.isInteger(horizon) && horizon > 0 && offsets.length === pairs.length
    && offsets.every((offset, i) => i === 0 || offset - offsets[i - 1] >= horizon);
  const denominator = pairs.reduce((sum, [fold]) => sum + fold.actual.reduce((total, value) => total + Math.abs(value), 0), 0);
  const comparable = independent && horizon === detailed?.selection?.horizon
    && pairs.length >= 3 && pairs.every(([fold]) => fold.actual.length === horizon) && denominator > 0;
  const error = side => pairs.reduce((sum, pair) => sum + pair[side].actual.reduce((total, value, i) => total + Math.abs(value - pair[side].predicted[i]), 0), 0) / denominator * 100;
  const aggregateWmape = comparable ? error(0) : null;
  const detailedWmape = comparable ? error(1) : null;
  // Keep the pooled fallback for indistinguishable scores. More input columns
  // need an actual development gain, not an accidental last-fold improvement.
  const detailedWins = comparable && detailed?.run && detailed?.panel
    && aggregateWmape - detailedWmape > Math.max(0.1, aggregateWmape * 0.02);
  return {
    resolution: detailedWins ? 'channel' : 'aggregate',
    comparable,
    folds: comparable ? pairs.length : 0,
    aggregateWmape,
    detailedWmape,
    latestUsedForSelection: false,
  };
}
