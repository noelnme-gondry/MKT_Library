import { describe, expect, it } from "vitest";
import { buildExperimentMediaPrior, buildExperimentMediaPriorDetailed, mmmRollingOrigins, summarizeRollingErrors, mmmPriorMroiAtSpend, mmmMroiToCoefficientPrior } from "./mmmPriorMath";

describe("MMM experiment prior calibration", () => {
  it("converts a transformed-feature coefficient prior to mROI and back at a spend operating point", () => {
    const params = { alpha: 0.4, ec: 120, slope: 1.1 };
    const prior = { mean: 2, se: 0.5, ci90: [1.2, 2.8] };
    const mroi = mmmPriorMroiAtSpend(prior, params, 250);
    expect(mroi).not.toBeNull();
    expect(mroi.mean).toBeGreaterThan(0);
    expect(mroi.ci90[0]).toBeLessThan(mroi.mean);
    const converted = mmmMroiToCoefficientPrior(mroi, params, 250);
    expect(converted.mean).toBeCloseTo(prior.mean, 10);
    expect(converted.se).toBeCloseTo(prior.se, 10);
  });

  it("converts On/Off effect and transformed treatment intensity into a finite CI-based prior", () => {
    let adstock = 0;
    const rows = Array.from({ length: 36 }, (_, i) => {
      const on = i % 3 !== 0;
      const spend = on ? 100 : 0;
      adstock = spend + 0.5 * adstock;
      const exposure = adstock / (adstock + 100);
      return {
        // unpadded W1/W10/W2 문자열 정렬 함정을 포함한다.
        week: `2025-W${i + 1}`,
        state: on ? "on" : "off",
        meta_spend: String(spend),
        regs: String(1000 + i * 3 + 80 * exposure + ((i % 5) - 2) * 4),
      };
    });
    const prior = buildExperimentMediaPrior(rows, {
      targetHeader: "regs",
      spendHeader: "meta_spend",
      stateHeader: "state",
      timeHeader: "week",
      params: { alpha: 0.5, ec: 100, slope: 1 },
    });
    expect(prior?.design).toBe("On/Off");
    expect(prior?.ciMethod).toContain("HAC");
    expect(prior?.treatmentIntensity).toBeGreaterThan(0.1);
    expect(prior?.mean).toBeGreaterThan(50);
    expect(prior?.variance).toBeGreaterThan(0);
    expect(prior?.precision).toBeCloseTo(1 / prior.variance, 10);
    expect(prior?.ci90[0]).toBeLessThan(prior?.mean);
    expect(prior?.ci90[1]).toBeGreaterThan(prior?.mean);
    expect(prior?.ciLevel).toBe(0.90);
    expect(prior?.effectExposureCovariance).toBeTypeOf("number");
    expect(prior?.deltaVariance).toBeCloseTo(prior.deltaVarianceIgnoringCovariance + prior.covarianceAdjustment, 10);
    expect(Math.abs(prior?.covarianceAdjustment)).toBeGreaterThan(0);
    // 90% 표시와 같은 t critical을 쓰므로 95% 보정(약 1.2배)처럼 과대 팽창하지 않는다.
    expect(prior?.smallSampleInflation).toBeLessThan(1.1);
    expect(prior).toMatchObject({ transformUnitAligned: true, targetLockedTransform: { alpha: 0.5, ec: 100, slope: 1 } });

    const inferredRows = rows.map((row) => ({ week: row.week, meta_spend: row.meta_spend, regs: row.regs }));
    const inferred = buildExperimentMediaPrior(inferredRows, {
      targetHeader: "regs",
      spendHeader: "meta_spend",
      timeHeader: "week",
      params: { alpha: 0.5, ec: 100, slope: 1 },
    });
    expect(inferred?.design).toContain("state inferred from verified spend zero");
    expect(inferred?.stateInferredFromSpend).toBe(true);
  });

  it("uses the DiD interaction and geo-clustered uncertainty when geo raw data is present", () => {
    const rows = ["A", "B", "C", "D"].flatMap((geo, geoIndex) => {
      let adstock = 0;
      return Array.from({ length: 10 }, (_, weekIndex) => {
        const treated = geoIndex < 2;
        const post = weekIndex >= 5;
        const spend = treated && post ? 100 : 0;
        adstock = spend + 0.5 * adstock;
        const exposure = adstock / (adstock + 100);
        return {
          geo,
          arm: treated ? "treatment" : "control",
          period: post ? "post" : "pre",
          week: `2025-W${String(weekIndex + 1).padStart(2, "0")}`,
          meta_spend: String(spend),
          regs: String(900 + geoIndex * 20 + weekIndex * 2 + 60 * exposure + ((weekIndex + geoIndex) % 3) * 3),
        };
      });
    });
    const options = {
      targetHeader: "regs",
      spendHeader: "meta_spend",
      armHeader: "arm",
      periodHeader: "period",
      timeHeader: "week",
      geoHeader: "geo",
      targetSpend: Array.from({ length: 10 }, (_, weekIndex) => weekIndex >= 5 ? 200 : 0),
      targetTimes: Array.from({ length: 10 }, (_, weekIndex) => `2025-W${String(weekIndex + 1).padStart(2, "0")}`),
      targetValues: Array.from({ length: 10 }, (_, weekIndex) => 4000 + weekIndex * 10),
      params: { alpha: 0.5, ec: 100, slope: 1 },
    };
    const prior = buildExperimentMediaPrior(rows, options);
    const reordered = buildExperimentMediaPrior(rows.slice().reverse(), options);
    expect(prior?.design).toContain("geo + time fixed effects");
    expect(prior?.ciMethod).toContain("Geo cluster-robust");
    expect(prior?.ciMethod).toContain("leave-one-geo-out");
    expect(prior?.mean).toBeGreaterThan(50);
    expect(prior?.variance).toBeGreaterThan(0);
    expect(prior?.geoRawAdstockReturn).toBeTypeOf("number");
    expect(prior?.geoTargetHillDerivative).toBeGreaterThan(0);
    expect(prior?.fieller90.every(Number.isFinite)).toBe(true);
    expect(prior?.variance).toBeGreaterThanOrEqual((prior?.jackknifeSe || 0) ** 2 * prior.smallClusterInflation ** 2);
    expect(prior).toMatchObject({ outcomeOverlapWeeks: 10, outcomeOverlapObservations: 40, outcomeExactMatchWeeks: 0, usableUniquePeriods: 10 });
    // 지역 순서를 바꿔도 각 geo의 adstock 상태가 분리되어 동일해야 한다.
    expect(reordered?.mean).toBeCloseTo(prior.mean, 8);
  });

  it("requires a canonical Geo clock, stable arms, and at least two geos per arm", () => {
    const baseRows = ["A", "B", "C", "D"].flatMap((geo, geoIndex) => Array.from({ length: 8 }, (_, week) => ({
      geo,
      week: week + 1,
      arm: geoIndex < 2 ? "treatment" : "control",
      period: week >= 4 ? "post" : "pre",
      spend: geoIndex < 2 && week >= 4 ? 100 : 0,
      outcome: 500 + geoIndex * 10 + week + (geoIndex < 2 && week >= 4 ? 30 : 0),
    })));
    const common = {
      targetHeader: "outcome", spendHeader: "spend", armHeader: "arm", periodHeader: "period", geoHeader: "geo",
      targetSpend: Array.from({ length: 8 }, (_, week) => week >= 4 ? 200 : 0),
      targetTimes: Array.from({ length: 8 }, (_, week) => week + 1), params: { alpha: 0.2, ec: 100, slope: 1 },
    };
    expect(buildExperimentMediaPriorDetailed(baseRows, common).diagnostic.reason).toBe("missing-geo-time");

    const switching = baseRows.map((row) => row.geo === "A" && row.week === 8 ? { ...row, arm: "control" } : row);
    expect(buildExperimentMediaPriorDetailed(switching, { ...common, timeHeader: "week" }).diagnostic).toMatchObject({ reason: "invalid-treatment-design", designIssue: "arm-varies-within-geo" });

    const oneTreated = baseRows.map((row) => ({ ...row, arm: row.geo === "A" ? "treatment" : "control", spend: row.geo === "A" && row.week >= 5 ? 100 : 0 }));
    expect(buildExperimentMediaPriorDetailed(oneTreated, { ...common, timeHeader: "week" }).diagnostic).toMatchObject({ reason: "invalid-treatment-design", designIssue: "minimum-two-geos-per-arm" });
  });

  it("does not misclassify an On/Off source merely because it has a descriptive geo column", () => {
    const rows = Array.from({ length: 24 }, (_, week) => {
      const on = week % 4 >= 2;
      return { week: week + 1, geo: "KR_national", state: on ? "on" : "off", spend: on ? 100 : 0, outcome: 800 + week * 2 + (on ? 50 : 0) };
    });
    const options = { targetHeader: "outcome", spendHeader: "spend", stateHeader: "state", timeHeader: "week", params: { alpha: 0.2, ec: 100, slope: 1 } };
    const plain = buildExperimentMediaPrior(rows, options);
    const withGeo = buildExperimentMediaPrior(rows, { ...options, geoHeader: "geo" });
    expect(withGeo?.design).toBe("On/Off");
    expect(withGeo?.mean).toBeCloseTo(plain.mean, 10);
  });

  it("rejects On/Off evidence without enough weeks in each state and repeated transitions", () => {
    const rows = Array.from({ length: 20 }, (_, week) => ({
      week: week + 1,
      state: week === 10 ? "on" : "off",
      spend: week === 10 ? 100 : 0,
      outcome: 500 + week + (week === 10 ? 20 : 0),
    }));
    const result = buildExperimentMediaPriorDetailed(rows, {
      targetHeader: "outcome", spendHeader: "spend", stateHeader: "state", timeHeader: "week", params: { alpha: 0.2, ec: 100, slope: 1 },
    });
    expect(result.prior).toBeNull();
    expect(result.diagnostic).toMatchObject({ reason: "insufficient-state-replication", onWeeks: 1, offWeeks: 19, transitionCount: 2, minimumWeeksPerState: 4 });
  });

  it("requires a sortable time axis for On/Off evidence", () => {
    const rows = Array.from({ length: 20 }, (_, week) => ({
      state: week % 4 >= 2 ? "on" : "off",
      spend: week % 4 >= 2 ? 100 : 0,
      outcome: 500 + week,
    }));
    const result = buildExperimentMediaPriorDetailed(rows, {
      targetHeader: "outcome", spendHeader: "spend", stateHeader: "state", params: { alpha: 0.2, ec: 100, slope: 1 },
    });
    expect(result.prior).toBeNull();
    expect(result.diagnostic.reason).toBe("missing-experiment-time");
  });

  it("aligns Excel serial experiment dates with the main calendar clock", () => {
    const epoch = Date.UTC(1899, 11, 30);
    let adstock = 0;
    const rows = Array.from({ length: 24 }, (_, week) => {
      const on = week % 4 >= 2;
      const spend = on ? 100 : 0;
      adstock = spend + 0.3 * adstock;
      const exposure = adstock / (adstock + 100);
      return {
        // Sunday evening must stay in the Sunday-ending week instead of
        // rounding into the following Monday.
        date: 45662.75 + week * 7,
        state: on ? "on" : "off",
        spend,
        outcome: 800 + week * 3 + 70 * exposure + ((week % 3) - 1) * 2,
      };
    });
    const targetTimes = rows.map((row) => new Date(epoch + Math.floor(row.date) * 86400000).toISOString().slice(0, 10));
    const result = buildExperimentMediaPriorDetailed(rows, {
      targetHeader: "outcome",
      spendHeader: "spend",
      stateHeader: "state",
      timeHeader: "date",
      targetTimes,
      targetValues: rows.map((row) => row.outcome + 1),
      params: { alpha: 0.3, ec: 100, slope: 1 },
    });
    expect(result.diagnostic?.reason).not.toBe("outcome-reuse-not-comparable");
    expect(result.diagnostic?.reason).not.toBe("missing-time-period");
    expect(result.prior?.design).toBe("On/Off");
    expect(result.prior?.outcomeOverlapWeeks).toBe(24);
  });

  it("blocks a national On/Off prior when it reuses the same MMM KPI in overlapping weeks", () => {
    const rows = Array.from({ length: 24 }, (_, week) => {
      const on = week % 4 >= 2;
      return {
        week: `2025-W${String(week + 1).padStart(2, "0")}`,
        state: on ? "on" : "off",
        spend: on ? 100 : 0,
        outcome: 800 + week * 3 + (on ? 45 : 0),
      };
    });
    const result = buildExperimentMediaPriorDetailed(rows, {
      targetHeader: "outcome",
      spendHeader: "spend",
      stateHeader: "state",
      timeHeader: "week",
      targetTimes: rows.map((row) => row.week),
      targetValues: rows.map((row) => row.outcome),
      params: { alpha: 0.2, ec: 100, slope: 1 },
    });
    expect(result.prior).toBeNull();
    expect(result.diagnostic).toMatchObject({
      reason: "non-independent-outcome-reuse",
      design: "On/Off",
      outcomeOverlapWeeks: 24,
      outcomeExactMatchWeeks: 24,
      outcomeExactMatchShare: 1,
      outcomeIndependenceCheck: "overlap-not-proven-independent",
      isLikelyOutcomeReuse: true,
    });
  });

  it("pauses national On/Off when experiment and MMM clocks cannot be compared for outcome reuse", () => {
    const rows = Array.from({ length: 24 }, (_, week) => ({
      week: new Date(Date.UTC(2025, 0, 6 + week * 7)).toISOString().slice(0, 10),
      state: week % 4 >= 2 ? "on" : "off",
      spend: week % 4 >= 2 ? 100 : 0,
      outcome: 800 + week * 3,
    }));
    const result = buildExperimentMediaPriorDetailed(rows, {
      targetHeader: "outcome", spendHeader: "spend", stateHeader: "state", timeHeader: "week",
      targetTimes: rows.map((_, index) => index + 1),
      targetValues: rows.map((row) => row.outcome),
      params: { alpha: 0.2, ec: 100, slope: 1 },
    });
    expect(result.prior).toBeNull();
    expect(result.diagnostic).toMatchObject({
      reason: "outcome-reuse-not-comparable",
      outcomeIndependenceCheck: "not-comparable",
      targetTimeKinds: ["index"],
      experimentTimeKinds: ["date"],
    });
  });

  it("normalizes daily holdout rows to the MMM weekly cadence before adstock", () => {
    let adstock = 0;
    const rows = Array.from({ length: 20 }, (_, weekIndex) => {
      const on = weekIndex % 3 !== 0;
      const weeklySpend = on ? 140 : 0;
      adstock = weeklySpend + 0.4 * adstock;
      const exposure = adstock / (adstock + 140);
      const weeklyTarget = 7000 + weekIndex * 12 + 90 * exposure + (weekIndex % 2) * 5;
      return Array.from({ length: 7 }, (_, day) => ({
        date: new Date(Date.UTC(2025, 0, 6 + weekIndex * 7 + day)).toISOString().slice(0, 10),
        state: on ? "on" : "off",
        meta_spend: String(weeklySpend / 7),
        regs: String(weeklyTarget / 7),
      }));
    }).flat();
    const prior = buildExperimentMediaPrior(rows, {
      targetHeader: "regs",
      spendHeader: "meta_spend",
      stateHeader: "state",
      timeHeader: "date",
      params: { alpha: 0.4, ec: 140, slope: 1 },
    });
    expect(prior?.cadence).toBe("monday-week");
    expect(prior?.sourceN).toBe(140);
    expect(prior?.n).toBe(20);
    expect(prior?.droppedMixedWeeks).toBe(0);
    expect(prior?.mean).toBeGreaterThan(50);

    const withBlankDay = rows.map((row, index) => index === 2 ? { ...row, regs: "" } : row);
    const missing = buildExperimentMediaPrior(withBlankDay, {
      targetHeader: "regs", spendHeader: "meta_spend", stateHeader: "state", timeHeader: "date",
      params: { alpha: 0.4, ec: 140, slope: 1 },
    });
    expect(missing?.droppedMissingWeeks).toBe(1);
    expect(missing?.n).toBe(19);

    const withInvalidDate = [...rows, { date: "not-a-date", state: "ON", meta_spend: "10", regs: "10" }];
    const invalid = buildExperimentMediaPrior(withInvalidDate, {
      targetHeader: "regs", spendHeader: "meta_spend", stateHeader: "state", timeHeader: "date",
      params: { alpha: 0.4, ec: 140, slope: 1 },
    });
    expect(invalid?.droppedUnparseableRows).toBe(1);
    expect(invalid?.n).toBe(20);
    const withTypo = rows.map((row, index) => index === 9 ? { ...row, state: "onn" } : row);
    const typo = buildExperimentMediaPriorDetailed(withTypo, {
      targetHeader: "regs", spendHeader: "meta_spend", stateHeader: "state", timeHeader: "date",
      params: { alpha: 0.4, ec: 140, slope: 1 },
    });
    expect(typo.prior).toBeNull();
    expect(typo.diagnostic.reason).toBe("missing-time-period");
    expect(typo.diagnostic.droppedUnknownCategoryWeeks).toBe(1);
    expect(buildExperimentMediaPrior(rows.slice(0, 14 * 7), {
      targetHeader: "regs", spendHeader: "meta_spend", stateHeader: "state", timeHeader: "date",
      params: { alpha: 0.4, ec: 140, slope: 1 },
    })).toBeNull();
  });

  it("rejects ISO-week gaps instead of compressing W01 to W03 and accepts compact ISO labels", () => {
    const rows = Array.from({ length: 21 }, (_, index) => {
      const week = index === 0 ? 1 : index + 2;
      const on = index % 2 === 0;
      return { week: `2025${index % 2 ? "-" : ""}W${String(week).padStart(index % 2 ? 2 : 1, "0")}`, state: on ? "on" : "off", spend: on ? 100 : 0, outcome: 500 + index * 2 + (on ? 30 : 0) };
    });
    const result = buildExperimentMediaPriorDetailed(rows, {
      targetHeader: "outcome", spendHeader: "spend", stateHeader: "state", timeHeader: "week",
      params: { alpha: 0.3, ec: 100, slope: 1 },
    });
    expect(result.prior).toBeNull();
    expect(result.diagnostic.reason).toBe("missing-time-period");
    expect(result.diagnostic.missingTimePeriods).toBe(1);
    expect(result.diagnostic.timeGaps[0]).toMatchObject({ after: "2024-12-30", before: "2025-01-13", missing: 1 });
  });

  it("rejects an internal partial daily week but excludes partial boundary weeks", () => {
    const full = Array.from({ length: 20 }, (_, weekIndex) => Array.from({ length: 7 }, (_, day) => {
      const on = weekIndex % 2 === 0;
      return {
        date: new Date(Date.UTC(2025, 0, 6 + weekIndex * 7 + day)).toISOString().slice(0, 10),
        state: on ? "on" : "off",
        spend: on ? "14" : "0",
        outcome: String(100 + weekIndex + (on ? 8 : 0)),
      };
    })).flat();
    const options = { targetHeader: "outcome", spendHeader: "spend", stateHeader: "state", timeHeader: "date", params: { alpha: 0.2, ec: 50, slope: 1 } };
    const internal = buildExperimentMediaPriorDetailed(full.filter((_, index) => index !== 8 * 7 + 3), options);
    expect(internal.prior).toBeNull();
    expect(internal.diagnostic.reason).toBe("partial-internal-week");
    expect(internal.diagnostic.internalPartialWeeks).toBe(1);

    const boundary = buildExperimentMediaPrior(full.slice(2, -3), options);
    expect(boundary?.boundaryPartialWeeks).toBe(2);
    expect(boundary?.expectedDaysPerWeek).toBe(7);
    expect(boundary?.n).toBe(18);
  });

  it("rejects duplicate daily rows at the same geo-date grain", () => {
    const rows = Array.from({ length: 20 }, (_, weekIndex) => Array.from({ length: 7 }, (_, day) => ({
      date: new Date(Date.UTC(2025, 0, 6 + weekIndex * 7 + day)).toISOString().slice(0, 10),
      state: weekIndex % 2 ? "off" : "on",
      spend: weekIndex % 2 ? "0" : "14",
      outcome: String(100 + weekIndex + (weekIndex % 2 ? 0 : 8)),
    }))).flat();
    const result = buildExperimentMediaPriorDetailed([...rows, { ...rows[20] }], {
      targetHeader: "outcome", spendHeader: "spend", stateHeader: "state", timeHeader: "date",
      params: { alpha: 0.2, ec: 50, slope: 1 },
    });
    expect(result.prior).toBeNull();
    expect(result.diagnostic.reason).toBe("duplicate-time-period");
    expect(result.diagnostic.duplicateProvidedPeriods).toBe(1);
  });

  it("rejects a weak transformed-spend contrast with a Fieller-style denominator gate", () => {
    const rows = Array.from({ length: 40 }, (_, index) => {
      const on = index % 2 === 0;
      const spend = 100 + (index % 7) * 8 + (on ? 0.2 : 0);
      return { week: index + 1, state: on ? "on" : "off", spend, outcome: 1000 + index * 2 + (index % 5) * 3 };
    });
    const result = buildExperimentMediaPriorDetailed(rows, {
      targetHeader: "outcome", spendHeader: "spend", stateHeader: "state", timeHeader: "week",
      params: { alpha: 0.3, ec: 100, slope: 1 },
    });
    expect(result.prior).toBeNull();
    expect(result.diagnostic.reason).toBe("weak-treatment-intensity");
    expect(result.diagnostic.exposureStrength).toBeLessThanOrEqual(result.diagnostic.weakExposureCriticalValue);
  });

  it("reports the actionable minimum weeks and geos when experiment evidence is insufficient", () => {
    const shortOnOff = Array.from({ length: 12 }, (_, index) => ({
      week: index + 1,
      state: index % 2 ? "on" : "off",
      spend: index % 2 ? 100 : 0,
      outcome: 500 + index * 4,
    }));
    const onOff = buildExperimentMediaPriorDetailed(shortOnOff, {
      targetHeader: "outcome", spendHeader: "spend", stateHeader: "state", timeHeader: "week",
      params: { alpha: 0.2, ec: 50, slope: 1 },
    });
    expect(onOff.prior).toBeNull();
    expect(onOff.diagnostic).toMatchObject({ reason: "insufficient-data", usableWeeks: 12, minimumUsableWeeks: 16 });
    expect(onOff.diagnostic.messageEn).toContain("minimum 16");

    const shortGeo = ["A", "B", "C"].flatMap((geo, geoIndex) => Array.from({ length: 8 }, (_, week) => ({
      geo,
      week: week + 1,
      arm: geoIndex === 0 ? "treatment" : "control",
      period: week >= 4 ? "post" : "pre",
      spend: geoIndex === 0 && week >= 4 ? 100 : 0,
      outcome: 700 + geoIndex * 10 + week,
    })));
    const geo = buildExperimentMediaPriorDetailed(shortGeo, {
      targetHeader: "outcome", spendHeader: "spend", armHeader: "arm", periodHeader: "period", timeHeader: "week", geoHeader: "geo",
      params: { alpha: 0.2, ec: 50, slope: 1 },
    });
    expect(geo.prior).toBeNull();
    expect(geo.diagnostic).toMatchObject({ reason: "insufficient-data", geoCount: 3, minimumGeoCount: 4 });
    expect(geo.diagnostic.messageKo).toContain("최소 Geo 4개");
  });

  it("builds bounded repeated rolling origins and penalizes unstable validation", () => {
    expect(mmmRollingOrigins(64)).toEqual([
      { cut: 52, holdout: 12 },
      { cut: 40, holdout: 12 },
      { cut: 28, holdout: 12 },
    ]);
    expect(mmmRollingOrigins(64, { holdout: 12, minTrain: 24, stride: 8, maxFolds: 3 })).toEqual([
      { cut: 52, holdout: 12 },
      { cut: 44, holdout: 12 },
      { cut: 36, holdout: 12 },
    ]);
    const stable = summarizeRollingErrors([100, 100, 100], 1);
    const unstable = summarizeRollingErrors([70, 100, 130], 1);
    const complex = summarizeRollingErrors([100, 100, 100], 3);
    expect(unstable.score).toBeGreaterThan(stable.score);
    expect(complex.score).toBeGreaterThan(stable.score);
  });
});
