import { describe, it, expect } from "vitest";
import { survivalFollowup, followupTable } from "./survivalFollowup";

describe("observed follow-up support", () => {
  it("separates early events from immature censoring and delayed entry", () => {
    const result = survivalFollowup([
      { entry: 0, time: 1, event: 1 },
      { entry: 0, time: 1, event: 0 },
      { entry: 0, time: 3, event: 1 },
      { entry: 0, time: 4, event: 0 },
      { entry: 4, time: 5, event: 0 },
    ], 3);
    expect(result).toEqual({ horizon: 3, total: 5, earlyExit: 1, earlyCensored: 1, observedToHorizon: 2, notEntered: 1 });
    expect(followupTable(result).rows[1]).toEqual(["all", 3, 5, 2, 1, 1, 1]);
  });
  it("does not invent zero support for unavailable inputs", () => {
    expect(survivalFollowup(null, 3)).toBeNull();
    expect(survivalFollowup([{ time: 2, event: 0 }], 3)).toBeNull();
  });
});
