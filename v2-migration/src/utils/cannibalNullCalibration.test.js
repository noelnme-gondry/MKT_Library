import { describe, expect, it } from "vitest";
import {
  MMM_METH_CONFIG,
  mmmCannibalization,
  mmmChannelCoverage,
  mmmElasticities,
  mmmGranger,
} from "./mmmMath";
import {
  CANNIBAL_RANK,
  mmmBuildCannibRank,
  mmmCannibActionShort,
  mmmCannibBucket,
  mmmCannibLevel,
  mmmGlobalCannib,
  mmmRankCfg,
} from "./responseCannibRank";

/*
 * 잠식 4검증의 귀무 보정(2026-10 감사). 효과가 없는 데이터에서 "잠식"이 얼마나 자주
 * 나오는지를 직접 잰다 — 판정 규칙의 이름이 아니라 오탐률이 계약이다.
 *   ① 저지출 주 안의 시간 기울기만 보던 시절: 성장하는 오가닉에서 채널의 93%가
 *      "잠식 쪽" 표, 4채널 전역 판정 28%가 "잠식 우려"였다.
 *   ② r ≤ −0.2 임계만 보던 시절: 40주 귀무에서 1/3이 "잠식 신호".
 *   ④ 그랜저는 시차를 고르지 않고 최대 시차로 고정해 검정한다(옛 AIC 선택은 표본 수가
 *      달라 비교가 성립하지 않았고 사실상 늘 최대 시차였다 — 동작은 같고 명시만 됐다).
 * 결정론: 시드 고정 xorshift. 임계는 관측값(수정 후 ~2~7%)보다 넉넉하게 두되 수정
 * 전 값은 확실히 걸러지게 잡았다.
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

function nullPanel(seed, { n = 104, trend = 0, channels = 4, effect = 0 } = {}) {
  const random = rng(seed * 7919 + 13);
  const ch = {};
  const channelMeta = [];
  for (let c = 0; c < channels; c++) {
    const key = `c${c}`;
    channelMeta.push({ key, label: `Ch${c}`, kind: "perf" });
    let level = 0;
    ch[key] = Array.from({ length: n }, (_, i) => {
      level = 0.7 * level + gauss(random) * 0.35;
      return Math.max(0, 1e6 * Math.exp(level) * (1 + 0.3 * Math.sin((2 * Math.PI * i) / 52.18)));
    });
  }
  let noise = 0;
  const organic = Array.from({ length: n }, (_, i) => {
    noise = 0.6 * noise + gauss(random) * 60;
    const media = effect ? effect * Math.log1p(ch.c0[i]) : 0;
    return 2000 + trend * i + 200 * Math.sin((2 * Math.PI * (i + 1)) / 52.18) + noise + media;
  });
  return { week: Array.from({ length: n }, (_, i) => i + 1), targets: { organic }, ch, channels: channelMeta, dummy: {}, steps: {}, external: {} };
}

function runCannib(panel) {
  const cfg = { ...MMM_METH_CONFIG, absorbed: new Set() };
  const elasticities = mmmElasticities(panel, cfg, "organic", cfg.defaultLam);
  const byChannel = {};
  const keys = [];
  panel.channels.forEach((channel) => {
    const e = elasticities.find((item) => item.var === `ln_${channel.key}`);
    const net = e ? { coef: e.coef, ci_lo: e.ci_lo, ci_hi: e.ci_hi, p: e.p } : { coef: 0, ci_lo: -1, ci_hi: 1, p: 1 };
    byChannel[channel.key] = mmmCannibalization(panel, cfg, "organic", net, channel.key, "ko");
    keys.push(channel.key);
  });
  const coverage = mmmChannelCoverage(panel, cfg);
  const identified = keys.filter((key) => CANNIBAL_RANK.eligibility(panel.ch[key], coverage[key].nonzero, mmmRankCfg()).eligible);
  return {
    byChannel,
    global: mmmGlobalCannib(byChannel, identified),
    rank: mmmBuildCannibRank(panel, "organic", byChannel, coverage, keys),
  };
}

describe("cannibalization null calibration", () => {
  it("does not read organic growth as cannibalization (check ① compares low- vs high-spend slopes)", () => {
    let channels = 0, precedenceAgainst = 0, globalCannibal = 0;
    const seeds = 40;
    for (let seed = 1; seed <= seeds; seed++) {
      const { byChannel, global } = runCannib(nullPanel(seed, { trend: 6 }));
      Object.values(byChannel).forEach((result) => {
        channels += 1;
        if (result.precedence.vote === "AGAINST") precedenceAgainst += 1;
      });
      if (global.verdict_class === "cannibal") globalCannibal += 1;
    }
    expect(channels).toBe(160);
    expect(precedenceAgainst / channels).toBeLessThan(0.15); // 수정 전 0.93
    expect(globalCannibal / seeds).toBeLessThan(0.15); // 수정 전 0.28
  }, 60_000);

  it("still finds a real cannibal channel", () => {
    let caught = 0;
    const seeds = 30;
    for (let seed = 1; seed <= seeds; seed++) {
      const { byChannel } = runCannib(nullPanel(seed, { effect: -60 }));
      if (byChannel.c0.verdict_class === "cannibal") caught += 1;
    }
    expect(caught / seeds).toBeGreaterThan(0.5);
  }, 60_000);

  it("requires significance at the autocorrelation-adjusted sample size for check ②", () => {
    let channels = 0, detrendAgainst = 0;
    for (let seed = 1; seed <= 40; seed++) {
      const { byChannel } = runCannib(nullPanel(seed, { n: 40, channels: 3 }));
      Object.values(byChannel).forEach((result) => {
        if (result.identification.blocked) return;
        channels += 1;
        if (result.detrend_corr.vote === "AGAINST") detrendAgainst += 1;
        expect(result.detrend_corr.n_eff_detrended).toBeLessThanOrEqual(40);
        expect(result.detrend_corr.p_detrended).toBeGreaterThanOrEqual(0);
      });
    }
    expect(channels).toBeGreaterThan(60);
    expect(detrendAgainst / channels).toBeLessThan(0.12); // 수정 전 0.33
  }, 60_000);

  it("keeps the cannibal-direction Granger rejection rate near nominal", () => {
    let tests = 0, rejections = 0, cannibalDirection = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const random = rng(seed * 31 + 7);
      let e = 0, level = 0;
      const n = 60;
      const y = Array.from({ length: n }, (_, i) => { e = 0.6 * e + gauss(random) * 400; return 6000 + 3 * i + e; });
      const x = Array.from({ length: n }, () => { level = 0.7 * level + gauss(random) * 0.4; return 20000 * Math.exp(level); });
      const result = mmmGranger(y, x, 6);
      tests += 1;
      if (result.spend_to_organic.p < 0.05) rejections += 1;
      if (result.spend_to_organic.p < 0.05 && result.spend_to_organic.coefSum < 0) cannibalDirection += 1;
    }
    // 판정에 쓰는 것은 "유의 + 음의 계수합"(명목 ≈ 2.5%)이다. 지속성 높은 시계열의
    // 소표본 F검정은 다소 부푼다(이 설계 6%, AR 0.9에서 양측 8~12%) — 알려진 한계라
    // ④는 단독으로 판정하지 않고 ①~③ 중 하나와 겹칠 때만 판정을 올린다.
    expect(cannibalDirection / tests).toBeLessThan(0.08);
    expect(rejections / tests).toBeLessThan(0.14);
  }, 60_000);

  it("detects a pure two-week lagged effect at the fixed lag order", () => {
    const random = rng(99);
    let level = 0;
    const x = Array.from({ length: 84 }, () => { level = 0.5 * level + gauss(random) * 0.4; return 7000 * Math.exp(level); });
    const y = x.map((_, i) => 90000 - 5 * x[Math.max(0, i - 2)] + gauss(random) * 120);
    const result = mmmGranger(y, x, 6);
    expect(result.spend_to_organic.p).toBeLessThan(0.001);
    expect(result.spend_to_organic.coefSum).toBeLessThan(0);
  });
});

describe("cannibalization labels follow the bucket", () => {
  it("never shows a holdout-priority action inside the ok bucket", () => {
    for (let seed = 1; seed <= 12; seed++) {
      const { rank } = runCannib(nullPanel(seed, { trend: 6 }));
      rank.forEach((row) => {
        const bucket = mmmCannibBucket(row);
        const action = mmmCannibActionShort(row, "ko");
        if (bucket === "ok") {
          expect(action).not.toMatch(/1순위|후보/);
        }
        if (mmmCannibLevel(row).lv >= 5) expect(action).toMatch(/holdout/);
      });
    }
  }, 60_000);

  it("names a single leaning check instead of promoting it to a holdout candidate", () => {
    const row = { eligible: true, verdict_class: "inconclusive", againstCount: 1, minAgainst: 2, leanNeg: false, gated: false, flighted: false, badge: "중" };
    expect(mmmCannibBucket(row)).toBe("ok");
    expect(mmmCannibActionShort(row, "ko")).toBe("신호 1개 · 모니터");
    expect(mmmCannibActionShort(row, "en")).toBe("One signal · monitor");
  });
});
