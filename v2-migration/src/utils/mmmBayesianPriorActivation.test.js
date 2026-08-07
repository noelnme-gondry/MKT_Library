import { describe, expect, it } from "vitest";
import { MMM_METH_CONFIG, mmmBayesianLikeRun } from "./mmmMath";

// T1: 정보 prior(지출점유 기반) 활성화 골든.
// - 기본(flag 없음/false) = 평면 OLS, 기존 동작 byte-동일(회귀 가드).
// - true = 지출점유 약정보 prior 결합 → 계수 이동 + businessContributionPrior.enabled.
// - 양쪽 모두 결정론(같은 입력 → byte-동일).
function priorPanel(length = 80) {
  const week = Array.from({ length }, (_, index) => index + 1);
  const perfA = week.map((value) => 80 + (value % 9) * 7);
  const perfB = week.map((value) => 45 + (value % 5) * 11);
  const brandA = week.map((value) => (value % 4 === 0 ? 180 : 25));
  const brandB = week.map((value) => (value % 7 === 0 ? 140 : 15));
  const rr = week.map((value, index) =>
    1200 - value * 1.5 + 0.8 * perfA[index] + 0.5 * perfB[index] +
    0.25 * brandA[index] + 0.2 * brandB[index] + Math.sin(value / 8) * 15,
  );
  return {
    week,
    weekLabel: week.map((value) => `2024-W${String(value).padStart(2, "0")}`),
    dateLabel: week.map((value) => `2024-W${String(value).padStart(2, "0")}`),
    ch: { perfA, perfB, brandA, brandB },
    channels: [
      { key: "perfA", label: "Performance A", kind: "perf" },
      { key: "perfB", label: "Performance B", kind: "perf" },
      { key: "brandA", label: "Brand A", kind: "brand" },
      { key: "brandB", label: "Brand B", kind: "brand" },
    ],
    external: {}, externalDefs: [], dummy: {}, dummyDefs: [], steps: {}, stepDefs: [],
    useDummies: false, targets: { Regs: rr },
  };
}

const CFG = {
  ...MMM_METH_CONFIG,
  trendDirectionFirst: false,
  seasonalityPeriods: [],
  seasonalityCandidates: [{ id: "none", periods: [] }],
  jointStructureSeasonalityIds: ["none"],
  jointStructureTrendFamilies: [0],
  adstockGrid: [0, 0.4],
  bayesHalfSaturationQuantiles: [0.6],
  bayesHillSlopeGrid: [1],
  bayesMaxProfileCandidates: 2,
  bayesMaxTotalProfileFits: 8,
  mediaPenaltyCandidates: [1],
  absorbed: new Set(),
};
const RUN_OPTS = {
  skipTransformUncertainty: true,
  enableJointStructureSelection: false,
  enableBaselineSelection: false,
  enableMediaPenaltySelection: false,
  draws: 400,
};

describe("MMM T1 — 정보 prior 활성화 (mmmBayesianLikeRun enableBusinessContributionPrior)", () => {
  it("기본값(flag 없음)은 평면 OLS이고 prior:false와 byte-동일 (회귀 가드)", () => {
    const panel = priorPanel();
    const noFlag = mmmBayesianLikeRun(panel, CFG, "Regs", false, { ...RUN_OPTS });
    const explicitFalse = mmmBayesianLikeRun(panel, CFG, "Regs", false, {
      ...RUN_OPTS,
      enableBusinessContributionPrior: false,
    });
    expect(noFlag.businessContributionPrior?.enabled).toBeFalsy();
    expect(explicitFalse.businessContributionPrior?.enabled).toBeFalsy();
    expect(explicitFalse.posterior.beta).toEqual(noFlag.posterior.beta);
  }, 30000);

  it("prior=true면 지출점유 약정보 prior가 결합되고 계수가 이동한다", () => {
    const panel = priorPanel();
    const flat = mmmBayesianLikeRun(panel, CFG, "Regs", false, { ...RUN_OPTS });
    const informed = mmmBayesianLikeRun(panel, CFG, "Regs", false, {
      ...RUN_OPTS,
      enableBusinessContributionPrior: true,
    });
    expect(flat.businessContributionPrior?.enabled).toBeFalsy();
    expect(informed.businessContributionPrior?.enabled).toBe(true);
    expect(informed.businessContributionPrior.channelCount).toBeGreaterThan(0);
    // prior 결합은 계수를 지출점유 쪽으로 수축 → 최소 한 채널 계수가 달라진다.
    const changed = informed.posterior.beta.some(
      (value, index) => Math.abs(value - flat.posterior.beta[index]) > 1e-9,
    );
    expect(changed).toBe(true);
  }, 30000);

  it("결정론 — prior=true 두 번 호출 시 posterior byte-동일", () => {
    const panel = priorPanel();
    const a = mmmBayesianLikeRun(panel, CFG, "Regs", false, { ...RUN_OPTS, enableBusinessContributionPrior: true });
    const b = mmmBayesianLikeRun(panel, CFG, "Regs", false, { ...RUN_OPTS, enableBusinessContributionPrior: true });
    expect(a.posterior.beta).toEqual(b.posterior.beta);
    expect(a.weeks.map((w) => w.fitted)).toEqual(b.weeks.map((w) => w.fitted));
  }, 30000);
});
