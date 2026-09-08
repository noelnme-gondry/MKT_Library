import { STATS } from "./abTestMath";

export function sampleRatioMismatch({ nA, nB, plannedShareA, confirmed = false }) {
  if (!confirmed) return { status: "unconfirmed", pValue: null };
  if (![nA, nB].every((n) => Number.isSafeInteger(n) && n >= 0) || !(plannedShareA > 0 && plannedShareA < 1)) return { status: "invalid", pValue: null };
  const total = nA + nB;
  const expectedA = total * plannedShareA;
  const expectedB = total - expectedA;
  if (Math.min(expectedA, expectedB) < 5) return { status: "insufficient", pValue: null };
  const chiSquare = (nA - expectedA) ** 2 / expectedA + (nB - expectedB) ** 2 / expectedB;
  // Two-arm Pearson GOF: chi-square(df=1) = Z². SRM is a diagnostic,
  // not a treatment-effect test. Fixed alarm threshold 0.001 is disclosed.
  const pValue = Math.min(1, Math.max(0, 2 * STATS.normalCDF(-Math.sqrt(chiSquare))));
  return { status: pValue < 0.001 ? "mismatch" : "no_alarm", pValue, chiSquare, expectedA, expectedB, threshold: 0.001 };
}

export function practicalEquivalence({ nA, xA, nB, xB, marginPp, confirmed = false }) {
  if (!confirmed || !(marginPp > 0 && marginPp < 100)) return { status: "unconfirmed" };
  if (![nA, xA, nB, xB].every(Number.isSafeInteger) || Math.min(xA, nA - xA, xB, nB - xB) < 10) return { status: "insufficient" };
  const difference = xB / nB - xA / nA;
  const se = Math.sqrt((xA / nA) * (1 - xA / nA) / nA + (xB / nB) * (1 - xB / nB) / nB);
  // Large-sample two one-sided tests at alpha=.05: the 90% interval
  // must lie wholly inside a margin declared independently of these results.
  const halfWidth = 1.6448536269514722 * se;
  const lowerPp = (difference - halfWidth) * 100;
  const upperPp = (difference + halfWidth) * 100;
  return { status: lowerPp > -marginPp && upperPp < marginPp ? "within_margin" : "not_established", lowerPp, upperPp, marginPp };
}
