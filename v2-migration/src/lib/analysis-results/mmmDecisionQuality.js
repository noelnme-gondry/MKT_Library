// Compose existing diagnostics; do not refit or substitute model estimates.
export function mmmDecisionQuality({ run, health, notices = [] } = {}) {
  const reasons = [];
  if (!run?.identification || run.identification.budgetEligible !== true) reasons.push("identification_unconfirmed");
  if (!Number.isFinite(health?.oos?.wmape)) reasons.push("time_holdout_missing");
  if (notices.some((notice) => !notice.dropped)) reasons.push("unresolved_collinearity");
  for (const flag of health?.flags || []) if (flag.severity === "fail") reasons.push(`health:${flag.key}`);
  return { budgetEligible: reasons.length === 0, reasons, oosWmape: health?.oos?.wmape ?? null,
    trainingCoverage90: health?.coverage90 ?? null, warnings: (health?.flags || []).map((flag) => flag.key) };
}

export function mmmDecisionQualityMessage(quality, locale = "ko") {
  const en = locale === "en";
  return quality.reasons.map((reason) => ({
    identification_unconfirmed: en ? "channel identification not confirmed" : "채널별 식별 미확인",
    time_holdout_missing: en ? "time-ordered validation unavailable" : "시간순 검증 결과 없음",
    unresolved_collinearity: en ? "unresolved overlapping channel movement" : "채널 동행 문제 미해결",
  })[reason] || (en ? "failed model-health check" : "모델 건강 점검 실패")).join(" · ");
}
