import { parseNumericStrict } from "../parseNumeric";
import { _Z975, studentTcrit, studentTp } from "../statPrimitives";

export const DAY = 86400000;
export const pair = (ko, en) => ({ ko, en });
export class AnalysisInputError extends Error {
  constructor(code, context = {}) {
    super(code);
    this.name = "AnalysisInputError";
    this.code = code;
    this.context = context;
  }
}
export function requireInput(condition, code, context) {
  if (!condition) throw new AnalysisInputError(code, context);
}
export function text(value, field = "value", row) {
  const result = String(value ?? "").trim();
  requireInput(result.length > 0, "missing_value", { field, row });
  return result;
}
export function number(value, field = "value", row, { min = -Infinity, max = Infinity, integer = false } = {}) {
  // A percentage sign is not a count or an already-declared numeric unit.
  const result = typeof value === "string" && value.includes("%") ? null : parseNumericStrict(value);
  requireInput(result !== null && Number.isFinite(result) && result >= min && result <= max && (!integer || Number.isSafeInteger(result)),
    "invalid_number", { field, row });
  return result;
}
export function timestamp(value, field = "date", row, { exactTime = false } = {}) {
  const input = text(value, field, row);
  const day = /^\d{4}-\d{2}-\d{2}$/.test(input);
  const instant = /^\d{4}-\d{2}-\d{2}T(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(input);
  requireInput((day && !exactTime) || instant, "invalid_date", { field, row });
  const ms = Date.parse(day ? `${input}T00:00:00Z` : input);
  const calendar = input.slice(0, 10);
  const calendarMs = Date.parse(`${calendar}T00:00:00Z`);
  requireInput(Number.isFinite(ms) && Number.isFinite(calendarMs)
    && new Date(calendarMs).toISOString().slice(0, 10) === calendar, "invalid_date", { field, row });
  return ms;
}
export const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
export function observationEnd(value) {
  // A selected calendar day includes that complete UTC day.
  const ms = timestamp(value, "observationEnd");
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? ms + DAY - 1 : ms;
}
export function uniqueKey(seen, values, row) {
  const key = JSON.stringify(values);
  requireInput(!seen.has(key), "duplicate_key", { row });
  seen.add(key);
  return key;
}
export function validateRows(rows, max = 50000) {
  requireInput(Array.isArray(rows) && rows.length > 0, "empty_data");
  requireInput(rows.length <= max, "too_many_rows", { max });
}
export const sum = (values) => values.reduce((a, b) => a + b, 0);
export const mean = (values) => values.length ? sum(values) / values.length : null;
export const variance = (values) => {
  if (values.length < 2) return null;
  const center = mean(values);
  return sum(values.map((x) => (x - center) ** 2)) / (values.length - 1);
};
export function quantile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const position = (sorted.length - 1) * p;
  const lower = Math.floor(position);
  return sorted[lower] + (sorted[Math.ceil(position)] - sorted[lower]) * (position - lower);
}
export function wilson(successes, n) {
  if (!(n > 0) || successes < 0 || successes > n) return null;
  const p = successes / n, z2 = _Z975 ** 2, denominator = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denominator;
  const half = _Z975 * Math.sqrt(p * (1 - p) / n + z2 / (4 * n * n)) / denominator;
  return { estimate: p, low: Math.max(0, center - half), high: Math.min(1, center + half), n };
}
export function welch(treatment, control) {
  requireInput(treatment.length >= 2 && control.length >= 2, "insufficient_groups");
  const estimate = mean(treatment) - mean(control);
  const a = variance(treatment) / treatment.length, b = variance(control) / control.length;
  const se2 = a + b;
  if (!(se2 > 0)) return { estimate, low: null, high: null, se: null, p: null, df: null, reason: "zero_variance" };
  const df = se2 * se2 / (a * a / (treatment.length - 1) + b * b / (control.length - 1));
  const se = Math.sqrt(se2), half = studentTcrit(0.95, df) * se;
  return { estimate, low: estimate - half, high: estimate + half, se, p: studentTp(estimate / se, df), df };
}
export const dot = (a, b) => sum(a.map((x, i) => x * b[i]));
export const zeros = (n, m = n) => Array.from({ length: n }, () => Array(m).fill(0));
export const multiply = (a, b) => a.map((row) => b[0].map((_, j) => sum(row.map((x, k) => x * b[k][j]))));
export const transpose = (a) => a[0].map((_, j) => a.map((row) => row[j]));

// Scaled partial pivoting; verify A * inverse(A), rather than trusting a pivot.
export function inverse(matrix) {
  const n = matrix.length;
  if (!n || matrix.some((row) => row.length !== n || row.some((x) => !Number.isFinite(x)))) return null;
  const scales = matrix.map((row) => Math.max(...row.map(Math.abs)));
  if (scales.some((s) => s === 0)) return null;
  const augmented = matrix.map((row, i) => [...row.map((v) => v / scales[i]),
    ...Array.from({ length: n }, (_, j) => (i === j ? 1 / scales[i] : 0))]);
  for (let k = 0; k < n; k++) {
    let pivot = k;
    for (let i = k + 1; i < n; i++) if (Math.abs(augmented[i][k]) > Math.abs(augmented[pivot][k])) pivot = i;
    if (Math.abs(augmented[pivot][k]) < 1e-12) return null;
    [augmented[k], augmented[pivot]] = [augmented[pivot], augmented[k]];
    const divider = augmented[k][k];
    augmented[k] = augmented[k].map((v) => v / divider);
    for (let i = 0; i < n; i++) {
      if (i === k) continue;
      const factor = augmented[i][k];
      for (let j = 0; j < 2 * n; j++) augmented[i][j] -= factor * augmented[k][j];
    }
  }
  const result = augmented.map((row) => row.slice(n));
  const product = multiply(matrix, result);
  const error = Math.max(...product.flatMap((row, i) => row.map((v, j) => Math.abs(v - (i === j ? 1 : 0)))));
  return error < 1e-6 && result.every((row) => row.every(Number.isFinite)) ? result : null;
}
export function quadratic(vector, matrix) {
  return dot(vector, matrix.map((row) => dot(row, vector)));
}
export function fitOls(design, outcome, { hacLag = null } = {}) {
  const n = design.length, p = design[0]?.length;
  if (!(p > 0) || n <= p + 1 || outcome.length !== n) return null;
  // Normalize each column to keep currencies and tiny covariates identifiable.
  const scales = Array.from({ length: p }, (_, j) => Math.sqrt(mean(design.map((row) => row[j] ** 2))) || 1);
  const x = design.map((row) => row.map((v, j) => v / scales[j]));
  const xt = transpose(x), xtx = multiply(xt, x), bread = inverse(xtx);
  if (!bread) return null;
  const scaledBeta = bread.map((row) => dot(row, xt.map((column) => dot(column, outcome))));
  const residuals = outcome.map((y, i) => y - dot(x[i], scaledBeta));
  const meat = zeros(p);
  const leverage = x.map((row) => quadratic(row, bread));
  if (leverage.some((h) => h >= 1 - 1e-9)) return null;
  const scores = x.map((row, i) => row.map((v) => v * residuals[i]
    / (hacLag === null ? 1 - leverage[i] : 1)));
  for (const row of scores) for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) meat[j][k] += row[j] * row[k];
  if (hacLag !== null) {
    const lag = Math.min(Math.max(0, Math.floor(hacLag)), n - 1);
    for (let l = 1; l <= lag; l++) {
      const weight = 1 - l / (lag + 1);
      for (let i = l; i < n; i++) for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) {
        meat[j][k] += weight * (scores[i][j] * scores[i - l][k] + scores[i - l][j] * scores[i][k]);
      }
    }
    for (let j = 0; j < p; j++) for (let k = 0; k < p; k++) meat[j][k] *= n / (n - p);
  }
  const covariance = multiply(multiply(bread, meat), bread).map((row, j) => row.map((v, k) => v / scales[j] / scales[k]));
  const beta = scaledBeta.map((v, j) => v / scales[j]);
  const critical = studentTcrit(0.95, n - p);
  const coefficients = beta.map((estimate, j) => {
    const se = covariance[j][j] > 1e-24 ? Math.sqrt(covariance[j][j]) : null;
    return { estimate, se, low: se === null ? null : estimate - critical * se,
      high: se === null ? null : estimate + critical * se, p: se === null ? null : studentTp(estimate / se, n - p) };
  });
  return { beta, coefficients, covariance, residuals, n, df: n - p, leverage };
}
export function nelderMead(fn, initial, { maxIterations = 1800, tolerance = 1e-9, step = 0.15 } = {}) {
  const dimension = initial.length;
  const evaluate = (x) => ({ x, value: fn(x) });
  let simplex = [evaluate([...initial]), ...initial.map((_, i) => evaluate(initial.map((v, j) => i === j ? v + step : v)))];
  let converged = false, iterations = 0;
  for (; iterations < maxIterations; iterations++) {
    simplex.sort((a, b) => a.value - b.value);
    const best = simplex[0], worst = simplex[dimension];
    const spread = Math.max(...simplex.map((point) => Math.abs(point.value - best.value)));
    const diameter = Math.max(...simplex.flatMap((point) => point.x.map((v, j) => Math.abs(v - best.x[j]))));
    if (Number.isFinite(best.value) && spread < tolerance && diameter < Math.sqrt(tolerance)) { converged = true; break; }
    const center = initial.map((_, j) => sum(simplex.slice(0, dimension).map((point) => point.x[j])) / dimension);
    const reflected = evaluate(center.map((v, j) => 2 * v - worst.x[j]));
    if (reflected.value < best.value) {
      const expanded = evaluate(center.map((v, j) => v + 2 * (reflected.x[j] - v)));
      simplex[dimension] = expanded.value < reflected.value ? expanded : reflected;
    } else if (reflected.value < simplex[dimension - 1].value) {
      simplex[dimension] = reflected;
    } else {
      const outside = reflected.value < worst.value;
      const contracted = evaluate(center.map((v, j) => v + 0.5 * ((outside ? reflected : worst).x[j] - v)));
      if (contracted.value < (outside ? reflected.value : worst.value)) simplex[dimension] = contracted;
      else simplex = [best, ...simplex.slice(1).map((point) => evaluate(point.x.map((v, j) => (v + best.x[j]) / 2)))];
    }
  }
  simplex.sort((a, b) => a.value - b.value);
  return { ...simplex[0], converged, iterations };
}
export function hessian(fn, point, step = 1e-4) {
  const n = point.length, matrix = zeros(n), center = fn(point);
  for (let i = 0; i < n; i++) {
    const plus = [...point], minus = [...point];
    plus[i] += step; minus[i] -= step;
    matrix[i][i] = (fn(plus) - 2 * center + fn(minus)) / step ** 2;
    for (let j = 0; j < i; j++) {
      let value = 0;
      for (const a of [-1, 1]) for (const b of [-1, 1]) {
        const next = [...point]; next[i] += a * step; next[j] += b * step;
        value += a * b * fn(next);
      }
      matrix[i][j] = matrix[j][i] = value / (4 * step ** 2);
    }
  }
  return matrix;
}
export function positiveDefinite(matrix) {
  const l = zeros(matrix.length);
  for (let i = 0; i < l.length; i++) for (let j = 0; j <= i; j++) {
    let value = matrix[i][j];
    for (let k = 0; k < j; k++) value -= l[i][k] * l[j][k];
    if (i === j) { if (!(value > 1e-10)) return false; l[i][j] = Math.sqrt(value); }
    else l[i][j] = value / l[j][j];
  }
  return true;
}
export function metric(id, label, value, type = "number", interval = null) {
  return { id, label, value, type, low: interval?.low ?? null, high: interval?.high ?? null };
}
export const column = (key, label, type = "number") => ({ key, label, type });
export const table = (id, title, columns, rows) => ({ id, title, columns, rows });
export function result({ headline, action, metrics, tables = [], warnings = [], method, diagnostics = {}, figure = null }) {
  const assertFinite = (value) => {
    if (typeof value === "number") requireInput(Number.isFinite(value), "numeric_overflow");
    else if (value && typeof value === "object") Object.values(value).forEach(assertFinite);
  };
  assertFinite({ metrics, tables, diagnostics });
  return { status: "ready", headline, action, metrics, tables, warnings, method, diagnostics, figure };
}
export function empiricalCorrelation(a, b) {
  const ma = mean(a), mb = mean(b), va = variance(a), vb = variance(b);
  if (!(va > 0 && vb > 0)) return null;
  return sum(a.map((v, i) => (v - ma) * (b[i] - mb))) / ((a.length - 1) * Math.sqrt(va * vb));
}
