// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import WeeklyReview, { buildBrief } from "@/components/WeeklyReview";
import { useAppStore } from "@/store/useDataStore";

describe("WeeklyReview", () => {
  beforeEach(() => {
    useAppStore.setState({ decisionRecords: [], decisionPersistenceEnabled: false });
    window.gtag = vi.fn();
  });

  it("explains the client-only review loop before a CSV is imported", () => {
    render(<WeeklyReview />);
    expect(screen.getByRole("heading", { name: "이번 주 결정 인박스" })).toBeTruthy();
    expect(screen.getByText(/현재 세션에서만/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "결정 기록 CSV 불러오기" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "이 기기에 결정 요약 저장" }).checked).toBe(false);
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

  it("derives overdue and unscheduled states and lets the review date be repaired", () => {
    useAppStore.setState({
      decisionRecords: [
        { id: "decision_1", toolId: "5-3", action: "기한 지난 결정", reviewDate: "2020-01-01", actual: "", learning: "", status: "pending" },
        { id: "decision_2", toolId: "5-22", action: "날짜 없는 결정", reviewDate: "", actual: "", learning: "", status: "pending" },
      ],
    });
    render(<WeeklyReview />);
    expect(screen.getAllByText("기한 지남").length).toBeGreaterThan(0);
    expect(screen.getAllByText("검토일 없음").length).toBeGreaterThan(0);
    const emptyDate = screen.getAllByLabelText("검토일").find((input) => input.value === "");
    fireEvent.change(emptyDate, { target: { value: "2099-01-01" } });
    expect(useAppStore.getState().decisionRecords.find((record) => record.id === "decision_2").reviewDate).toBe("2099-01-01");
  });

  it("shows a conservative outcome ledger and lets ambiguous metrics declare a direction", () => {
    useAppStore.setState({
      decisionRecords: [
        { id: "decision_1", toolId: "5-3", action: "CPA 확인", metric: "CPA", baseline: "5,240원", actual: "4,980원", learning: "", reviewDate: "2020-01-01" },
        { id: "decision_2", toolId: "5-2", action: "매출 확인", metric: "매출", baseline: "100", actual: "120", learning: "", reviewDate: "2020-01-01" },
      ],
    });
    render(<WeeklyReview />);

    expect(screen.getAllByText("지표 개선").length).toBeGreaterThan(0);
    expect(screen.getAllByText("방향 판정 보류").length).toBeGreaterThan(0);
    expect(screen.getByText("낮을수록 좋은 지표 기준")).toBeTruthy();
    expect(screen.getByText("좋고 나쁨을 정하지 않고 변화량만 표시")).toBeTruthy();

    const directionSelects = screen.getAllByLabelText(/무엇이 개선인가요\?/);
    const revenueDirection = directionSelects.find((select) => select.value === "");
    fireEvent.change(revenueDirection, { target: { value: "higher" } });
    expect(useAppStore.getState().decisionRecords.find((record) => record.id === "decision_2").targetDirection).toBe("higher");
    expect(screen.getAllByText("지표 개선").length).toBeGreaterThan(1);
  });

  it("tracks the inbox state and the first completed review without decision content", () => {
    useAppStore.setState({
      decisionRecords: [
        { id: "decision_1", toolId: "5-3", action: "민감한 캠페인 이름", reviewDate: "2099-01-01", actual: "", learning: "", status: "pending" },
      ],
    });
    render(<WeeklyReview />);

    expect(window.gtag).toHaveBeenCalledWith("event", "decision_inbox_viewed", {
      source: "weekly_review",
      result_state: "active",
      locale: "ko",
    });
    fireEvent.change(screen.getByLabelText("실제 결과 — 민감한 캠페인 이름"), { target: { value: "CPA 12,000원" } });
    expect(window.gtag).toHaveBeenCalledWith("event", "decision_review_completed", {
      tool_id: "5-3",
      source: "weekly_review",
      result_state: "reviewed",
      locale: "ko",
    });
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("민감한 캠페인 이름");
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("12,000");
  });
});
