import { expect, it } from "vitest";
import { operationsScatterEvidence, operationContributionLabels } from "./operationsPresentation";
import { ALLOC_MATH } from "@/utils/allocationMath";
it("draws the raw fit only over its own observed range, with separate prior and excluded points", () => {
  const points = [{ date: "2026-09-01", x: 1, y: 3 }, { date: "2026-10-01", x: 2, y: 5 }, { date: "2026-10-02", x: 3, y: 100 }, { date: "2026-10-03", x: 4, y: 1 }];
  const model = { xMin: 2, xMax: 4, kept: [points[1], points[3]], regime: { start: "2026-10-01", kept: points.slice(1) }, model: { type: "Poly2", a: 1, b: -8, c: 17, predict: x => (x - 4) ** 2 + 1 }, poly2Shape: { shape: "u", vertex: 4 } };
  const evidence = operationsScatterEvidence({ trend: points.map(point => ({ date: point.date, cost: point.x, cpr: point.y })) }, model);
  expect(evidence.used).toEqual(model.kept);
  expect(evidence.earlier).toEqual([points[0]]);
  expect(evidence.excluded).toEqual([points[2]]);
  expect(evidence.fitted[0]).toEqual({ x: 2, y: 5 });
  expect(evidence.fitted.at(-1)).toEqual({ x: 4, y: 1 });
  expect(evidence.fitted.every(point => point.x >= 2 && point.x <= 4 && point.y === (point.x - 4) ** 2 + 1)).toBe(true);
  // Budget guardrails must not replace the plotted polynomial.
  expect(evidence.fitted[0].y).not.toBe(ALLOC_MATH.predictSafeCpr(model, 2));
});
it("names the actual denominator in both locales", () => {
  expect(operationContributionLabels("CPI", "ko").share).toBe("소재별 설치 비중 변화");
  expect(operationContributionLabels("CPA", "en").cost).toBe("Change in cost per outcome by creative");
});
