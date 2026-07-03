import { describe, it, expect } from "vitest";
import { INCR_PREPOST } from "./incrPrePostMath";

describe("INCR_PREPOST", () => {
  it("turn-on: post > pre → positive delta & incremental", () => {
    const pre = [100, 110, 90, 105, 95];
    const post = [150, 160, 140, 155, 145];
    const r = INCR_PREPOST.compute({ pre, post, direction: "on" });
    expect(r.preMean).toBeCloseTo(100, 6);
    expect(r.postMean).toBeCloseTo(150, 6);
    expect(r.delta).toBeCloseTo(50, 6);
    expect(r.incrementalTotal).toBeCloseTo(250, 6); // (150-100)*5
    expect(r.sig).toBeTruthy();
  });

  it("turn-off: post < pre → negative delta (loss)", () => {
    const pre = [200, 210, 190, 205, 195];
    const post = [120, 130, 110, 125, 115];
    const r = INCR_PREPOST.compute({ pre, post, direction: "off" });
    expect(r.delta).toBeLessThan(0);
    expect(r.incrementalTotal).toBeLessThan(0); // lost volume
  });

  it("DiD subtracts control's own change", () => {
    const pre = [100, 100, 100];
    const post = [150, 150, 150];        // treatment +50
    const control = { pre: [100, 100, 100], post: [120, 120, 120] }; // +20 seasonal
    const r = INCR_PREPOST.compute({ pre, post, control });
    expect(r.did).toBeTruthy();
    expect(r.did.ctrlDelta).toBeCloseTo(20, 6);
    expect(r.did.didDelta).toBeCloseTo(30, 6); // 50 − 20
  });

  it("returns null on empty", () => {
    expect(INCR_PREPOST.compute({ pre: [], post: [1] })).toBe(null);
  });
});
