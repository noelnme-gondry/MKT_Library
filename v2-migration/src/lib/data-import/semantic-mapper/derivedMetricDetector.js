import { normalizeNumericValue } from "../normalizeValues";

const finite = (value) => Number.isFinite(value);
const numeric = (value) => {
  const parsed = normalizeNumericValue(value);
  return parsed ? (parsed.isPercent ? parsed.value / 100 : parsed.value) : null;
};

function formulaMatch({ rows, observedHeader, numeratorHeader, denominatorHeader }) {
  const errors = rows.slice(0, 500).flatMap((row) => {
    const observed = numeric(row?.[observedHeader]);
    const numerator = numeric(row?.[numeratorHeader]);
    const denominator = numeric(row?.[denominatorHeader]);
    if (!finite(observed) || !finite(numerator) || !finite(denominator) || denominator === 0) return [];
    const expected = numerator / denominator;
    return [Math.abs(observed - expected) / Math.max(Math.abs(expected), 0.01)];
  }).sort((left, right) => left - right);
  if (errors.length < 8) return null;
  const median = errors[Math.floor(errors.length / 2)];
  const p90 = errors[Math.floor(errors.length * 0.9)];
  return median <= 0.02 && p90 <= 0.1 ? { validRowCount: errors.length, medianRelativeError: median, p90RelativeError: p90 } : null;
}

export function detectDerivedMetricBindings({ headers = [], rows = [], bindings = [] } = {}) {
  const headerFor = (canonicalKey) => bindings.find((binding) => binding.canonicalKey === canonicalKey && binding.decision !== "UNKNOWN")?.sourceColumn;
  const clicks = headerFor("media_clicks");
  const impressions = headerFor("media_impressions");
  const spend = headerFor("media_spend");
  const outcome = ["outcome_installs", "outcome_signups", "outcome_purchases", "outcome_generic"].map(headerFor).find(Boolean);
  const unknown = headers.filter((header) => !bindings.find((binding) => binding.sourceColumn === header)?.canonicalKey);
  return unknown.flatMap((observedHeader) => {
    const ctr = clicks && impressions ? formulaMatch({ rows, observedHeader, numeratorHeader: clicks, denominatorHeader: impressions }) : null;
    if (ctr) return [{ sourceColumn: observedHeader, canonicalKey: "derived_ctr", role: "DERIVED_METRIC", decision: "SUGGEST", confidence: 0.84, evidence: [{ kind: "formula", code: "CTR_FORMULA_MATCH" }], diagnostic: ctr }];
    const cpa = spend && outcome ? formulaMatch({ rows, observedHeader, numeratorHeader: spend, denominatorHeader: outcome }) : null;
    return cpa ? [{ sourceColumn: observedHeader, canonicalKey: "derived_cpa", role: "DERIVED_METRIC", decision: "SUGGEST", confidence: 0.84, evidence: [{ kind: "formula", code: "CPA_FORMULA_MATCH" }], diagnostic: cpa }] : [];
  });
}
