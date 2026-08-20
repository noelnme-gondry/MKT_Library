import { describe, expect, it } from "vitest";
import { buildLegacyRows } from "./buildLegacyRows";

describe("V2 compatibility adapter", () => {
  it("preserves the existing legacy engine shape including cost/spend compatibility", () => {
    expect(buildLegacyRows({ raw: [{ Cost: "1,000", Installs: "2" }], legacyMapping: { Cost: "cost", Installs: "installs" } }))
      .toEqual([{ cost: "1000", installs: "2", spend: "1000" }]);
  });
});
