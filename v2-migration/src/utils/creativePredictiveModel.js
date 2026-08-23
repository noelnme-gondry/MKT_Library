import { CREATIVE_MATH } from "@/utils/creativeMath";

const MIN_LEVEL_COUNT = 3;
const MAX_LEVELS_PER_ATTRIBUTE = 12;
const MAX_SHAPLEY_ATTRIBUTES = 8;

function finite(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function targetWeight(row, metric) {
  if (metric === "cvr") return finite(row.clicks);
  if (metric === "cpa") return finite(row.actions);
  if (metric === "roas") return finite(row.spend);
  return finite(row.impressions);
}

function normalizedLevel(value) {
  if (value == null || String(value).trim() === "") return null;
  return String(value).trim();
}

function levelSpec(rows, attribute) {
  const rawCounts = new Map();
  for (const row of rows) {
    const level = normalizedLevel(row[attribute]);
    if (level) rawCounts.set(level, (rawCounts.get(level) || 0) + 1);
  }
  if (rawCounts.size < 2) return null;
  const ranked = [...rawCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]));
  const kept = new Set(ranked.slice(0, MAX_LEVELS_PER_ATTRIBUTE - 1).filter(([, count]) => count >= MIN_LEVEL_COUNT).map(([level]) => level));
  const collapse = (value) => {
    const level = normalizedLevel(value);
    if (!level) return null;
    return kept.has(level) ? level : "__other__";
  };
  const collapsedCounts = new Map();
  for (const row of rows) {
    const level = collapse(row[attribute]);
    if (level) collapsedCounts.set(level, (collapsedCounts.get(level) || 0) + 1);
  }
  const levels = [...collapsedCounts.entries()].sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0])).map(([level]) => level);
  if (levels.length < 2) return null;
  return { attribute, reference: levels[0], levels, collapse };
}

function buildDesign(metrics, attributes, metric, { includeChannel = true, numericFeatures = [] } = {}) {
  const requestedNumeric = [...new Set((numericFeatures || []).filter(Boolean))];
  const rows = (metrics || []).filter((row) => finite(row?.[metric]) != null
    && targetWeight(row, metric) > 0
    && requestedNumeric.every((feature) => finite(row?.[feature]) != null));
  if (rows.length < 2 || new Set(rows.map((row) => Number(row[metric]))).size < 2) {
    return { ok: false, reason: "constant_or_missing_outcome", n: rows.length };
  }
  const requested = [...new Set((attributes || []).filter(Boolean))];
  const controls = includeChannel ? ["channel"] : [];
  const specs = [...controls, ...requested].map((attribute) => levelSpec(rows, attribute)).filter(Boolean);
  const attributeSpecs = specs.filter((spec) => requested.includes(spec.attribute));
  if (!attributeSpecs.length) return { ok: false, reason: "insufficient_attribute_diversity", n: rows.length };

  const terms = ["(Intercept)"];
  const groups = {};
  const controlIndices = [];
  for (const spec of specs) {
    groups[spec.attribute] = [];
    for (const level of spec.levels.slice(1)) {
      terms.push(`${spec.attribute}=${level}`);
      const index = terms.length - 1;
      groups[spec.attribute].push(index);
      if (controls.includes(spec.attribute)) controlIndices.push(index);
    }
  }
  const usableNumeric = requestedNumeric.filter((feature) => new Set(rows.map((row) => Number(row[feature]))).size >= 3);
  for (const feature of usableNumeric) {
    terms.push(feature);
    groups[feature] = [terms.length - 1];
  }
  const X = rows.map((row) => {
    const encoded = [1];
    for (const spec of specs) {
      const selected = spec.collapse(row[spec.attribute]);
      for (const level of spec.levels.slice(1)) encoded.push(selected === level ? 1 : 0);
    }
    for (const feature of usableNumeric) encoded.push(Number(row[feature]));
    return encoded;
  });
  const y = rows.map((row) => Number(row[metric]));
  const weights = rows.map((row) => Number(targetWeight(row, metric)));
  return {
    ok: true,
    X,
    y,
    weights,
    terms,
    groups,
    controlIndices,
    n: rows.length,
    predictorCount: terms.length - 1,
    attributeCount: attributeSpecs.length,
    numericFeatureCount: usableNumeric.length,
    numericFeatures: usableNumeric,
    attributes: attributeSpecs.map((spec) => spec.attribute),
    droppedAttributes: requested.filter((attribute) => !attributeSpecs.some((spec) => spec.attribute === attribute)),
    targetMetric: metric,
  };
}

export function buildCreativePredictiveInput({ metrics = [], attributes = [], numericFeatures = [], metric = "ctr" } = {}) {
  const design = buildDesign(metrics, attributes, metric, { numericFeatures });
  if (!design.ok) return design;
  if (design.predictorCount < 2) return { ...design, ok: false, reason: "insufficient_predictor_diversity" };
  return design;
}

function factorial(value) {
  let result = 1;
  for (let next = 2; next <= value; next += 1) result *= next;
  return result;
}

function subsetColumns(design, attributes, mask) {
  const indices = [...design.controlIndices];
  attributes.forEach((attribute, index) => {
    if (mask & (1 << index)) indices.push(...(design.groups[attribute] || []));
  });
  return [...new Set(indices)].sort((left, right) => left - right);
}

function subsetR2(design, attributes, mask) {
  const indices = subsetColumns(design, attributes, mask);
  const X = design.X.map((row) => [1, ...indices.map((index) => row[index])]);
  return CREATIVE_MATH.wlsSolve(X, design.y, design.weights)?.R2 ?? null;
}

// 속성 그룹을 넣는 모든 순서를 평균해, 채널 통제 이후 추가 설명력(R²)을
// 속성별로 배분한다. 예측 SHAP이나 인과 기여도가 아니라 전역 Shapley R²다.
export function creativeShapleyR2({ metrics = [], attributes = [], metric = "ctr" } = {}) {
  const design = buildDesign(metrics, attributes, metric);
  if (!design.ok) return { status: "not_computable", reason: design.reason, n: design.n || 0, rows: [] };
  const selected = design.attributes;
  if (selected.length > MAX_SHAPLEY_ATTRIBUTES) {
    return { status: "not_computable", reason: "too_many_attributes", n: design.n, rows: [], maxAttributes: MAX_SHAPLEY_ATTRIBUTES };
  }
  const subsetCount = 1 << selected.length;
  const values = new Array(subsetCount);
  for (let mask = 0; mask < subsetCount; mask += 1) {
    values[mask] = subsetR2(design, selected, mask);
    if (values[mask] == null || !Number.isFinite(values[mask])) {
      return { status: "not_identified", reason: "singular_subset", n: design.n, rows: [] };
    }
  }
  const denom = factorial(selected.length);
  const rows = selected.map((attribute, attributeIndex) => {
    let contribution = 0;
    for (let mask = 0; mask < subsetCount; mask += 1) {
      if (mask & (1 << attributeIndex)) continue;
      const size = selected.reduce((sum, _, index) => sum + ((mask & (1 << index)) ? 1 : 0), 0);
      const weight = (factorial(size) * factorial(selected.length - size - 1)) / denom;
      contribution += weight * (values[mask | (1 << attributeIndex)] - values[mask]);
    }
    return { attribute, contribution };
  }).sort((left, right) => right.contribution - left.contribution);
  return {
    status: "complete",
    n: design.n,
    metric,
    baselineR2: values[0],
    fullR2: values[subsetCount - 1],
    incrementalR2: values[subsetCount - 1] - values[0],
    rows,
  };
}

export const CREATIVE_PREDICTIVE_LIMITS = Object.freeze({
  minLevelCount: MIN_LEVEL_COUNT,
  maxLevelsPerAttribute: MAX_LEVELS_PER_ATTRIBUTE,
  maxShapleyAttributes: MAX_SHAPLEY_ATTRIBUTES,
});
