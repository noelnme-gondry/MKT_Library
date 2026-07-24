import { describe, expect, it } from "vitest";
import { rrBuildGroupedCombinationPlan, rrBuildPostSelectionWavePlan, rrBuildWavePlan, rrCreatePreRegistration, rrGenerateHypotheses, rrRunGroupedCombinationLoop, rrRunHypothesisLoop, rrRunMultiverse, rrRunPostSelectionWaveLoop, rrRunWaveLoop, rrSelectTopWaves } from "./rrMultiverse.js";

function fixture() {
  const n = 36;
  const target = Array.from({ length: n }, (_, i) => 100 + i * 1.8 + 12 * Math.sin(2 * Math.PI * i / 12) + (i > 18 ? 5 : 0));
  return {
    target,
    industry: target.map((_, i) => 40 + i * 0.3 + Math.cos(i / 4)),
    channels: {
      meta: Array.from({ length: n }, (_, i) => 20 + (i % 5) * 4),
      google: Array.from({ length: n }, (_, i) => 25 + ((i + 2) % 7) * 3),
    },
    period: 12,
  };
}

describe("RR specification multiverse", () => {
  it("freezes preregistration and exhaustively enumerates the factor grid", () => {
    const preReg = rrCreatePreRegistration({ grid: {
      trendBasis: ["cv-optimal", "cv-plus-se"], seasonalBasis: [1], industryHandling: ["idio-only"],
      adstock: [0.2], saturation: ["linear"], channelSet: ["full"], prior: ["ols", "ridge"],
    } });
    const result = rrRunMultiverse(fixture(), preReg);
    expect(Object.isFrozen(preReg)).toBe(true);
    expect(result.rows).toHaveLength(4);
    expect(result.rows.every((row) => row.seed && row.code_version && Array.isArray(row.fail_reasons))).toBe(true);
    expect(result.exhaustive).toBe(true);
  });

  it("keeps failed specs in the ledger and exposes the taxonomy", () => {
    const preReg = rrCreatePreRegistration({ gate: { seasonVarShare: 0.99 }, grid: {
      trendBasis: ["cv-optimal"], seasonalBasis: [1], industryHandling: ["idio-only"],
      adstock: [0.2], saturation: ["linear"], channelSet: ["full"], prior: ["ols"],
    } });
    const result = rrRunMultiverse(fixture(), preReg);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].admissible).toBe(false);
    expect(result.rows[0].fail_reasons.length).toBeGreaterThan(0);
    expect(["INCONCLUSIVE", "NOT IDENTIFIED", "ROBUST"]).toContain(result.taxonomy);
  });

  it("generates diagnostic hypotheses without changing gate thresholds", () => {
    const preReg = rrCreatePreRegistration({ gate: { seasonVarShare: 0.99 }, grid: {
      trendBasis: ["cv-optimal"], seasonalBasis: [1], industryHandling: ["idio-only"],
      adstock: [0.2], saturation: ["linear"], channelSet: ["full"], prior: ["ols"],
    } });
    const baseline = rrRunMultiverse(fixture(), preReg);
    const hypotheses = rrGenerateHypotheses(baseline, preReg);
    expect(hypotheses.some((item) => item.id === "seasonality-higher-harmonics")).toBe(true);
    expect(hypotheses.every((item) => item.preRegistration.gate.seasonVarShare === preReg.gate.seasonVarShare)).toBe(true);
  });

  it("runs every generated hypothesis and never stops when a result changes", () => {
    const preReg = rrCreatePreRegistration({ gate: { seasonVarShare: 0.99 }, grid: {
      trendBasis: ["cv-optimal"], seasonalBasis: [1], industryHandling: ["idio-only"],
      adstock: [0.2], saturation: ["linear"], channelSet: ["full"], prior: ["ols"],
    } });
    const loop = rrRunHypothesisLoop(fixture(), preReg, { maxHypotheses: 2 });
    expect(loop.attempts.length).toBeGreaterThan(1);
    expect(loop.exhaustive).toBe(true);
    expect(loop.stoppedByResult).toBe(false);
    expect(loop.rows.every((row) => row.hypothesis_id)).toBe(true);
  });

  it("pre-registers and summarizes a fixed wave count", () => {
    const preReg = rrCreatePreRegistration({ grid: {
      trendBasis: ["cv-optimal"], seasonalBasis: [1], industryHandling: ["idio-only"],
      adstock: [0.2], saturation: ["linear"], channelSet: ["full"], prior: ["ols"],
    } });
    expect(rrBuildWavePlan(preReg, 3)).toHaveLength(3);
    const loop = rrRunWaveLoop(fixture(), preReg, { waveCount: 3 });
    expect(loop.attempts).toHaveLength(3);
    expect(loop.attempts.every((attempt) => attempt.metrics.wave_id > 0 && Number.isFinite(attempt.metrics.specs))).toBe(true);
    expect(loop.stoppedByResult).toBe(false);
  });

  it("records holdout actual, predicted, and absolute-error user counts", () => {
    const preReg = rrCreatePreRegistration({ grid: {
      trendBasis: ["cv-optimal"], seasonalBasis: [1], industryHandling: ["idio-only"],
      adstock: [0.2], saturation: ["linear"], channelSet: ["full"], prior: ["ols"],
    } });
    const result = rrRunMultiverse(fixture(), preReg);
    const holdout = result.rows[0].holdout;
    expect(Number.isFinite(holdout.actual_users)).toBe(true);
    expect(Number.isFinite(holdout.predicted_users)).toBe(true);
    expect(Number.isFinite(holdout.absolute_error_users)).toBe(true);
    expect(Number.isFinite(holdout.performance_contribution_users)).toBe(true);
    expect(Number.isFinite(holdout.brand_contribution_users)).toBe(true);
  });

  it("creates 50 distinct wave hypotheses without cycling variants", () => {
    const preReg = rrCreatePreRegistration();
    const plan = rrBuildWavePlan(preReg, 50);
    expect(plan).toHaveLength(50);
    expect(new Set(plan.map((wave) => JSON.stringify(wave.preRegistration.grid))).size).toBe(50);
    expect(new Set(plan.map((wave) => wave.hypothesis)).size).toBe(50);
  });

  it("selects exploratory sources only by holdout error and preserves source provenance", () => {
    const preReg = rrCreatePreRegistration({ grid: {
      trendBasis: ["cv-optimal"], seasonalBasis: [1], industryHandling: ["idio-only"],
      adstock: [0.2], saturation: ["linear"], channelSet: ["full"], prior: ["ols"],
    } });
    const initial = rrRunWaveLoop(fixture(), preReg, { waveCount: 3 });
    const top = rrSelectTopWaves(initial, 2);
    expect(top).toHaveLength(2);
    const plan = rrBuildPostSelectionWavePlan(top, preReg, 4);
    expect(plan).toHaveLength(4);
    expect(plan.every((wave) => wave.source_wave_id && wave.preRegistration.stop.postSelection)).toBe(true);
    const loop = rrRunPostSelectionWaveLoop(fixture(), preReg, initial, { waveCount: 4, topCount: 2 });
    expect(loop.attempts).toHaveLength(4);
    expect(loop.stoppedByResult).toBe(false);
  });

  it("can fill the requested 50 post-selection waves after deduplicating grids", () => {
    const preReg = rrCreatePreRegistration();
    const initial = rrRunWaveLoop(fixture(), preReg, { waveCount: 5 });
    const loop = rrRunPostSelectionWaveLoop(fixture(), preReg, initial, { waveCount: 50, topCount: 5 });
    expect(loop.attempts).toHaveLength(50);
    expect(new Set(loop.plan.map((wave) => JSON.stringify(wave.preRegistration.grid))).size).toBe(50);
    expect(new Set(loop.plan.map((wave) => wave.source_wave_id)).size).toBe(5);
    expect(Object.values(loop.plan.reduce((counts, wave) => ({ ...counts, [wave.source_wave_id]: (counts[wave.source_wave_id] || 0) + 1 }), {}))).toEqual([10, 10, 10, 10, 10]);
  });

  it("groups post-selection waves and exhaustively combines their factor unions", () => {
    const preReg = rrCreatePreRegistration({ grid: {
      trendBasis: ["cv-optimal"], seasonalBasis: [1], industryHandling: ["idio-only"],
      adstock: [0.2], saturation: ["linear"], channelSet: ["full"], prior: ["ols"],
    } });
    const initial = rrRunWaveLoop(fixture(), preReg, { waveCount: 5 });
    const post = rrRunPostSelectionWaveLoop(fixture(), preReg, initial, { waveCount: 4, topCount: 2 });
    const plan = rrBuildGroupedCombinationPlan(post, preReg);
    expect(plan).toHaveLength(2);
    expect(plan.every((group) => group.source_wave_count === 2)).toBe(true);
    const grouped = rrRunGroupedCombinationLoop(fixture(), preReg, post);
    expect(grouped.attempts).toHaveLength(2);
    expect(grouped.exhaustive).toBe(true);
    expect(grouped.stoppedByResult).toBe(false);
  });
});
