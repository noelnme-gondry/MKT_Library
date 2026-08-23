import { describe, expect, it } from "vitest";
import {
  discreteHazard,
  kaplanMeier,
  logRankTest,
  medianSurvival,
  normalizeDateSurvivalRows,
  normalizeSurvivalRows,
  restrictedMeanSurvival,
  survivalBasedLtv,
  survivalEvidence,
  observedHorizonUnitEconomics,
  parseSubscriptionUtcDate,
  subscriptionDatePeriods,
} from "./subscriptionSurvivalMath";

describe("subscription survival input normalization", () => {
  it("keeps invalid periods and event codes out of the analysis with reasons", () => {
    const normalized = normalizeSurvivalRows([
      { tenure_periods: "3", event_observed: "1" },
      { tenure_periods: "-1", event_observed: "0" },
      { tenure_periods: "2", event_observed: "yes" },
      { tenure_periods: "2", event_observed: "0", entry_period: "3" },
    ]);
    expect(normalized.validRows).toHaveLength(1);
    expect(normalized.eventCount).toBe(1);
    expect(normalized.exclusionsByReason).toEqual({
      invalid_tenure: 1,
      invalid_event_observed: 1,
      invalid_entry_period: 1,
    });
  });

  it("derives UTC date-mode tenure and excludes missing, invalid, and contradictory dates", () => {
    const normalized = normalizeDateSurvivalRows([
      { subscription_start_date: "2026-01-31", churn_date: "2026-02-28" },
      { subscription_start_date: "2026-01-01", observation_end_date: "2026-03-01" },
      { subscription_start_date: "2026-02-30", observation_end_date: "2026-03-01" },
      { subscription_start_date: "2026-01-01" },
      { subscription_start_date: "2026-03-01", churn_date: "2026-02-28" },
    ], { timeUnit: "month", observationEndDate: "2026-03-31" });
    expect(normalized.validRows.slice(0, 2)).toMatchObject([
      { time: 1, event: 1 },
      { time: 2, event: 0 },
    ]);
    expect(normalized.exclusionsByReason).toEqual({
      invalid_subscription_start_date: 1,
      end_before_subscription_start: 1,
    });
    // The globally declared observation end fills the otherwise missing end.
    expect(normalized.validRows).toHaveLength(3);
    expect(normalized.validRows[2]).toMatchObject({ time: 3, event: 0 });
  });

  it("uses UTC calendar components and never turns an invalid date into a duration", () => {
    expect(parseSubscriptionUtcDate("2026-08-12T23:30:00-07:00")).toBe(Date.UTC(2026, 7, 12));
    expect(parseSubscriptionUtcDate("2026-13-01")).toBeNull();
    expect(subscriptionDatePeriods("2026-01-01", "2026-01-08", "week")).toBe(1);
    expect(subscriptionDatePeriods("2026-03-01", "2026-04-01", "month")).toBe(1);
    expect(subscriptionDatePeriods("2026-01-31", "2026-02-28", "month")).toBe(1);
    expect(subscriptionDatePeriods("2026-01-31", "2026-03-01", "month")).toBe(2);
    expect(subscriptionDatePeriods("2026-01-02", "2026-01-01", "day")).toBeNull();
  });

  it("does not accept a churn date observed after the declared cutoff", () => {
    const normalized = normalizeDateSurvivalRows([
      { subscription_start_date: "2026-01-01", churn_date: "2026-03-02" },
    ], { observationEndDate: "2026-03-01" });
    expect(normalized.validRows).toHaveLength(0);
    expect(normalized.exclusionsByReason).toEqual({ churn_after_observation_end_date: 1 });
  });

  it("keeps a date-mode row without an end date out instead of censoring it at zero", () => {
    const normalized = normalizeDateSurvivalRows([
      { subscription_start_date: "2026-01-01" },
    ]);
    expect(normalized.validRows).toHaveLength(0);
    expect(normalized.exclusionsByReason).toEqual({ missing_observation_end_date: 1 });
  });
});

describe("Kaplan–Meier and discrete hazard", () => {
  it("applies an event before a censoring record tied at the same time", () => {
    const table = kaplanMeier([
      { time: 1, event: 1, entry: 0 },
      { time: 1, event: 0, entry: 0 },
      { time: 2, event: 1, entry: 0 },
    ]);
    expect(table[0]).toMatchObject({ time: 1, atRisk: 3, events: 1, censored: 1 });
    expect(table[0].survival).toBeCloseTo(2 / 3, 12);
    expect(table[1]).toMatchObject({ time: 2, atRisk: 1, events: 1, censored: 0, survival: 0, ciLow: 0, ciHigh: 0 });
    expect(discreteHazard(table).rows.map((row) => row.hazard)).toEqual([1 / 3, 1]);
  });

  it("changes the risk set when an episode enters after observation begins", () => {
    const table = kaplanMeier([
      { time: 2, event: 1, entry: 0 },
      { time: 3, event: 0, entry: 2 },
    ]);
    expect(table[0]).toMatchObject({ time: 2, atRisk: 2, events: 1, survival: 0.5 });
    expect(table[1]).toMatchObject({ time: 3, atRisk: 1, censored: 1, survival: 0.5 });
  });

  it("does not invent a median survival time when the curve remains above 50%", () => {
    const table = kaplanMeier([
      { time: 2, event: 1, entry: 0 },
      { time: 3, event: 0, entry: 0 },
      { time: 4, event: 0, entry: 0 },
    ]);
    expect(medianSurvival(table)).toBeNull();
  });
});

describe("observed-horizon value", () => {
  const table = kaplanMeier([
    { time: 1, event: 1, entry: 0 },
    { time: 3, event: 0, entry: 0 },
  ]);

  it("integrates the step survival curve only through the requested observed horizon", () => {
    expect(restrictedMeanSurvival(table, 3)).toBeCloseTo(2, 12);
    expect(restrictedMeanSurvival(table, 4)).toBeNull();
  });

  it("calculates LTV from observed survival and never extrapolates", () => {
    expect(survivalBasedLtv({ survival: table, arpu: 100, margin: 0.5, horizon: 3 })).toBeCloseTo(100, 12);
    expect(survivalBasedLtv({ survival: table, arpu: 100, margin: 0.5, horizon: 4 })).toBeNull();
  });

  it("uses only complete CAC coverage and never calls an unreached payback zero", () => {
    const economics = observedHorizonUnitEconomics({ survival: table, arpu: 100, margin: 0.5, horizon: 3, cac: 75 });
    expect(economics).toMatchObject({ status: "available", ltv: 100, cac: 75, paybackPeriod: 2 });
    expect(economics.ltvCac).toBeCloseTo(100 / 75, 12);
    expect(observedHorizonUnitEconomics({ survival: table, arpu: 100, margin: 0.5, horizon: 3, cac: 101 })).toMatchObject({
      status: "not_reached",
      reason: "payback_not_reached",
      paybackPeriod: null,
    });
    expect(observedHorizonUnitEconomics({ survival: table, arpu: 100, margin: 0.5, horizon: 3, cac: 0 })).toMatchObject({
      status: "unavailable",
      reason: "zero_cac",
      ltvCac: null,
      paybackPeriod: null,
    });
    expect(observedHorizonUnitEconomics({ survival: table, arpu: 100, margin: 0.5, horizon: 3 })).toMatchObject({
      status: "unavailable",
      reason: "cac_unavailable",
      ltvCac: null,
      paybackPeriod: null,
    });
  });
});

describe("log-rank and evidence guards", () => {
  it("matches a hand-calculated two-group log-rank score", () => {
    const result = logRankTest([
      { name: "A", rows: [{ time: 1, event: 1, entry: 0 }, { time: 2, event: 1, entry: 0 }, { time: 3, event: 0, entry: 0 }] },
      { name: "B", rows: [{ time: 1, event: 0, entry: 0 }, { time: 2, event: 0, entry: 0 }, { time: 3, event: 1, entry: 0 }] },
    ]);
    // O-E for A = 0.5; Var(O-E) = 0.75, so chi-square = 1/3.
    expect(result.ok).toBe(true);
    expect(result.df).toBe(1);
    expect(result.chiSquare).toBeCloseTo(1 / 3, 12);
    expect(result.pValue).toBeCloseTo(0.5637028616507731, 12);
  });

  it("withholds a difference test when a comparison group has no events", () => {
    expect(logRankTest([
      { name: "event", rows: [{ time: 1, event: 1, entry: 0 }] },
      { name: "censored", rows: [{ time: 2, event: 0, entry: 0 }] },
    ])).toMatchObject({ ok: false, reason: "group_without_events" });
  });

  it("keeps an event-free dataset in an abstain state rather than calling it healthy", () => {
    const normalized = normalizeSurvivalRows([
      { tenure_periods: 2, event_observed: 0 },
      { tenure_periods: 3, event_observed: 0 },
    ]);
    expect(survivalEvidence({ normalized, kmTable: kaplanMeier(normalized.validRows), horizon: 2 })).toEqual({
      status: "ABSTAIN",
      reason: "no_observed_events",
    });
  });

  it("marks an all-event sample as directional because censoring information is absent", () => {
    const normalized = normalizeSurvivalRows(Array.from({ length: 10 }, (_, index) => ({
      tenure_periods: index + 1,
      event_observed: 1,
    })));
    const table = kaplanMeier(normalized.validRows);
    expect(survivalEvidence({ normalized, kmTable: table, horizon: 5 })).toMatchObject({
      status: "CAUTION",
      reason: "no_censored_rows",
    });
  });
});
