import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { confirmReviewSave } from "@/test/reviewSaveBoundary";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import OperationsPlanner from "@/components/tools/OperationsPlanner";
import { useAppStore } from "@/store/useDataStore";
import { buildToolDemo } from "@/lib/toolDemo";
import DecisionHistoryList from "@/components/weekly-review/DecisionHistoryList";

function upload() {
  const raw = [];
  for (let day = 0; day < 70; day++) for (let campaign = 0; campaign < 2; campaign++) {
    const date = new Date(Date.UTC(2026, 6, 1 + day)).toISOString().slice(0, 10);
    const cost = 100000 + (day % 11) * 14000;
    const installs = cost / ((campaign ? 1800 : 600) + cost * (campaign ? 0.006 : 0.001));
    raw.push({ Date: date, Spend: cost, Installs: installs, Impressions: installs * 200, Clicks: installs * 10,
      Channel: "Meta", Campaign: `Campaign ${campaign}`, Creative: campaign === 0 && day >= 63 ? "new" : "established", Country: "KR", Platform: "iOS" });
  }
  const mapping = { Date: "date", Spend: "cost", Installs: "installs", Impressions: "impressions", Clicks: "clicks", Channel: "channel", Campaign: "campaign_name", Creative: "creative_id", Country: "country", Platform: "platform" };
  useAppStore.getState().setCurrentRouteId("5-31");
  useAppStore.getState().setCsvData({ raw, headers: Object.keys(mapping), mapping, fileName: "test-operations.csv", currency: "KRW" });
}

describe("standalone operations planner entry path", () => {
  beforeEach(() => {
    useAppStore.setState({ ...useAppStore.getInitialState(), decisionPersistenceEnabled: false }, true);
    upload();
  });

  it("keeps the real analysis gate and mounts its independent tool shell", async () => {
    expect(useAppStore.getState().isGroupAnalyzed("5-31")).toBe(false);
    render(<OperationsPlanner />);
    expect(screen.queryByText("동일 예산 조정안")).toBeNull();
    expect(screen.getByRole("heading", { name: "운영 플래너", level: 1 })).toBeTruthy();
    act(() => useAppStore.getState().setGroupAnalyzed("5-31"));
    expect(useAppStore.getState().isGroupAnalyzed("5-31")).toBe(true);
    await screen.findByText("동일 예산 조정안");
    expect(document.querySelector(".operations-planner__conditions").open).toBe(false);
    expect(document.querySelector(".operations-data").open).toBe(false);
    fireEvent.click(document.querySelector(".operations-data > summary"));
    expect(screen.getByRole("region", { name: "소재별 최근 효율" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "대상별 예산과 효율" })).toBeTruthy();
    expect(document.querySelectorAll(".operations-workbench canvas")).toHaveLength(6);
    expect(screen.getByRole("img", { name: "전체 일별 실측 CPI" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "소재 구성·단가 변화 기여" })).toBeTruthy();
    expect(document.querySelector(".operations-workbench").compareDocumentPosition(document.querySelector(".operations-data")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("replans, selects campaign evidence, and follows shared filters without showing stale results", async () => {
    useAppStore.getState().setGroupAnalyzed("5-31");
    const { container } = render(<OperationsPlanner />);
    await screen.findByText("동일 예산 조정안");
    const select = screen.getByRole("combobox", { name: "변경 한도" });
    fireEvent.change(select, { target: { value: "0" } });
    await waitFor(() => expect(select.value).toBe("0"));
    fireEvent.click(document.querySelector(".operations-data > summary"));
    const budgetTable = within(screen.getByRole("region", { name: "대상별 예산과 효율" }));
    for (const row of budgetTable.getAllByRole("row").slice(1)) {
      const cells = within(row).getAllByRole("cell");
      expect(cells[1].textContent).toBe(cells[2].textContent);
    }
    const campaignSelect = screen.getByRole("combobox", { name: "캠페인 선택" });
    fireEvent.change(campaignSelect, { target: { value: [...campaignSelect.options].find(option => option.textContent.includes("Campaign 0")).value } });
    expect(container.querySelector(".operations-brief__diagnosis h4").textContent).toContain("Campaign 0");
    act(() => useAppStore.getState().setDashboardFilter({ dateStart: "2026-08-26", dateEnd: "2026-09-01", compareEnabled: true,
      comparisonStart: "2026-08-19", comparisonEnd: "2026-08-25" }));
    expect(screen.queryByText("동일 예산 조정안")).toBeNull();
    await screen.findByText("동일 예산 조정안");
    expect(screen.getByRole("region", { name: "소재별 최근 효율" }).textContent).not.toContain("new");
    expect(screen.getByRole("combobox", { name: "변경 한도" }).value).toBe("0");
  });

  it("offers the same workflow in English and honest missing-field states", async () => {
    const csv = useAppStore.getState().csvData;
    const raw = csv.raw.map(row => ({ ...row, Creative: "", Installs: "" }));
    useAppStore.getState().setCsvData({ ...csv, raw });
    useAppStore.getState().setGroupAnalyzed("5-31");
    render(<OperationsPlanner locale="en" />);
    await screen.findByText("Same-budget allocation plan");
    expect(screen.getByRole("heading", { name: "Operations planner", level: 1 })).toBeTruthy();
    expect(screen.getByText("Budget and improvement estimates withheld")).toBeTruthy();
    fireEvent.click(document.querySelector(".operations-data > summary"));
    expect(screen.getByText("No mapped creative IDs are available.")).toBeTruthy();
    expect(screen.getByText("Recent unit cost cannot be calculated.")).toBeTruthy();
    expect(screen.queryByText("0.0% improvement")).toBeNull();
  });

  it("carries a chart-selected campaign into the real decision editor and weekly history without matching portfolio totals", async () => {
    useAppStore.getState().setGroupAnalyzed("5-31");
    const view = render(<OperationsPlanner />);
    await screen.findByText("동일 예산 조정안");
    const campaignSelect = screen.getByRole("combobox", { name: "캠페인 선택" });
    fireEvent.change(campaignSelect, { target: { value: [...campaignSelect.options].find(option => option.textContent.includes("Campaign 0")).value } });
    fireEvent.click(screen.getByRole("button", { name: /이 캠페인 점검을 주간 리뷰로/ }));
    expect(document.querySelector(".operations-review-plan").textContent).toContain("Campaign 0");
    fireEvent.click(document.querySelector(".decision-review-launch"));
    const dialog = screen.getByRole("dialog", { name: "다음 마케팅 프로젝트로 만들기" });
    expect(within(dialog).getByLabelText("대상").value).toContain("Campaign 0");
    expect(within(dialog).getByLabelText("기준값 데이터 기준일").value).toBe("2026-09-08");
    expect(within(dialog).getByLabelText("비교 기간 (일)").value).toBe("7");
    expect(within(dialog).getByLabelText("현재 기준값 (선택)").value).toBe(document.querySelector(".operations-review-plan strong").textContent);
    expect(dialog.textContent).toContain("자동 실제값 대조는 제공하지 않습니다");
    fireEvent.click(within(dialog).getByRole("button", { name: "이대로 만들기" }));
    confirmReviewSave();
    const record = useAppStore.getState().decisionRecords[0];
    expect(record.toolId).toBe("5-31");
    expect(record.actionTarget).toContain("Campaign 0");
    expect(record.comparisonScope).toBe("");
    expect(record.sourcePath).toBe("/tools/operations-planner");
    view.unmount();
    useAppStore.getState().setCurrentRouteId("weekly-review");
    render(<DecisionHistoryList records={[record]} />);
    expect(await screen.findByRole("button", { name: /Campaign 0/ })).toBeTruthy();
  });

  it("uses observed portfolio cost rather than the model forecast as the budget decision baseline", async () => {
    useAppStore.getState().setGroupAnalyzed("5-31");
    render(<OperationsPlanner />);
    await screen.findByText("동일 예산 조정안");
    fireEvent.click(screen.getByRole("button", { name: /이 예산안을 주간 리뷰로/ }));
    fireEvent.click(document.querySelector(".decision-review-launch"));
    const dialog = screen.getByRole("dialog", { name: "다음 마케팅 프로젝트로 만들기" });
    const observed = document.querySelector(".operations-observed-comparison > div:nth-of-type(2) strong").textContent;
    expect(within(dialog).getByLabelText("현재 기준값 (선택)").value).toBe(observed);
    expect(within(dialog).getByLabelText("검토 예정일").value).toBe("2026-09-15");
    fireEvent.click(within(dialog).getByRole("button", { name: "이대로 만들기" }));
    confirmReviewSave();
    const record = useAppStore.getState().decisionRecords[0];
    expect(record.baseline).toBe(observed);
    expect(record.goalMetric).toBe("cpi");
    expect(JSON.parse(record.comparisonScope).dataGroup).toBe("efficiency");
  });
});

describe("operations planner built-in demo", () => {
  beforeEach(async () => {
    await useAppStore.persist.rehydrate();
    useAppStore.setState({ ...useAppStore.getInitialState(), decisionPersistenceEnabled: false }, true);
    useAppStore.getState().setCurrentRouteId("5-31");
    window.history.replaceState(null, "", "/tools/operations-planner");
  });
  afterEach(() => window.history.replaceState(null, "", "/"));

  it.each(["ko", "en"])("loads computed results into the active CSV mirror on the same route (%s)", async locale => {
    useAppStore.getState().setDisplayCurrency("USD");
    render(<OperationsPlanner locale={locale} />);
    fireEvent.click(screen.getByRole("button", { name: locale === "en" ? /Run the example and see results/ : /예시 데이터로 결과 바로 보기/ }));
    const expected = buildToolDemo("5-31", locale);
    const state = useAppStore.getState();
    expect(state.csvData.raw).toEqual(expected.raw);
    expect(state.csvGroups.efficiency.raw).toBe(state.csvData.raw);
    expect(state.isGroupAnalyzed("5-31")).toBe(true);
    expect(state.denomBasis).toBe("installs");
    expect(state.displayCurrency).toBe("KRW");
    await screen.findByText(locale === "en" ? "Same-budget allocation plan" : "동일 예산 조정안");
    expect(document.querySelector('.operations-planner__settings[data-currency-scope="declare"]')).toBeTruthy();
    expect(document.querySelector(".operations-planner__conditions > summary").textContent).toContain("2026-09-30");
    fireEvent.click(document.querySelector(".operations-data > summary"));
    expect(screen.getByRole("region", { name: locale === "en" ? "Recent efficiency by creative" : "소재별 최근 효율" }).textContent).toContain(locale === "en" ? "Customer review video" : "고객 후기 영상");
    act(() => useAppStore.getState().setCurrentRouteId("5-2"));
    expect(useAppStore.getState().csvData.raw).toBe(state.csvData.raw);
  });

  it("keeps a real dataset until the user chooses to replace it", async () => {
    upload();
    const csv = useAppStore.getState().csvData;
    window.history.replaceState(null, "", "/tools/operations-planner?example=1");
    const view = render(<OperationsPlanner />);
    await screen.findByRole("dialog", { name: "예시 데이터로 교체" });
    expect(useAppStore.getState().csvData.raw).toBe(csv.raw);
    fireEvent.click(screen.getByRole("button", { name: "현재 파일 유지", exact: true }));
    expect(useAppStore.getState().csvData.raw).toBe(csv.raw);
    expect(useAppStore.getState().isGroupAnalyzed("5-31")).toBe(false);
    view.unmount();
    window.history.replaceState(null, "", "/tools/operations-planner?example=1");
    render(<OperationsPlanner />);
    await screen.findByRole("dialog", { name: "예시 데이터로 교체" });
    fireEvent.click(screen.getByRole("button", { name: "예시로 교체", exact: true }));
    await screen.findByText("동일 예산 조정안");
    expect(useAppStore.getState().csvData.fileName).toBe("demo_operations_98days.csv");
  });
});
