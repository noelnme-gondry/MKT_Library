export const DECISION_REVIEW_OPEN_EVENT = "decision-review:open";

export function findDecisionReviewTarget(toolId, root = typeof document !== "undefined" ? document : null) {
  if (!toolId || !root?.querySelectorAll) return null;
  return Array.from(root.querySelectorAll("[data-decision-review-tool]")).find(
    (element) => element.dataset.decisionReviewTool === toolId,
  ) || null;
}

export function requestDecisionReviewOpen(toolId, source = "external") {
  const target = findDecisionReviewTarget(toolId);
  const EventCtor = target?.ownerDocument?.defaultView?.CustomEvent;
  if (!target || !EventCtor) return false;
  target.dispatchEvent(new EventCtor(DECISION_REVIEW_OPEN_EVENT, { detail: { source } }));
  return true;
}
