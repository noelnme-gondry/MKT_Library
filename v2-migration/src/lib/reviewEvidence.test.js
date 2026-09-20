import { describe, expect, it } from "vitest";
import Papa from "papaparse";
import { buildReviewEvidence, serializeReviewEvidence, readReviewEvidence } from "./reviewEvidence";
import { sanitizeDecisionReviewRecord, serializeDecisionReviewCsv, normalizeDecisionReviewRows } from "./decisionReview";
import { archiveMemo } from "./account/archiveContract";

const evidence = { headline: "국가별 전환율 차이", stats: [{ label: "조정 효과", value: "−4.2%", detail: "95% CI −6% ~ −2%" }], points: [{ text: "구성 변화 확인", detail: "인과효과 아님" }], scope: { dateStart: "2026-09-01", dateEnd: "2026-09-07", currency: "KRW", raw: "private" }, rows: [{ secret: "raw" }], fileName: "private.csv", capturedAt: "2026-09-08T00:00:00Z" };
describe("decision evidence storage", () => {
  it("keeps visible evidence and uncertainty but never arbitrary source data", () => {
    const safe = buildReviewEvidence(evidence);
    expect(safe.stats[0].detail).toContain("95% CI");
    expect(JSON.stringify(safe)).not.toMatch(/private|secret|fileName/);
  });
  it("round-trips Korean evidence and the parent link through decision CSV; preserves both in selected account memos", () => {
    const record = sanitizeDecisionReviewRecord({ id: "child", toolId: "5-29", action: "검토", evidence: serializeReviewEvidence(evidence), parentDecisionId: "parent" });
    const restored = normalizeDecisionReviewRows(Papa.parse(serializeDecisionReviewCsv([record]), { header: true }).data)[0];
    expect(restored.evidence).toBe(record.evidence);
    expect(restored.parentDecisionId).toBe("parent");
    expect(readReviewEvidence(restored.evidence).stats[0].value).toBe("−4.2%");
    expect(archiveMemo(restored).evidence).toBe(restored.evidence);
    expect(archiveMemo(restored).parentDecisionId).toBe(restored.parentDecisionId);
  });
  it("leaves old records without invented evidence and rejects malformed input", () => {
    expect(sanitizeDecisionReviewRecord({ toolId: "5-3", action: "Old" }).evidence).toBe("");
    expect(readReviewEvidence("{")).toBeNull();
    expect(serializeReviewEvidence({ headline: { raw: "private" } })).toBe("");
  });
});
