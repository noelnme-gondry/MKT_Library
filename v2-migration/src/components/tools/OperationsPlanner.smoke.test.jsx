import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { confirmReviewSave } from "@/test/reviewSaveBoundary";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import OperationsPlanner from "@/components/tools/OperationsPlanner";
import { useAppStore } from "@/store/useDataStore";
import { buildToolDemo } from "@/lib/toolDemo";
import DecisionHistoryList from "@/components/weekly-review/DecisionHistoryList";
import OperationsMetricEvidence from "@/components/tools/OperationsMetricEvidence";
import { readOperationAction } from "@/lib/operations/actionContract";
import { operationsInputEvidence } from "@/lib/operations/operationsEvidence";

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

async function openEvidence(locale = "ko") {
  fireEvent.click(await screen.findByRole("tab", { name: locale === "en" ? "Explore evidence" : "근거 살펴보기" }));
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
    await openEvidence();
    await screen.findByText("동일 예산 조정안");
    expect(document.querySelector(".operations-planner__conditions").open).toBe(false);
    expect(document.querySelector(".operations-data").open).toBe(false);
    fireEvent.click(document.querySelector(".operations-data > summary"));
    expect(screen.getByRole("region", { name: "소재별 최근 효율" })).toBeTruthy();
    expect(screen.getByRole("region", { name: "대상별 예산과 효율" })).toBeTruthy();
    expect(document.querySelectorAll(".operations-workbench canvas")).toHaveLength(7);
    const budgetGroup = document.querySelector(".operations-workbench__group--budget");
    expect(budgetGroup.querySelector(".operations-panel--budget").contains(budgetGroup.querySelector(".operations-brief__forecast"))).toBe(true);
    expect(budgetGroup.querySelector(".operations-comparison").contains(budgetGroup.querySelector(".operations-brief__forecast"))).toBe(false);
    expect(screen.getByRole("img", { name: "전체 일별 실측 CPI" })).toBeTruthy();
    expect(screen.getByRole("img", { name: "전체 CPI가 달라진 두 가지 몫" })).toBeTruthy();
    expect(document.querySelector(".operations-workbench").compareDocumentPosition(document.querySelector(".operations-data")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("replans, selects campaign evidence, and follows shared filters without showing stale results", async () => {
    useAppStore.getState().setGroupAnalyzed("5-31");
    const { container } = render(<OperationsPlanner />);
    await openEvidence();
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
    // 기간을 바꿔도 사용자가 보던 근거 탭을 유지한다.
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
    await openEvidence("en");
    await screen.findByText("Same-budget allocation plan");
    expect(screen.getByRole("heading", { name: "Operations planner", level: 1 })).toBeTruthy();
    expect(screen.getByText("Budget and improvement estimates withheld")).toBeTruthy();
    const budgetGroup = document.querySelector(".operations-workbench__group--budget");
    expect(budgetGroup.querySelector(".operations-panel--allocation")).toBeNull();
    expect(budgetGroup.querySelector(".operations-comparison--single").children).toHaveLength(1);
    fireEvent.click(document.querySelector(".operations-data > summary"));
    expect(screen.getByText("No mapped creative IDs are available.")).toBeTruthy();
    expect(screen.getByText("Recent unit cost cannot be calculated.")).toBeTruthy();
    expect(screen.queryByText("0.0% improvement")).toBeNull();
  });

  it.each(["ko", "en"])("withholds forecasts for two observed days but keeps actual evidence (%s)", async locale => {
    const en = locale === "en";
    // 전체 업로드는 유효하다. 분석 기준일 이후의 관측이 예측 보류를 풀면 안 된다.
    useAppStore.getState().setDashboardFilter({ dateStart: "2026-07-01", dateEnd: "2026-07-02" });
    useAppStore.getState().setGroupAnalyzed("5-31");
    expect(useAppStore.getState().isGroupAnalyzed("5-31")).toBe(true);
    render(<OperationsPlanner locale={locale} />);
    await openEvidence(locale);
    await screen.findByText(en ? "Budget and improvement estimates withheld" : "예산·개선치 추정 보류");
    expect(screen.getByText(en ? "Budget forecasts are withheld because observations or model fit are insufficient." : "관측 수 또는 모형 적합도가 부족해 예산 예측을 보류했습니다.")).toBeTruthy();
    expect(document.querySelector(".operations-brief__forecast, .operations-panel--allocation")).toBeNull();
    expect(document.querySelector(".operations-comparison--single > .operations-panel--trend")).toBeTruthy();
    expect(document.querySelectorAll(".operations-observed-queue tbody tr")).toHaveLength(2);
    expect(screen.queryByRole("radio", { name: en ? "Budget adjustment" : "예산 조정", exact: true })).toBeNull();
    expect(screen.getByRole("button", { name: /^CPI / }).textContent).not.toContain(en ? "Unavailable" : "계산 불가");
  });

  it("stacks an unavailable creative chart and its real zero-outcome details", async () => {
    const csv = useAppStore.getState().csvData;
    useAppStore.getState().setCsvData({ ...csv, raw: csv.raw.map(row => ({ ...row, Installs: 0 })) });
    useAppStore.getState().setGroupAnalyzed("5-31");
    render(<OperationsPlanner locale="en" />);
    await openEvidence("en");
    await screen.findByText("No valid creative-level spend and outcomes are available.");
    const group = document.querySelector(".operations-workbench__group--creative");
    expect(group.querySelector(".operations-comparison--single")).toBeTruthy();
    const detail = within(screen.getByRole("region", { name: "Selected creative", exact: true }));
    expect(detail.getAllByText("Unavailable")).toHaveLength(1);
    expect(detail.getByText(/^installs$/i, { selector: "dt" }).nextElementSibling.textContent).toBe("0.0");
    expect(screen.queryByRole("img", { name: /Creative spend versus/ })).toBeNull();
  });

  it.each(["ko", "en"])("traces actual metric inputs, opens existing mapping, and selects scoped observations (%s)", async locale => {
    const en = locale === "en";
    render(<OperationsPlanner locale={locale} />);
    expect(screen.queryByRole("heading", { name: en ? "Metrics and input evidence" : "지표와 입력 근거" })).toBeNull();
    act(() => useAppStore.getState().setGroupAnalyzed("5-31"));
    await openEvidence(locale);
    await screen.findByRole("heading", { name: en ? "Metrics and input evidence" : "지표와 입력 근거" });
    expect(screen.getByRole("heading", { name: en ? "CPI · Input details" : "CPI · 입력 내역" })).toBeTruthy();
    const chooser = within(screen.getByRole("group", { name: en ? "Select an arithmetic metric" : "산술 지표 선택" }));
    const inputTable = () => within(screen.getByRole("region", { name: en ? "Inputs behind the selected metric" : "선택 지표의 입력 근거" }));
    expect(inputTable().getByRole("cell", { name: "Spend", exact: true })).toBeTruthy();
    expect(inputTable().getByRole("cell", { name: "Installs", exact: true })).toBeTruthy();
    fireEvent.click(chooser.getByRole("button", { name: /^CTR / }));
    const calculation = () => screen.getByRole("group", { name: en ? "Calculation for the selected metric" : "선택 지표의 계산식" });
    expect(calculation().textContent).toContain(en ? "Clicks total" : "클릭 합계");
    expect(calculation().textContent).toContain(en ? "Impressions total" : "노출 합계");
    expect(calculation().textContent).toContain("× 100");
    expect(document.querySelector(".operations-metric-evidence__result > strong").textContent).toBe("5.0%");
    expect(inputTable().getByRole("cell", { name: "Impressions", exact: true })).toBeTruthy();
    expect(inputTable().getByRole("cell", { name: "Clicks", exact: true })).toBeTruthy();
    expect(inputTable().queryByRole("cell", { name: "Spend", exact: true })).toBeNull();
    const controlledId = chooser.getByRole("button", { name: /^CTR / }).getAttribute("aria-controls");
    expect(document.getElementById(controlledId).contains(inputTable().getByRole("table"))).toBe(true);
    fireEvent.click(chooser.getByRole("button", { name: /^CPM / }));
    expect(calculation().textContent).toContain("× 1,000");
    expect(calculation().textContent).toContain(en ? "Spend total (KRW)" : "광고비 합계 (KRW)");
    expect(calculation().textContent).not.toContain(en ? "Clicks total" : "클릭 합계");
    fireEvent.click(screen.getByRole("button", { name: en ? "Inspect current mapping" : "현재 매핑 확인" }));
    expect(document.querySelector(".operations-planner__conditions").open).toBe(true);
    await waitFor(() => expect(document.activeElement.id).toBe("ops-analysis-settings"));
    fireEvent.click(screen.getByRole("button", { name: en ? "Select observed evidence for Campaign 0" : "Campaign 0 관측 근거 선택" }));
    expect(document.querySelector(".operations-brief__diagnosis h4").textContent).toContain("Campaign 0");
    await waitFor(() => expect(document.activeElement.id).toBe("ops-diagnosis-title"));
    const model = useAppStore.getState().csvData;
    act(() => useAppStore.getState().setCsvData({ ...model, mapping: { ...model.mapping, Clicks: "__ignore__" } }));
    expect(useAppStore.getState().isGroupAnalyzed("5-31")).toBe(false);
    expect(screen.queryByRole("heading", { name: en ? "Metrics and input evidence" : "지표와 입력 근거" })).toBeNull();
  });

  it("keeps optional missing metrics unavailable while base CPR and observed reviews remain usable", async () => {
    const csv = useAppStore.getState().csvData;
    useAppStore.getState().setCsvData({ ...csv, mapping: { ...csv.mapping, Clicks: "__ignore__", Impressions: "__ignore__" } });
    useAppStore.getState().setGroupAnalyzed("5-31");
    render(<OperationsPlanner locale="en" />);
    await openEvidence("en");
    const chooser = within(await screen.findByRole("group", { name: "Select an arithmetic metric" }));
    expect(chooser.getByRole("button", { name: /^CPI / }).textContent).not.toContain("Unavailable");
    fireEvent.click(chooser.getByRole("button", { name: /^CTR / }));
    expect(document.querySelector(".operations-metric-evidence__status").textContent).toBe("Required column not mapped");
    expect(document.querySelector(".operations-metric-evidence__result > strong").textContent).toBe("Unavailable");
    expect([...document.querySelectorAll(".operations-metric-evidence__operand strong")].map(node => node.textContent)).toEqual(["Unavailable", "Unavailable"]);
    expect(screen.getByRole("region", { name: "Observed review queue" }).textContent).toContain("Campaign 0");
    expect(screen.getByText("Stage data is incomplete; contributions cannot be separated.")).toBeTruthy();
    expect(document.querySelector(".operations-decomposition-grid--single").contains(screen.getByRole("img", { name: "Two contributions to the CPI change" }))).toBe(true);
    expect(screen.getByRole("img", { name: "Daily observed portfolio CPI" })).toBeTruthy();
  });

  it("carries a chart-selected target into a saved plan, execution and scoped review", async () => {
    useAppStore.getState().setGroupAnalyzed("5-31");
    const view = render(<OperationsPlanner />);
    await openEvidence();
    const campaignSelect = screen.getByRole("combobox", { name: "캠페인 선택" });
    fireEvent.change(campaignSelect, { target: { value: [...campaignSelect.options].find(option => option.textContent.includes("Campaign 0")).value } });
    fireEvent.click(screen.getByRole("button", { name: /이 캠페인의 액션 정하기/ }));
    let dialog = screen.getByRole("dialog", { name: "운영 액션 정하기" });
    expect(within(dialog).getByLabelText("대상").selectedOptions[0].textContent).toContain("Campaign 0");
    fireEvent.change(within(dialog).getByLabelText("계획일"), { target: { value: "2026-08-20" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "액션 저장" }));
    confirmReviewSave();
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "운영 액션 정하기" })).toBeNull());
    let record = useAppStore.getState().decisionRecords[0];
    expect(record.toolId).toBe("5-31");
    expect(record.sourcePath).toBe("/tools/operations-planner");
    expect(readOperationAction(record.operationAction)).toMatchObject({ state: "planned", executedDate: "", target: { campaign: "Campaign 0", platform: "iOS" } });
    fireEvent.click(screen.getByRole("tab", { name: "지금 할 일" }));
    fireEvent.click(screen.getByRole("button", { name: /^진행 중/ }));
    fireEvent.click(screen.getByRole("button", { name: "실행 기록" }));
    dialog = screen.getByRole("dialog", { name: "운영 액션 정하기" });
    fireEvent.change(within(dialog).getByLabelText("상태"), { target: { value: "executed" } });
    fireEvent.change(within(dialog).getByLabelText("실제 실행일"), { target: { value: "2026-08-21" } });
    fireEvent.click(within(dialog).getByRole("button", { name: "액션 저장" }));
    confirmReviewSave();
    await waitFor(() => expect(readOperationAction(useAppStore.getState().decisionRecords[0].operationAction).state).toBe("executed"));
    expect(useAppStore.getState().decisionRecords[0].reviewDate).toBe("2026-08-28");
    fireEvent.click(screen.getByRole("button", { name: /^검토할 결과/ }));
    fireEvent.click(screen.getByRole("button", { name: "전후 검토" }));
    expect(screen.getByRole("dialog", { name: "실행 후 검토" }).textContent).toContain("2026-08-14 – 2026-08-20 → 2026-08-21 – 2026-08-27");
    fireEvent.change(screen.getByLabelText("검토 메모"), { target: { value: "다른 변화와 함께 관측됨" } });
    fireEvent.click(screen.getByRole("button", { name: "관측 결과 저장" }));
    confirmReviewSave();
    await waitFor(() => expect(useAppStore.getState().decisionRecords[0].status).toBe("reviewed"));
    record = useAppStore.getState().decisionRecords[0];
    expect(record.actual).toContain("인과 효과 미확인");
    fireEvent.click(screen.getByRole("button", { name: /^완료/ }));
    fireEvent.click(screen.getByRole("button", { name: "후속 액션", exact: true }));
    fireEvent.click(screen.getByRole("button", { name: "액션 저장" }));
    confirmReviewSave();
    await waitFor(() => expect(useAppStore.getState().decisionRecords).toHaveLength(2));
    expect(useAppStore.getState().decisionRecords.some(item => item.parentDecisionId === record.id)).toBe(true);
    view.unmount();
    useAppStore.getState().setCurrentRouteId("weekly-review");
    render(<DecisionHistoryList records={[record]} />);
    expect(await screen.findByRole("button", { name: /Campaign 0/ })).toBeTruthy();
  });

  it("preserves full history and manual records when the comparison period changes", async () => {
    useAppStore.setState({ decisionRecords: [{ id: "old", toolId: "5-3", action: "July budget change", baselineDate: "2026-07-10" }] });
    useAppStore.getState().setGroupAnalyzed("5-31");
    render(<OperationsPlanner />);
    fireEvent.click(await screen.findByRole("tab", { name: "전체 변화 이력" }));
    expect(screen.getByRole("region", { name: "전체 변화 목록" }).textContent).toContain("July budget change");
    expect(screen.getByText("직접 기록 · 실행 미확인")).toBeTruthy();
    expect(screen.getByRole("region", { name: "운영 액션 루프" }).textContent).toContain("2026-07-01 – 2026-09-08");
    act(() => useAppStore.getState().setDashboardFilter({ dateStart: "2026-07-01", dateEnd: "2026-07-02" }));
    fireEvent.click(await screen.findByRole("tab", { name: "전체 변화 이력" }));
    expect(screen.getByRole("region", { name: "운영 액션 루프" }).textContent).toContain("2026-07-01 – 2026-09-08");
    expect(screen.getByRole("region", { name: "전체 변화 목록" }).textContent).toContain("July budget change");
  });

  it.each(["ko", "en"])("records budget amounts without pretending observed spend is a confirmed setting (%s)", async locale => {
    const en = locale === "en";
    useAppStore.getState().setGroupAnalyzed("5-31");
    render(<OperationsPlanner locale={locale} />);
    await screen.findByRole("tab", { name: en ? "Actions & reviews" : "지금 할 일" });
    fireEvent.click(screen.getAllByRole("button", { name: en ? /Define action/ : /액션 정하기/ })[0]);
    const dialog = screen.getByRole("dialog", { name: en ? "Define an operating action" : "운영 액션 정하기" });
    expect(within(dialog).getByLabelText(en ? "Previous daily budget (KRW, optional)" : "변경 전 하루 예산 (KRW, 선택)").value).toBe("");
    fireEvent.change(within(dialog).getByLabelText(en ? "New daily budget (KRW)" : "변경 후 하루 예산 (KRW)"), { target: { value: "123,456.78" } });
    fireEvent.click(within(dialog).getByRole("button", { name: en ? "Save action" : "액션 저장" }));
    confirmReviewSave();
    await waitFor(() => expect(useAppStore.getState().decisionRecords).toHaveLength(1));
    expect(readOperationAction(useAppStore.getState().decisionRecords[0].operationAction)).toMatchObject({ state: "planned", beforeBudget: null, afterBudget: 123456.78, currency: "KRW" });
  });
});

it("shows a real zero denominator without displaying a fabricated zero metric", () => {
  const evidence = operationsInputEvidence({ rows: [{ date: "2026-10-01", cost: 200, installs: 0, clicks: 0, impressions: 0 }],
    mapping: { Spend: "cost", Installs: "installs", Clicks: "clicks", Impressions: "impressions" }, period: { start: "2026-10-01", end: "2026-10-01" } });
  render(<OperationsMetricEvidence evidence={evidence} currency="KRW" locale="en" />);
  const calculation = screen.getByRole("group", { name: "Calculation for the selected metric" });
  expect(within(calculation).getByText("200", { exact: true })).toBeTruthy();
  expect(within(calculation).getByText("0", { exact: true })).toBeTruthy();
  expect(document.querySelector(".operations-metric-evidence__result > strong").textContent).toBe("Unavailable");
  expect(screen.getByRole("status").textContent).toBe("Unavailable: zero denominator");
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
    await openEvidence(locale);
    await screen.findByText(locale === "en" ? "Same-budget allocation plan" : "동일 예산 조정안");
    const en = locale === "en";
    const creativeList = screen.getByRole("region", { name: en ? "New creative comparison" : "신규 소재 비교" });
    expect(creativeList.closest(".operations-comparison")).toBeNull();
    const selectedCreative = () => screen.getByRole("region", { name: en ? "Selected creative" : "선택한 소재" });
    const firstRow = within(creativeList).getAllByRole("row")[1];
    const name = within(firstRow).getAllByRole("cell")[0].querySelector("strong").textContent;
    fireEvent.click(within(firstRow).getByRole("button"));
    await waitFor(() => expect(document.activeElement.id).toBe("ops-selected-creative-title"));
    expect(within(selectedCreative()).getByRole("heading", { name, exact: true })).toBeTruthy();
    expect(within(selectedCreative()).getByText(en ? "First observed in uploaded history" : "업로드 이력의 첫 관측일", { exact: true })).toBeTruthy();
    const creativeSelect = screen.getByRole("combobox", { name: en ? "Select a creative" : "소재 선택" });
    const existing = [...creativeSelect.options].find(option => option.textContent.includes(en ? "Established" : "기존"));
    expect(existing).toBeTruthy();
    fireEvent.change(creativeSelect, { target: { value: existing.value } });
    expect(within(selectedCreative()).queryByText(en ? "vs established creatives" : "기존 소재 대비", { exact: true })).toBeNull();
    expect(within(selectedCreative()).queryByRole("button", { name: en ? /Follow up on this creative/ : /이 소재를 다음 주에도 확인/ })).toBeNull();
    const evidenceTab = screen.getByRole("tab", { name: en ? "Explore evidence" : "근거 살펴보기" });
    fireEvent.keyDown(evidenceTab, { key: "Home" });
    const actionTab = screen.getByRole("tab", { name: en ? "Actions & reviews" : "지금 할 일" });
    expect(actionTab.getAttribute("aria-selected")).toBe("true");
    expect(document.activeElement).toBe(actionTab);
    await openEvidence(locale);
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
    await openEvidence();
    await screen.findByText("동일 예산 조정안");
    expect(useAppStore.getState().csvData.fileName).toBe("demo_operations_98days.csv");
  });
});
