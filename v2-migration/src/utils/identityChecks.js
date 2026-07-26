export function sumFinite(values = []) {
  return values.reduce((sum, value) => sum + (Number.isFinite(value) ? value : 0), 0);
}

export function checkAdditiveIdentity(total, parts = [], tolerance = 1e-9) {
  const expected = sumFinite(parts);
  const actual = Number.isFinite(total) ? total : 0;
  const error = actual - expected;
  const scale = Math.max(1, Math.abs(actual), Math.abs(expected));
  return { ok: Math.abs(error) <= tolerance * scale, actual, expected, error, tolerance };
}

export function checkRollupIdentity(rows = [], totalKey, partKeys = [], tolerance = 1e-9) {
  return rows.map((row, index) => ({
    index,
    ...checkAdditiveIdentity(row?.[totalKey], partKeys.map((key) => row?.[key]), tolerance),
  }));
}
