import { expect, it } from "vitest";
import Papa from "papaparse";
import { reviewEvidenceMatch } from "./reviewEvidenceMatch";
import { serializeReviewEvidence } from "./reviewEvidence";
import { selectProjectReviewRecords } from "./projectReviewSelection";
import { buildAnalysisExportPayload } from "./analysis-export/exportContract";
import { sanitizeDecisionReviewRecord, serializeDecisionReviewCsv, normalizeDecisionReviewRows, getDecisionReviewBucket, assessDecisionOutcome, summarizeDecisionOutcomes } from "./decisionReview";
import { scoreDecision } from "./weekly-review/decisionScore";
const record = { id: "a", toolId: "5-18-mmm", action: "Hold out brand", metric: "Organic users", dataOrigin: "real", reviewPlan: JSON.stringify({ method: "holdout", metric: "Organic users", target: "Google", window: "2026-10-01 – 2026-10-14" }) };
const source = scope => ({ dataOrigin: "real", evidence: serializeReviewEvidence({ headline: "Recovery +300, interval +100 to +500", scope }) });
it("recommends only compatible metrics; missing conditions never become verified", () => {
  const missing = reviewEvidenceMatch(record, source({ metric: "Organic users" }));
  expect(missing.recommended).toBe(true);
  expect(missing.needsConfirmation).toBe(true);
  expect(missing.rows.slice(1).map(row => row.state)).toEqual(["unknown", "unknown"]);
  expect(reviewEvidenceMatch(record, source({ metric: "CTR" })).recommended).toBe(false);
  expect(reviewEvidenceMatch(record, source({ metric: "Organic users", channel: "Meta" })).recommended).toBe(false);
  expect(reviewEvidenceMatch(record, source({ metric: "Organic users", start: "2025-01-01", end: "2025-01-14" })).recommended).toBe(false);
  expect(reviewEvidenceMatch(record, source({ metric: "Organic users", channel: "Google", start: "2026-10-01", end: "2026-10-14" })).needsConfirmation).toBe(false);
});
it("retains older ancestors outside date and tool filters without leaking unrelated decisions", () => {
  const records = [{ ...record, reviewDate: "2026-01-01" }, { id: "b", action: "Experiment", parentDecisionId: "a", toolId: "5-23", reviewDate: "2026-10-14" }, { id: "c", action: "Unrelated", toolId: "5-23", reviewDate: "2026-10-14" }];
  const selected = selectProjectReviewRecords(records, { toolId: "5-23", start: "2026-10-01", threadId: "b" });
  expect(selected.records.map(row => row.id)).toEqual(["a", "b"]);
  expect(selected).toMatchObject({ matched: 1, ancestors: 1, excluded: 1 });
  expect(selectProjectReviewRecords([{ id: "a", parentDecisionId: "b" }, { id: "b", parentDecisionId: "a" }], { threadId: "a" }).records).toHaveLength(2);
});
it("exports every explicitly selected record beyond the default 20 with consistent summary", () => {
  const records = Array.from({ length: 25 }, (_, index) => ({ id: String(index), action: `Decision ${index}` }));
  const payload = buildAnalysisExportPayload({ toolId: "weekly-review", reviewRecords: records, reviewLimit: records.length });
  expect(payload.review.total).toBe(25);
  expect(payload.review.decisions).toHaveLength(25);
  expect(buildAnalysisExportPayload({ reviewRecords: records }).review.decisions).toHaveLength(20);
});
it("preserves explicit early closure through CSV without converting it to a successful outcome", () => {
  const saved = sanitizeDecisionReviewRecord({ ...record, closureReason: "invalid_design", reviewDate: "2099-01-01", reviewedAt: "2026-09-20T00:00:00Z", status: "reviewed", metric: "CPA", baseline: "100", actual: "80" });
  const restored = normalizeDecisionReviewRows(Papa.parse(serializeDecisionReviewCsv([saved]), { header: true }).data)[0];
  expect(restored.closureReason).toBe("invalid_design");
  expect(getDecisionReviewBucket(restored, "2026-09-20")).toBe("reviewed");
  expect(assessDecisionOutcome(restored)).toMatchObject({ state: "unscored", comparison: null });
  expect(summarizeDecisionOutcomes([restored])).toMatchObject({ comparable: 0, improved: 0, unscored: 1 });
  expect(scoreDecision({ decision: restored })).toMatchObject({ reason: "closed_without_effect_verdict", meansNoEffect: false });
  expect(sanitizeDecisionReviewRecord({ ...saved, closureReason: "success" }).closureReason).toBe("");
});
