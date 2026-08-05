const FILTER_KEYS = ["platforms", "countries", "channels", "sources"];

function asDate(value) {
  const text = String(value ?? "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return "";
  const [year, month, day] = text.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? text : "";
}

function values(value) {
  const source = value instanceof Set ? [...value] : Array.isArray(value) ? value : [];
  return [...new Set(source
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .map((item) => item.slice(0, 120)))].sort().slice(0, 80);
}

function dataGroup(value) {
  const text = String(value ?? "").trim();
  return /^[a-z0-9_]{1,40}$/.test(text) ? text : "";
}

// CSV에는 원자료가 아니라, 사용자가 선택한 범위만 JSON 한 칸으로 보존한다. 날짜는
// 기준 계산을 재현하기 위한 메타데이터이고 실제 비교의 날짜 범위는 baselineDate+1부터
// comparisonWindowDays로 명시적으로 다시 정한다.
export function createDecisionComparisonScope({ dataGroup: group, filter = {} } = {}) {
  const dimensions = Object.fromEntries(FILTER_KEYS.map((key) => [key, values(filter?.[key])]));
  return JSON.stringify({
    dataGroup: dataGroup(group),
    baselineDateStart: asDate(filter?.dateStart),
    baselineDateEnd: asDate(filter?.dateEnd),
    dimensions,
  });
}

export function readDecisionComparisonScope(value) {
  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return null;
  const group = dataGroup(parsed.dataGroup);
  if (!group) return null;
  const inputDimensions = parsed.dimensions && typeof parsed.dimensions === "object" ? parsed.dimensions : {};
  return {
    dataGroup: group,
    baselineDateStart: asDate(parsed.baselineDateStart),
    baselineDateEnd: asDate(parsed.baselineDateEnd),
    dimensions: Object.fromEntries(FILTER_KEYS.map((key) => [key, values(inputDimensions[key])])),
  };
}

export function normalizeDecisionComparisonScope(value) {
  const scope = readDecisionComparisonScope(value);
  return scope ? JSON.stringify(scope) : "";
}

export function canonicalRowMatchesDecisionScope(row, scope) {
  if (!scope) return false;
  return FILTER_KEYS.every((filterKey) => {
    const selected = scope.dimensions?.[filterKey] || [];
    if (!selected.length) return true;
    const field = filterKey.slice(0, -1);
    // source는 초기 canonical 계약에서 metrics에 보존된 CSV도 있어 양쪽을 읽는다.
    const value = row?.dimensions?.[field] ?? row?.metrics?.[field];
    return selected.includes(String(value ?? "").trim());
  });
}
