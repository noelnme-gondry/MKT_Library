import { describe, expect, it } from "vitest";
import { buildDemoCsv } from "./demoData";
import { mmmIRF, mmmTrendDirectionPlan } from "./mmmMath";

/*
 * ④ 시차 반응(IRF)과 추세 꺾임 선택의 2026-10 감사 계약.
 * - IRF는 같은 주 반응을 포함하고 95% 잔차 부트스트랩 구간을 낸다. 예전에는 같은 주
 *   반응을 0으로 고정해 데모의 실제 잠식 채널(tiktok)이 +4,083, 실제 증분 채널(google)이
 *   −888로 부호가 뒤집혀 나왔고, 구간이 없어 귀무 데이터의 우연한 누적(±250)과 구분이
 *   안 됐다.
 * - 추세 꺾임 개수는 원 KPI로 고른다(평활 곡선 BIC는 직선에도 꺾임 0개를 고르지 않았다).
 */
function rng(seed) {
  let state = seed >>> 0 || 1;
  return () => {
    state ^= state << 13; state >>>= 0;
    state ^= state >> 17;
    state ^= state << 5; state >>>= 0;
    return state / 4294967296;
  };
}
function gauss(random) {
  const u = Math.max(1e-12, random()), v = random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const demo = buildDemoCsv("response");
const signups = demo.raw.map((row) => Number(row.signups));
const spendOf = (key) => demo.raw.map((row) => Number(row[key]));

describe("mmmIRF", () => {
  it("recovers the generating sign of the demo channels, same-week response included", () => {
    const tiktok = mmmIRF(signups, spendOf("tiktok_spend"), { horizon: 12 });
    const brand = mmmIRF(signups, spendOf("brand_spend"), { horizon: 12 });
    const google = mmmIRF(signups, spendOf("google_spend"), { horizon: 12 });
    expect(tiktok.contemporaneous).toBe(true);
    expect(tiktok.cumTotal).toBeLessThan(0); // 데모 생성식: tiktok sign −1
    expect(brand.cumTotal).toBeGreaterThan(0);
    expect(google.cumTotal).toBeGreaterThan(0);
    expect(tiktok.irf[0]).not.toBe(0);
    expect(brand.cumulativeSignal).toBe("positive");
  });

  it("returns a 95% bootstrap band that brackets the point path and is deterministic", () => {
    const a = mmmIRF(signups, spendOf("brand_spend"), { horizon: 12 });
    const b = mmmIRF(signups, spendOf("brand_spend"), { horizon: 12 });
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
    expect(a.cumLo).toHaveLength(13);
    a.cum.forEach((value, index) => {
      expect(a.cumLo[index]).toBeLessThanOrEqual(a.cumHi[index]);
    });
    expect(a.ci).toBe("95% residual bootstrap");
  });

  it("mostly withholds a direction when spend has no effect", () => {
    let inconclusive = 0;
    const seeds = 30;
    for (let seed = 1; seed <= seeds; seed++) {
      const random = rng(seed * 131);
      let e = 0, level = 0;
      const y = Array.from({ length: 104 }, (_, i) => { e = 0.5 * e + gauss(random) * 400; return 6000 + 900 * Math.sin((i / 52) * 2 * Math.PI + 1) + e; });
      const x = Array.from({ length: 104 }, () => { level = 0.7 * level + gauss(random) * 0.4; return 20000 * Math.exp(level); });
      if (mmmIRF(y, x, { horizon: 12 }).cumulativeSignal === "inconclusive") inconclusive += 1;
    }
    expect(inconclusive / seeds).toBeGreaterThanOrEqual(0.8);
  }, 60_000);
});

describe("mmmTrendDirectionPlan", () => {
  it("keeps a straight trend straight under autocorrelated noise", () => {
    let zeroKnots = 0;
    for (let seed = 1; seed <= 30; seed++) {
      const random = rng(seed * 31 + 104);
      let e = 0;
      const y = Array.from({ length: 104 }, (_, i) => { e = 0.5 * e + gauss(random) * 120; return 2000 + 3 * i + e; });
      const plan = mmmTrendDirectionPlan({ week: y.map((_, i) => i + 1), targets: { y } }, "y");
      if (!plan.knots.length) zeroKnots += 1;
      expect(plan.segments.at(-1).direction).not.toBe("down");
    }
    expect(zeroKnots / 30).toBeGreaterThanOrEqual(0.7); // 수정 전 0/60
  });

  it("still finds a real V-shaped turn", () => {
    const random = rng(7);
    const y = Array.from({ length: 104 }, (_, i) => (i < 52 ? 3000 - 12 * i : 3000 - 12 * 52 + 15 * (i - 52)) + gauss(random) * 60);
    const plan = mmmTrendDirectionPlan({ week: y.map((_, i) => i + 1), targets: { y } }, "y");
    expect(plan.knots.length).toBeGreaterThanOrEqual(1);
    expect(plan.segments[0].direction).toBe("down");
    expect(plan.segments.at(-1).direction).toBe("up");
  });

  it("does not lock the growing demo baseline into a final decline", () => {
    const plan = mmmTrendDirectionPlan({ week: signups.map((_, i) => i + 1), targets: { Regs: signups } }, "Regs");
    expect(plan.segments.at(-1).direction).toBe("up"); // 수정 전: down,up,down
  });
});
