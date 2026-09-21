// @vitest-environment jsdom
import { confirmReviewSave } from "@/test/reviewSaveBoundary";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DecisionReview from "@/components/ds/DecisionReview";
import WeeklyReview from "@/components/WeeklyReview";
import { useAppStore } from "@/store/useDataStore";

function openDecisionReview(container) {
  fireEvent.click(container.querySelector(".decision-review-launch"));
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

  it("keeps a dirty draft but prevents mixing changed analysis evidence", () => {
    const first = { headline: "CPA 100", stats: [{ label: "CPA", value: "100" }] };
    const view = render(<DecisionReview toolId="5-3" analysisEvidence={first} decisionPrefill={{ action: "Hold", conclusion: "CPA 100" }} />);
    openDecisionReview(view.container);
    fireEvent.change(screen.getByLabelText("무엇을 바꿀까요?"), { target: { value: "My edited action" } });
    view.rerender(<DecisionReview toolId="5-3" analysisEvidence={{ headline: "CPA 200", stats: [{ label: "CPA", value: "200" }] }} decisionPrefill={{ action: "Investigate", conclusion: "CPA 200" }} />);
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toBe("My edited action");
    expect(screen.getByRole("button", { name: "다음 검토로 저장" }).disabled).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "현재 결과로 초안 다시 만들기" }));
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toBe("Investigate");
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
    confirmReviewSave();
    const saved = useAppStore.getState().decisionRecords[0];
    expect(saved.conclusion).toBe("CPA 200");
    expect(JSON.parse(saved.evidence).stats[0].value).toBe("200");
  });

  it("records a concrete action and lets the user enter its outcome", () => {
    const { container } = render(<DecisionReview toolId="5-3" />);
    expect(container.textContent).toContain("7일 뒤 검토");
    expect(container.querySelector(".decision-review__tape-cta").textContent).toContain("다음 검토 약속 만들기");
    expect(useAppStore.getState().decisionRecords).toHaveLength(0);
    const summary = container.querySelector(".decision-review-launch");
    expect(summary.tabIndex).toBe(0);
    summary.focus();
    expect(document.activeElement).toBe(summary);
    openDecisionReview(container);
    expect(useAppStore.getState().decisionRecords).toHaveLength(0);
    fireEvent.change(screen.getByLabelText("무엇을 바꿀까요?"), { target: { value: "Meta 예산 20% 감액" } });
    // 목표는 도구가 선언한 첫 후보가 이미 골라진 채로 뜬다 — 지표를 타이핑할 필요가 없다.
    expect(screen.getByLabelText("목표 (성공의 정의)").value).toBe("cpa");
    // 방향은 그 선언이 정하므로 방향 선택기는 뜨지 않는다(같은 값을 두 컨트롤이 들면 어긋난다).
    expect(screen.queryByLabelText("무엇이 개선인가요?")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
    confirmReviewSave();

    expect(screen.getByText("Meta 예산 20% 감액")).toBeTruthy();
    expect(screen.getByText("다음 주에도 이 결정을 다시 보시겠어요?")).toBeTruthy();
    expect(screen.getByText(/새로고침하거나 페이지를 닫으면 기록이 사라집니다/)).toBeTruthy();
    const saved = useAppStore.getState().decisionRecords[0];
    expect(saved.targetDirection).toBe("lower");
    expect(saved.goalMetric).toBe("cpa");
    expect(saved.goalDirection).toBe("down");
    expect(saved.metric).toBe("CPA");
    fireEvent.change(screen.getByPlaceholderText("예: CPA 4,980원"), { target: { value: "CPA 4,980원" } });
    expect(screen.getByText("검토 예정")).toBeTruthy();
  });

  it("도구마다 다른 목표를 제안하고, 고른 목표를 그대로 저장한다", () => {
    // 5-3은 CPA, 5-18-cannibal은 오가닉 전환수 — 같은 폼이 도구를 따라 달라진다.
    const { container, unmount } = render(<DecisionReview toolId="5-18-cannibal" />);
    openDecisionReview(container);
    const goal = screen.getByLabelText("목표 (성공의 정의)");
    expect(goal.value).toBe("rerun:organic_conversions");
    expect([...goal.options].map((option) => option.textContent)).toContain("강한 잠식 후보 수 ↓");
    // 자동 계산 밖 목표라는 사실을 화면이 말한다 — 조용히 판정 불가로 두지 않는다.
    expect(document.body.textContent).toContain("원본 도구에서 새 데이터로 다시 분석");
    unmount();

    const second = render(<DecisionReview toolId="5-3" />);
    openDecisionReview(second.container);
    expect(screen.getByLabelText("목표 (성공의 정의)").value).toBe("cpa");
    second.unmount();
  });

  it("잠식 결정에 총량 가드레일을 함께 걸어 저장한다", () => {
    const { container } = render(<DecisionReview toolId="5-18-cannibal" />);
    openDecisionReview(container);
    fireEvent.change(screen.getByLabelText("무엇을 바꿀까요?"), { target: { value: "Meta 예산 30% 감액" } });
    fireEvent.change(screen.getByLabelText("무엇을 하나요?"), { target: { value: "decrease_budget" } });
    fireEvent.change(screen.getByLabelText("대상"), { target: { value: "Meta" } });
    fireEvent.change(screen.getByLabelText("변화량"), { target: { value: "-30%" } });
    // 가드레일은 기준값을 적은 것만 판정에 들어간다.
    fireEvent.change(screen.getByLabelText("전환수 유지 ≥"), { target: { value: "5000" } });
    fireEvent.change(screen.getByLabelText("CPA 유지 ≤"), { target: { value: "8000" } });
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
    confirmReviewSave();

    const saved = useAppStore.getState().decisionRecords[0];
    expect(saved.actionKind).toBe("decrease_budget");
    expect(saved.actionTarget).toBe("Meta");
    expect(saved.actionAmount).toBe("-30%");
    expect(saved.goalMetric).toBe("rerun:organic_conversions");
    expect(saved.goalDirection).toBe("up");
    // 첫 항목은 단수 필드(v9 호환), 나머지는 목록으로.
    expect(saved.guardrailMetric).toBe("conversions");
    expect(saved.guardrailOp).toBe("gte");
    expect(saved.guardrailValue).toBe("5000");
    expect(saved.guardrails).toBe("cpa|lte|8000");
    // 방향은 레지스트리 선언에서 온다 — decisionMetricDirection은 이 지표를 못 읽는다.
    expect(saved.targetDirection).toBe("higher");
  });

  it("프리필 지표가 목표 후보와 맞으면 그 목표가 기본으로 잡힌다", () => {
    // 5-3은 사용자의 CPA/ROAS 토글을 따라 지표를 프리필한다. 목록 첫 항목을
    // 무조건 쓰면 원장은 ROAS를, 판정은 CPA를 말하는 상태가 된다.
    const { container } = render(<DecisionReview toolId="5-3" decisionPrefill={{ action: "재배분", metric: "ROAS" }} />);
    openDecisionReview(container);
    expect(screen.getByLabelText("목표 (성공의 정의)").value).toBe("roas");
  });

  it("도구의 구체적인 프리필 라벨은 원장에 남고, 판정 키는 레지스트리가 준다", () => {
    // `metric`(보이는 라벨)과 `goalMetric`(판정 키)은 역할이 다르다. 라벨을
    // 레지스트리 일반명으로 덮으면 "Control 대비 Test 전환율" 같은 정보가 사라진다.
    const { container } = render(<DecisionReview toolId="5-18-cannibal" decisionPrefill={{ action: "교차 검증", metric: "강한 잠식 후보" }} />);
    openDecisionReview(container);
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
    confirmReviewSave();
    const saved = useAppStore.getState().decisionRecords[0];
    expect(saved.metric).toBe("강한 잠식 후보");
    expect(saved.goalMetric).toBe("rerun:organic_conversions");
    expect(saved.targetDirection).toBe("higher");
  });

  it.each(["ko", "en"])("rejects a nonnumeric guardrail without silently dropping it (%s)", (locale) => {
    const { container } = render(<DecisionReview toolId="5-18-cannibal" locale={locale} decisionPrefill={{ action: "Review budget" }} />);
    openDecisionReview(container);
    const threshold = screen.getAllByPlaceholderText(locale === "en" ? "Threshold" : "기준값")[0];
    fireEvent.change(threshold, { target: { value: "abc" } });
    fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Save for next review" : "다음 검토로 저장" }));
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByText(locale === "en" ? "Enter a number for each threshold, or clear it to leave it unused." : "기준값은 숫자로 입력하거나, 사용하지 않을 항목은 비워 주세요.")).toBeTruthy();
    expect(threshold.value).toBe("abc");
    expect(useAppStore.getState().decisionRecords).toHaveLength(0);
  });

  it("기준값을 비운 가드레일은 저장되지 않는다", () => {
    // 반쪽 가드레일을 남기면 스코어러가 \"측정 불가\"로 판정 전체를 막는다.
    const { container } = render(<DecisionReview toolId="5-3" />);
    openDecisionReview(container);
    fireEvent.change(screen.getByLabelText("무엇을 바꿀까요?"), { target: { value: "예산 재배분" } });
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
    confirmReviewSave();
    const saved = useAppStore.getState().decisionRecords[0];
    expect(saved.guardrailMetric).toBe("");
    expect(saved.guardrails).toBe("");
  });

  it("asks for storage consent after save and persists only after acceptance", () => {
    const { container } = render(<DecisionReview toolId="5-3" decisionPrefill={{ action: "예산 검토", reviewDate: "2026-08-11" }} />);
    openDecisionReview(container);
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
    confirmReviewSave();
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
    expect(screen.getByRole("switch", { name: "Store source files and decision records on this device" }).checked).toBe(false);
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
    confirmReviewSave();
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
    expect(document.body.textContent).toContain("2026-08-03 · 가입 1,240명/주");
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
    confirmReviewSave();

    const record = useAppStore.getState().decisionRecords[0];
    expect(record).toMatchObject({ comparisonKind: "forecast_actual", forecastPeriod: "2026-08-03", forecastTarget: "Regs", forecastValue: "1240" });
    expect(record.forecast).toBeUndefined();
  });

  it("persists sanitized summaries only after opt-in and removes the stored copy on opt-out", () => {
    const { container } = render(<DecisionReview toolId="5-2" decisionPrefill={{ action: "Search 점검", metric: "CPA", raw: [{ secret: "row" }] }} />);
    openDecisionReview(container);
    const retentionSwitch = screen.getByRole("switch", { name: "원본 파일과 결정 기록을 이 기기에 저장" });
    fireEvent.click(retentionSwitch);
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
    confirmReviewSave();

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
    const retentionSwitch = screen.getByRole("switch", { name: "원본 파일과 결정 기록을 이 기기에 저장" });
    fireEvent.click(retentionSwitch);

    expect(retentionSwitch.checked).toBe(false);
    expect(screen.getByRole("status").textContent).toContain("저장을 켜지 못했습니다");
    storageWrite.mockRestore();
  });
});
