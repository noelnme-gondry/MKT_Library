// Only used with the built-in sample, never the user's uploaded data.
export function compareSamplePerformance(rows) {
  const dates = [...new Set(rows.map(row => row.date))].sort().slice(-14);
  if (dates.length < 14) return null;
  const priorDates = new Set(dates.slice(0, 7));
  const recentDates = new Set(dates.slice(7));
  const paid = rows.filter(row => row.source === "paid");
  const aggregate = (data, window) => data.filter(row => window.has(row.date)).reduce((sum, row) => ({ cost: sum.cost + Number(row.cost), actions: sum.actions + Number(row.actions) }), { cost: 0, actions: 0 });
  const compare = data => {
    const prior = aggregate(data, priorDates);
    const recent = aggregate(data, recentDates);
    prior.cpa = prior.actions > 0 ? prior.cost / prior.actions : null;
    recent.cpa = recent.actions > 0 ? recent.cost / recent.actions : null;
    const change = key => prior[key] > 0 && recent[key] != null ? recent[key] / prior[key] - 1 : null;
    return { prior, recent, costChange: change("cost"), actionChange: change("actions"), cpaChange: change("cpa") };
  };
  const channels = [...new Set(paid.map(row => row.channel))].map(channel => ({ channel, ...compare(paid.filter(row => row.channel === channel)) }))
    .filter(row => row.cpaChange != null).sort((a, b) => b.cpaChange - a.cpaChange);
  return { ...compare(paid), channels, dates };
}

export function summarizeSampleSpend(rows) {
  const dates = [...new Set(rows.map(row => row.date))].sort().slice(-7);
  const totals = dates.map(date => ({ date, cost: rows.filter(row => row.date === date).reduce((sum, row) => sum + Number(row.cost || 0), 0) }));
  const total = totals.reduce((sum, row) => sum + row.cost, 0);
  const peak = Math.max(...totals.map(row => row.cost));
  return { dates, totals, total, peak, peakDay: totals.find(row => row.cost === peak) };
}
