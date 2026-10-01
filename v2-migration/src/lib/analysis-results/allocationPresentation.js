// Display-only comparisons. Engine outputs are never recalculated or optimized here.
export function allocationEfficiency(currentCost, currentResults, nextCost, nextResults, metric) {
  const roas = metric === "revenue_d7";
  const value = (cost, results) => {
    if (!Number.isFinite(cost) || !Number.isFinite(results) || cost < 0 || results < 0) return null;
    return roas ? (cost > 0 ? results / cost : null) : (results > 0 ? cost / results : null);
  };
  const current = value(currentCost, currentResults);
  const next = value(nextCost, nextResults);
  const changePct = current > 0 && next != null ? (next / current - 1) * 100 : null;
  const improvementPct = changePct == null ? null : roas ? changePct : -changePct;
  return { current, next, improvementPct, label: roas ? "ROAS" : metric === "installs" ? "CPI" : "CPA", roas };
}

// Roll up only explicitly supplied identities (never parse display labels).
export function allocationDistribution(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.group || row.entity;
    if (!groups.has(key)) groups.set(key, { entity: key, current: 0, next: 0 });
    const group = groups.get(key);
    group.current += Number.isFinite(row.current) ? row.current : 0;
    group.next += Number.isFinite(row.next) ? row.next : 0;
  }
  const values = [...groups.values()];
  const currentTotal = values.reduce((sum, row) => sum + row.current, 0);
  const nextTotal = values.reduce((sum, row) => sum + row.next, 0);
  return values.map(row => ({ ...row, currentShare: currentTotal > 0 ? row.current / currentTotal * 100 : null, nextShare: nextTotal > 0 ? row.next / nextTotal * 100 : null })).sort((a, b) => b.next - a.next);
}

// Select from already optimized scenarios; never reallocate the full budget to a subset.
export function allocationScenarioView(scenarios, entities) {
  if (entities == null) return scenarios;
  if (!entities.size) return [];
  return scenarios.map(scenario => {
    const items = scenario.items.filter(item => entities.has(item.channel));
    const totCost = items.reduce((sum, item) => sum + item.cost, 0);
    const totResults = items.reduce((sum, item) => sum + item.results, 0);
    return { ...scenario, items, totCost, totResults, avgCpr: totResults > 0 ? totCost / totResults : null };
  });
}
