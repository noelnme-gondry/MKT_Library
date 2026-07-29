import { describe, expect, it } from "vitest";
import {
  MMM_METH_CONFIG,
  mmmCannibalization,
} from "./mmmMath";
import {
  CANNIBAL_RANK,
  mmmCannibBucket,
  mmmRankCfg,
} from "./responseCannibRank";
import {
  buildLowSpendOutcomeSeries,
  lowSpendPointIndices,
} from "./responseCannibChart";
import { seededNoise } from "./testFixtures";

function directionalPanel(targetDirection = "opposite") {
  const week = Array.from({ length: 40 }, (_, index) => index + 1);
  const spend = week.map((_, index) => (
    Math.floor(index / 4) % 2 === 0 ? 100 : 220
  ));
  const target = spend.map((value) => (
    targetDirection === "opposite" ? 420 - value : 100 + value
  ));
  return {
    week,
    weekLabel: week.map(String),
    ch: { x: spend },
    dummy: {},
    targets: { Revenue: target },
    channels: [{ key: "x", label: "Prospecting", kind: "perf" }],
  };
}

describe("cannibal directional movement", () => {
  it("flags repeated spend-down/outcome-up and spend-up/outcome-down weeks", () => {
    const panel = directionalPanel("opposite");
    const result = mmmCannibalization(
      panel,
      MMM_METH_CONFIG,
      "Revenue",
      { coef: -0.3, ci_lo: -0.4, ci_hi: -0.2, p: 0.001, vif: 1.2 },
      "x",
    );

    expect(result.detrend_corr.directional).toMatchObject({
      informative_n: 9,
      opposite_n: 9,
      spend_down_target_up: 4,
      spend_up_target_down: 5,
      vote: "AGAINST",
    });
    expect(result.detrend_corr.vote).toBe("AGAINST");
    expect(result.verdict_class).toBe("cannibal");
  });

  it("recognizes repeated same-direction movement as defensive evidence", () => {
    const panel = directionalPanel("same");
    const result = mmmCannibalization(
      panel,
      MMM_METH_CONFIG,
      "Revenue",
      { coef: 0.3, ci_lo: 0.2, ci_hi: 0.4, p: 0.001, vif: 1.2 },
      "x",
    );

    expect(result.detrend_corr.directional).toMatchObject({
      informative_n: 9,
      same_n: 9,
      vote: "FOR",
    });
    expect(result.detrend_corr.vote).toBe("FOR");
    expect(result.verdict_class).toBe("ok");
  });

  it("keeps an always-on channel eligible when spend has enough variation", () => {
    const panel = directionalPanel("opposite");
    const eligibility = CANNIBAL_RANK.eligibility(
      panel.ch.x,
      panel.ch.x.length,
      mmmRankCfg(),
    );

    expect(eligibility.flights).toEqual([40]);
    expect(eligibility.flighted).toBe(false);
    expect(eligibility.eligible).toBe(true);
  });

  it("uses direction and net evidence even without a four-week low-spend block", () => {
    const week = Array.from({ length: 40 }, (_, index) => index + 1);
    const spend = week.map((_, index) => (index % 2 === 0 ? 100 : 220));
    const panel = {
      week,
      ch: { x: spend },
      dummy: {},
      targets: { Users: spend.map((value) => 420 - value) },
      channels: [{ key: "x", label: "Prospecting", kind: "perf" }],
    };
    const result = mmmCannibalization(
      panel,
      MMM_METH_CONFIG,
      "Users",
      { coef: -0.3, ci_lo: -0.4, ci_hi: -0.2, p: 0.001, vif: 1.2 },
      "x",
    );
    const eligibility = CANNIBAL_RANK.eligibility(
      spend,
      spend.length,
      mmmRankCfg(),
    );

    expect(result.precedence.vote).toBe("ABSTAIN");
    expect(result.detrend_corr.directional.opposite_n).toBe(39);
    expect(result.detrend_corr.vote).toBe("AGAINST");
    expect(result.identification.blocked).toBe(false);
    expect(result.verdict_class).toBe("cannibal");
    expect(eligibility.lowBlockMax).toBe(1);
    expect(eligibility.eligible).toBe(true);
  });

  it("keeps every detail vote withheld when the final identification gate closes", () => {
    const week = Array.from({ length: 40 }, (_, index) => index + 1);
    const panel = {
      week,
      ch: { x: week.map(() => 100) },
      dummy: {},
      targets: { Users: week.map((value) => 500 - value * 8) },
      channels: [{ key: "x", label: "Prospecting", kind: "perf" }],
    };
    const result = mmmCannibalization(
      panel,
      MMM_METH_CONFIG,
      "Users",
      { coef: -0.3, ci_lo: -0.4, ci_hi: -0.2, p: 0.001, vif: 1.2 },
      "x",
    );

    expect(result.identification.blocked).toBe(true);
    expect(result.votes).toEqual({ FOR: 0, AGAINST: 0, ABSTAIN: 3 });
    expect(result.precedence.vote).toBe("ABSTAIN");
    expect(result.detrend_corr.vote).toBe("ABSTAIN");
    expect(result.net_incrementality.vote).toBe("ABSTAIN");
    expect(result.verdict_class).toBe("not_identified");
  });

  it("counts a lagged Granger signal as the fourth check when one core check also warns", () => {
    const week = Array.from({ length: 84 }, (_, index) => index + 1);
    const spendNoise = seededNoise(801);
    const targetNoise = seededNoise(917);
    const spend = week.map(() => 7000 + spendNoise() * 3200);
    const target = week.map((_, index) => (
      90000 - 5 * spend[Math.max(0, index - 2)] + targetNoise() * 120
    ));
    const panel = {
      week,
      ch: { x: spend },
      dummy: {},
      targets: { Users: target },
      channels: [{ key: "x", label: "Prospecting", kind: "perf" }],
    };
    const result = mmmCannibalization(
      panel,
      MMM_METH_CONFIG,
      "Users",
      // ③의 유의 음 순증분과 ④의 시차 하락은 서로 다른 두 검정이다.
      { coef: -0.3, ci_lo: -0.4, ci_hi: -0.2, p: 0.001, vif: 1.2 },
      "x",
    );

    expect(result.granger_cannibal).toBe(true);
    // ①~③에는 ③만 AGAINST다. 과거 조건(AGAINST 2개 필요)에서는 ④가
    // 있어도 inconclusive였고, 이제 ③+④ 두 검정으로 승격한다.
    expect(result.votes.AGAINST).toBe(1);
    expect(result.verdict_class).toBe("cannibal");
  });

  it("uses the same marketer-facing bucket for summary and detail views", () => {
    expect(mmmCannibBucket({
      eligible: true,
      verdict_class: "ok",
      againstCount: 0,
      minAgainst: 2,
      leanNeg: false,
    })).toBe("ok");
    expect(mmmCannibBucket({
      eligible: true,
      verdict_class: "cannibal",
      againstCount: 2,
      minAgainst: 2,
      leanNeg: true,
    })).toBe("danger");
    expect(mmmCannibBucket({
      eligible: true,
      verdict_class: "inconclusive",
      againstCount: 1,
      minAgainst: 2,
      leanNeg: true,
    })).toBe("unclear");
  });

  it("plots orange points on exactly the weeks used by the p25 low-spend test", () => {
    const outcome = [10, 20, 30, 40, 50, 60];
    const spend = [10.1, 20.2, 30.3, 20.2, 40.4, Number.NaN];
    const p25 = 20.2;

    expect(buildLowSpendOutcomeSeries(outcome, spend, p25)).toEqual([
      10,
      20,
      null,
      40,
      null,
      null,
    ]);
    expect(lowSpendPointIndices(outcome, spend, p25)).toEqual([0, 1, 3]);
  });
});
