// Qualify the legacy fatigue diagnostic without changing its curve calculation.
export function qualifyCreativeFatigue(fatigue, metrics, minImpressions) {
  const exposure = new Map(metrics.map((row) => [row.creative_id, Number(row.impressions) || 0]));
  return fatigue.map((row) => {
    const qualityStatus = row.reason ? "insufficient_history"
      : (exposure.get(row.creative_id) || 0) < minImpressions ? "insufficient_exposure" : "reviewable";
    return { ...row, qualityStatus, fatigued: qualityStatus === "reviewable" && row.fatigued };
  });
}
