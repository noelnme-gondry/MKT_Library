// 입력 행 정리와 계층 노드 집계 (spec §1·§2).
import { parseNumericStrict } from "@/utils/parseNumeric";
import { isIsoDate } from "./plannerStats";

const TEXT_FIELDS = ["country", "platform", "channel", "campaign_name", "adgroup_name", "creative_id"];

function normalizePlatform(value) {
  const text = String(value ?? "").trim();
  const lower = text.toLowerCase();
  if (lower.includes("ios") || lower === "iphone") return "iOS";
  if (lower.includes("android")) return "Android";
  return text;
}

/**
 * 매핑된 행 → 플래너 행. 날짜·비용·결과를 못 읽는 행은 버리고 사유별로 센다(0으로 채우지 않는다).
 * @param {object[]} rows getMappedRows 결과 같은 표준키 행
 * @param {{metric:string, budgetField?:string}} opts
 */
export function normalizePlannerRows(rows, { metric, budgetField = "daily_budget" }) {
  const out = [];
  const dropped = { invalid_date: 0, invalid_cost: 0, invalid_result: 0 };
  for (const row of rows || []) {
    const date = String(row?.date ?? "").trim();
    if (!isIsoDate(date)) {
      dropped.invalid_date += 1;
      continue;
    }
    const cost = parseNumericStrict(row.cost);
    if (cost == null || cost < 0) {
      dropped.invalid_cost += 1;
      continue;
    }
    const result = parseNumericStrict(row[metric]);
    if (result == null || result < 0) {
      dropped.invalid_result += 1;
      continue;
    }
    const clean = { date, cost, result };
    for (const field of TEXT_FIELDS) clean[field] = String(row[field] ?? "").trim();
    clean.platform = normalizePlatform(row.platform);
    clean.impressions = parseNumericStrict(row.impressions);
    clean.clicks = parseNumericStrict(row.clicks);
    clean.budget = parseNumericStrict(row[budgetField]);
    out.push(clean);
  }
  return { rows: out, dropped };
}

/** 데이터에 값이 하나라도 있는 가장 낮은 레벨. */
export function deepestPresentLevel(rows, levels) {
  for (let i = levels.length - 1; i >= 0; i -= 1) {
    if (rows.some((row) => row[levels[i]])) return levels[i];
  }
  return levels[0];
}

export function pathOf(row, level, levels) {
  const depth = levels.indexOf(level);
  return Object.fromEntries(levels.slice(0, depth + 1).map((name) => [name, row[name] || ""]));
}

export function nodeKey(row, level, levels) {
  return JSON.stringify(levels.slice(0, levels.indexOf(level) + 1).map((name) => row[name] || ""));
}

export function nodeLabel(path) {
  const parts = Object.values(path).filter(Boolean);
  return parts.length ? parts.join(" › ") : "(전체)";
}

/**
 * 레벨별 노드 → 날짜별 합계.
 * @returns {Map<string, {key, path, label, days: Map<string, {cost, result, impressions, clicks, budget, hasFunnel}>}>}
 */
export function dailyByNode(rows, level, levels) {
  const nodes = new Map();
  for (const row of rows) {
    const key = nodeKey(row, level, levels);
    if (!nodes.has(key)) {
      const path = pathOf(row, level, levels);
      nodes.set(key, { key, path, label: nodeLabel(path), days: new Map() });
    }
    const days = nodes.get(key).days;
    if (!days.has(row.date)) days.set(row.date, { cost: 0, result: 0, impressions: 0, clicks: 0, budget: null, hasFunnel: true });
    const day = days.get(row.date);
    day.cost += row.cost;
    day.result += row.result;
    if (row.impressions == null || row.clicks == null) day.hasFunnel = false;
    else {
      day.impressions += row.impressions;
      day.clicks += row.clicks;
    }
    if (row.budget != null) day.budget = (day.budget ?? 0) + row.budget;
  }
  for (const node of nodes.values()) node.days = new Map([...node.days].sort(([a], [b]) => a.localeCompare(b)));
  return nodes;
}

/** 노드 경로를 상위 레벨 키로 줄인다(부모 곡선·대조군 찾기용). */
export function ancestorKey(path, level, levels) {
  return JSON.stringify(levels.slice(0, levels.indexOf(level) + 1).map((name) => path[name] || ""));
}

/** 기간 합계. */
export function sumDays(days, from, to) {
  const total = { cost: 0, result: 0, impressions: 0, clicks: 0, hasFunnel: true, dayCount: 0 };
  for (const [date, day] of days) {
    if (date < from || date > to) continue;
    total.cost += day.cost;
    total.result += day.result;
    total.impressions += day.impressions;
    total.clicks += day.clicks;
    if (!day.hasFunnel) total.hasFunnel = false;
    total.dayCount += 1;
  }
  return total;
}
