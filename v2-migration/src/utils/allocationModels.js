import { ALLOC_MATH } from "./allocationMath";
import { getRowGroupKey } from "./budgetAllocTool";
import { selectAllocationRegime } from "./allocationRegime";

const OUTLIER_STRENGTH = {
  iqr: { standard: 1.5, strong: 1.0, very_strong: 0.5 },
  modz: { standard: 3.5, strong: 2.5, very_strong: 2.0 },
};
export function allocationOutlierOptions(method, strength = "standard") {
  if (method === "iqr") return { iqrMult: OUTLIER_STRENGTH.iqr[strength] ?? 1.5 };
  if (method === "modz") return { modzThreshold: OUTLIER_STRENGTH.modz[strength] ?? 3.5 };
  return {};
}

export function allocationPointMap(rows, unit, metric) {
  const aggregate = new Map();
  for (const row of rows) {
    const group = getRowGroupKey(row, unit);
    if (!group) continue;
    const key = row.date || "__nodate__";
    if (!aggregate.has(group)) aggregate.set(group, new Map());
    if (!aggregate.get(group).has(key)) aggregate.get(group).set(key, { x: 0, result: 0, date: row.date, known: true });
    const point = aggregate.get(group).get(key);
    point.x += Number(row.cost) || 0;
    point.result += Number(row[metric]) || 0;
    if (row[metric] == null || row[metric] === "" || !Number.isFinite(Number(row[metric])) || !Number.isFinite(Number(row.cost))) point.known = false;
  }
  return new Map([...aggregate].flatMap(([group, dates]) => {
    const points = [...dates.values()].filter(p => p.known && p.x > 0 && p.result > 0).map(p => ({ x: p.x, y: p.x / p.result, date: p.date }));
    return points.length ? [[group, points]] : [];
  }));
}
export const ALLOCATION_MODEL_TYPES = Object.freeze({ linear: "Linear", log: "Log", poly2: "Poly2", power: "Power" });
export const ALLOCATION_PREDICTION_METRICS = Object.freeze(["installs", "actions", "revenue_d7"]);

export function fitAllocationChannel(points, options = {}) {
  const method = options.outlierMethod ?? "iqr";
  const regime = selectAllocationRegime(points, options);
  const cleaned = ALLOC_MATH.removeOutliers(regime.kept, method, allocationOutlierOptions(method, options.outlierStrength));
  const kept = cleaned.kept;
  if (kept.length < 2) return null;
  const trainData = kept.map(p => [p.x, p.y]);
  const dates = kept.map(p => p.date);
  const parsed = dates.map(date => Date.parse(date)).filter(Number.isFinite);
  const weights = options.weightMode && options.weightMode !== "none" && parsed.length
    ? ALLOC_MATH.calcDateWeights(dates, options.weightMode, Math.max(...parsed), options.halfLifeDays ?? 30) : null;
  const type = ALLOCATION_MODEL_TYPES[options.trendType];
  const model = type ? ALLOC_MATH[`fit${type}`](trainData, weights) : ALLOC_MATH.fitBest(trainData, weights);
  if (!model) return null;
  const periodDates = dates.filter(date => typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(date))).sort();
  const scopeEnd = periodDates.length ? new Date(Date.parse(`${periodDates.at(-1)}T00:00:00Z`) + ((options.periodDays || 1) - 1) * 86400000).toISOString().slice(0, 10) : "";
  return { model, kept, xMin: Math.min(...kept.map(p => p.x)), xMax: Math.max(...kept.map(p => p.x)),
    poly2Shape: ALLOC_MATH.detectPoly2Shape(model), r2: model.r2 ?? ALLOC_MATH.calcR2(trainData, model, weights),
    regime, outliersRemoved: cleaned.removed.length, scopeStart: periodDates[0] || "", scopeEnd };
}

export function allocationModelMap(points, options = {}, overrides = {}) {
  return new Map([...points].map(([name, values]) => [name, fitAllocationChannel(values, overrides[name] ? { ...options, trendType: overrides[name] } : options)]));
}

export function predictAllocationCost(wrapper, cost) {
  if (!wrapper?.model || !Number.isFinite(cost) || cost < 0) return null;
  const cpr = ALLOC_MATH.predictSafeCpr(wrapper, cost);
  if (!(cpr > 0) || !Number.isFinite(cpr)) return null;
  const results = cost / cpr;
  return { cost, results, cpr: cost > 0 ? cpr : null, roas: cost > 0 ? 1 / cpr : null,
    estimated: cost < wrapper.xMin || cost > wrapper.xMax };
}
