import { describe, it, expect } from "vitest";
import { STATS } from "./abTestMath";

// Golden scenarios plus v2 statistical-integrity regressions.
const massReadout = (arms) => STATS.massReadout(arms);

describe("runMassReadoutTests (golden parity)", () => {
  it("T1 · 명확한 positive → sig+lift+probBWins", () => {
    const r1 = massReadout([
      { name: "control", n: 10000, x: 500, isControl: true },
      { name: "variant_b", n: 10000, x: 650, isControl: false },
    ]);
    const row1 = r1.rows.find((r) => !r.isControl);
    expect(row1).toBeTruthy();
    expect(row1.sig).toBe(true);
    expect(row1.liftRel).toBeGreaterThan(0);
    expect(row1.probBWins).toBeGreaterThan(0.9);
  });

  it("T2 · 명확한 negative → sig+lift<0+probBWins낮음", () => {
    const r2 = massReadout([
      { name: "control", n: 10000, x: 650, isControl: true },
      { name: "variant_c", n: 10000, x: 500, isControl: false },
    ]);
    const row2 = r2.rows.find((r) => !r.isControl);
    expect(row2).toBeTruthy();
    expect(row2.sig).toBe(true);
    expect(row2.liftRel).toBeLessThan(0);
    expect(row2.probBWins).toBeLessThan(0.1);
  });

  it("T3 · is_control 없을 때 첫 행 fallback", () => {
    const r3 = massReadout([
      { name: "alpha", n: 5000, x: 300, isControl: false },
      { name: "beta", n: 5000, x: 320, isControl: false },
    ]);
    expect(r3.control).toBeTruthy();
    expect(r3.control.name).toBe("alpha");
    expect(r3.rows[0].isControl).toBe(true);
  });

  it("T4 · massReadout 결정론", () => {
    const arms = [
      { name: "control", n: 8000, x: 400, isControl: true },
      { name: "v1", n: 8000, x: 460, isControl: false },
    ];
    const m1 = JSON.stringify(massReadout(arms));
    const m2 = JSON.stringify(massReadout(arms));
    expect(m1).toBe(m2);
  });

  it("T5 · MDE↔SampleSize 라운드트립", () => {
    const baseline = 0.05;
    const mde0 = 0.2; // 20% relative
    const nFromMde = STATS.sampleSizePerArm({
      baseline,
      mdeRelative: mde0,
      alpha: 0.05,
      power: 0.8,
    }).n;
    const mdeFromN = STATS.mdeForSampleSize({
      baseline,
      n: nFromMde,
      alpha: 0.05,
      power: 0.8,
    });
    const roundtripErr = Math.abs(mdeFromN - mde0) / mde0;
    expect(roundtripErr).toBeLessThan(0.05);
  });

  it("T6 · powerCurve MDE 단조감소", () => {
    const curve = STATS.powerCurve({
      baseline: 0.05,
      alpha: 0.05,
      power: 0.8,
      points: 12,
    });
    const valid = curve.filter((p) => p.mdePct != null);
    const monotone = valid.every(
      (p, i) => i === 0 || p.mdePct <= valid[i - 1].mdePct + 1e-9,
    );
    expect(monotone).toBe(true);
  });

  it("T7 · powerCurve 결정론", () => {
    const c1 = JSON.stringify(
      STATS.powerCurve({ baseline: 0.05, alpha: 0.05, power: 0.8 }),
    );
    const c2 = JSON.stringify(
      STATS.powerCurve({ baseline: 0.05, alpha: 0.05, power: 0.8 }),
    );
    expect(c1).toBe(c2);
  });

  it("T8 · 다중 변형은 Holm 보정 p-value를 판정에 사용", () => {
    const result = massReadout([
      { name: "control", n: 5000, x: 250, isControl: true },
      { name: "v1", n: 5000, x: 285, isControl: false },
      { name: "v2", n: 5000, x: 275, isControl: false },
      { name: "v3", n: 5000, x: 260, isControl: false },
    ]);
    const variants = result.rows.filter((row) => !row.isControl);
    expect(variants.every((row) => row.pValue >= row.rawPValue)).toBe(true);
    const byRaw = [...variants].sort((a, b) => a.rawPValue - b.rawPValue);
    let prior = 0;
    byRaw.forEach((row, index) => {
      const expected = Math.min(1, Math.max(prior, row.rawPValue * (byRaw.length - index)));
      expect(row.pValue).toBeCloseTo(expected, 12);
      prior = expected;
    });
  });

  it("T9 · raw p<.05 하나만으로 다중 변형 유의를 선언하지 않음", () => {
    const result = massReadout([
      { name: "control", n: 5000, x: 250, isControl: true },
      { name: "borderline", n: 5000, x: 295, isControl: false },
      { name: "v2", n: 5000, x: 260, isControl: false },
      { name: "v3", n: 5000, x: 255, isControl: false },
    ]);
    const borderline = result.rows.find((row) => row.name === "borderline");
    expect(borderline.rawPValue).toBeLessThan(0.05);
    expect(borderline.pValue).toBeGreaterThanOrEqual(0.05);
    expect(borderline.sig).toBe(false);
  });

  it.each([
    { xA: 1000, xB: 1200, minimum: 0.999 },
    { xA: 100, xB: 150, minimum: 0.99 },
  ])("T10 · 백만 표본 저전환에서도 posterior 방향을 보존 ($xA→$xB)", ({ xA, xB, minimum }) => {
    const result = massReadout([
      { name: "control", n: 1_000_000, x: xA, isControl: true },
      { name: "variant", n: 1_000_000, x: xB, isControl: false },
    ]);
    const variant = result.rows.find((row) => !row.isControl);
    const direct = STATS.bayesianAB({ nA: 1_000_000, xA, nB: 1_000_000, xB });
    expect(variant.probBWins).toBeGreaterThan(minimum);
    expect(variant.probBWins).toBeCloseTo(direct.probBWins, 12);
  });
});
