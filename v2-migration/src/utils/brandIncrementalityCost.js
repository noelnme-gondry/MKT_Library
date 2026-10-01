import { normalizeIncrDate } from "./incrPrePostMath";
import { parseCampaignFlag } from "./brandIncrementalityMath";
import { parseNum } from "./format";

// Cost is a reporting overlay, never an input to the ITS fit. Match exactly
// the campaign dates used by the outcome model; never turn missing cost into 0.
export function summarizeBrandCampaignCost({ rows = [], points = [], hasCostColumn = false, invalidOutcomeRows = 0 } = {}) {
  if (!hasCostColumn) return { ok: false, reason: "missing_column", total: null };
  if (invalidOutcomeRows > 0) return { ok: false, reason: "invalid_outcome_rows", total: null };
  const dates = new Set(points.filter(point => point.isCampaignOn).map(point => point.date));
  if (!dates.size) return { ok: false, reason: "no_campaign_dates", total: null };
  let total = 0;
  const matched = new Set();
  for (const row of rows) {
    const date = normalizeIncrDate(row.date);
    if (!date || !dates.has(date) || parseCampaignFlag(row.campaignOn) !== true) continue;
    const cost = parseNum(row.cost);
    if (cost == null || cost < 0) return { ok: false, reason: "invalid_cost", total: null };
    total += cost;
    matched.add(date);
  }
  if (matched.size !== dates.size || !Number.isFinite(total)) return { ok: false, reason: "incomplete_cost", total: null };
  return { ok: true, reason: null, total, periods: dates.size, start: [...dates].sort()[0], end: [...dates].sort().at(-1) };
}

export function brandIncrementalUnitCost({ spend, estimate, interval, referenceOnly = true } = {}) {
  const unavailable = reason => ({ value: null, range: null, status: "not_estimable", reason });
  if (!spend?.ok) return unavailable(spend?.reason || "missing_column");
  if (!Number.isFinite(spend.total) || spend.total < 0) return unavailable("invalid_cost");
  if (!Number.isFinite(estimate) || estimate <= 0) return unavailable("nonpositive_increment");
  if (!Array.isArray(interval) || interval.length !== 2 || !interval.every(Number.isFinite) || interval[0] > estimate || interval[1] < estimate) return unavailable("invalid_interval");
  if (interval[0] <= 0) return unavailable("interval_includes_zero");
  const value = spend.total / estimate;
  const range = [spend.total / interval[1], spend.total / interval[0]];
  if (![value, ...range].every(Number.isFinite)) return unavailable("invalid_ratio");
  return { value, range, status: referenceOnly ? "reference" : "estimated", reason: null };
}
