import { describe, it, expect } from "vitest";
import { INCR_PREPOST, INCR_PREPOST_CONTRACT } from "./incrPrePostMath";

const dated = (startDay, values) => values.map((value, index) => ({
  date: `2024-01-${String(startDay + index).padStart(2, "0")}`,
  value,
}));

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
    const pre = dated(1, [98, 101, 100, 102, 99, 100]);
    const post = dated(7, [148, 151, 150, 152, 149, 150]);        // treatment +50
    const control = {
      pre: dated(1, [99, 100, 101, 100, 99, 101]),
      post: dated(7, [119, 120, 121, 120, 119, 121]),
    }; // +20 seasonal
    const r = INCR_PREPOST.compute({ pre, post, control });
    expect(r.did).toBeTruthy();
    expect(r.did.ok).toBe(true);
    expect(r.did.ctrlDelta).toBeCloseTo(20, 6);
    expect(r.did.didDelta).toBeCloseTo(30, 6); // 50 − 20
    expect(r.did.sig.ok).toBe(true);
    expect(r.did.sig.pValue).toBeLessThan(0.05);
  });

  it("uses DiD significance rather than a significant common trend", () => {
    const pre = dated(1, [98, 101, 100, 102, 99, 100]);
    const post = dated(7, [118, 121, 120, 122, 119, 120]);
    const control = {
      pre: dated(1, [99, 100, 101, 100, 99, 101]),
      post: dated(7, [119, 120, 121, 120, 119, 121]),
    };
    const r = INCR_PREPOST.compute({ pre, post, control });
    expect(r.sig.pValue).toBeLessThan(0.05);
    expect(r.did.didDelta).toBeCloseTo(0, 6);
    expect(r.did.sig.ok).toBe(true);
    expect(r.did.sig.pValue).toBeGreaterThan(0.05);
  });

  it("pre-aggregates by date, sorts, and matches only common calendar dates", () => {
    const pre = [
      { date: "2024-01-03", value: 30 },
      { date: "2024/1/1", value: 10 },
      { date: "2024-01-01", value: 5 },
      { date: "2024-01-02", value: 999 },
      { date: "2024-01-04", value: 40 },
      { date: "2024-01-05", value: 50 },
      { date: "2024-01-06", value: 60 },
    ];
    const post = [
      { date: "2024-01-08", value: 70 },
      { date: "2024-01-07", value: 20 },
      { date: "2024-01-07", value: 30 },
      { date: "2024-01-09", value: 999 },
    ];
    const control = {
      pre: [
        { date: "2023-12-31", value: 777 },
        { date: "2024-01-01", value: 5 },
        { date: "2024-01-03", value: 20 },
        { date: "2024-01-04", value: 30 },
        { date: "2024-01-05", value: 40 },
        { date: "2024-01-06", value: 50 },
      ],
      post: [
        { date: "2024-01-07", value: 20 },
        { date: "2024-01-08", value: 40 },
      ],
    };
    const r = INCR_PREPOST.compute({ pre, post, control });
    expect(r.did).toMatchObject({
      ok: true,
      pairedPreN: 5,
      pairedPostN: 2,
      commonPreDates: ["2024-01-01", "2024-01-03", "2024-01-04", "2024-01-05", "2024-01-06"],
      commonPostDates: ["2024-01-07", "2024-01-08"],
      unmatchedTreatmentDates: 2,
      unmatchedControlDates: 1,
    });
    expect(r.did.didDelta).toBeCloseTo(20, 6);
    expect(r.did.incrementalTotal).toBeCloseTo(40, 6);
  });

  it("blocks a significant linear pretrend that would masquerade as a DiD effect", () => {
    const controlPre = dated(1, Array(10).fill(100));
    const controlPost = dated(11, Array(10).fill(100));
    const treatmentPre = dated(1, Array.from({ length: 10 }, (_, i) => 100 + i * 10));
    const treatmentPost = dated(11, Array.from({ length: 10 }, (_, i) => 200 + i * 10));
    const r = INCR_PREPOST.compute({
      pre: treatmentPre,
      post: treatmentPost,
      control: { pre: controlPre, post: controlPost },
    });
    expect(r.did).toMatchObject({
      ok: false,
      status: "NOT_IDENTIFIED",
      reason: "pretrend_violation",
      pretrend: { status: "FAIL", n: 10, slopePerDay: 10, pValue: 0 },
    });
    expect(r.did.didDelta).toBeUndefined();
  });

  it("uses actual calendar-day spacing for the pretrend slope", () => {
    const dates = ["2024-01-01", "2024-01-02", "2024-01-04", "2024-01-07", "2024-01-11"];
    const gaps = [0, 1, 3, 6, 10];
    const pre = dates.map((date, i) => ({ date, value: 100 + gaps[i] }));
    const controlPre = dates.map((date) => ({ date, value: 100 }));
    const r = INCR_PREPOST.compute({
      pre,
      post: dated(12, [112, 113]),
      control: { pre: controlPre, post: dated(12, [100, 100]) },
    });
    expect(r.did.pretrend.slopePerDay).toBeCloseTo(1, 12);
    expect(r.did).toMatchObject({ ok: false, status: "NOT_IDENTIFIED", reason: "pretrend_violation" });
  });

  it("requires five common pre-period dates before attempting a pretrend check", () => {
    const r = INCR_PREPOST.compute({
      pre: dated(1, [110, 110, 110, 110]),
      post: dated(5, [130, 130]),
      control: { pre: dated(1, [100, 100, 100, 100]), post: dated(5, [100, 100]) },
    });
    expect(INCR_PREPOST_CONTRACT.minPretrendDates).toBe(5);
    expect(r.did).toMatchObject({
      ok: false,
      status: "NOT_IDENTIFIED",
      reason: "insufficient_pretrend_dates",
      pretrend: { status: "INSUFFICIENT_DATA", n: 4, minRequired: 5 },
    });
  });

  it("refuses implicit index pairing when DiD series have no dates", () => {
    const r = INCR_PREPOST.compute({
      pre: [10, 20],
      post: [30, 40],
      control: { pre: [5, 10], post: [15, 20] },
    });
    expect(r.did).toMatchObject({ ok: false, reason: "dated_series_required" });
  });

  it("marks DiD unidentifiable when either period has no common dates", () => {
    const r = INCR_PREPOST.compute({
      pre: [{ date: "2024-01-01", value: 10 }],
      post: [{ date: "2024-01-03", value: 20 }],
      control: {
        pre: [{ date: "2024-01-02", value: 9 }],
        post: [{ date: "2024-01-03", value: 19 }],
      },
    });
    expect(r.did).toMatchObject({ ok: false, reason: "no_common_dates", pairedPreN: 0, pairedPostN: 1 });
  });

  it("refuses a dated series containing an invalid observation instead of partially skipping it", () => {
    const r = INCR_PREPOST.compute({
      pre: [{ date: "2024-01-01", value: 10 }, { date: "2024-02-30", value: 12 }],
      post: [{ date: "2024-01-02", value: 20 }],
    });
    expect(r).toBeNull();
  });

  it("returns null on empty", () => {
    expect(INCR_PREPOST.compute({ pre: [], post: [1] })).toBe(null);
  });
});
