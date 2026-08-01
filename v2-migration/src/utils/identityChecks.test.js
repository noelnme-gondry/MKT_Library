import { describe, expect, it } from "vitest";
import { checkAdditiveIdentity, checkRollupIdentity } from "./identityChecks";

describe("identityChecks", () => {
  it("checks additive decomposition without rounding", () => {
    expect(checkAdditiveIdentity(10, [4, 6]).ok).toBe(true);
    expect(checkAdditiveIdentity(10, [4, 5]).ok).toBe(false);
  });

  it("checks every rollup row", () => {
    expect(checkRollupIdentity([{ total: 3, a: 1, b: 2 }, { total: 4, a: 1, b: 1 }], "total", ["a", "b"]).map((row) => row.ok)).toEqual([true, false]);
  });

  it("fails closed for NaN/Infinity totals, parts, and overflowed sums", () => {
    expect(checkAdditiveIdentity(Infinity, [1, 2])).toMatchObject({ ok: false, reason: "NON_FINITE_INPUT" });
    expect(checkAdditiveIdentity(NaN, [0])).toMatchObject({ ok: false, reason: "NON_FINITE_INPUT" });
    expect(checkAdditiveIdentity(3, [1, Infinity])).toMatchObject({ ok: false, reason: "NON_FINITE_INPUT" });
    expect(checkAdditiveIdentity(3, [1, 2], Infinity)).toMatchObject({ ok: false, reason: "NON_FINITE_INPUT" });
    expect(checkAdditiveIdentity(Number.MAX_VALUE, [Number.MAX_VALUE, Number.MAX_VALUE])).toMatchObject({ ok: false, reason: "NON_FINITE_SUM" });
    expect(checkAdditiveIdentity(Number.MAX_VALUE, [-Number.MAX_VALUE])).toMatchObject({ ok: false, reason: "NON_FINITE_COMPUTATION" });
  });
});
