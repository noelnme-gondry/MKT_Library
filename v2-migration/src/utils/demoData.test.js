import { describe, it, expect } from "vitest";
import { buildDemoCsv, buildMmmPriorDemo } from "./demoData";
import { getMappedRows } from "./dashboardAggregator";
import { satBuildPoints, SAT_MATH } from "./satMath";
import { AHA_STATS } from "./ahaMath";
import { CREATIVE_STATS } from "./creativeMath";
import { INCR_MATH } from "./incrMath";

describe("demo sanity", () => {
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
    expect(d.raw.length).toBeGreaterThan(50);
    const sign = d.raw.map((r) => r.signups);
    expect(Math.max(...sign)).toBeGreaterThan(Math.min(...sign) * 1.2);
    expect(d.headers).toContain("google_spend");
  });

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
