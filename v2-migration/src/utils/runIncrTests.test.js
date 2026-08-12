import { describe, it, expect } from "vitest";
import { INCR_MATH, parseHoldoutGroup } from "./incrMath";

// Golden test port of runIncrTests (index.html ~20105-20161).
// Same inputs, same expected values, same tolerances — verbatim.

describe("runIncrTests (golden parity)", () => {
  // control 1000명 5% (50), test 1000명 8% (80) → 반사실 50, 증분 30, lift +60%
  const r = INCR_MATH.compute(
    { num: 80, den: 1000, spend: 0, rev: 0 },
    { num: 50, den: 1000 },
  );

  it("T1 · 증분 전환 30", () => {
    expect(Math.round(r.incrementalConv)).toBe(30);
  });

  it("T2 · 상대 lift +60%", () => {
    expect(Math.abs(r.liftRel - 0.6) < 1e-9).toBe(true);
  });

  it("T3 · iROAS=1.0", () => {
    // iROAS: spend 300, rev 800 (test), revPerConv=10 → incrementalRev=300 → iroas=1.0
    const r2 = INCR_MATH.compute(
      { num: 80, den: 1000, spend: 300, rev: 800 },
      { num: 50, den: 1000 },
    );
    expect(Math.abs(r2.iroas - 1) < 1e-9).toBe(true);
  });

  it("T4 · 그룹 파싱", () => {
    const pg = [
      "test",
      "control",
      "holdout",
      "노출",
      "대조군",
      "exposed",
    ].map(parseHoldoutGroup);
    expect(pg.join(",")).toBe("test,control,control,test,control,test");
  });
});

// 감사 P1-1: 통제군 탭이 CI·유의성 없이 "광고가 만든 증분 N건"을 확정 서술했다.
describe("INCR_MATH.compute · 유의성·95% CI (§8.4)", () => {
  it("노이즈 범위 차이는 conclusive=false (판단 보류)", () => {
    // 홀드아웃 100명 중 3전환(3.0%) vs 노출 10,000명 중 320전환(3.2%)
    const r = INCR_MATH.compute({ num: 320, den: 10000, spend: 1000, rev: 5000 }, { num: 3, den: 100 });
    expect(r.conclusive).toBe(false);
    expect(r.ciLow95).toBeLessThan(0);
    expect(r.ciHigh95).toBeGreaterThan(0);
    expect(r.nTest).toBe(10000);
    expect(r.nControl).toBe(100);
  });

  it("명확한 차이는 conclusive=true + CI가 0을 배제", () => {
    const r = INCR_MATH.compute({ num: 800, den: 10000 }, { num: 300, den: 10000 });
    expect(r.conclusive).toBe(true);
    expect(r.ciLow95).toBeGreaterThan(0);
    expect(r.pValue).toBeLessThan(0.001);
  });

  it("기존 증분 지표는 불변 (additive only)", () => {
    const r = INCR_MATH.compute({ num: 800, den: 10000 }, { num: 300, den: 10000 });
    expect(r.tRate).toBeCloseTo(0.08, 10);
    expect(r.cRate).toBeCloseTo(0.03, 10);
    expect(r.incrementalConv).toBeCloseTo(500, 10);
  });
});
