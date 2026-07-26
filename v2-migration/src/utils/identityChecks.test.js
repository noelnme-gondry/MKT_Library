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
});
