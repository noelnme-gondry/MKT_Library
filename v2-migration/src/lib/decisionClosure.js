export const DECISION_CLOSURE_REASONS = Object.freeze({
  cancelled: ["실행 취소", "Cancelled before execution"],
  stopped: ["실행 중단", "Stopped"],
  invalid_design: ["설계 오류로 재설계", "Redesign required"],
});
export function decisionClosureLabel(reason, locale = "ko") {
  return DECISION_CLOSURE_REASONS[reason]?.[locale === "en" ? 1 : 0] || "";
}
