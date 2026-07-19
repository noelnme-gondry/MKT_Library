const EMPTY_MARKERS = new Set(["", "-", "n/a", "na", "null", "undefined", "없음"]);

export function normalizeNumericValue(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (EMPTY_MARKERS.has(raw.toLowerCase())) return null;
  const isPercent = raw.includes("%");
  const cleaned = raw.replace(/[^0-9,.-]/g, "").replace(/,/g, "");
  if (!cleaned || cleaned === "-" || cleaned === ".") return null;
  const number = Number.parseFloat(cleaned);
  if (!Number.isFinite(number)) return null;
  return { value: number, isPercent };
}

export function normalizeDateValue(value) {
  if (value == null) return null;
  const raw = String(value).trim();
  if (!raw || EMPTY_MARKERS.has(raw.toLowerCase())) return null;
  const compact = raw.match(/^(\d{4})(\d{2})(\d{2})$/);
  const normalized = compact ? `${compact[1]}-${compact[2]}-${compact[3]}` : raw.replace(/\./g, "-");
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) return null;
  const year = parsed.getUTCFullYear();
  if (year < 2000 || year > 2100) return null;
  return parsed.toISOString().slice(0, 10);
}
