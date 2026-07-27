import { describe, expect, it } from "vitest";
import { getDecisionReviewStatus, normalizeDecisionReviewRows, serializeDecisionReviewCsv } from "@/lib/decisionReview";

describe("decision review CSV contract", () => {
  it("exports Excel-safe UTF-8 BOM + CRLF rows without losing commas", () => {
    const csv = serializeDecisionReviewCsv([{
      toolId: "5-3",
      action: "Meta 예산 20% 감액",
      hypothesis: "CPA가 5,000원 아래로 유지된다",
      metric: "CPA",
      baseline: "5,240",
      reviewDate: "2026-08-03",
      actual: "4,980",
      learning: "=SUM(A1:A2)는 값이 아니라 가설 텍스트",
    }]);

    expect(csv.startsWith("\uFEFF\"tool_id\"")).toBe(true);
    expect(csv).toContain("\r\n");
    expect(csv).toContain("\"5,240\"");
    expect(csv).toContain("\"2026-08-03\"");
    expect(csv).toContain("'=SUM(A1:A2)");
  });

  it("keeps only actionable imported rows and derives review state honestly", () => {
    const rows = normalizeDecisionReviewRows([
      { action: "", metric: "CPA" },
      { "\uFEFFtool_id": "5-2", action: "주간 예산 확인", reviewDate: "2026-08-03", actual: "", learning: "" },
      { action: "소재 교체", actual: "CTR 1.8%", learning: "훅 테스트 지속" },
    ], "9-6");

    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ toolId: "5-2", reviewDate: "2026-08-03", status: "pending" });
    expect(rows[1]).toMatchObject({ toolId: "9-6", status: "reviewed" });
    expect(getDecisionReviewStatus({ actual: "", learning: "" })).toBe("pending");
  });
});
