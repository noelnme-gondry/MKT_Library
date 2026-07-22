import { describe, expect, it } from "vitest";
import { buildExperimentMediaPrior, mmmRollingOrigins, summarizeRollingErrors } from "./mmmPriorMath";

describe("MMM experiment prior calibration", () => {
  it("converts On/Off effect and transformed treatment intensity into a finite CI-based prior", () => {
    const rows = Array.from({ length: 36 }, (_, i) => {
      const on = i % 3 !== 0;
      const spend = on ? 100 : 0;
      const exposure = spend / (spend + 100);
      return {
        week: `2025-W${String(i + 1).padStart(2, "0")}`,
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
      params: { alpha: 0, ec: 100, slope: 1 },
    });
    expect(prior?.design).toBe("On/Off");
    expect(prior?.ciMethod).toContain("HAC");
    expect(prior?.treatmentIntensity).toBeGreaterThan(0.1);
    expect(prior?.mean).toBeGreaterThan(50);
    expect(prior?.variance).toBeGreaterThan(0);
    expect(prior?.precision).toBeCloseTo(1 / prior.variance, 10);
    expect(prior?.ci90[0]).toBeLessThan(prior?.mean);
    expect(prior?.ci90[1]).toBeGreaterThan(prior?.mean);
  });

  it("uses the DiD interaction and geo-clustered uncertainty when geo raw data is present", () => {
    const rows = ["A", "B", "C", "D"].flatMap((geo, geoIndex) => Array.from({ length: 10 }, (_, weekIndex) => {
      const treated = geoIndex < 2;
      const post = weekIndex >= 5;
      const spend = treated && post ? 100 : 0;
      const exposure = spend / (spend + 100);
      return {
        geo,
        arm: treated ? "treatment" : "control",
        period: post ? "post" : "pre",
        week: `2025-W${String(weekIndex + 1).padStart(2, "0")}`,
        meta_spend: String(spend),
        regs: String(900 + geoIndex * 20 + weekIndex * 2 + 60 * exposure + ((weekIndex + geoIndex) % 3) * 3),
      };
    }));
    const prior = buildExperimentMediaPrior(rows, {
      targetHeader: "regs",
      spendHeader: "meta_spend",
      armHeader: "arm",
      periodHeader: "period",
      timeHeader: "week",
      geoHeader: "geo",
      params: { alpha: 0, ec: 100, slope: 1 },
    });
    expect(prior?.design).toBe("Geo DiD");
    expect(prior?.ciMethod).toContain("Geo cluster-robust");
    expect(prior?.mean).toBeGreaterThan(50);
    expect(prior?.variance).toBeGreaterThan(0);
  });

  it("builds bounded repeated rolling origins and penalizes unstable validation", () => {
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
