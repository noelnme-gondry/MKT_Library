import { predictAllocationCost } from "./allocationModels";

/** Only the budget delta is moved. A zero delta preserves every current channel spend. */
export function allocationDeltaPlan({ modelsMap, currentSpends = {}, totalBudget, maxSpends = {}, overrides = {}, currency = "KRW" }) {
  const channels = [...modelsMap].map(([channel, model]) => ({ channel, model, cost: Number(currentSpends[channel]) || 0, cap: maxSpends[channel] ?? model?.xMax ?? 0, locked: Object.hasOwn(overrides, channel) }));
  const invalid = !channels.length || channels.some(item => !Object.hasOwn(currentSpends, item.channel) || !item.model || item.cost < 0 || item.cost > item.cap || !predictAllocationCost(item.model, item.cost));
  if (invalid || !Number.isFinite(totalBudget) || totalBudget < 0) return { items: [], totalAllocated: 0, unallocated: null, overspent: false, blocked: true };
  let delta = totalBudget - channels.reduce((sum, item) => sum + item.cost, 0);
  const unit = currency === "USD" ? 0.01 : 10;
  const step = Math.max(unit, Math.abs(delta) / 500);
  for (let iteration = 0; iteration < 502 && Math.abs(delta) > 1e-8; iteration += 1) {
    const increase = delta > 0;
    const candidates = channels.filter(item => !item.locked).flatMap(item => {
      const amount = Math.min(step, Math.abs(delta), increase ? item.cap - item.cost : item.cost);
      if (!(amount > 1e-8)) return [];
      const nextCost = item.cost + (increase ? amount : -amount);
      const current = predictAllocationCost(item.model, item.cost), next = predictAllocationCost(item.model, nextCost);
      if (!current || !next) return [];
      const gain = increase ? (next.results - current.results) / amount : (current.results - next.results) / amount;
      return [{ item, amount, gain }];
    }).sort((a, b) => (increase ? b.gain - a.gain : a.gain - b.gain) || a.item.channel.localeCompare(b.item.channel));
    const selected = candidates[0];
    if (!selected || (increase && selected.gain <= 0)) break;
    selected.item.cost += increase ? selected.amount : -selected.amount;
    delta += increase ? -selected.amount : selected.amount;
  }
  const totalAllocated = channels.reduce((sum, item) => sum + item.cost, 0);
  return { items: channels.map(item => ({ channel: item.channel, cost: item.cost, results: predictAllocationCost(item.model, item.cost).results, weight: totalAllocated > 0 ? item.cost / totalAllocated : 0, locked: item.locked })),
    totalAllocated, unallocated: Math.max(0, totalBudget - totalAllocated), overspent: totalAllocated > totalBudget + 1e-8, blocked: false };
}
