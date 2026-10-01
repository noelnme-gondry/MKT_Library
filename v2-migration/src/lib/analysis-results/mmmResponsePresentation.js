// Presentation domain only: do not extend the fitted engine's observed-spend limit.
export function mmmResponseDomain(channel) {
  const min = channel?.coverage?.observedMin;
  const rawMax = channel?.coverage?.observedMax;
  const ceiling = channel?.observedSustainableSpendMax;
  if (![min, rawMax, ceiling].every(Number.isFinite)) return null;
  const start = Math.max(0, min);
  const end = Math.min(rawMax, ceiling);
  if (!(end > start)) return null;
  const grid = Array.from({ length: 41 }, (_, index) => start + (end - start) * index / 40);
  const current = channel.recentMean;
  if (Number.isFinite(current) && current >= start && current <= end) grid.push(current);
  return { min: start, max: end, grid: [...new Set(grid)].sort((a, b) => a - b), currentInRange: Number.isFinite(current) && current >= start && current <= end };
}
