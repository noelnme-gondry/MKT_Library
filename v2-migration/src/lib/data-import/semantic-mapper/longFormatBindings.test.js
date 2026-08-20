import { describe, expect, it } from "vitest";
import { detectLongFormatBindings } from "./longFormatBindings";

describe("long-format value bindings", () => {
  it("maps metric/value recipes without treating the value column as one role", () => {
    const recipes = detectLongFormatBindings({
      headers: ["channel", "metric", "value"], representation: "long",
      rows: [{ channel: "Meta", metric: "spend", value: "100" }, { channel: "Meta", metric: "installs", value: "3" }],
    });
    expect(recipes).toEqual(expect.arrayContaining([
      expect.objectContaining({ metricColumn: "metric", valueColumn: "value", when: { equals: "spend" }, canonicalKey: "media_spend" }),
      expect.objectContaining({ when: { equals: "installs" }, canonicalKey: "outcome_installs" }),
    ]));
  });
});
