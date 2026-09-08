// Reuse recorded validation windows, never infer rolling windows from a total n.
export function mmmBaselineEvidence(run, actual) {
  const backtest = run?.backtest;
  if (!Array.isArray(actual) || !actual.every(Number.isFinite) || !Number.isFinite(backtest?.wmape)) return null;
  let cuts;
  let horizon;
  let modelErrors;
  if (backtest.source === "aggregate-model-rolling-origin" || backtest.source === "channel-model-rolling-origin") {
    const rolling = backtest.source === "aggregate-model-rolling-origin" ? run.aggregateRollingBacktest : run.rollingBacktest;
    cuts = rolling?.cuts;
    horizon = rolling?.horizon;
    modelErrors = rolling?.foldWmapes;
  } else if (!backtest.source && actual.length >= 48 && backtest.n === actual.length - Math.floor(actual.length * 0.8)) {
    // mmmBayesianRun's single chronological 80/20 holdout.
    cuts = [actual.length - backtest.n];
    horizon = backtest.n;
    modelErrors = [backtest.wmape];
  }
  if (!Array.isArray(cuts) || !cuts.length || !Number.isInteger(horizon) || horizon < 1
    || modelErrors?.length !== cuts.length || !modelErrors.every(Number.isFinite)
    || cuts.some((cut) => !Number.isInteger(cut) || cut < 1 || cut + horizon > actual.length)) return null;
  const folds = cuts.map((cut, index) => {
    const observed = actual.slice(cut, cut + horizon);
    const denominator = observed.reduce((sum, value) => sum + Math.abs(value), 0);
    if (!(denominator > 1e-9)) return null;
    const baselineWmape = observed.reduce((sum, value) => sum + Math.abs(value - actual[cut - 1]), 0) / denominator * 100;
    return { cut, horizon, baselineWmape, modelWmape: modelErrors[index] };
  });
  if (folds.some((fold) => !fold)) return null;
  const baselineWmape = folds.reduce((sum, fold) => sum + fold.baselineWmape, 0) / folds.length;
  const modelWmape = folds.reduce((sum, fold) => sum + fold.modelWmape, 0) / folds.length;
  if (Math.abs(modelWmape - backtest.wmape) > 1e-6) return null;
  return { baselineWmape, modelWmape, beatsBaseline: modelWmape < baselineWmape, folds };
}

// Compose diagnostics without refitting or substituting model estimates.
export function mmmDecisionQuality({ run, health, notices = [], actual } = {}) {
  const baseline = mmmBaselineEvidence(run, actual);
  const reasons = [];
  if (!run?.identification || run.identification.budgetEligible !== true) reasons.push("identification_unconfirmed");
  if (!Number.isFinite(health?.oos?.wmape)) reasons.push("time_holdout_missing");
  if (!baseline) reasons.push("baseline_unconfirmed");
  else if (!baseline.beatsBaseline) reasons.push("baseline_not_beaten");
  if (notices.some((notice) => !notice.dropped)) reasons.push("unresolved_collinearity");
  for (const flag of health?.flags || []) if (flag.severity === "fail") reasons.push(`health:${flag.key}`);
  return { budgetEligible: reasons.length === 0, reasons, baseline, oosWmape: health?.oos?.wmape ?? null,
    trainingCoverage90: health?.coverage90 ?? null, warnings: (health?.flags || []).map((flag) => flag.key) };
}

export function mmmDecisionQualityMessage(quality, locale = "ko") {
  const en = locale === "en";
  return quality.reasons.map((reason) => ({
    identification_unconfirmed: en ? "channel identification not confirmed" : "채널별 식별 미확인",
    time_holdout_missing: en ? "time-ordered validation unavailable" : "시간순 검증 결과 없음",
    baseline_unconfirmed: en ? "same-window baseline comparison unconfirmed" : "같은 검증 구간의 기준선 비교 미확인",
    baseline_not_beaten: en ? "does not beat the last-observation baseline" : "마지막 관측값 기준선보다 오차가 낮지 않음",
    unresolved_collinearity: en ? "unresolved overlapping channel movement" : "채널 동행 문제 미해결",
  })[reason] || (en ? "failed model-health check" : "모델 건강 점검 실패")).join(" · ");
}
