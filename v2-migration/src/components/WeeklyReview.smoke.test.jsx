// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import WeeklyReview, { buildBrief } from "@/components/WeeklyReview";

describe("WeeklyReview", () => {
  it("explains the client-only review loop before a CSV is imported", () => {
    render(<WeeklyReview />);
    expect(screen.getByRole("heading", { name: "지난 판단을 다음 판단의 근거로" })).toBeTruthy();
    expect(screen.getByText(/브라우저 메모리에서만/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "결정 기록 CSV 불러오기" })).toBeTruthy();
  });

  it("renders all copy in English", () => {
    render(<WeeklyReview locale="en" />);
    expect(document.body.textContent).not.toMatch(/[가-힣]/);
    expect(screen.getByRole("button", { name: "Import decision CSV" })).toBeTruthy();
  });

  it("localizes the hypothesis label in downloaded briefs", () => {
    const record = [{ toolId: "5-3", action: "Hold budget", hypothesis: "Keep CPA below target", status: "pending" }];
    const koCopy = { reviewDate: "검토일", baseline: "기준", noMetric: "지표 미입력", briefPending: "검토 대기", briefReviewed: "검토 완료", learning: "배운 점", briefTitle: "주간 운영 브리프", hypothesis: "가설" };
    const enCopy = { reviewDate: "Review date", baseline: "Baseline", noMetric: "No metric set", briefPending: "Pending review", briefReviewed: "Reviewed", learning: "Learning", briefTitle: "Weekly operating brief", hypothesis: "Hypothesis" };

    expect(buildBrief(record, koCopy, "ko")).toContain("- 가설: Keep CPA below target");
    expect(buildBrief(record, enCopy, "en")).toContain("- Hypothesis: Keep CPA below target");
  });
});
