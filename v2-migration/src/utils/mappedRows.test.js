import { describe, expect, it } from "vitest";
import { mapRowsToStandard } from "./mappedRows";

describe("mapRowsToStandard", () => {
  it("projects mapped fields and keeps cost/spend aliases", () => {
    expect(mapRowsToStandard([{ Amount: "10", Users: "2", Ignore: "x" }], {
      Amount: "cost",
      Users: "installs",
      Ignore: "__ignore__",
    })).toEqual([{ cost: "10", installs: "2", spend: "10" }]);
  });
});
