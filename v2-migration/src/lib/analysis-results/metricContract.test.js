import { describe, expect, it } from "vitest";
import { buildMetricContract, buildMetricContracts } from "./metricContract";

describe("metricContract", () => {
  it("keeps numerator, denominator, unit and time basis explicit", () => {
    expect(buildMetricContract({
      key: "cpa",
      numerator: "cost",
      denominator: "installs",
      unit: "currency / user",
      aggregation: "ratio",
    })).toMatchObject({
      valid: true,
      key: "cpa",
      numerator: "cost",
      denominator: "installs",
      timeBasis: "calendar",
    });
  });

  it("rejects unknown aggregation and duplicate keys", () => {
    const result = buildMetricContracts([
      { key: "rr", aggregation: "sum" },
      { key: "rr", aggregation: "ratio" },
      { key: "bad", aggregation: "magic" },
    ]);
    expect(result.valid).toBe(false);
    expect(result.duplicateKeys).toEqual(["rr"]);
    expect(result.contracts[2].errors).toContain("invalid_aggregation");
  });
});
