// Display-only audit of the exact held-out values. No model selection or fitting.
const finiteSeries = values => Array.isArray(values) && values.length > 0 && values.every(Number.isFinite);
const change = values => values.length > 1 && values[0] > 0 ? (values.at(-1) / values[0] - 1) * 100 : null;

export function forecastValidationSummary(backtest) {
  if (!finiteSeries(backtest?.actual) || !finiteSeries(backtest?.predicted) || backtest.actual.length !== backtest.predicted.length) return null;
  const start = Math.max(0, backtest.validationStartIndex || 0);
  const actual = backtest.actual.slice(start);
  const predicted = backtest.predicted.slice(start);
  if (!actual.length) return null;
  const total = actual.reduce((sum, value) => sum + Math.abs(value), 0);
  const error = predicted.map((value, index) => value - actual[index]);
  const baseline = finiteSeries(backtest.lastValueBaseline) && backtest.lastValueBaseline.length === backtest.actual.length
    ? backtest.lastValueBaseline.slice(start) : null;
  return {
    weeks: actual.length,
    fixedBudgetWmape: Number.isFinite(backtest.fixedBudgetWmape) ? backtest.fixedBudgetWmape : null,
    actualChange: change(actual),
    predictedChange: change(predicted),
    meanError: error.reduce((sum, value) => sum + value, 0) / error.length,
    wmape: total > 0 ? error.reduce((sum, value) => sum + Math.abs(value), 0) / total * 100 : null,
    baselineWmape: baseline && total > 0 ? baseline.reduce((sum, value, index) => sum + Math.abs(value - actual[index]), 0) / total * 100 : null,
  };
}

export function forecastPathSummary(forecast) {
  const values = forecast?.predFut;
  if (!finiteSeries(values)) return null;
  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const budgets = Object.values(forecast.futSpendByKey || {});
  return {
    minimum, maximum,
    rangePercent: average > 0 ? (maximum - minimum) / average * 100 : null,
    constantBudgets: budgets.length > 0 && budgets.every(series => finiteSeries(series) && series.length === values.length && series.every(value => Math.abs(value - series[0]) <= Math.max(1, Math.abs(series[0])) * 1e-9)),
  };
}
