import { describe, it, expect } from 'vitest';
import { mmmResponseDomain } from './mmmResponsePresentation';
describe('MMM chart observed domain', () => {
  it('excludes unobserved low spend and the transformed upper extrapolation; retains the exact current marker', () => {
    const result = mmmResponseDomain({ coverage: { observedMin: 100, observedMax: 900 }, observedSustainableSpendMax: 700, recentMean: 333 });
    expect(result.min).toBe(100); expect(result.max).toBe(700); expect(result.grid).toContain(333);
    expect(result.grid.every(x => x >= 100 && x <= 700)).toBe(true);
  });
  it('does not invent coverage or move an out-of-range current point onto the curve', () => {
    expect(mmmResponseDomain({})).toBeNull();
    expect(mmmResponseDomain({ coverage: { observedMin: 800, observedMax: 900 }, observedSustainableSpendMax: 700 })).toBeNull();
    expect(mmmResponseDomain({ coverage: { observedMin: 100, observedMax: 900 }, observedSustainableSpendMax: 700, recentMean: 950 }).currentInRange).toBe(false);
  });
});
