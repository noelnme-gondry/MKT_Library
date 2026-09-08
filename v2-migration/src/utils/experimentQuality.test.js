import { expect, it } from "vitest";
import { practicalEquivalence, sampleRatioMismatch } from "./experimentQuality";

it("checks declared 80/20 allocation, never assuming equal splits", () => {
  expect(sampleRatioMismatch({ nA: 800, nB: 200, plannedShareA: 0.8, confirmed: true }).pValue).toBeCloseTo(1, 6);
  const result = sampleRatioMismatch({ nA: 600, nB: 400, plannedShareA: 0.5, confirmed: true });
  expect(result.chiSquare).toBe(40); // (100²/500)*2, independent hand calculation.
  expect(result.status).toBe("mismatch");
  expect(result.pValue).toBeLessThan(1e-8);
});
it("abstains for undeclared, fractional or tiny samples", () => {
  expect(sampleRatioMismatch({ nA: 10, nB: 10, plannedShareA: 0.5 }).status).toBe("unconfirmed");
  expect(sampleRatioMismatch({ nA: 10.5, nB: 10, plannedShareA: 0.5, confirmed: true }).status).toBe("invalid");
  expect(sampleRatioMismatch({ nA: 2, nB: 2, plannedShareA: 0.5, confirmed: true }).status).toBe("insufficient");
});
it("requires the whole interval inside a prespecified practical margin", () => {
  const input = { nA: 10000, nB: 10000, xA: 5000, xB: 5000, confirmed: true };
  expect(practicalEquivalence({ ...input, marginPp: 2 }).status).toBe("within_margin");
  expect(practicalEquivalence({ ...input, marginPp: 1 }).status).toBe("not_established");
  expect(practicalEquivalence({ ...input, xA: 0, marginPp: 2 }).status).toBe("insufficient");
});
