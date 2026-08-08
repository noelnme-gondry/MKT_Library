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
    useAppStore.setState({
      decisionRecords: [],
      decisionPersistenceEnabled: false,
      decisionPersistencePromptSeen: false,
      decisionSessionRecordIds: new Set(),
    });
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
    expect(screen.getByText("다음 주에도 이 결정을 다시 보시겠어요?")).toBeTruthy();
    expect(screen.getByText(/새로고침하거나 페이지를 닫으면 기록이 사라집니다/)).toBeTruthy();
    expect(screen.getByText("CPA")).toBeTruthy();
    expect(useAppStore.getState().decisionRecords[0].targetDirection).toBe("lower");
    fireEvent.change(screen.getByPlaceholderText("예: CPA 4,980원"), { target: { value: "CPA 4,980원" } });
    expect(screen.getByText("검토 예정")).toBeTruthy();
  });

  it("asks for storage consent after save and persists only after acceptance", () => {
    const { container } = render(<DecisionReview toolId="5-3" decisionPrefill={{ action: "예산 검토", reviewDate: "2026-08-11" }} />);
    openDecisionReview(container);
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
    expect(useAppStore.getState().decisionPersistenceEnabled).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "이 기기에 저장" }));
    expect(useAppStore.getState().decisionPersistenceEnabled).toBe(true);
    expect(window.localStorage.getItem("mkt_view_config")).toContain("예산 검토");
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
    const view = render(<DecisionReview toolId="5-3" sourcePath="/tools/budget-allocation" decisionPrefill={{
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
    expect(useAppStore.getState().decisionRecords[0].sourcePath).toBe("/tools/budget-allocation");
    view.unmount();
    render(<WeeklyReview />);
    expect(screen.getByRole("heading", { name: "검색 예산을 10% 시험 증액" })).toBeTruthy();
  });

  it("shows and saves a one-period forecast snapshot without raw forecast arrays", () => {
    const { container } = render(<DecisionReview toolId="5-18" decisionPrefill={{
      conclusion: "2026-08-03 가입 예측 1,240명/주",
      action: "첫 예측 주 실제값을 확인한다",
      metric: "가입",
      baseline: "1,240명/주",
      targetDirection: "neutral",
      comparisonKind: "forecast_actual",
      forecastPeriod: "2026-08-03",
      forecastTarget: "Regs",
      forecastPlatform: "all",
      forecastValue: "1240",
      forecastLower: "1100",
      forecastUpper: "1380",
      forecastSourceThrough: "2026-07-27",
      forecast: { predFut: [1240, 1300] },
    }} />);
    openDecisionReview(container);
    expect(screen.getByText("다음 CSV와 자동 대조")).toBeTruthy();
    expect(container.textContent).toContain("2026-08-03 · 가입 1,240명/주");
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));

    const record = useAppStore.getState().decisionRecords[0];
    expect(record).toMatchObject({ comparisonKind: "forecast_actual", forecastPeriod: "2026-08-03", forecastTarget: "Regs", forecastValue: "1240" });
    expect(record.forecast).toBeUndefined();
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
