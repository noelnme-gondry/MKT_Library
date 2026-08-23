import { describe, expect, it } from "vitest";

import { buildCreativePredictiveInput, creativeShapleyR2 } from "./creativePredictiveModel";

function creativeRows(count = 320) {
  return Array.from({ length: count }, (_, index) => {
    const angle = ["benefit", "proof", "story", "feature"][index % 4];
    const format = ["video", "static", "ugc"][index % 3];
    const channel = ["Meta", "TikTok", "Google"][(index * 5 + Math.floor(index / 7)) % 3];
    const durationSeconds = 6 + (index % 24);
    const textLength = 8 + ((index * 7) % 45);
    const impressions = 10_000 + index * 17;
    const ctr = 0.012
      + (angle === "proof" ? 0.008 : 0)
      + (format === "ugc" ? 0.004 : 0)
      + durationSeconds * 0.00003
      + (index % 7) * 0.00001;
    return {
      creative_id: `creative-${index}`,
      channel,
      message_angle: angle,
      format,
      duration_seconds: durationSeconds,
      text_length: textLength,
      impressions,
      clicks: Math.round(impressions * ctr),
      ctr,
    };
  });
}

describe("creative predictive model input", () => {
  it("builds one numeric matrix from independent creative rows and preserves feature diversity", () => {
    const result = buildCreativePredictiveInput({
      metrics: creativeRows(),
      attributes: ["message_angle", "format"],
      numericFeatures: ["duration_seconds", "text_length"],
      metric: "ctr",
    });
    expect(result.ok).toBe(true);
    expect(result.n).toBe(320);
    expect(result.numericFeatureCount).toBe(2);
    expect(result.attributeCount).toBe(2);
    expect(result.X).toHaveLength(result.y.length);
    expect(result.X[0]).toHaveLength(result.terms.length);
  });

  it("withholds a design when the target does not vary", () => {
    const result = buildCreativePredictiveInput({
      metrics: creativeRows(20).map((row) => ({ ...row, ctr: 0.02 })),
      attributes: ["message_angle"],
      metric: "ctr",
    });
    expect(result).toMatchObject({ ok: false, reason: "constant_or_missing_outcome" });
  });
});

describe("creative Shapley R2", () => {
  it("allocates the channel-controlled incremental R2 across attribute groups", () => {
    const result = creativeShapleyR2({ metrics: creativeRows(180), attributes: ["message_angle", "format"], metric: "ctr" });
    expect(result.status).toBe("complete");
    expect(result.rows.map((row) => row.attribute).sort()).toEqual(["format", "message_angle"]);
    const allocated = result.rows.reduce((sum, row) => sum + row.contribution, 0);
    expect(allocated).toBeCloseTo(result.incrementalR2, 10);
    expect(result.rows.find((row) => row.attribute === "message_angle").contribution).toBeGreaterThan(0);
  });
});
