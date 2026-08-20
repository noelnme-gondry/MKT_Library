import { describe, expect, it } from "vitest";
import { buildComparisonManifest, buildResultManifest, serializeResultManifest } from "./resultManifest";

describe("resultManifest", () => {
  it("keeps reproducibility metadata explicit and deterministic by default", () => {
    const input = { toolId: "5-2", mode: "classic", inputSignature: "abc", metricDefinitions: [{ key: "cost", unit: "currency" }] };
    expect(buildResultManifest(input)).toEqual(buildResultManifest(input));
    expect(buildResultManifest(input)).toMatchObject({ toolId: "5-2", mode: "classic", generatedAt: null, seed: null });
  });

  it("serializes with a trailing newline for text downloads", () => {
    expect(serializeResultManifest({ toolId: "5-2" })).toBe('{\n  "toolId": "5-2"\n}\n');
  });

  it("keeps method/design provenance without leaking raw input data", () => {
    const manifest = buildResultManifest({
      analysis: {
        methodId: "welch_t_test",
        methodStatus: "READY",
        design: "independent",
        estimand: "mean_difference",
        outcome: { key: "outcome_revenue", kind: "continuous", unit: "KRW", sampleValues: [100, 200] },
        validN: 42,
        exclusionCount: 3,
        multiplicity: "holm",
        engine: { name: "js", version: "analysis-router-1", packages: ["none", 7] },
        rawRows: [{ customer: "must-not-persist" }],
      },
    });
    expect(manifest.analysis).toEqual({
      methodId: "welch_t_test",
      methodStatus: "READY",
      design: "independent",
      estimand: "mean_difference",
      outcome: { key: "outcome_revenue", kind: "continuous", unit: "KRW" },
      validN: 42,
      exclusionCount: 3,
      multiplicity: "holm",
      engine: { name: "js", version: "analysis-router-1", packages: ["none"] },
    });
    expect(JSON.stringify(manifest)).not.toContain("must-not-persist");
  });

  it("only marks runs comparable when metric, filter, and grain match", () => {
    const base = buildResultManifest({ toolId: "5-22", metricDefinitions: [{ key: "cpa", unit: "currency / result" }], filter: { days: 90 }, grain: "channel" });
    expect(buildComparisonManifest([base, { ...base, mode: "bayesian" }]).comparable).toBe(true);
    expect(buildComparisonManifest([base, { ...base, grain: "campaign" }])).toMatchObject({ comparable: false, reason: "metric, filter, or grain mismatch" });
  });
});
