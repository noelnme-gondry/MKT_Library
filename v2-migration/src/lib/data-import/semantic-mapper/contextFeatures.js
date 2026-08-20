export function scoreContextFeatures(profile, canonicalKey, profiles = []) {
  const normalized = profile?.headerFeatures?.normalized || "";
  const hasMediaNeighbour = profiles.some((other) => /impression|click|spend|cost|노출|클릭|비용|광고비/i.test(other.header));
  if (canonicalKey === "media_spend" && hasMediaNeighbour && /spend|cost|expense|비용|광고비|소진/i.test(normalized)) return { score: 0.08, evidence: ["NEAR_MEDIA_METRICS"] };
  if (canonicalKey === "outcome_revenue" && /revenue|sales|매출/i.test(normalized) && hasMediaNeighbour) return { score: 0.06, evidence: ["OUTCOME_WITH_MEDIA_CONTEXT"] };
  return { score: 0, evidence: [] };
}
