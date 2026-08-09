import { normalizeDateValue, normalizeNumericValue } from "@/lib/data-import/normalizeValues";

function finiteCost(value) {
  return normalizeNumericValue(value)?.value ?? null;
}

// /start 판정과 실제 VIF 도구가 같은 날짜×채널 지출 패널을 보도록 만드는 SSOT.
// 누락 채널은 해당 날짜의 지출 0으로 채우며, 변동이 없는 열은 VIF 계산 대상이 아니다.
export function buildVifSpendPanel(observations = []) {
  const byDate = new Map();
  observations.forEach((observation) => {
    const date = normalizeDateValue(observation?.date);
    const entity = String(observation?.entity || "").trim();
    const cost = finiteCost(observation?.cost);
    if (!date || !entity || cost == null) return;
    const point = byDate.get(date) || {};
    point[entity] = (point[entity] || 0) + cost;
    byDate.set(date, point);
  });
  const entities = [...new Set([...byDate.values()].flatMap((point) => Object.keys(point)))].sort();
  const dates = [...byDate.keys()].sort((a, b) => a.localeCompare(b));
  const matrix = dates.map((date) => entities.map((entity) => byDate.get(date)?.[entity] || 0));
  const variableEntityIndices = entities.map((_, index) => index).filter((index) => {
    const values = matrix.map((row) => row[index]);
    return values.length > 0 && Math.max(...values) - Math.min(...values) > 1e-12;
  });
  return { entities, dates, matrix, variableEntityIndices };
}
