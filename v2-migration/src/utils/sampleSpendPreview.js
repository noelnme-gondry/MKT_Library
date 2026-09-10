// Only used with the built-in sample, never the user's uploaded data.
export function summarizeSampleSpend(rows) {
  const dates = [...new Set(rows.map(row => row.date))].sort().slice(-7);
  const totals = dates.map(date => ({ date, cost: rows.filter(row => row.date === date).reduce((sum, row) => sum + Number(row.cost || 0), 0) }));
  const total = totals.reduce((sum, row) => sum + row.cost, 0);
  const peak = Math.max(...totals.map(row => row.cost));
  return { dates, totals, total, peak, peakDay: totals.find(row => row.cost === peak) };
}
