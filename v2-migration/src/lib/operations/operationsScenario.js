import { periodDays, dateOrdinal } from "@/lib/analysisPeriod";
import { predictAllocationCost } from "@/utils/allocationModels";
import { getAllocationEvidenceLimits, improveAllocationFromCurrent } from "@/utils/budgetAllocTool";

// Plan policy only. The existing fit, prediction and allocation engines are unchanged.
// Budget amounts returned to the execution contract remain daily amounts.
export function operationsPlanRange(after, unit = "week") {
  if (dateOrdinal(after) == null) return { start: "", end: "" };
  if (unit === "month") {
    const date = new Date(`${after}T00:00:00Z`);
    const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1)).toISOString().slice(0, 10);
    const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 2, 0)).toISOString().slice(0, 10);
    return { start, end };
  }
  const shift = count => new Date((dateOrdinal(after) + count) * 86400000).toISOString().slice(0, 10);
  return { start: shift(1), end: shift(7) };
}

export function planOperationsScenario(brief, { mode = "maintain", changeLimit = .2, targetTotal = null, range, currency = "KRW" } = {}) {
  const planRange = range || operationsPlanRange(brief.periods.current.end);
  const horizonDays = periodDays(planRange);
  const currentTotal = Object.values(brief.currentSpends).reduce((sum, value) => sum + value, 0);
  const totalBudget = mode === "maintain" ? currentTotal : Number(targetTotal) / horizonDays;
  const base = { ok: false, mode, planRange, horizonDays, currentTotal, totalBudget, changeLimit, items: [], holds: [], baselineResults: null, expectedResults: null, improvementPct: null };
  const withheld = (holds, extra = {}) => ({ ...base, ...extra, holds });
  if (brief.budgetHolds.length) return withheld(brief.budgetHolds);
  if (!horizonDays || !Number.isFinite(totalBudget) || totalBudget <= 0 || !Number.isFinite(changeLimit) || changeLimit < 0 || changeLimit > 1 || !["maintain", "increase", "decrease"].includes(mode)) return withheld([{ reason: "constraints" }]);
  if ((mode === "increase" && totalBudget <= currentTotal) || (mode === "decrease" && totalBudget >= currentTotal)) return withheld([{ reason: "direction" }]);
  const evidence = getAllocationEvidenceLimits({ modelsMap: brief.models });
  const minSpends = {}, maxSpends = {}, baseline = new Map();
  for (const [id, model] of brief.models) {
    const current = brief.currentSpends[id], cap = evidence.maxSpends[id];
    const prediction = predictAllocationCost(model, current);
    if (!(current > 0) || current < model.xMin || current > cap || !prediction || prediction.estimated) return withheld([{ id, reason: "range" }]);
    baseline.set(id, prediction);
    minSpends[id] = mode === "increase" ? current : Math.max(model.xMin, current * (1 - changeLimit));
    maxSpends[id] = mode === "decrease" ? current : Math.min(cap, current * (1 + changeLimit));
  }
  const minTotal = Object.values(minSpends).reduce((sum, value) => sum + value, 0);
  const maxTotal = Object.values(maxSpends).reduce((sum, value) => sum + value, 0);
  const bounds = { minTotal, maxTotal };
  if (totalBudget < minTotal - 1e-6 || totalBudget > maxTotal + 1e-6) return withheld([{ reason: "constraints" }], bounds);
  const allocation = improveAllocationFromCurrent({ modelsMap: brief.models, currentSpends: brief.currentSpends, totalBudget, minSpends, maxSpends, currency });
  if (allocation.constraintViolation || allocation.items.length !== brief.models.size || Math.abs(allocation.totalAllocated - totalBudget) > Math.max(1e-6, totalBudget * 1e-9)) return withheld([{ reason: "constraints" }], bounds);
  const items = allocation.items.map(item => {
    const predicted = predictAllocationCost(brief.models.get(item.channel), item.cost);
    return { id: item.channel, current: brief.currentSpends[item.channel], budget: item.cost, currentResults: baseline.get(item.channel).results,
      expectedResults: predicted?.results ?? null, expectedCpr: predicted?.cpr ?? null, min: minSpends[item.channel], max: maxSpends[item.channel] };
  });
  if (items.some(item => !Number.isFinite(item.expectedResults) || item.budget < item.min - 1e-6 || item.budget > item.max + 1e-6)) return withheld([{ reason: "constraints" }], bounds);
  const baselineResults = items.reduce((sum, item) => sum + item.currentResults, 0);
  const expectedResults = items.reduce((sum, item) => sum + item.expectedResults, 0);
  if (!(baselineResults > 0) || (mode === "maintain" && expectedResults < baselineResults - 1e-8)) return withheld([{ reason: "constraints" }], bounds);
  return { ...base, ...bounds, ok: true, items, baselineResults, expectedResults, baselineCpr: currentTotal / baselineResults,
    expectedCpr: totalBudget / expectedResults, improvementPct: (expectedResults / baselineResults - 1) * 100 };
}
