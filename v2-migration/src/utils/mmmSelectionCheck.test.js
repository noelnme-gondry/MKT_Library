import { describe, expect, it } from "vitest";
import { buildDemoCsv } from "./demoData";
import { MMM_METH_CONFIG, mmmBayesianLikeRun, mmmBayesianRun, mmmResolveAbsorb } from "./mmmMath";

/*
 * 변환 선택 편향 검사(docs/mmm-transform-selection-crossfit-spec.md §7).
 * 채널마다 adstock·포화 모양 후보 수십 개 중 잔차와 가장 맞는 것을 고른 뒤 그 모양을
 * 고정된 것처럼 구간을 계산하면, 효과 없는 채널도 우연히 맞는 후보 덕에 IDENTIFIED가
 * 된다(2026-10 감사: 합성 잡음 채널 24%). 계약은 판정 규칙의 이름이 아니라 잡음·진짜
 * 채널의 식별률이다. 결정론: 시드 고정 xorshift.
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

// 독립 AR(1) 지출 3채널 + 추세·계절·AR(1) 잡음. effects[c]는 1M 지출(adstock 0.3)당 성과.
function syntheticPanel(seed, effects, n) {
  const random = rng(seed * 104729 + 7);
  const ch = {};
  const channels = [];
  effects.forEach((_, c) => {
    const key = `c${c}`;
    channels.push({ key, label: `Ch${c}`, kind: "perf" });
    let level = 0;
    ch[key] = Array.from({ length: n }, () => {
      level = 0.6 * level + gauss(random) * 0.4;
      return Math.max(0, 1e6 * (1 + c) * Math.exp(level));
    });
  });
  let noise = 0;
  const y = Array.from({ length: n }, (_, i) => {
    noise = 0.4 * noise + gauss(random) * 150;
    let media = 0;
    effects.forEach((effect, c) => {
      let adstock = 0;
      for (let k = 0; k <= i; k++) adstock = ch[`c${c}`][k] / 1e6 + 0.3 * adstock;
      media += effect * adstock;
    });
    return 3000 + 4 * i + 300 * Math.sin((2 * Math.PI * (i + 1)) / 52.18) + noise + media;
  });
  return { week: Array.from({ length: n }, (_, i) => i + 1), targets: { y }, ch, channels, dummy: {}, steps: {}, external: {} };
}

const runOptions = (selectionCheck) => ({
  enableBaselineSelection: true,
  enableBusinessContributionPrior: true,
  skipTransformUncertainty: true,
  selectionCheck,
});

function identifiedRate(effects, n, { seeds = 60, selectionCheck = true } = {}) {
  let identified = 0, total = 0;
  const methods = new Set();
  for (let seed = 1; seed <= seeds; seed++) {
    const panel = syntheticPanel(seed, effects, n);
    const run = mmmBayesianLikeRun(panel, { ...MMM_METH_CONFIG, absorbed: new Set() }, "y", false, runOptions(selectionCheck));
    run.channelMeta.forEach((channel) => {
      const identification = run.posteriorApproximation.channelIdentification[channel.key];
      total += 1;
      if (identification.verdict === "IDENTIFIED") identified += 1;
      if (identification.selectionCheck) methods.add(identification.selectionCheck.method);
    });
  }
  return { rate: identified / total, total, methods: [...methods] };
}

function demoPanel(extra = null) {
  const demo = buildDemoCsv("response");
  const keys = demo.headers.filter((header) => header.endsWith("_spend"));
  const panel = {
    week: demo.raw.map((_, index) => index + 1),
    ch: Object.fromEntries(keys.map((key) => [key, demo.raw.map((row) => Number(row[key]) || 0)])),
    channels: keys.map((key) => ({ key, label: key, kind: key === "brand_spend" ? "brand" : "perf" })),
    targets: { Regs: demo.raw.map((row) => Number(row.signups) || 0) },
    dummy: {}, steps: {},
  };
  if (extra) {
    panel.ch.noise_spend = extra(panel.week.length);
    panel.channels.push({ key: "noise_spend", label: "noise_spend", kind: "perf" });
  }
  const cfg = { ...MMM_METH_CONFIG, absorbed: new Set() };
  cfg.absorbed = mmmResolveAbsorb(panel, cfg).absorbed;
  return { panel, cfg };
}
const verdicts = (run) => Object.fromEntries(run.channelMeta.map((channel) => [
  channel.key,
  run.posteriorApproximation.channelIdentification[channel.key].verdict,
]));

describe("transform selection check — null and power calibration", () => {
  it("A1·A8: cross-fit keeps noise channels from being identified (104 weeks)", () => {
    const withCheck = identifiedRate([0, 0, 0], 104);
    expect(withCheck.total).toBe(180);
    expect(withCheck.methods).toEqual(["block-cross-fit"]);
    expect(withCheck.rate).toBeLessThanOrEqual(0.08); // 측정 5.6%
    // 검사를 끄면 같은 데이터에서 실패해야 이 테스트가 검사를 지킨다(측정 24%).
    expect(identifiedRate([0, 0, 0], 104, { selectionCheck: false }).rate).toBeGreaterThan(0.15);
  }, 120_000);

  it("A2: real channels stay identified (104 weeks)", () => {
    const result = identifiedRate([100, 100, 100], 104);
    expect(result.rate).toBeGreaterThanOrEqual(0.85); // 측정 93%
  }, 120_000);

  it("A3: the multiplicity-adjusted fallback holds the null on short histories (60 weeks)", () => {
    const result = identifiedRate([0, 0, 0], 60);
    expect(result.methods).toEqual(["multiplicity-adjusted"]);
    expect(result.rate).toBeLessThanOrEqual(0.08); // 측정 3.3%, 검사 전 17%
  }, 120_000);

  it("A4: short histories keep most real channels (conservative approximation)", () => {
    expect(identifiedRate([100, 100, 100], 60).rate).toBeGreaterThanOrEqual(0.6); // 측정 82%
  }, 120_000);
});

describe("transform selection check — demo data", () => {
  it("A5: the demo verdicts are unchanged", () => {
    const { panel, cfg } = demoPanel();
    const run = mmmBayesianLikeRun(panel, cfg, "Regs", false, runOptions(true));
    expect(verdicts(run)).toEqual({
      google_spend: "IDENTIFIED",
      meta_spend: "IDENTIFIED",
      tiktok_spend: "BOUNDARY/UNIDENTIFIED",
      brand_spend: "IDENTIFIED",
    });
    const google = run.posteriorApproximation.channelIdentification.google_spend.selectionCheck;
    expect(google.method).toBe("block-cross-fit");
    expect(google.blocks).toBe(8);
    expect(google.passed).toBe(true);
  }, 60_000);

  it("A6: an added noise channel is never identified", () => {
    for (let seed = 1; seed <= 6; seed++) {
      const random = rng(seed * 97);
      let level = 0;
      const { panel, cfg } = demoPanel((n) => Array.from({ length: n }, () => {
        level = 0.6 * level + gauss(random) * 0.45;
        return Math.round(25000 * Math.exp(level));
      }));
      const run = mmmBayesianLikeRun(panel, cfg, "Regs", false, runOptions(true));
      expect(verdicts(run).noise_spend).not.toBe("IDENTIFIED");
    }
  }, 120_000);

  it("A7: the check costs less than 300ms on the demo panel", () => {
    const { panel, cfg } = demoPanel();
    const best = { on: Infinity, off: Infinity };
    for (let round = 0; round < 3; round++) {
      for (const [key, selectionCheck] of [["off", false], ["on", true]]) {
        const start = performance.now();
        mmmBayesianRun(panel, cfg, "Regs", false, { skipTransformUncertainty: true, selectionCheck });
        best[key] = Math.min(best[key], performance.now() - start);
      }
    }
    expect(best.on - best.off).toBeLessThan(300);
  }, 120_000);

  it("A10: only the verdict changes — coefficients, contributions and weeks are identical", () => {
    const { panel, cfg } = demoPanel();
    const on = mmmBayesianLikeRun(panel, cfg, "Regs", false, runOptions(true));
    const off = mmmBayesianLikeRun(panel, cfg, "Regs", false, runOptions(false));
    expect(on.absoluteBeta).toEqual(off.absoluteBeta);
    expect(on.params).toEqual(off.params);
    expect(on.weeks).toEqual(off.weeks);
    Object.keys(off.channelContributions).forEach((key) => {
      expect(on.channelContributions[key].totalMean).toBe(off.channelContributions[key].totalMean);
      expect(on.channelContributions[key].weeklyMean).toEqual(off.channelContributions[key].weeklyMean);
    });
    expect(off.selectionCheck).toBeUndefined();
    expect(on.posteriorApproximation.selectionCheck).toEqual({ enabled: true, blocks: 8, buffer: 4, method: "block-cross-fit" });
  }, 60_000);
});

describe("transform selection check — contract", () => {
  it("demotes an interval-identified channel that fails the check, with a reason code", () => {
    let demoted = null;
    for (let seed = 1; seed <= 60 && !demoted; seed++) {
      const run = mmmBayesianLikeRun(syntheticPanel(seed, [0, 0, 0], 104), { ...MMM_METH_CONFIG, absorbed: new Set() }, "y", false, runOptions(true));
      demoted = Object.values(run.posteriorApproximation.channelIdentification).find((item) => item.reason === "selection-not-replicated") || null;
    }
    expect(demoted).not.toBeNull();
    expect(demoted.verdict).toBe("ABSTAIN");
    expect(demoted.selectionCheck.passed).toBe(false);
    expect(demoted.selectionCheck.z).toBeLessThanOrEqual(demoted.selectionCheck.threshold);
  }, 120_000);

  it("is deterministic", () => {
    const panel = syntheticPanel(3, [40, 0, 0], 60);
    const first = mmmBayesianLikeRun(panel, { ...MMM_METH_CONFIG, absorbed: new Set() }, "y", false, runOptions(true));
    const second = mmmBayesianLikeRun(panel, { ...MMM_METH_CONFIG, absorbed: new Set() }, "y", false, runOptions(true));
    expect(second.selectionCheck).toEqual(first.selectionCheck);
    const check = first.selectionCheck.channels.c0;
    expect(check.method).toBe("multiplicity-adjusted");
    expect(check.effectiveCandidates).toBeGreaterThanOrEqual(1);
    expect(check.threshold).toBeGreaterThan(1.645);
  });
});
