// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import WeeklyReview, { buildBrief } from "@/components/WeeklyReview";
import { createDecisionComparisonScope } from "@/lib/decisionComparisonScope";
import { useAppStore } from "@/store/useDataStore";

describe("WeeklyReview", () => {
  beforeEach(() => {
    useAppStore.setState({ decisionRecords: [], decisionPersistenceEnabled: false, decisionSessionRecordIds: new Set() });
    window.gtag = vi.fn();
  });

  it("explains the client-only review loop before a CSV is imported", () => {
    render(<WeeklyReview />);
    expect(screen.getByRole("heading", { name: "이번 주 결정 인박스" })).toBeTruthy();
    expect(screen.getByText(/현재 세션에서만/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "결정 기록 CSV 불러오기" })).toBeTruthy();
    expect(screen.getByRole("switch", { name: "원본 파일과 결정 기록을 이 기기에 저장" }).checked).toBe(false);
    expect(screen.getByRole("heading", { name: "첫 결정을 이렇게 쌓습니다" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "내 데이터로 첫 분석" }).getAttribute("href")).toBe("/start");
    expect(screen.getByRole("link", { name: "필요한 분석부터 진단" }).getAttribute("href")).toBe("/diagnose");
    expect(screen.queryByRole("region", { name: "검토 현황" })).toBeNull();
  });

  it("renders all copy in English", () => {
    render(<WeeklyReview locale="en" />);
    expect(document.body.textContent).not.toMatch(/[가-힣]/);
    expect(screen.getByRole("button", { name: "Import decision CSV" })).toBeTruthy();
    expect(screen.getByRole("link", { name: "Run my first analysis" }).getAttribute("href")).toBe("/en/start");
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

  it("keeps a forecast check-in pending, then reports range coverage after an actual is entered", () => {
    useAppStore.setState({
      decisionRecords: [{
        id: "forecast_1", toolId: "5-18", action: "첫 예측 주 실제값 확인", metric: "가입", baseline: "120명/주",
        targetDirection: "neutral", comparisonKind: "forecast_actual", forecastPeriod: "2026-08-03", forecastTarget: "Regs",
        forecastPlatform: "all", forecastValue: "120", forecastLower: "100", forecastUpper: "140", forecastSourceThrough: "2026-07-27",
        reviewDate: "2026-08-10", actual: "", learning: "", status: "pending",
      }],
    });
    render(<WeeklyReview />);

    expect(screen.getByText("예측 대조 약속")).toBeTruthy();
    expect(screen.getByText("새 실제값을 기다리는 중")).toBeTruthy();
    expect(screen.getByRole("link", { name: "마케팅 예측에서 실제값 찾기 →" }).getAttribute("href")).toBe("/tools/marketing-forecast");

    fireEvent.change(screen.getByLabelText("실제 결과 — 첫 예측 주 실제값 확인"), { target: { value: "126명/주" } });
    expect(screen.getByText("참고범위 안")).toBeTruthy();
    expect(screen.getByText("+6 · +5.0%")).toBeTruthy();
    expect(screen.queryByText("새 실제값을 기다리는 중")).toBeNull();
  });

  it("does not complete a future review merely by typing an actual", () => {
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
    expect(window.gtag).not.toHaveBeenCalledWith("event", "decision_review_completed", expect.anything());
    expect(screen.getAllByText("예정").length).toBeGreaterThan(0);
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("민감한 캠페인 이름");
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("12,000");
  });

  it("finds an actual from each record's data group and links back to the source tool", () => {
    const baseGroups = useAppStore.getState().csvGroups;
    const brandRows = Array.from({ length: 7 }, (_, index) => ({
      date: `2020-01-${String(index + 2).padStart(2, "0")}`,
      metrics: { cost: 100, actions: 10 },
      dimensions: { channel: "Brand" },
    }));
    useAppStore.setState({
      activeDataGroup: "efficiency",
      csvData: { raw: [], headers: [], mapping: {}, fileName: "", canonicalData: { records: [] }, mappedRows: [] },
      csvGroups: {
        ...baseGroups,
        brand_incrementality: {
          raw: [], headers: [], mapping: {}, fileName: "brand.csv", canonicalData: { records: brandRows }, mappedRows: [],
        },
      },
      decisionRecords: [{
        id: "brand_decision", toolId: "5-24", action: "브랜드 예산 검토", metric: "CPA", baseline: "12원",
        baselineDate: "2020-01-01", reviewDate: "2020-01-08", comparisonWindowDays: "7", actual: "", learning: "", status: "pending",
        comparisonScope: createDecisionComparisonScope({ dataGroup: "brand_incrementality", filter: { channels: new Set(["Brand"]) } }),
      }],
    });

    render(<WeeklyReview />);

    expect(screen.getByText("10원 · CPA")).toBeTruthy();
    expect(screen.getByRole("link", { name: /원본 도구 열기/ }).getAttribute("href")).toBe("/tools/brand-campaign-incrementality");
  });

  it("returns a response decision to its saved analysis stage and labels a manual rerun honestly", () => {
    useAppStore.setState({
      decisionRecords: [
        { id: "response_stage", toolId: "5-18", sourcePath: "/tools/marketing-response?stage=mmm", action: "MMM 재확인", metric: "최대 VIF", reviewDate: "2020-01-01", actual: "", learning: "", status: "pending" },
      ],
    });
    render(<WeeklyReview />);
    expect(screen.getByRole("link", { name: /원본 도구 열기/ }).getAttribute("href")).toBe("/tools/marketing-response?stage=mmm");
    expect(screen.getByText("새 데이터 재분석 후 기록")).toBeTruthy();
    expect(screen.getByText(/VIF·ASA·증분 추정처럼/)).toBeTruthy();
  });

  it("preserves the saved source stage and manual follow-up copy in English", () => {
    useAppStore.setState({
      decisionRecords: [
        { id: "response_stage_en", toolId: "5-18", sourcePath: "/tools/marketing-response?stage=mmm", action: "Rerun MMM", metric: "Maximum VIF", reviewDate: "2020-01-01", actual: "", learning: "", status: "pending" },
      ],
    });
    render(<WeeklyReview locale="en" />);
    expect(screen.getByRole("link", { name: /Open source tool/ }).getAttribute("href")).toBe("/en/tools/marketing-response?stage=mmm");
    expect(screen.getByText("Rerun with new data, then record")).toBeTruthy();
    expect(screen.getByText(/VIF, ASA, and incrementality/)).toBeTruthy();
  });
});
