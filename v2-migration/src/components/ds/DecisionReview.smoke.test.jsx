// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DecisionReview from "@/components/ds/DecisionReview";
import WeeklyReview from "@/components/WeeklyReview";
import { useAppStore } from "@/store/useDataStore";

function openDecisionReview(container) {
  fireEvent.click(container.querySelector(".decision-review > summary"));
}

describe("DecisionReview", () => {
  afterEach(() => vi.restoreAllMocks());

  beforeEach(() => {
    window.localStorage.removeItem("mkt_view_config");
    useAppStore.setState({ decisionRecords: [], decisionPersistenceEnabled: false });
  });

  it("records a concrete action and lets the user enter its outcome", () => {
    const { container } = render(<DecisionReview toolId="5-3" />);
    expect(container.textContent).toContain("7일 뒤 검토");
    expect(container.querySelector(".decision-review__tape-cta").textContent).toContain("다음 검토 약속 만들기");
    expect(useAppStore.getState().decisionRecords).toHaveLength(0);
    const summary = container.querySelector(".decision-review > summary");
    expect(summary.tabIndex).toBe(0);
    summary.focus();
    expect(document.activeElement).toBe(summary);
    openDecisionReview(container);
    expect(useAppStore.getState().decisionRecords).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("무엇을 바꿀까요?"), { target: { value: "Meta 예산 20% 감액" } });
    fireEvent.change(screen.getByLabelText("검증 지표"), { target: { value: "CPA" } });
    expect(screen.getByLabelText("무엇이 개선인가요?").value).toBe("lower");
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));

    expect(screen.getByText("Meta 예산 20% 감액")).toBeTruthy();
    expect(screen.getByText("CPA")).toBeTruthy();
    expect(useAppStore.getState().decisionRecords[0].targetDirection).toBe("lower");
    fireEvent.change(screen.getByPlaceholderText("예: CPA 4,980원"), { target: { value: "CPA 4,980원" } });
    expect(screen.getByText("검토 완료")).toBeTruthy();
  });

  it("renders a fully English decision loop", () => {
    const { container } = render(<DecisionReview toolId="5-2" locale="en" />);
    expect(container.textContent).toContain("Review in 7 days");
    expect(container.querySelector(".decision-review__tape-cta").textContent).toContain("Schedule the next review");
    openDecisionReview(container);
    expect(document.body.textContent).not.toMatch(/[가-힣]/);
    expect(screen.getByRole("button", { name: "Save for next review" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "Keep decision summaries on this device" }).checked).toBe(false);
  });

  it("prefills explicit fields and shares a saved action with Weekly Review", () => {
    const view = render(<DecisionReview toolId="5-3" decisionPrefill={{
      conclusion: "검색 예산 확대 여지가 있습니다",
      action: "검색 예산을 10% 시험 증액",
      metric: "CPA",
      baseline: "5,240원",
      reviewQuestion: "CPA가 기준을 유지했는가?",
      sourcePeriod: "최근 14일",
      raw: [{ secret: "row" }],
    }} />);
    openDecisionReview(view.container);
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toBe("검색 예산을 10% 시험 증액");
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
    expect(useAppStore.getState().decisionRecords[0].raw).toBeUndefined();
    view.unmount();
    render(<WeeklyReview />);
    expect(screen.getByRole("heading", { name: "검색 예산을 10% 시험 증액" })).toBeTruthy();
  });

  it("persists sanitized summaries only after opt-in and removes the stored copy on opt-out", () => {
    const { container } = render(<DecisionReview toolId="5-2" decisionPrefill={{ action: "Search 점검", metric: "CPA", raw: [{ secret: "row" }] }} />);
    openDecisionReview(container);
    const retentionSwitch = screen.getByRole("switch", { name: "이 기기에 결정 요약 저장" });
    fireEvent.click(retentionSwitch);
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));

    const storedOn = window.localStorage.getItem("mkt_view_config");
    expect(storedOn).toContain("Search 점검");
    expect(storedOn).not.toContain("secret");
    expect(storedOn).not.toContain("raw");

    fireEvent.click(retentionSwitch);
    const storedOff = window.localStorage.getItem("mkt_view_config");
    expect(storedOff).not.toContain("Search 점검");
    expect(useAppStore.getState().decisionRecords).toHaveLength(1);
  });

  it("does not claim retention when browser storage is unavailable", () => {
    const storageWrite = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("Blocked", "SecurityError");
    });
    const { container } = render(<DecisionReview toolId="5-2" />);
    openDecisionReview(container);
    const retentionSwitch = screen.getByRole("switch", { name: "이 기기에 결정 요약 저장" });
    fireEvent.click(retentionSwitch);

    expect(retentionSwitch.checked).toBe(false);
    expect(screen.getByRole("status").textContent).toContain("저장을 켜지 못했습니다");
    storageWrite.mockRestore();
  });
});
