export function sumFinite(values = []) {
  if (!Array.isArray(values) || values.some((value) => !Number.isFinite(value))) return NaN;
  const sum = values.reduce((total, value) => total + value, 0);
  return Number.isFinite(sum) ? sum : NaN;
}

export function checkAdditiveIdentity(total, parts = [], tolerance = 1e-9) {
  if (!Number.isFinite(total) || !Number.isFinite(tolerance) || !Array.isArray(parts) || parts.some((value) => !Number.isFinite(value))) {
    return {
      ok: false,
      actual: total,
      expected: sumFinite(parts),
      error: NaN,
      tolerance,
      reason: "NON_FINITE_INPUT",
    };
  }
  const expected = sumFinite(parts);
  if (!Number.isFinite(expected)) {
    return {
      ok: false,
      actual: total,
      expected,
      error: NaN,
      tolerance,
      reason: "NON_FINITE_SUM",
    };
  }
  const actual = total;
  const error = actual - expected;
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  const threshold = tolerance * scale;
  if (!Number.isFinite(error) || !Number.isFinite(scale) || !Number.isFinite(threshold)) {
    return { ok: false, actual, expected, error, tolerance, reason: "NON_FINITE_COMPUTATION" };
  }
  return { ok: Math.abs(error) <= threshold, actual, expected, error, tolerance, reason: null };
}

export function checkRollupIdentity(rows = [], totalKey, partKeys = [], tolerance = 1e-9) {
  return rows.map((row, index) => ({
    index,
    ...checkAdditiveIdentity(row?.[totalKey], partKeys.map((key) => row?.[key]), tolerance),
  }));
}
