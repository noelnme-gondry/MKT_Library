import { describe, expect, it } from "vitest";
import { buildCreativeQuickSummary } from "./creativeQuickSummary";

describe("buildCreativeQuickSummary", () => {
  it("does not claim fatigue when the required creative fields are missing", () => {
    expect(buildCreativeQuickSummary({ raw: [], mapping: { Date: "date" } })).toMatchObject({ available: false });
  });
});
