import { ASA_RULES } from "./asaKeywordMath";

// Daily totals cannot recover a conversion-delay distribution. Maturity is an
// explicit report-level declaration; no dates or conversions are fabricated.
export function qualifyAsaRecommendations(rows, maturity = "unknown") {
  return rows.map((row) => {
    const qualityStatus = maturity !== "mature" ? (maturity === "immature" ? "immature" : "maturity_unknown")
      : row.taps < ASA_RULES.minExactTaps ? "low_taps"
        : row.installs < ASA_RULES.minExactInstalls ? "low_installs" : "reviewable";
    return qualityStatus === "reviewable" ? { ...row, qualityStatus } : {
      ...row, qualityStatus, action: { code: "quality_held", pct: 0 }, recommendedCpt: null,
      isExactCandidate: false, isNegativeCandidate: false,
    };
  });
}
