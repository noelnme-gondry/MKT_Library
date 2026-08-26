const SNAPSHOT_VERSION = 1;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function asDate(value) {
  const text = String(value ?? "").trim();
  if (!ISO_DATE.test(text)) return "";
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? text : "";
}

function stableHash(value) {
  let hash = 2166136261;
  for (const char of String(value)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function dayDistance(left, right) {
  return Math.round((Date.parse(`${right}T00:00:00Z`) - Date.parse(`${left}T00:00:00Z`)) / 86400000);
}

function normalizedMetrics(metrics = {}) {
  return Object.entries(metrics)
    .filter(([, value]) => typeof value === "number" && Number.isFinite(value))
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, value]) => `${key}:${value}`)
    .join("|");
}

function inferGrain(dates) {
  if (dates.length < 2) return "unknown";
  const gaps = dates.slice(1).map((date, index) => dayDistance(dates[index], date)).filter((gap) => gap > 0);
  const median = [...gaps].sort((left, right) => left - right)[Math.floor(gaps.length / 2)] || 0;
  if (median <= 2) return "day";
  if (median <= 9) return "week";
  if (median <= 40) return "month";
  return "irregular";
}

function mappingSignature(mapping = {}) {
  return stableHash(Object.entries(mapping || {}).sort(([left], [right]) => left.localeCompare(right)).map(([key, value]) => `${key}:${value}`).join("|"));
}

// 원본 행·헤더·지표값은 저장하지 않는다. 날짜 범위와 비가역 지문만으로 중복·수정·
// 연속성을 판정한다. 이 정보는 결정 기록과 함께 이 기기에만 남는다.
export function buildDatasetContinuitySnapshot(canonicalData = {}, { dataGroup = "", mapping = {} } = {}) {
  const dates = new Map();
  for (const row of canonicalData?.records || []) {
    const date = asDate(row?.date);
    if (!date) continue;
    const digest = stableHash(`${date}|${normalizedMetrics(row?.metrics)}`);
    dates.set(date, digest);
  }
  const orderedDates = [...dates.keys()].sort();
  if (!orderedDates.length) return null;
  const dateDigest = stableHash(orderedDates.map((date) => `${date}:${dates.get(date)}`).join("|"));
  return {
    version: SNAPSHOT_VERSION,
    dataGroup: String(dataGroup || "").slice(0, 40),
    dateStart: orderedDates[0],
    dateEnd: orderedDates.at(-1),
    dateCount: orderedDates.length,
    grain: inferGrain(orderedDates),
    mappingSignature: mappingSignature(mapping),
    dateDigest,
  };
}

export function readDatasetContinuitySnapshot(value) {
  let raw = value;
  if (typeof value === "string") {
    try { raw = JSON.parse(value); } catch { return null; }
  }
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const dateStart = asDate(raw.dateStart);
  const dateEnd = asDate(raw.dateEnd);
  const dateCount = Number(raw.dateCount);
  const grain = ["day", "week", "month", "irregular", "unknown"].includes(raw.grain) ? raw.grain : "unknown";
  const dataGroup = /^[a-z0-9_]{1,40}$/.test(String(raw.dataGroup || "")) ? String(raw.dataGroup) : "";
  const digest = String(raw.dateDigest || "");
  const signature = String(raw.mappingSignature || "");
  if (!dateStart || !dateEnd || dateStart > dateEnd || !Number.isInteger(dateCount) || dateCount < 1 || !dataGroup || !digest || !signature) return null;
  return { version: SNAPSHOT_VERSION, dataGroup, dateStart, dateEnd, dateCount, grain, mappingSignature: signature, dateDigest: digest };
}

export function serializeDatasetContinuitySnapshot(snapshot) {
  const safe = readDatasetContinuitySnapshot(snapshot);
  return safe ? JSON.stringify(safe) : "";
}

export function classifyDatasetContinuity(previousValue, currentValue, { now = new Date(), settleDays = 3 } = {}) {
  const previous = readDatasetContinuitySnapshot(previousValue);
  const current = readDatasetContinuitySnapshot(currentValue);
  if (!previous) return { state: "missing_previous_snapshot" };
  if (!current) return { state: "missing_current_snapshot" };
  if (previous.dataGroup !== current.dataGroup) return { state: "dataset_mismatch", previous, current };
  if (previous.mappingSignature !== current.mappingSignature) return { state: "mapping_changed", previous, current };

  const maturityCutoff = new Date(now instanceof Date ? now : now);
  maturityCutoff.setUTCDate(maturityCutoff.getUTCDate() - Math.max(0, Number(settleDays) || 0));
  const maturity = current.dateEnd <= maturityCutoff.toISOString().slice(0, 10) ? "likely_closed" : "provisional";
  if (previous.dateStart === current.dateStart && previous.dateEnd === current.dateEnd) {
    return { state: previous.dateDigest === current.dateDigest ? "duplicate" : "revised_period", maturity, previous, current };
  }
  if (current.dateStart > previous.dateEnd) {
    const expectedStart = addDays(previous.dateEnd, previous.grain === "month" ? 28 : previous.grain === "week" ? 7 : 1);
    return { state: current.dateStart <= expectedStart ? "next_period" : "gap", maturity, previous, current, expectedStart };
  }
  if (current.dateEnd < previous.dateStart) return { state: "historical_backfill", maturity, previous, current };
  return { state: "partial_overlap", maturity, previous, current };
}
