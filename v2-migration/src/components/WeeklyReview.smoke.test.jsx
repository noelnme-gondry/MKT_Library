// @vitest-environment jsdom
import { confirmReviewSave } from "@/test/reviewSaveBoundary";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import WeeklyReview, { buildBrief } from "@/components/WeeklyReview";
import { createDecisionComparisonScope } from "@/lib/decisionComparisonScope";
import { useAppStore } from "@/store/useDataStore";
import { appendDecisionEpisode, decisionEpisodeList } from "@/lib/decisionReview";

describe("WeeklyReview", () => {
  beforeEach(() => {
    useAppStore.setState({ decisionRecords: [], decisionPersistenceEnabled: false, decisionSessionRecordIds: new Set(), findingsByGroup: {} });
    window.gtag = vi.fn();
  });

  // 결론 저장소(findingsByGroup)와 정렬 함수는 오래 있었는데 읽는 화면이 없었다.
  // 이 검사가 그 소비처의 존재를 계약으로 고정한다 — 화면이 사라지면 여기서 걸린다.
  it("reads stored findings into a briefing and names the conflict between two tools", () => {
    const base = {
      schemaVersion: 1,
      dataGroup: "efficiency",
      severity: "action",
      score: 90,
      evidence: [],
      scope: {},
      suggestedTargets: [],
      inputSignature: "sig",
      locale: "ko",
    };
    useAppStore.setState({
      findingsByGroup: {
        efficiency: [
          { ...base, id: "f1", toolId: "5-22", kind: "saturation", headline: "Meta는 아직 여유가 있어 증액 여력이 있습니다.", detail: "한계 CPA가 평균보다 낮습니다." },
          { ...base, id: "f2", toolId: "5-3", kind: "allocation", headline: "Meta 예산을 감액하고 Google로 옮기세요.", detail: "한계효용 기준 재배분." },
        ],
      },
    });
    render(<WeeklyReview />);

    expect(screen.getByRole("heading", { name: "이번 주 분석이 말한 것" })).toBeTruthy();
    expect(screen.getByText("Meta는 아직 여유가 있어 증액 여력이 있습니다.")).toBeTruthy();
    expect(screen.getByText("Meta 예산을 감액하고 Google로 옮기세요.")).toBeTruthy();
    // 모순은 한쪽을 채택하지 않고 확인 순서를 말한다(§8).
    expect(screen.getByText("결론이 엇갈립니다")).toBeTruthy();
    expect(screen.getByText(/기간·채널 필터·분모 기준이 서로 같은지 먼저 확인/)).toBeTruthy();
  });

  it("shows no briefing when nothing has been analysed yet", () => {
    render(<WeeklyReview />);
    expect(screen.queryByRole("heading", { name: "이번 주 분석이 말한 것" })).toBeNull();
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
    expect(useAppStore.getState().decisionRecords.find(record => record.id === "decision_2").reviewDate).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "검토 내용 저장" }));
    confirmReviewSave();
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
    expect(useAppStore.getState().decisionRecords.find(record => record.id === "decision_2").targetDirection).toBeUndefined();
    fireEvent.click(screen.getByRole("button", { name: "검토 내용 저장" }));
    confirmReviewSave();
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
    let showInbox;
    const observer = vi.fn(function (callback) { showInbox = callback; this.observe = vi.fn(); this.disconnect = vi.fn(); });
    vi.stubGlobal("IntersectionObserver", observer);
    render(<WeeklyReview />);
    expect(window.gtag).not.toHaveBeenCalledWith("event", "decision_inbox_viewed", expect.anything());
    showInbox([{ isIntersecting: true }]);
    expect(window.gtag).toHaveBeenCalledWith("event", "decision_inbox_viewed", {
      source: "weekly_review",
      result_state: "active",
      locale: "ko",
    });
    vi.unstubAllGlobals();
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

  // v11 관측 이력 — 골든(decisionEpisodes.test.js)은 엔진만 본다. 실제 사용자
  // 경로에서 두 번째 관측이 첫 관측을 덮지 않는지는 화면을 밟아야 나온다
  // (§7 "순수함수 밖은 골든이 못 잡는다 → 스모크").
  it("검토를 마친 뒤 관측을 고쳐 저장해도 앞선 관측이 남는다", () => {
    const today = new Date().toISOString().slice(0, 10);
    useAppStore.setState({
      entitlement: { plan: "paid", account: true, expiresAt: Date.now() + 86400000, offlineUntil: Date.now() + 86400000 },
      decisionRecords: [{
        id: "d1",
        toolId: "5-2",
        locale: "ko",
        action: "Meta 예산 20% 증액",
        actual: "",
        learning: "",
        reviewDate: today,
        status: "",
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }],
    });
    render(<WeeklyReview />);

    // ① 1주차 관측을 적고 검토 완료
    fireEvent.change(screen.getByLabelText("실제 결과 — Meta 예산 20% 증액"), { target: { value: "1주차 CPA 1,200원" } });
    fireEvent.click(screen.getByRole("button", { name: "검토 완료로 저장" }));
    confirmReviewSave();
    expect(useAppStore.getState().decisionRecords[0].actual).toBe("1주차 CPA 1,200원");

    // ② 2주차 관측으로 고쳐 저장 — 예전에는 여기서 1주차가 사라졌다
    fireEvent.change(screen.getByLabelText("실제 결과 — Meta 예산 20% 증액"), { target: { value: "2주차 CPA 950원" } });
    fireEvent.click(screen.getByRole("button", { name: "검토 내용 저장" }));
    confirmReviewSave();

    const saved = useAppStore.getState().decisionRecords[0];
    const episodes = decisionEpisodeList(saved);
    expect(episodes.map((item) => item.actual)).toEqual(["1주차 CPA 1,200원", "2주차 CPA 950원"]);
    // 미러는 최신 관측 — 읽는 소비처 13곳이 그대로 도는 근거다.
    expect(saved.actual).toBe("2주차 CPA 950원");
  });

  it("관측이 두 번 쌓이면 이력을 화면에서 펼 수 있다", () => {
    const today = new Date().toISOString().slice(0, 10);
    const first = appendDecisionEpisode({}, { actual: "1주차 CPA 1,200원", learning: "아직 이르다" });
    const second = appendDecisionEpisode({ ...first }, { actual: "2주차 CPA 950원" });
    useAppStore.setState({
      entitlement: { plan: "paid", account: true, expiresAt: Date.now() + 86400000 },
      decisionRecords: [{
        id: "d2", toolId: "5-2", locale: "ko", action: "Meta 예산 20% 증액",
        reviewDate: today, status: "reviewed", ...second,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      }],
    });
    render(<WeeklyReview />);
    // 쌓아 놓고 읽는 곳이 없으면 §16 "신호를 만들어 놓고 안 배선한 자리"다.
    expect(screen.getByText("관측 이력 2회")).toBeTruthy();
    expect(screen.getByText("1주차 CPA 1,200원")).toBeTruthy();
    expect(screen.getByText("아직 이르다")).toBeTruthy();
  });
});
