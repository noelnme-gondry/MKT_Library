import { describe, expect, it } from "vitest";
import { buildResultManifest, serializeResultManifest } from "./resultManifest";

describe("resultManifest", () => {
  it("keeps reproducibility metadata explicit and deterministic by default", () => {
    const input = { toolId: "5-2", mode: "classic", inputSignature: "abc", metricDefinitions: [{ key: "cost", unit: "currency" }] };
    expect(buildResultManifest(input)).toEqual(buildResultManifest(input));
    expect(buildResultManifest(input)).toMatchObject({ toolId: "5-2", mode: "classic", generatedAt: null, seed: null });
  });

  it("serializes with a trailing newline for text downloads", () => {
    expect(serializeResultManifest({ toolId: "5-2" })).toBe('{\n  "toolId": "5-2"\n}\n');
  });
});
