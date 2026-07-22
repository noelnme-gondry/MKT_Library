import { describe, expect, it } from "vitest";
import {
  MMM_COUNTRY_PRIOR_LIMITS,
  buildCountryCombinations,
  buildCountryTransferPrior,
  mmmCountryRowsAsOfFold,
  planCountryReferenceFits,
  rescaleCountryPriorToTarget,
  selectCountryPriorCandidate,
} from "./mmmCountryPrior";

const channelPrior = (mean, variance = 100) => ({
  media_meta: { mean, variance, precision: 1 / variance },
});

describe("MMM country-prior safeguards", () => {
  it("caps expensive reference fits and exposes skip-transform fit options", () => {
    const rows = Array.from({ length: 20 }, (_, countryIndex) => Array.from({ length: 30 }, (_, week) => ({
      country: `C${String(countryIndex).padStart(2, "0")}`,
      week: `2025-W${String(week + 1).padStart(2, "0")}`,
    }))).flat();
    rows.push(...Array.from({ length: 10 }, (_, week) => ({ country: "SHORT", week: `2025-W${String(week + 1).padStart(2, "0")}` })));
    const plan = planCountryReferenceFits(rows, {
      countryHeader: "country",
      timeHeader: "week",
      targetTimes: Array.from({ length: 30 }, (_, week) => `2025-W${String(week + 1).padStart(2, "0")}`),
    });
    expect(plan.totalCountries).toBe(21);
    expect(plan.countries).toHaveLength(MMM_COUNTRY_PRIOR_LIMITS.maxReferenceFits);
    expect(plan.capped).toBe(true);
    expect(plan.ineligibleCountries).toEqual([expect.objectContaining({ country: "SHORT", rowCount: 10, validPeriodCount: 10, reason: "minimum-rows", minimumRows: 24 })]);
    expect(plan.omittedCountryDetails).toHaveLength(8);
    expect(plan.fitOptions).toEqual({ skipTransformUncertainty: true });
  });

  it("merges case and whitespace variants of the same reference market", () => {
    const rows = [
      { country: " US ", week: "2025-W01" },
      { country: "us", week: "2025-W02" },
      { country: "Us", week: "2025-W03" },
      { country: "JP", week: "2025-W01" },
    ];
    const plan = planCountryReferenceFits(rows, { countryHeader: "country", timeHeader: "week", minRows: 1 });
    expect(plan.totalCountries).toBe(2);
    const us = plan.countries.find((item) => item.country === "US");
    expect(us?.rows).toHaveLength(3);
  });

  it("requires 24 distinct weekly periods rather than 24 daily rows", () => {
    const rows = Array.from({ length: 28 }, (_, day) => ({
      country: "DAILY",
      date: new Date(Date.UTC(2025, 0, 6 + day)).toISOString().slice(0, 10),
    }));
    const plan = planCountryReferenceFits(rows, { countryHeader: "country", timeHeader: "date" });
    expect(plan.countries).toHaveLength(0);
    expect(plan.ineligibleCountries[0]).toMatchObject({ country: "DAILY", rowCount: 28, validPeriodCount: 4, minimumRows: 24 });
  });

  it("removes reference evidence after each target fold cutoff", () => {
    const rows = [
      { week: "2025-W01", value: 1 },
      { week: "2025-W10", value: 2 },
      { week: "2025-W20", value: 3 },
    ];
    const result = mmmCountryRowsAsOfFold(rows, {
      timeHeader: "week",
      targetTimes: ["2025-W01", "2025-W10", "2025-W15"],
      cut: 3,
    });
    expect(result.isStrictHistorical).toBe(true);
    expect(result.rows.map((row) => row.value)).toEqual([1, 2]);
    expect(result.excludedFutureRows).toBe(1);
  });

  it("includes all daily reference rows in the target cutoff week but nothing later", () => {
    const rows = [
      { date: "2025-01-06", value: 1 },
      { date: "2025-01-12", value: 2 },
      { date: "2025-01-13", value: 3 },
    ];
    const result = mmmCountryRowsAsOfFold(rows, { timeHeader: "date", targetTimes: ["2025-01-06"], cut: 1 });
    expect(result.rows.map((row) => row.value)).toEqual([1, 2]);
    expect(result.excludedFutureRows).toBe(1);
  });

  it("aligns Excel serial reference dates with the target calendar clock", () => {
    const rows = [
      { date: 45658, value: 1 },
      { date: 45664, value: 2 },
      { date: 45670, value: 3 },
    ];
    const result = mmmCountryRowsAsOfFold(rows, { timeHeader: "date", targetTimes: ["2025-01-06"], cut: 1 });
    expect(result.isStrictHistorical).toBe(true);
    expect(result.rows.map((row) => row.value)).toEqual([1, 2]);
    expect(result.excludedFutureRows).toBe(1);
    expect(result.unparseableRows).toBe(0);
  });

  it("keeps a fractional Sunday Excel serial in its calendar week", () => {
    const rows = [
      { date: 45662.75, value: "Sunday evening" },
      { date: 45663.25, value: "Monday morning" },
    ];
    const result = mmmCountryRowsAsOfFold(rows, { timeHeader: "date", targetTimes: ["2024-12-30"], cut: 1 });
    expect(result.isStrictHistorical).toBe(true);
    expect(result.rows.map((row) => row.value)).toEqual(["Sunday evening"]);
    expect(result.excludedFutureRows).toBe(1);
  });

  it("labels incompatible timelines retrospective instead of claiming strict validation", () => {
    const rows = [{ week: "not-a-date", value: 1 }];
    const result = mmmCountryRowsAsOfFold(rows, {
      timeHeader: "week",
      targetTimes: ["2025-W01"],
      cut: 1,
    });
    expect(result.isStrictHistorical).toBe(false);
    expect(result.validationMode).toBe("retrospective");
    expect(result.rows).toEqual(rows);
  });

  it("rescales country coefficients and uncertainty to the target KPI scale", () => {
    const scaled = rescaleCountryPriorToTarget(channelPrior(40, 25), 1000, 2500);
    expect(scaled.media_meta.mean).toBe(100);
    expect(scaled.media_meta.variance).toBe(156.25);
    expect(scaled.media_meta.precision).toBeCloseTo(1 / 156.25, 12);
  });

  it("uses between-country tau² and a precision floor for a new-market prior", () => {
    const single = buildCountryTransferPrior([{ country: "A", prior: channelPrior(100, 1) }]);
    expect(single.prior.media_meta.variance).toBeGreaterThanOrEqual(2500);
    expect(single.prior.media_meta.transferRelativeSdFloor).toBe(0.5);

    const heterogeneous = buildCountryTransferPrior([
      { country: "A", prior: channelPrior(20, 4) },
      { country: "B", prior: channelPrior(60, 4) },
      { country: "C", prior: channelPrior(100, 4) },
    ]);
    expect(heterogeneous.prior.media_meta.tau2).toBeGreaterThan(0);
    expect(heterogeneous.prior.media_meta.variance).toBeGreaterThan(4);

    const duplicates = buildCountryTransferPrior([
      { country: "A", prior: channelPrior(50, 9) },
      { country: "B", prior: channelPrior(50, 9) },
      { country: "C", prior: channelPrior(50, 9) },
    ]);
    expect(duplicates.prior.media_meta.tau2).toBe(0);
    expect(duplicates.prior.media_meta.variance).toBeGreaterThanOrEqual(3);

    const aligned = buildCountryTransferPrior([
      { country: "A", prior: { media_meta: { ...channelPrior(50, 9).media_meta, targetLockedTransform: { alpha: 0.4, ec: 800, slope: 1 }, referenceSpendScaleFactor: 2, referenceSpendScaleMethod: "positive-adstock-median-to-target" } } },
      { country: "B", prior: { media_meta: { ...channelPrior(55, 9).media_meta, targetLockedTransform: { alpha: 0.4, ec: 800, slope: 1 }, referenceSpendScaleFactor: 0.5, referenceSpendScaleMethod: "positive-adstock-median-to-target" } } },
    ], { requireTransformAlignment: true });
    expect(aligned.prior.media_meta).toMatchObject({ transformUnitAligned: true, targetLockedTransform: { alpha: 0.4, ec: 800, slope: 1 } });
    expect(aligned.prior.media_meta.referenceSpendScaleFactors).toEqual({ A: 2, B: 0.5 });
    expect(buildCountryTransferPrior([{ country: "A", prior: channelPrior(50, 9) }], { requireTransformAlignment: true }).prior).toEqual({});
  });

  it("never applies more than three countries or enumerates an unbounded search", () => {
    const members = Array.from({ length: 10 }, (_, index) => ({ country: `C${index}`, prior: channelPrior(40 + index) }));
    const combined = buildCountryTransferPrior(members);
    expect(combined.countryCount).toBe(3);
    expect(combined.capped).toBe(true);
    expect(combined.droppedCountries).toHaveLength(7);

    const combinations = buildCountryCombinations(members);
    expect(combinations.every((set) => set.length <= 3)).toBe(true);
    expect(combinations.length).toBeLessThanOrEqual(MMM_COUNTRY_PRIOR_LIMITS.maxCombinations);
  });

  it("keeps base MMM unless improvement is material and repeated across folds", () => {
    const baseline = { country: "Base", foldRmses: [100, 100, 100] };
    const lucky = { country: "Lucky", foldRmses: [60, 105, 105], complexity: 1 };
    const tiny = { country: "Tiny", foldRmses: [99, 99, 99], complexity: 1 };
    const robust = { country: "Robust", foldRmses: [94, 95, 96], complexity: 1 };
    const incomplete = { country: "Incomplete", foldRmses: [50, Infinity, Infinity], complexity: 1 };
    const nullFold = { country: "Null fold", foldRmses: [50, null, 50], complexity: 1 };
    const selected = selectCountryPriorCandidate(baseline, [lucky, tiny, incomplete, nullFold, robust]);
    expect(selected.selected?.country).toBe("Robust");
    expect(selected.evaluated.find((item) => item.country === "Lucky")?.ineligibleReasons).toContain("insufficient-fold-wins");
    expect(selected.evaluated.find((item) => item.country === "Tiny")?.ineligibleReasons).toContain("below-material-improvement");
    expect(selected.evaluated.find((item) => item.country === "Incomplete")?.ineligibleReasons).toContain("incomplete-folds");
    expect(selected.evaluated.find((item) => item.country === "Null fold")?.ineligibleReasons).toContain("incomplete-folds");
  });

  it("rejects a single lucky country fold and keeps the base model", () => {
    const selected = selectCountryPriorCandidate(
      { country: "Base", foldRmses: [100] },
      [{ country: "One-shot winner", foldRmses: [60], complexity: 1 }],
    );
    expect(selected.selected).toBeNull();
    expect(selected.reason).toBe("insufficient-validation-folds");
    expect(selected.evaluated[0].ineligibleReasons).toContain("insufficient-validation-folds");
  });

  it("rejects average improvement that is not larger than paired fold noise", () => {
    const selected = selectCountryPriorCandidate(
      { country: "Base", foldRmses: [100, 100, 100] },
      [{ country: "Noisy", foldRmses: [70, 99, 105], complexity: 1 }],
    );
    expect(selected.selected).toBeNull();
    expect(selected.evaluated[0].foldWinRate).toBeCloseTo(2 / 3, 10);
    expect(selected.evaluated[0].oneSeEvidence).toBe(false);
    expect(selected.evaluated[0].ineligibleReasons).toContain("improvement-not-above-fold-noise");
  });

  it("uses the one-standard-error rule to prefer a simpler eligible combination", () => {
    const baseline = { country: "Base", foldRmses: [110, 105, 115] };
    const single = { country: "A", foldRmses: [99, 98, 100], complexity: 1 };
    const triple = { country: "A + B + C", foldRmses: [97, 96, 99], complexity: 3 };
    const selected = selectCountryPriorCandidate(baseline, [triple, single]);
    expect(selected.selected?.country).toBe("A");
  });
});
