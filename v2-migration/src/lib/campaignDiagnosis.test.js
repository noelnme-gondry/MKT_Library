import { readFileSync } from "node:fs";
import { mapDiagnosisData, parseDiagnosisCsv } from "./diagnosisImport";
import { describe, expect, it } from "vitest";
import { analyzeDiagnosis } from "./campaignDiagnosis";
import { addDays } from "./budgetPlanner/plannerStats";

const week = (date, channel, cost, result, organic) => ({
  date,
  channel,
  cost,
  result,
  organic,
  currency: "KRW",
  campaign: channel + " 1",
});
const sample = [
  week("2026-11-09", "Meta", 1000000, 100, 90),
  week("2026-11-09", "Google", 400000, 80, 90),
  week("2026-11-16", "Meta", 1300000, 120, 80),
  week("2026-11-16", "Google", 300000, 75, 80),
];
const diagnose = (rows, options = {}) => analyzeDiagnosis(rows, { grain: "weekly", targetCpa: 12000, ...options });

describe("unified diagnosis", () => {
  it("reconciles total CPA, result-weighted mix/rate, observed incremental cost and organic market totals", () => {
    const d = diagnose(sample, { organicExclusive: true });
    expect(d.current.cpa).toBeCloseTo(8205.1282);
    expect(d.channels[0].incrementalCpa).toBe(15000);
    expect(d.channels[0].effect).toBe("above_target");
    expect(d.channels[0].campaigns[0].current.result).toBe(120);
    expect(d.channels[0].points).toHaveLength(2);
    expect(d.pvm.mix).toBeCloseTo(353.9886);
    expect(d.pvm.rate).toBeCloseTo(73.3618);
    expect(d.pvm.mix + d.pvm.rate + d.pvm.entry + d.pvm.exit).toBeCloseTo(d.current.cpa - d.previous.cpa);
    expect(d.organic).toMatchObject({ previous: 90, current: 80, paidDelta: 15, totalDelta: 5 });
    expect(diagnose(sample).organic.totalDelta).toBeNull();
    expect(d.budget.status).toBe("insufficient");
  });
  it("keeps zero-result spend in overall CPA while reporting its PVM exclusion; never converts blank to zero", () => {
    const row = week("2026-11-16", "New", 100000, 0, 80);
    const d = diagnose([...sample, row]);
    expect(d.current.cpa).toBeCloseTo(8717.9487);
    expect(d.pvm.excludedCost).toBe(100000);
    expect(d.pvm.currentCpa).toBeCloseTo(8205.1282);
    expect(d.current.zeroCost).toBe(100000);
    const missing = diagnose([...sample, { ...row, result: null }]);
    expect(missing.current.cost).toBe(1700000);
    expect(missing.current.result).toBeNull();
    expect(missing.current.cpa).toBeNull();
    expect(missing.current.coverage).toBeCloseTo(16 / 17);
    expect(missing.pvm.scope).toBe("subset");
    expect(missing.pvm.excludedCost).toBe(100000);
    expect(missing.pvm.currentCpa).toBeCloseTo(8205.1282);
  });
  it("ranks signed channel contributions in CPA units and reconciles both the complete and identified scope", () => {
    for (const extra of [
      [],
      [week("2026-11-16", "New", 100000, 0, 80)],
      [week("2026-11-16", "New", 100000, null, 80)],
    ]) {
      const d = diagnose([...sample, ...extra]);
      expect(d.pvm.drivers.map((r) => r.name)).toEqual(["Meta"]);
      expect(d.pvm.improvers.map((r) => r.name)).toEqual(["Google"]);
      expect(d.pvm.drivers[0].contribution).toBeCloseTo(632.98999, 4);
      expect(d.pvm.improvers[0].contribution).toBeCloseTo(-205.63956, 4);
      for (const row of d.pvm.contributions)
        expect(row.contribution).toBeCloseTo(row.mix + row.rate + row.entry + row.exit, 8);
      expect(d.pvm.contributions.reduce((n, r) => n + r.contribution, 0)).toBeCloseTo(
        d.pvm.currentCpa - d.pvm.baselineCpa,
        8,
      );
      expect(d.pvm.residual).toBeCloseTo(0, 8);
      expect(d.pvm.scope).toBe(extra.length ? "subset" : "all");
    }
    const many = Array.from({ length: 5 }, (_, i) => [
      week("2026-11-09", "C" + i, 100, 5),
      week("2026-11-16", "C" + i, 110 + 10 * i, 5),
    ]).flat();
    const d = diagnose(many);
    expect(d.pvm.drivers.map((r) => r.name)).toEqual(["C4", "C3", "C2"]);
    expect(d.pvm.contributions).toHaveLength(5);
  });
  it("separates market and platform scopes before organic or cross-channel comparisons", () => {
    const rows = sample.map((r) => ({
      ...r,
      platform: "iOS",
      market: "KR",
    }));
    for (const conflict of [{ platform: "Android" }, { market: "JP" }, { platform: null }]) {
      const d = diagnose([...rows, ...rows.map((r) => ({ ...r, ...conflict }))], { organicExclusive: true });
      expect(d.organic).toMatchObject({
        reason: "mixed_scope",
        status: "insufficient",
        totalDelta: null,
        points: [],
        lags: [],
      });
      expect(d.channelPerformance).toEqual({ reason: "scope", channels: [] });
    }
    expect(diagnose(rows, { supplementalScopeHeld: true }).organic.reason).toBe("mixed_scope");
    expect(
      diagnose([...rows, ...rows.map((r) => ({ ...r, platform: "Android" }))], { platform: "iOS" }).organic.status,
    ).toBe("ready");
  });
  it("separates no extra results, losses, and spend changes with an action record", () => {
    for (const result of [100, 90]) {
      const d = diagnose(sample.map((r, i) => (i === 2 ? { ...r, result, change: "Budget changed" } : r)));
      expect(d.channels[0]).toMatchObject({
        action: "increase",
        effect: "no_result_gain",
        incrementalCpa: null,
        deltaResult: result - 100,
      });
      expect(d.channels[0].changes[0]).toContain("Budget changed");
    }
  });
  it("compares the same weekday cutoff and withholds inferences on missing calendar days", () => {
    const days = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => week(addDays("2026-11-09", i), "C", 100, 10, 5));
    const d = analyzeDiagnosis(days);
    expect(d.previous.result).toBe(30);
    expect(d.current.result).toBe(30);
    expect(d.periods.previous.end).toBe("2026-11-11");
    const gaps = analyzeDiagnosis(days.filter((_, i) => i !== 1));
    expect(gaps.status).toBe("insufficient");
    expect(gaps.channels[0].deltaCost).toBeNull();
    expect(gaps.pvm.status).toBe("insufficient");
  });
  it("rejects incompatible units, invalid dates and weekly grain with conflicting anchor weekdays", () => {
    expect(diagnose([sample[0], { ...sample[1], currency: "USD" }]).status).toBe("mixed");
    expect(diagnose([{ ...sample[0], date: "2026-02-31" }]).status).toBe("invalid");
    expect(diagnose([sample[0], { ...sample[1], date: "2026-11-10" }]).status).toBe("invalid");
    expect(analyzeDiagnosis([]).status).toBe("empty");
  });
  it("withholds organic on conflicting repeated totals", () => {
    const rows = sample.map((r, i) => ({
      ...r,
      organic: i === 3 ? 70 : r.organic,
    }));
    const d = diagnose(rows, { organicExclusive: true });
    expect(d.organic.conflict).toBe(true);
    expect(d.organic.totalDelta).toBeNull();
  });
  it("compares organic on matching markets and estimates fixed lags from actual calendar dates", () => {
    const rows = Array.from({ length: 56 }, (_, i) => {
      const costAt = (t) => 1000 + 7 * ((t * t + 3 * t) % 31);
      return { ...week(addDays("2026-09-28", i), "M", costAt(i), 20, 2000 - costAt(i - 1)), market: "KR" };
    });
    const d = analyzeDiagnosis(rows);
    const lag = d.organic.lags.find((l) => l.days === 1);
    expect(lag.n).toBe(48);
    expect(lag.correlation).toBeCloseTo(-1);
    expect(analyzeDiagnosis(rows.map((r, i) => (i >= 49 ? { ...r, market: "JP" } : r))).organic.status).toBe(
      "insufficient",
    );
  });
  it("a single extreme day does not establish sustained creative fatigue", () => {
    const rows = Array.from({ length: 14 }, (_, i) => ({
      ...week(addDays("2026-11-02", i), "C", 100, i === 13 ? 1 : 10),
      creative: "Q",
      impressions: i === 13 ? 20000 : 1000,
      clicks: i === 13 ? 1 : 50,
    }));
    expect(analyzeDiagnosis(rows).creative.fatigue).toHaveLength(0);
  });
  it("retains campaign-scoped creative identity and requires both periods' exposure for fatigue", () => {
    const rows = Array.from({ length: 14 }, (_, i) => ({
      ...week(addDays("2026-11-02", i), "M", 1000, i < 7 ? 10 : 5),
      creative: "A",
      impressions: 2000,
      clicks: i < 7 ? 100 : 50,
    }));
    const d = analyzeDiagnosis([...rows, { ...rows[0], creative: "old" }, { ...rows[13], creative: "new" }]);
    expect(d.creative.entered.map((r) => r.name)).toEqual(["new"]);
    expect(d.creative.exited.map((r) => r.name)).toEqual(["old"]);
    expect(d.creative.fatigue.map((r) => r.name)).toEqual(["A"]);
    expect(analyzeDiagnosis(rows.map((r) => ({ ...r, clicks: null }))).creative.fatigue).toHaveLength(0);
  });
  it("replays the actual downloadable CSV through the same mapping and analysis as the UI", () => {
    const csv = readFileSync(new URL("../../public/examples/campaign-diagnosis.csv", import.meta.url), "utf8");
    const parsed = parseDiagnosisCsv(csv);
    const { rows, meta } = mapDiagnosisData(parsed, parsed.mapping, { targetCpa: 12000, organicExclusive: true });
    const d = analyzeDiagnosis(rows, meta);
    expect(d.current.cost).toBe(1600000);
    expect(d.previous.result).toBe(180);
    expect(d.current.result).toBe(195);
    expect(d.channels.find((c) => c.name === "Meta").incrementalCpa).toBe(15000);
    expect(d.organic.totalDelta).toBe(5);
    expect(d.budget).toMatchObject({ status: "ready", decision: "hold", totalCost: 1600000 });
    expect(d.budget.rows.reduce((s, r) => s + r.proposedCost, 0)).toBeCloseTo(1600000);
    expect(d.creative.entered).toHaveLength(1);
    expect(d.creative.exited).toHaveLength(1);
    expect(d.creative.fatigue).toHaveLength(1);
    expect(d.channels.find((c) => c.name === "Meta").points).toHaveLength(56);
  });
  it("a channel missing a day withholds the comparison when other channels still cover all days", () => {
    const rows = Array.from({ length: 14 }, (_, i) =>
      ["A", "B"].map((channel) => week(addDays("2026-11-02", i), channel, 1000, 10)),
    )
      .flat()
      .filter((row) => row.date !== "2026-11-11" || row.channel !== "A");
    const d = analyzeDiagnosis(rows);
    expect(d.status).toBe("ready");
    expect(d.channels.find((c) => c.name === "A")).toMatchObject({
      comparable: false,
      deltaCost: null,
      action: "unavailable",
    });
  });
  it("compares post-change observations to the identical prior weekdays and captures concurrent creative turnover", () => {
    const rows = Array.from({ length: 14 }, (_, i) => ({
      ...week(addDays("2026-11-02", i), "M", i >= 9 ? 150 : 100, 10),
      budget: i >= 9 ? 200 : 110,
      creative: i >= 9 ? "New" : "Old",
    }));
    const ch = analyzeDiagnosis(rows).channels[0];
    expect(ch.budgetChanges).toMatchObject([{ date: "2026-11-11", from: 110, to: 200 }]);
    expect(ch.changeReviews[0]).toMatchObject({
      before: { start: "2026-11-04", end: "2026-11-08" },
      after: { start: "2026-11-11", end: "2026-11-15" },
      deltaCost: 250,
      deltaResult: 0,
      incrementalCpa: null,
      coincidesWithCreativeChange: true,
    });
  });
  it("uses a time holdout, bounded observed spend and identical total budget", () => {
    const rows = Array.from({ length: 56 }, (_, i) =>
      ["A", "B"].map((channel) => {
        const cost = 10000 + (i % 7) * 1000;
        const cpa = (channel === "A" ? 120 : 420) + cost * 0.001;
        return week(addDays("2026-09-28", i), channel, cost, cost / cpa);
      }),
    ).flat();
    const result = analyzeDiagnosis(rows).budget;
    expect(result.status).toBe("ready");
    expect(result.rows.reduce((s, r) => s + r.proposedCost, 0)).toBeCloseTo(result.totalCost);
    expect(result.proposedResult).toBeGreaterThan(result.currentResult);
    expect(result.validationError).toBeLessThan(0.01);
    for (const row of result.rows) {
      expect(row.proposedCost).toBeGreaterThanOrEqual(row.minSpend - 0.001);
      expect(row.proposedCost).toBeLessThanOrEqual(row.maxSpend + 0.001);
    }
    expect(analyzeDiagnosis(rows.slice(-28)).budget.status).toBe("insufficient");
    expect(
      analyzeDiagnosis(rows.map((r, i) => (i >= rows.length - 14 ? { ...r, result: r.result * 3 } : r))).budget
        .status,
    ).toBe("insufficient");
  });
});
