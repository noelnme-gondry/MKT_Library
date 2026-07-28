export const CLASSIC_NO_PRIOR_OVERRIDES = Object.freeze({
  mediaPenalty: 0,
  controlPenalty: 0,
  trendPriorMultiplier: 1,
  mediaPenaltyCandidates: Object.freeze([0]),
});

export function classicNoPriorConfig(baseConfig, absorbed = new Set()) {
  return {
    ...baseConfig,
    ...CLASSIC_NO_PRIOR_OVERRIDES,
    mediaPenaltyCandidates: [0],
    absorbed,
  };
}

export function classicNoPriorFitOptions(overrides = {}) {
  return {
    ...overrides,
    mediaPriors: {},
    groupContributionPriors: {},
    controlPriors: {},
    disableManualPriors: true,
    enableBusinessContributionPrior: false,
    enableMediaPenaltySelection: false,
  };
}

export function auditClassicNoPriorRun(run) {
  const reasons = [];
  if (!run) reasons.push("missing-run");
  if (run?.businessContributionPrior?.enabled) reasons.push("business-contribution-prior");
  if (Object.keys(run?.appliedMediaPriors || {}).length) reasons.push("external-media-prior");
  if ((run?.posterior?.calibratedPriorCount || 0) > 0) reasons.push("calibrated-prior");
  if ((run?.effectiveCfg?.mediaPenalty || 0) !== 0) reasons.push("media-penalty");
  if ((run?.effectiveCfg?.controlPenalty || 0) !== 0) reasons.push("control-penalty");
  if (
    Number.isFinite(Number(run?.effectiveCfg?.trendPriorMultiplier)) &&
    Number(run.effectiveCfg.trendPriorMultiplier) !== 1
  ) reasons.push("trend-prior");
  if (run?.mediaPenaltySelection?.enabled) reasons.push("media-penalty-selection");
  return { passed: reasons.length === 0, reasons };
}
