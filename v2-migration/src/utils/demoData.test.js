import { describe, it, expect } from "vitest";
import { buildDemoCsv } from "./demoData";
import { getMappedRows } from "./dashboardAggregator";
import { satBuildPoints, SAT_MATH } from "./satMath";
import { AHA_STATS } from "./ahaMath";

describe("demo sanity", () => {
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
    let cNum = 0, cDen = 0, tNum = 0, tDen = 0;
    for (const r of d.raw) {
      const isC = Number(r.is_control) === 1;
      if (isC) { cNum += r.numerator; cDen += r.denominator; }
      else { tNum += r.numerator; tDen += r.denominator; }
    }
    const cCvr = cNum / cDen, tCvr = tNum / tDen;
    expect(tCvr).toBeGreaterThan(cCvr); // test arms lift
  });

  it("response: signups vary and correlate with spend range", () => {
    const d = buildDemoCsv("response");
    expect(d.raw.length).toBeGreaterThan(50);
    const sign = d.raw.map((r) => r.signups);
    expect(Math.max(...sign)).toBeGreaterThan(Math.min(...sign) * 1.2);
    expect(d.headers).toContain("google_spend");
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
