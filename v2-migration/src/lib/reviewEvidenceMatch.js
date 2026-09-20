import { readReviewEvidence } from "./reviewEvidence";
import { readDecisionPlan } from "./decisionPlan";

const normalize = value => String(value || "").trim().toLocaleLowerCase().replace(/\s+/g, " ");
/** Conservative compatibility hints, never validation of experimental design. */
export function reviewEvidenceMatch(record, candidate, locale = "ko") {
  const en = locale === "en";
  const plan = readDecisionPlan(record.reviewPlan);
  const evidence = readReviewEvidence(candidate.evidence);
  const scope = evidence?.scope || {};
  const expectedMetric = plan.metric || record.metric || record.goalMetric;
  const actualMetric = scope.metric || candidate.metric || candidate.goalMetric;
  const expectedTarget = plan.target || record.actionTarget;
  const actualTarget = scope.channel || scope.channels || scope.campaign || scope.platforms;
  const actualWindow = [scope.dateStart || scope.start, scope.dateEnd || scope.end].filter(Boolean).join(" – ");
  const expectedWindow = plan.window;
  const compare = (expected, actual) => !expected || !actual ? "unknown" : normalize(expected) === normalize(actual) ? "match" : "different";
  const rows = [
    { label: en ? "Metric" : "지표", expected: expectedMetric, actual: actualMetric, state: compare(expectedMetric, actualMetric) },
    { label: en ? "Population / channel" : "집단·채널", expected: expectedTarget, actual: actualTarget, state: compare(expectedTarget, actualTarget) },
    { label: en ? "Observation window" : "관측 기간", expected: expectedWindow, actual: actualWindow, state: compare(expectedWindow, actualWindow) },
  ];
  const originMismatch = record.dataOrigin && candidate.dataOrigin && record.dataOrigin !== candidate.dataOrigin;
  // A matching metric is only a candidate; unknown population/window still needs confirmation.
  return { rows, recommended: !originMismatch && rows[0].state === "match" && rows.slice(1).every(row => row.state !== "different"), needsConfirmation: originMismatch || rows.some(row => row.state !== "match") };
}
