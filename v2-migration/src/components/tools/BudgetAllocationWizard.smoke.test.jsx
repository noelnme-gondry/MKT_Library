// @vitest-environment jsdom
//
// Render-smoke for the BudgetAllocation (5-3) multi-step wizard flow.
// Complements BudgetAllocation.smoke.test.jsx (which only mounts the Step 1
// default) — drives real DOM clicks through Step1 -> Step2 (추세선 검증) ->
// Step3 (§4 배분 비중 bar chart) so render-throw bugs in step-transition JSX
// and Chart.js effects are caught (golden tests only cover pure math, §7).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import { ALLOCATION_SPEC, allocationOptionValue } from "@/lib/recipe/allocationRecipe";
import { foldSteps } from "@/lib/recipe/recipe";
import { recipeVocabularyFor } from "@/lib/recipe/toolVocabulary";
import { ALLOC_MATH } from "@/utils/allocationMath";
import BudgetAllocation, { buildAllocationChartCountries, buildAllocationChartPoints, buildAllocationModels, buildScatterDatasets } from "@/components/tools/BudgetAllocation";

// 조건은 "조건 바꾸기" 창 안에 있다. 실행안이 있으면 예산·지표도 그 창으로 접힌다(product-ssot §1.1c).
// 창이 열려 있으면 바깥이 aria-hidden이므로, 바깥을 누를 때는 닫는다.
function openConditions(locale = "ko") {
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Change settings" : "조건 바꾸기" }));
  return screen.getByRole("dialog");
}
function closeConditions(dialog, locale = "ko") {
  fireEvent.click(within(dialog).getByRole("button", { name: locale === "en" ? "Close" : "닫기", exact: true }));
}
function chooseBasis(name, locale = "ko", { keepOpen = false } = {}) {
  const dialog = openConditions(locale);
  fireEvent.click(within(dialog).getByRole("button", { name }));
  if (!keepOpen) closeConditions(dialog, locale);
  return dialog;
}
// 지표 선택은 접힘 여부에 따라 창 안이나 바깥에 있다 — 어느 쪽이든 하나만 렌더된다.
const objectiveRadio = (name) => screen.getByRole("radio", { name, hidden: true });


function seedWithData() {
  const headers = ["Date", "Country", "Platform", "Channel", "Spend", "Installs", "Actions", "Revenue"];
  const mapping = {
    Date: "date",
    Country: "country",
    Platform: "platform",
    Channel: "channel",
    Spend: "cost",
    Installs: "installs",
    Actions: "actions",
    Revenue: "revenue_d7",
  };
  const raw = [];
  const channels = ["Google", "Meta", "TikTok"];
  for (let d = 1; d <= 20; d++) {
    const date = `2026-01-${String(d).padStart(2, "0")}`;
    for (const ch of channels) {
      const base = ch === "Google" ? 100000 : ch === "Meta" ? 80000 : 40000;
      const cost = base + d * 3000;
      const divisor = ch === "Google" ? 5000 : ch === "Meta" ? 4200 : 6000;
      const installs = Math.round(cost / divisor);
      raw.push({
        Date: date,
        Country: "KR",
        Platform: "iOS",
        Channel: ch,
        Spend: cost,
        Installs: installs,
        Actions: Math.max(1, Math.round(installs * 0.35)),
        Revenue: cost * (ch === "Google" ? 1.6 : ch === "Meta" ? 1.3 : 1.05),
      });
    }
  }
  useAppStore.setState({
    currentRouteId: "5-3",
    displayCurrency: "KRW",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: { raw, headers, mapping, fileName: "alloc.csv" } },
    csvData: { raw, headers, mapping, fileName: "alloc.csv" },
  });
  useAppStore.getState().setGroupAnalyzed("5-3");
}

describe("allocation chart grouping", () => {
  it("국가 선택은 표시 문자열 대신 원본 국가와 현재 보기 대상에서 파생한다", () => {
    const rows = [{ country: "US · East", channel: "Meta", platform: "iOS", date: "2026-01-01", cost: 100, installs: 10 }, { country: "KR", channel: "Google", platform: "Android", date: "2026-01-01", cost: 0, installs: 0 }];
    const available = buildAllocationChartPoints(rows, "country_channel", "channel", "installs");
    const groups = buildAllocationChartCountries(rows, "country_channel", "channel", available);
    expect(groups).toEqual([["US · East", new Set(["US · East · Meta"])]]);
  });
  it("국가·채널은 OS를 일별 합산하며 배분 단위는 별도로 보존한다", () => {
    const rows = [
      { country: "KR", channel: "Meta", platform: "iOS", date: "2026-01-01", cost: 100, installs: 10 },
      { country: "KR", channel: "Meta", platform: "Android", date: "2026-01-01", cost: 900, installs: 30 },
      { country: "US", channel: "Meta", platform: "iOS", date: "2026-01-01", cost: 40, installs: 4 },
    ];
    const grouped = buildAllocationChartPoints(rows, "country_channel", "channel", "installs");
    expect([...grouped.keys()]).toEqual(["KR · Meta", "US · Meta"]);
    expect(grouped.get("KR · Meta")).toEqual([{ x: 1000, y: 25, date: "2026-01-01" }]);
    expect(buildAllocationChartPoints(rows, "allocation", "channel", "installs").size).toBe(3);
    expect(rows[0].platform).toBe("iOS");
  });
});

describe("BudgetAllocation Step2/Step3 wizard flow render smoke", () => {
  beforeEach(() => {
    seedWithData();
    // jsdom doesn't implement confirm() (throws "Not implemented") — stub so the
    // unverified-groups gate can proceed deterministically in this test.
    window.confirm = () => true;
  });

  it("결과-먼저 착지 → 곡선 검증(Step2)로 이동 시 사이드바+scatter가 throw 없이 렌더", () => {
    // PRISM 뷰 P2: 데이터가 있으면 렌더 즉시 결과(step 3)에 착지. 곡선 검증은 링크로 이동.
    expect(() => render(<BudgetAllocation />)).not.toThrow();
    fireEvent.click(screen.getByText(/곡선 검증·보정/));

    expect(screen.getByText(/데이터가 예산 변화에 반응했나/)).toBeTruthy();
    const canvas = document.getElementById("chart-alloc-scatter-verify");
    expect(canvas).toBeTruthy();

    const proceedBtns = screen.getAllByText(/검증 완료 및 예산 배분/);
    expect(() => fireEvent.click(proceedBtns[0])).not.toThrow();
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });

  it("결과-먼저 착지에서 §4 배분 섹션이 throw 없이 렌더", () => {
    expect(() => render(<BudgetAllocation />)).not.toThrow();
    expect(document.body.textContent.length).toBeGreaterThan(0);
    const barSection = document.querySelector("#s-bar");
    expect(barSection).toBeTruthy();
  });

  it("결론은 할 일·핵심 수치 3개로 끝나고, 근거는 자세히 보기 탭에만 있다", () => {
    render(<BudgetAllocation />);
    const card = document.querySelector(".result-action-card");
    expect(card).toBeTruthy();
    // 결론은 한 줄: 무엇을 얼마나 옮기는지 → 지표 변화.
    const headline = card.querySelector(".result-action-card__headline").textContent;
    expect(headline).toMatch(/일 ₩[\d.,]+(만|억)? (감액|증액)|현 배분 유지/);
    expect(headline.length).toBeLessThanOrEqual(70);
    // 줄은 방향별(감액·증액·효과), 줄 안은 끊기지 않는 덩어리 — 이름 중간에서 줄이 바뀌지 않는다.
    const lines = [...card.querySelectorAll(".alloc-headline__line")];
    expect(lines.length).toBeGreaterThanOrEqual(1);
    for (const line of lines) expect(line.querySelectorAll(".alloc-headline__chunk").length).toBeGreaterThanOrEqual(1);
    expect(headline).not.toMatch(/감액\S|증액\S/);
    // 덩어리 사이 공백은 덩어리 밖(텍스트 노드)에 있어야 줄을 바꿀 자리가 생긴다.
    for (const chunk of card.querySelectorAll(".alloc-headline__chunk")) expect(chunk.textContent).toBe(chunk.textContent.trim());
    expect(lines[0].textContent).toMatch(/\S \S/);
    expect(card.querySelectorAll(".result-action-card__stats > div")).toHaveLength(3);
    const table = within(card).getByRole("table", { name: "채널별 조정안" });
    const rows = table.querySelectorAll("tbody tr");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.length).toBeLessThanOrEqual(6);
    for (const row of rows) {
      expect(row.querySelector(".alloc-plan__unit").textContent.trim()).not.toBe("");
      expect(row.querySelector(".alloc-plan__delta strong").textContent).toMatch(/^[+−]₩/);
      expect(row.querySelector(".alloc-plan__cpr").textContent).toMatch(/→/);
      expect(row.querySelector(".alloc-plan__why").textContent.trim()).not.toBe("");
    }
    // 일반 방법 안내로 빨간 "!"를 띄우지 않는다. 지운 진단·점검 블록은 되살리지 않는다.
    expect(card.querySelector(".issue-mark")).toBeNull();
    expect(document.querySelector(".alloc-diag-card")).toBeNull();
    expect(document.querySelector(".alloc-verify-strip")).toBeNull();
    expect(document.querySelector(".alloc-total-card")).toBeNull();
    expect(document.querySelectorAll(".result-action-card__stats")).toHaveLength(1);
    const status = document.querySelector(".planner-status");
    expect(status.closest('[role="tabpanel"]').hidden).toBe(true);
    fireEvent.click(screen.getByRole("tab", { name: "확인", exact: true }));
    expect(status.closest('[role="tabpanel"]').hidden).toBe(false);
  });

  it("switches between named current/plan distribution and the full allocation table", () => {
    // 결과-먼저 착지라 위저드 네비 없이 바로 예산 입력 → 바 차트 렌더 경로.
    render(<BudgetAllocation />);
    // 실행안이 있으면 결론이 먼저 오고, 예산은 조건 창에서 바꾼다.
    expect(document.getElementById("prism-total-budget")).toBeNull();
    expect(document.getElementById("s-controls").textContent).toContain("일예산");
    const conditions = openConditions();
    const budgetSlider = document.getElementById("prism-total-budget");
    expect(budgetSlider).toBeTruthy();
    expect(() => {
      fireEvent.change(budgetSlider, { target: { value: budgetSlider.max } });
    }).not.toThrow();
    expect(conditions.querySelector(".alloc-condition-dialog__preview").textContent).toContain("지금 결론");
    closeConditions(conditions);

    const distribution = document.querySelector(".allocation-distribution");
    expect(distribution).toBeTruthy();
    expect(distribution.querySelectorAll("li").length).toBeGreaterThan(0);
    expect(distribution.textContent).toContain("변경안");
    fireEvent.click(screen.getByRole("radio", { name: "비중", exact: true }));
    expect(distribution.closest("[hidden]")).toBeNull();
    expect(document.getElementById("s-table").closest("[hidden]")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "전체 배분표", exact: true }));
    expect(document.getElementById("s-table").closest("[hidden]")).toBeNull();
    expect(distribution.closest("[hidden]")).toBeTruthy();
    // Legacy flexbox segments must be gone from this section.
    expect(document.querySelector(".alloc-bar-seg")).toBeNull();
  });

  it("uses the Step 2 channel model override when rebuilding allocation models", () => {
    const points = new Map([[
      "Search",
      [
        { x: 10, y: 9, date: "2026-01-01" },
        { x: 20, y: 14, date: "2026-01-02" },
        { x: 30, y: 19, date: "2026-01-03" },
      ],
    ]]);
    const models = buildAllocationModels(
      points,
      { trendType: "auto", outlierMethod: "none", outlierStrength: "standard", weightMode: "none" },
      { Search: "linear" },
    );

    expect(models.get("Search")?.model.type).toBe("Linear");
  });

  it("renders ROAS scatter values as Revenue / Cost rather than its inverse", () => {
    const points = new Map([["Search", [{ x: 100, y: 0.5, date: "2026-01-01" }, { x: 200, y: 0.5, date: "2026-01-02" }]]]);
    const { datasets } = buildScatterDatasets(["Search"], points, {
      trendType: "linear", outlierMethod: "none", outlierStrength: "standard", weightMode: "none",
    }, { hidePoints: false, normalizeMode: "raw", isRoas: true });

    expect(datasets[0].data.map((point) => point.y)).toEqual([2, 2]);
  });

  it("PRISM은 전역 예산 슬라이더 하나만 렌더하고 채널 행을 직접 편집하지 않는다", () => {
    render(<BudgetAllocation />);
    openConditions();
    const slider = document.getElementById("prism-total-budget");
    expect(slider).toBeTruthy();
    const sliders = document.querySelectorAll('input[type="range"]');
    expect(sliders).toHaveLength(1);
    expect(document.querySelector("#s-table input")).toBeNull();
    expect(() => {
      fireEvent.change(slider, { target: { value: slider.max } });
    }).not.toThrow();
  });

  it("일/월 전환은 같은 실제 일예산을 보존한다", () => {
    render(<BudgetAllocation />);
    openConditions();
    const exact = document.getElementById("prism-total-budget-exact");
    fireEvent.change(exact, { target: { value: "100000" } });
    fireEvent.blur(exact);
    fireEvent.click(screen.getByRole("button", { name: "월" }));
    expect(exact.value).toBe("3,000,000");
    fireEvent.click(screen.getByRole("button", { name: "일" }));
    expect(exact.value).toBe("100,000");
  });

  it("USD 전역 예산은 센트와 월/일 변환을 잃지 않는다", () => {
    useAppStore.setState({ displayCurrency: "USD" });
    render(<BudgetAllocation />);
    openConditions();
    const exact = document.getElementById("prism-total-budget-exact");
    fireEvent.change(exact, { target: { value: "0.01" } });
    fireEvent.blur(exact);
    expect(exact.value).toBe("0.01");
    expect(document.querySelector(".prism-driver__readout")?.textContent).toBe("$0.01");
    fireEvent.click(screen.getByRole("button", { name: "월" }));
    expect(exact.value).toBe("0.3");
    fireEvent.click(screen.getByRole("button", { name: "일" }));
    expect(exact.value).toBe("0.01");
  });

  it("관측 상한을 넘는 정확 예산은 실행·저장 가능한 추천안으로 만들지 않는다", () => {
    render(<BudgetAllocation />);
    const conditions = openConditions();
    const slider = document.getElementById("prism-total-budget");
    const exact = document.getElementById("prism-total-budget-exact");
    fireEvent.change(exact, { target: { value: String(Number(slider.max) * 2) } });
    fireEvent.blur(exact);
    // 창을 연 채로는 컨트롤이 제자리에 남고, 창 위 결론 자리가 실행안이 없다고 말한다.
    expect(within(conditions).getByText(/자동 실행안은 만들지 않았습니다/)).toBeTruthy();
    expect(conditions.querySelector(".alloc-condition-dialog__preview").textContent).toContain("실행안이 없습니다");
    expect(document.querySelector(".result-action-card")).toBeNull();
    // 닫으면 고칠 입력과 사유가 본문에 그대로 펼쳐진다.
    closeConditions(conditions);
    expect(document.getElementById("prism-total-budget-exact")).toBeTruthy();
    expect(screen.getByText(/자동 실행안은 만들지 않았습니다/)).toBeTruthy();
    // 본문 칸을 고치는 동안에는 실행안이 생겨도 칸이 사라지지 않고, 칸을 떠나면 한 줄로 접힌다.
    const inline = document.getElementById("prism-total-budget-exact");
    fireEvent.focus(inline);
    fireEvent.change(inline, { target: { value: String(Math.round((Number(slider.min) + Number(slider.max)) / 2)) } });
    expect(document.querySelector(".result-action-card")).toBeTruthy();
    expect(document.getElementById("prism-total-budget-exact")).toBe(inline);
    fireEvent.blur(inline);
    expect(document.getElementById("prism-total-budget-exact")).toBeNull();
    expect(document.getElementById("s-controls").textContent).toContain("일예산");
  });

  it("효율 목표 모드는 CPI/CPA/ROAS 중 현재 CSV에 있는 목표의 전역 슬라이더로 최대 안전 예산을 찾는다", () => {
    render(<BudgetAllocation />);
    chooseBasis(/효율 목표/, "ko", { keepOpen: true });
    const sliders = document.querySelectorAll('input[type="range"]');
    expect(sliders).toHaveLength(1);
    const targetSlider = document.getElementById("prism-efficiency-target");
    expect(targetSlider).toBeTruthy();
    expect(document.querySelector("#s-table input")).toBeNull();
    expect(() => {
      fireEvent.change(targetSlider, { target: { value: targetSlider.max } });
    }).not.toThrow();
    expect(document.querySelector(".prism-driver__status")).toBeTruthy();
  });

  it("달성 불가능한 효율 목표는 참고안만 보이고 실행·저장 가능한 결과를 만들지 않는다", () => {
    render(<BudgetAllocation />);
    chooseBasis(/효율 목표/, "ko", { keepOpen: true });
    const targetSlider = document.getElementById("prism-efficiency-target");
    fireEvent.change(targetSlider, { target: { value: targetSlider.min } });
    expect(screen.getByText(/실행·저장할 수 없습니다/)).toBeTruthy();
    expect(document.querySelector(".result-action-card")).toBeNull();
  });

  it("효율 목표에서 고른 KPI는 총 예산 모드에도 그대로 이어진다", () => {
    render(<BudgetAllocation />);
    const conditions = chooseBasis(/효율 목표/, "ko", { keepOpen: true });
    fireEvent.click(objectiveRadio(/ROAS/));
    expect(objectiveRadio(/ROAS/).getAttribute("aria-checked")).toBe("true");
    closeConditions(conditions);
    fireEvent.click(screen.getByRole("button", { name: /^배분 대상:/ }));
    fireEvent.click(screen.getByRole("button", { name: "적용 후 곡선 검토" }));
    const finish = screen.getAllByRole("button", { name: /검증 완료 및 예산 배분/ })[0];
    fireEvent.click(finish);
    chooseBasis(/총 예산/);
    expect(objectiveRadio(/ROAS/).getAttribute("aria-checked")).toBe("true");
  });

  it("기본 CPI 목표도 빠른 필터 적용 뒤에 같은 KPI로 검증 단계에 들어간다", () => {
    render(<BudgetAllocation />);
    chooseBasis(/효율 목표/);
    expect(objectiveRadio(/CPI/).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /^배분 대상:/ }));
    fireEvent.click(screen.getByRole("button", { name: "적용 후 곡선 검토" }));
    expect(screen.getByText(/데이터가 예산 변화에 반응했나/)).toBeTruthy();
  });

  for (const locale of ["ko", "en"]) it(`date selection is saved and invalid drafts preserve the applied range (${locale})`, () => {
    const en = locale === "en";
    render(<BudgetAllocation locale={locale} />);
    const dates = () => screen.getByRole("button", { name: en ? /^Analysis period/ : /^분석 기간/ });
    const observations = vi.spyOn(ALLOC_MATH, "removeOutliers");
    fireEvent.click(dates());
    fireEvent.change(screen.getByLabelText(en ? "Start date" : "시작일"), { target: { value: "2026-01-10" } });
    fireEvent.click(screen.getByRole("button", { name: en ? "Apply" : "적용", exact: true }));
    expect(dates().textContent).toContain("2026-01-10");
    expect(observations).toHaveBeenCalled();
    expect(observations.mock.calls.every(([points]) => points.every(point => point.date >= "2026-01-10" && point.date <= "2026-01-20"))).toBe(true);
    observations.mockRestore();
    expect(allocationOptionValue(foldSteps(useAppStore.getState().viewConfig["analysis-inputs:5-3"].recipeSteps, recipeVocabularyFor("5-3"), ALLOCATION_SPEC).state, "analysisRange")).toEqual({ start: "2026-01-10", end: "2026-01-20" });
    const table = document.getElementById("s-table");
    expect(table).toBeTruthy();
    fireEvent.click(dates());
    fireEvent.change(screen.getByLabelText(en ? "Start date" : "시작일"), { target: { value: "2026-01-21" } });
    fireEvent.click(screen.getByRole("button", { name: en ? "Apply" : "적용", exact: true }));
    expect(screen.getByRole("alert").textContent).toMatch(en ? /start date/ : /시작일/);
    fireEvent.click(screen.getByRole("button", { name: en ? "Cancel" : "취소", exact: true }));
    expect(dates().textContent).toContain("2026-01-10");
  });

  it("keeps the same global-driver behavior in English", () => {
    render(<BudgetAllocation locale="en" />);
    expect(document.getElementById("s-controls").textContent).toContain("Daily budget");
    closeConditions(openConditions("en"), "en");
    chooseBasis("Efficiency target", "en", { keepOpen: true });
    expect(document.getElementById("prism-efficiency-target")).toBeTruthy();
    expect(document.querySelector(".prism-driver__status")?.textContent).toMatch(/largest daily budget|observed maximum spend|observed-spend ceiling|No budget below the observed-spend ceilings/);
  });

  it("§6 채널 반응 곡선이 canvas로 렌더되고 채널 선택 전환이 throw 없이 동작 (P4)", () => {
    render(<BudgetAllocation />);
    // 결과-먼저 착지(step3, 예산 자동 시드) → §6 반응 곡선 canvas + 채널 선택 노출.
    const section = document.querySelector("#s-response");
    expect(section).toBeTruthy();
    const canvas = document.getElementById("alloc-response-curve");
    expect(canvas).toBeTruthy();
    expect(canvas.tagName).toBe("CANVAS");
    // Named selector changes the same curve state without a wall of color pills.
    const select = section.querySelector("select");
    expect(select.options.length).toBeGreaterThan(1);
    expect(() => fireEvent.change(select, { target: { value: select.options[1].value } })).not.toThrow();
    // 마커 해석 평어(현재/계획)가 노출.
    expect(section.textContent).toMatch(/현재|계획/);
  });

  it("§1 진단 산점도가 <details>로 접혀 있고, 펼쳐도(toggle) throw 없이 canvas resize 경로가 동작 (P5)", () => {
    render(<BudgetAllocation />);
    const scatter = document.querySelector("#s-scatter");
    expect(scatter).toBeTruthy();
    // 접힘 섹션은 <details>, 기본 collapsed(open=false).
    expect(scatter.tagName).toBe("SECTION");
    expect(scatter.tagName).toBe("SECTION");
    // 산점도 canvas는 접힌 상태로도 DOM에 존재.
    expect(document.getElementById("chart-alloc-scatter")).toBeTruthy();
    // 펼치기(toggle) → onToggle resize 경로 throw 없음.
    expect(() => {
      scatter.open = true;
      scatter.dispatchEvent(new Event("toggle"));
    }).not.toThrow();
  });
});
