import { describe, it, expect } from "vitest";
import { buildDemoCsv, buildMmmPriorDemo } from "./demoData";
import { getMappedRows } from "./dashboardAggregator";
import { DATA_GROUPS } from "@/lib/toolGroups";
import { TOOL_REQUIRED_FIELDS } from "./csvConstants";
import { satBuildPoints, SAT_MATH } from "./satMath";
import { AHA_STATS } from "./ahaMath";
import { CREATIVE_STATS } from "./creativeMath";
import { buildCreativePredictiveInput } from "./creativePredictiveModel";
import { INCR_MATH } from "./incrMath";
import { MMM_METH_CONFIG, mmmBayesianHealth, mmmBayesianLikeRun, mmmResolveAbsorb } from "./mmmMath";
import { discreteHazard, kaplanMeier, logRankTest, normalizeDateSurvivalRows, normalizeSurvivalRows } from "./subscriptionSurvivalMath";
import { prepareRandomForestInput } from "@/lib/analysis/webr/randomForest";
import { prepareSvmInput } from "@/lib/analysis/webr/svm";

const DEMO_MINIMUM_ROWS = Object.freeze({
  efficiency: 2000,
  creative: 1000,
  experiment: 200,
  response: 120,
  aha: 2000,
  incrementality: 80,
  brand_incrementality: 45,
  aso_store: 300,
  subscription_survival: 100,
  collinearity: 160,
  asa_keyword: 40,
  content_aha: 2000,
  content_attr: 250,
  content_traffic: 300,
  content_dashboard: 300,
  segment_composition: 180,
});

describe("demo sanity", () => {
  it("every data group has its own valid demo instead of a fallback dataset", () => {
    DATA_GROUPS.forEach((group) => {
      const demo = buildDemoCsv(group);
      expect(demo.fileName).toMatch(/^demo_/);
      expect(demo.raw.length).toBeGreaterThan(0);
      expect(demo.headers.length).toBeGreaterThan(0);
      expect(demo.raw.length, `${group} demo needs enough depth to expose its result views`).toBeGreaterThanOrEqual(DEMO_MINIMUM_ROWS[group]);
    });

    // These three groups were previously sent to the efficiency fallback.
    // Their published routes use the standard mapped-row path, so their demo
    // must satisfy the route contract before the analyzer is auto-confirmed.
    const dedicatedToolByGroup = { brand_incrementality: "5-24", collinearity: "5-25", asa_keyword: "5-26" };
    Object.entries(dedicatedToolByGroup).forEach(([group, toolId]) => {
      const demo = buildDemoCsv(group);
      const mapped = new Set(Object.values(demo.mapping));
      (TOOL_REQUIRED_FIELDS[toolId] || []).forEach((field) => {
        if (typeof field === "string" && !mapped.has(field)) throw new Error(`${toolId} demo is missing required field: ${field}`);
        if (typeof field !== "string" && !field.oneOf.some((key) => mapped.has(key))) throw new Error(`${toolId} demo is missing one of: ${field.oneOf.join(", ")}`);
      });
    });
  });

  it("action survival: generic action demo supports both duration and date modes", () => {
    const demo = buildDemoCsv("subscription_survival");
    expect(demo.fileName).toBe("demo_action_survival.csv");
    expect(demo.headers).toEqual(expect.arrayContaining([
      "Action Survival Duration", "Dropout Observed", "Action Start Date",
      "Action Exit Date", "Action Observation End Date", "Observation Entry",
      "Action Type", "Campaign Name",
    ]));

    const mapped = getMappedRows(demo);
    const periods = normalizeSurvivalRows(mapped, { timeUnit: "month" });
    const dates = normalizeDateSurvivalRows(mapped, { timeUnit: "month", observationEndDate: "2025-12-31" });
    for (const prepared of [periods, dates]) {
      expect(prepared.excludedRows).toEqual([]);
      expect(prepared.validRows.length).toBeGreaterThanOrEqual(100);
      expect(prepared.eventCount).toBeGreaterThan(20);
      expect(prepared.censoredCount).toBeGreaterThan(20);
      expect(prepared.leftTruncatedCount).toBeGreaterThan(0);
      const table = kaplanMeier(prepared.validRows);
      expect(table.length).toBeGreaterThan(4);
      expect(discreteHazard(table).maxHazard).toEqual(expect.objectContaining({ time: expect.any(Number) }));
    }
    expect(new Set(mapped.map((row) => row.channel)).size).toBe(3);
    expect(new Set(mapped.map((row) => row.event_type)).size).toBeGreaterThanOrEqual(3);
    expect(new Set(mapped.map((row) => row.campaign_name)).size).toBe(2);

    const comparisons = ["channel", "event_type", "campaign_name"].map((field) => {
      const groups = [...new Set(mapped.map((row) => row[field]))].map((name) => ({
        name,
        rows: periods.validRows.filter((row) => row.source?.[field] === name),
      }));
      expect(groups.every((group) => group.rows.some((row) => row.event === 1)), `${field} needs an observed exit in every demo segment`).toBe(true);
      const comparison = logRankTest(groups);
      expect(comparison.ok, `${field} comparison must be estimable in the demo`).toBe(true);
      return comparison;
    });
    expect(comparisons.some((comparison) => comparison.pValue < 0.05), "at least one demo segment must show an observed difference signal").toBe(true);

    const hazard = discreteHazard(kaplanMeier(periods.validRows)).rows;
    expect(hazard.filter((row) => row.time >= 7 && row.events > 0).length).toBeGreaterThan(0);
  });

  it("efficiency: retention < 설치·가입 both (리텐션 ≤ 100% 어느 분모든)", () => {
    const d = buildDemoCsv("efficiency");
    for (const r of d.raw) {
      // ret_d7·ret_d14는 잔존 인원 — 설치·가입 어느 기준으로도 분모를 못 넘어야 함.
      expect(r.ret_d7).toBeLessThan(r.installs);
      expect(r.ret_d7).toBeLessThan(r.actions);
      expect(r.ret_d14).toBeLessThanOrEqual(r.ret_d7);
    }
  });

  it("creative: concept matrix (message_angle × format) fills cells", () => {
    const d = buildDemoCsv("creative");
    const rows = getMappedRows({ raw: d.raw, headers: d.headers, mapping: d.mapping });
    const metrics = CREATIVE_STATS.deriveMetrics(rows);
    // attributes carried through
    expect(metrics.some((m) => m.message_angle && m.format)).toBe(true);
    const matrix = CREATIVE_STATS.conceptMatrix(
      metrics,
      { rows: "message_angle", cols: "format" },
      { minNCell: 5, minImpressions: 1000 }
    );
    expect(matrix.rows.length).toBeGreaterThanOrEqual(4);
    expect(matrix.cols.length).toBeGreaterThanOrEqual(4);
    // 다채로운 해석: 검증/데이터부족/미관측 상태가 모두 존재해야 함(전부 검증 X)
    const flat = matrix.grid.flat();
    const statuses = new Set(flat.map((c) => c.status));
    expect(statuses.has("validated")).toBe(true);
    expect(statuses.has("insufficient")).toBe(true);
    expect(statuses.has("empty")).toBe(true);
    expect(statuses.size).toBeGreaterThanOrEqual(3);
  });

  it("creative: demo supplies enough independent creatives and production features for RF and SVM", () => {
    const demo = buildDemoCsv("creative");
    const metrics = CREATIVE_STATS.deriveMetrics(getMappedRows(demo));
    const numericFeatures = ["duration_seconds", "text_length", "scene_cut_count", "face_screen_ratio", "speech_rate"];
    const design = buildCreativePredictiveInput({
      metrics,
      attributes: ["message_angle", "format", "hook_type", "cta_style", "first_3s", "has_text_overlay", "duration_bucket"],
      numericFeatures,
      metric: "ctr",
    });
    expect(metrics.length).toBeGreaterThanOrEqual(480);
    expect(design.ok).toBe(true);
    expect(prepareRandomForestInput(design)).toMatchObject({ ok: true });
    expect(prepareSvmInput({ ...design, numericFeatureCount: design.numericFeatureCount })).toMatchObject({ ok: true });
    expect(metrics.every((row) => Number(row.actions) > 0)).toBe(true);
  });

  it("demo quality guards keep user-visible optional paths and physical value ranges available", () => {
    const efficiency = buildDemoCsv("efficiency");
    expect(new Set(efficiency.raw.map((row) => row.source))).toEqual(new Set(["paid", "organic"]));
    expect(efficiency.raw.filter((row) => row.source === "organic").every((row) => Number(row.cost) === 0)).toBe(true);
    expect(efficiency.raw.every((row) => row.snapshot_date)).toBe(true);
    expect(buildDemoCsv("asa_keyword").raw.every((row) => row.country && Number(row.target_cpt) > 0)).toBe(true);
    expect(buildDemoCsv("brand_incrementality").raw.every((row) => row.country && row.channel && Number(row.cost) >= 0)).toBe(true);
    expect(buildDemoCsv("aso_store").raw.every((row) => row.country)).toBe(true);
    const titleLengths = buildDemoCsv("content_attr").raw.map((row) => Number(row.title_len));
    expect(Math.min(...titleLengths)).toBeGreaterThanOrEqual(20);
    expect(Math.max(...titleLengths)).toBeLessThanOrEqual(65);
  });

  it("uses English categorical values for English demo surfaces", () => {
    const d = buildDemoCsv("creative", "en");
    expect(d.raw.some((row) => String(row.message_angle).includes("할인혜택"))).toBe(false);
    expect(d.raw.some((row) => String(row.format).includes("플레이어블"))).toBe(false);
    expect(d.raw.some((row) => String(row.message_angle).includes("Discount offer"))).toBe(true);
  });

  it("efficiency: rows + funnel + saturation signal", () => {
    const d = buildDemoCsv("efficiency");
    expect(d.raw.length).toBeGreaterThan(300);
    const rows = getMappedRows({ raw: d.raw, headers: d.headers, mapping: d.mapping });
    const r0 = rows[0];
    expect(Number(r0.cost)).toBeGreaterThan(0);
    expect(Number(r0.installs)).toBeGreaterThan(0);
    // spend alias filled by getMappedRows
    expect(Number(r0.spend)).toBeGreaterThan(0);
    // funnel monotonic-ish: impressions > clicks > installs
    expect(Number(r0.impressions)).toBeGreaterThan(Number(r0.clicks));
    expect(Number(r0.clicks)).toBeGreaterThan(Number(r0.installs));
  });

  it("saturation: analyzeEntity yields a finite saturation index", () => {
    const d = buildDemoCsv("efficiency");
    const rows = getMappedRows({ raw: d.raw, headers: d.headers, mapping: d.mapping });
    const pts = satBuildPoints(rows, "channel", "installs");
    // Map(channel -> [{cost,res,...}]) — expect ≥1 channel with multiple points
    const entries = [...pts.entries()];
    expect(entries.length).toBeGreaterThan(0);
    const [, arr] = entries[0];
    expect(arr.length).toBeGreaterThan(5);
    // point = {x:cost, y:CPA}; CPA should rise with cost (diminishing returns)
    expect(arr.every((p) => Number(p.x) > 0 && Number(p.y) > 0)).toBe(true);
    const sorted = [...arr].sort((a, b) => a.x - b.x);
    expect(sorted[sorted.length - 1].y).toBeGreaterThan(sorted[0].y);
  });

  it("experiment: control vs test aggregate differ", () => {
    const d = buildDemoCsv("experiment");
    const mapped = getMappedRows(d); // in-app path uses getMappedRows (identity mapping)
    expect(mapped.length).toBe(d.raw.length);
    let cNum = 0, cDen = 0, tNum = 0, tDen = 0;
    for (const r of mapped) {
      const isC = Number(r.is_control) === 1;
      if (isC) { cNum += r.numerator; cDen += r.denominator; }
      else { tNum += r.numerator; tDen += r.denominator; }
    }
    const cCvr = cNum / cDen, tCvr = tNum / tDen;
    expect(tCvr).toBeGreaterThan(cCvr); // test arms lift
  });

  it("experiment: holdout differs from A/B — has spend/revenue → iROAS", () => {
    const d = buildDemoCsv("experiment");
    // holdout(control) vs exposed(test) with spend+revenue → incremental + iROAS
    let cNum = 0, cDen = 0, tNum = 0, tDen = 0, spend = 0, rev = 0;
    for (const r of getMappedRows(d)) {
      const g = String(r.holdout_group).toLowerCase();
      if (g.includes("holdout")) { cNum += r.numerator; cDen += r.denominator; }
      else if (g.includes("exposed")) { tNum += r.numerator; tDen += r.denominator; spend += Number(r.spend) || 0; rev += Number(r.revenue_d7) || 0; }
    }
    const incr = INCR_MATH.compute({ num: tNum, den: tDen, spend, rev }, { num: cNum, den: cDen });
    expect(incr.incrementalConv).toBeGreaterThan(0); // 광고가 만든 순증분
    expect(incr.iroas).toBeGreaterThan(0);           // 매출/비용 비율 산출 (A/B엔 없음)
    expect(spend).toBeGreaterThan(0);
  });

  it("response: signups vary and correlate with spend range", () => {
    const d = buildDemoCsv("response");
    expect(d.raw.length).toBeGreaterThanOrEqual(120);
    const sign = d.raw.map((r) => r.signups);
    expect(Math.max(...sign)).toBeGreaterThan(Math.min(...sign) * 1.2);
    expect(d.headers).toContain("google_spend");
    expect(d.headers).toContain("paid_signups");
    expect(d.raw.every((row) => row.paid_signups >= 0 && row.paid_signups <= row.signups)).toBe(true);
    expect(new Set(d.raw.map((row) => row.paid_signups)).size).toBeGreaterThan(20);
  });

  it("response: MMM demo has identifiable spend variation and non-negative absolute media contribution", () => {
    const d = buildDemoCsv("response");
    const channelKeys = d.headers.filter((header) => header.endsWith("_spend"));
    const panel = {
      week: d.raw.map((_, index) => index + 1),
      ch: Object.fromEntries(channelKeys.map((key) => [key, d.raw.map((row) => Number(row[key]) || 0)])),
      channels: channelKeys.map((key) => ({ key, label: key, kind: "perf" })),
      targets: { Regs: d.raw.map((row) => Number(row.signups) || 0) },
      dummy: {}, steps: {},
    };
    const cfg = { ...MMM_METH_CONFIG, absorbed: new Set() };
    cfg.absorbed = mmmResolveAbsorb(panel, cfg).absorbed;
    const run = mmmBayesianLikeRun(panel, cfg, "Regs", true, { enableBaselineSelection: true, skipTransformUncertainty: true });
    const health = mmmBayesianHealth(run);
    const mediaNames = new Set(run.channelMeta.map((channel) => channel.label));
    const mediaContribution = run.weeks.map((week) => Object.entries(week.contrib)
      .filter(([name]) => mediaNames.has(name))
      .reduce((sum, [, value]) => sum + value, 0));
    expect(run.identification.highCollinearity).toBe(false);
    expect(run.identification.budgetEligible).toBe(true);
    expect(run.identification.maxMediaVif).toBeLessThan(10);
    expect(run.rollingBacktest?.cuts?.length).toBeGreaterThanOrEqual(2);
    expect(run.backtest?.wmape).toEqual(expect.any(Number));
    expect(mediaContribution.every((value) => value >= -1e-8)).toBe(true);
    expect(health.negativeBaselineShare).toBe(0);
  }, 20_000);

  it("MMM prior evidence: exposes repeated on/off periods and named markets", () => {
    const demo = buildMmmPriorDemo();
    expect(demo.experiment.raw.some((row) => row.treatment_state === "on")).toBe(true);
    expect(demo.experiment.raw.some((row) => row.treatment_state === "off")).toBe(true);
    expect(new Set(demo.country.raw.map((row) => row.country))).toEqual(new Set(["JP", "TW", "SG", "US"]));
    expect(demo.country.headers).toContain("country");
  });

  it("aha: converted correlates with messages (gridSearch finds signal)", () => {
    const d = buildDemoCsv("aha");
    const targets = d.raw.map((r) => (r.converted >= 0.5 ? 1 : 0));
    const base = targets.reduce((s, t) => s + t, 0) / targets.length;
    expect(base).toBeGreaterThan(0.05);
    expect(base).toBeLessThan(0.95);
    const wc = [{ header: "messages_sent_7d", window: 7, valuesAll: d.raw.map((r) => r.messages_sent_7d) }];
    const idx = d.raw.map((_, i) => i);
    const gs = AHA_STATS.gridSearch(wc, targets, idx, idx, 10);
    expect(gs).not.toBeNull();
    expect(gs.holdout.P).toBeGreaterThan(base); // lift over base rate
  });
});
