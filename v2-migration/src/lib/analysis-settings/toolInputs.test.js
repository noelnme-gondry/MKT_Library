import { expect, it } from "vitest";
import { cleanToolInputs, sameInputShape } from "./toolInputs";
it("accepts configured model inputs but never results or approval state", () => {
  expect(cleanToolInputs("5-3", { budget: "120000", trendType: "linear", verifiedSig: "done", groupVerification: { x: "verified" }, result: {} })).toEqual({ budget: "120000", trendType: "linear" });
  expect(cleanToolInputs("5-3", { budget: Infinity })).toEqual({});
  expect(cleanToolInputs("unknown", { budget: "10" })).toEqual({});
  expect(sameInputShape({}, 2)).toBe(false);
});
