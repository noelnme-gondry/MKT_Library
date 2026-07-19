import { describe, expect, it } from "vitest";
import { buildPvmQuickSummary } from "./pvmQuickSummary";

describe("buildPvmQuickSummary", () => {
  it("stays unavailable instead of inferring a cause without PVM contract fields", () => {
    expect(buildPvmQuickSummary({ csvData: { raw: [], mapping: { Date: "date" } } })).toEqual({ available: false });
  });
});
