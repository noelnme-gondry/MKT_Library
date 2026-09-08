import { expect, it } from "vitest";
import { qualifyAsaRecommendations } from "./asaRecommendationQuality";
const candidate = { taps: 40, installs: 6, action: { code: "raise", pct: 0.1 }, recommendedCpt: 10, isExactCandidate: true, isNegativeCandidate: false };
it("holds unknown, immature and low-volume actions without fabricating maturity", () => {
  for (const [row, maturity, status] of [[candidate, "unknown", "maturity_unknown"], [candidate, "immature", "immature"], [{ ...candidate, taps: 1 }, "mature", "low_taps"], [{ ...candidate, installs: 0 }, "mature", "low_installs"]]) {
    const [result] = qualifyAsaRecommendations([row], maturity);
    expect(result.qualityStatus).toBe(status);
    expect(result.recommendedCpt).toBeNull();
    expect(result.isExactCandidate).toBe(false);
  }
  expect(qualifyAsaRecommendations([candidate], "mature")[0].action).toEqual(candidate.action);
});
