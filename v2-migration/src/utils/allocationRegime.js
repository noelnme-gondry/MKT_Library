const median = values => { const a = [...values].sort((x, y) => x - y); const m = Math.floor(a.length / 2); return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2; };
export const ALLOCATION_REGIME_POLICY = Object.freeze({ minimumSide: 6, minimumOverlap: 3, minimumRelativeShift: 0.25, noiseMultiplier: 3 });

/** Operational change candidate, not a causal or significance test. Compare at overlapping costs. */
export function selectAllocationRegime(points, { regimeMode = "all", regimeStart = "" } = {}) {
  const sorted = [...points].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  if (regimeMode === "manual") {
    const kept = sorted.filter(point => point.date >= regimeStart);
    return { kept, start: regimeStart, excluded: points.length - kept.length, candidate: null };
  }
  if (regimeMode !== "auto" || sorted.length < ALLOCATION_REGIME_POLICY.minimumSide * 2) return { kept: points, start: "", excluded: 0, candidate: null };
  const candidates = [];
  const policy = ALLOCATION_REGIME_POLICY;
  const count = sorted.length - policy.minimumSide * 2 + 1;
  const stride = Math.max(1, Math.ceil(count / 32));
  for (let i = policy.minimumSide; i <= sorted.length - policy.minimumSide; i += stride) {
    if (!sorted[i].date || sorted[i].date === sorted[i - 1].date) continue;
    const before = sorted.slice(0, i), after = sorted.slice(i);
    const low = Math.max(Math.min(...before.map(p => p.x)), Math.min(...after.map(p => p.x)));
    const high = Math.min(Math.max(...before.map(p => p.x)), Math.max(...after.map(p => p.x)));
    const left = before.filter(p => p.x >= low && p.x <= high), right = after.filter(p => p.x >= low && p.x <= high);
    if (left.length < policy.minimumOverlap || right.length < policy.minimumOverlap) continue;
    // Match costs rather than treating a spend-range move along one curve as a new regime.
    const ordered = [...left].sort((a, b) => a.x - b.x);
    const deltas = right.flatMap(point => {
      let lo = 0, hi = ordered.length;
      while (lo < hi) { const mid = Math.floor((lo + hi) / 2); if (ordered[mid].x < point.x) lo = mid + 1; else hi = mid; }
      const nearest = [ordered[lo], ordered[lo - 1]].filter(Boolean).sort((a, b) => Math.abs(a.x - point.x) - Math.abs(b.x - point.x))[0];
      if (Math.abs(nearest.x - point.x) > Math.max(point.x, nearest.x) * 0.02) return [];
      const reference = nearest.y;
      return reference > 0 ? [(point.y - reference) / reference] : [];
    });
    if (deltas.length < policy.minimumOverlap) continue;
    const shift = median(deltas), noise = median(deltas.map(value => Math.abs(value - shift)));
    if (Math.abs(shift) < Math.max(policy.minimumRelativeShift, policy.noiseMultiplier * noise)) continue;
    const meanShift = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
    candidates.push({ index: i, start: sorted[i].date, relativeShift: shift, score: Math.abs(meanShift) * Math.sqrt(left.length * deltas.length / (left.length + deltas.length)) });
  }
  const candidate = candidates.sort((a, b) => b.score - a.score)[0] || null;
  return candidate ? { kept: sorted.slice(candidate.index), start: candidate.start, excluded: candidate.index, candidate } : { kept: points, start: "", excluded: 0, candidate: null };
}
