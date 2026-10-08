// @vitest-environment jsdom
//
// Render-smoke for the BudgetAllocation (5-3) multi-step wizard flow.
// Complements BudgetAllocation.smoke.test.jsx (which only mounts the Step 1
// default) — drives real DOM clicks through Step1 -> Step2 (추세선 검증) ->
// Step3 (§4 배분 비중 bar chart) so render-throw bugs in step-transition JSX
// and Chart.js effects are caught (golden tests only cover pure math, §7).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import { ALLOCATION_SPEC, allocationOptionValue } from "@/lib/recipe/allocationRecipe";
import { foldSteps } from "@/lib/recipe/recipe";
import { recipeVocabularyFor } from "@/lib/recipe/toolVocabulary";
import { ALLOC_MATH } from "@/utils/allocationMath";
import BudgetAllocation, { buildAllocationChartCountries, buildAllocationChartPoints, buildAllocationModels, buildScatterDatasets } from "@/components/tools/BudgetAllocation";

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

  it("진단은 확인 탭에서 읽고 총합 수치는 결론에 한 번만 표시한다", () => {
    render(<BudgetAllocation />);
    const diagnosis = document.querySelector(".alloc-diag-card");
    expect(diagnosis).toBeTruthy();
    expect(document.querySelector(".alloc-total-card")).toBeNull();
    expect(document.querySelectorAll(".result-action-card__stats")).toHaveLength(1);
    expect(diagnosis.querySelector(".alloc-insight-summary").textContent).toMatch(/감액|증액|효율 점검/);
    expect(diagnosis.closest('[role="tabpanel"]').hidden).toBe(true);
    fireEvent.click(screen.getByRole("tab", { name: "확인", exact: true }));
    expect(diagnosis.closest('[role="tabpanel"]').hidden).toBe(false);
    expect(diagnosis.querySelectorAll(".alloc-diag-item").length).toBeGreaterThan(0);
    expect(diagnosis.querySelectorAll(".alloc-diag-item").length).toBeLessThanOrEqual(3);
  });

  it("switches between named current/plan distribution and the full allocation table", () => {
    // 결과-먼저 착지라 위저드 네비 없이 바로 예산 입력 → 바 차트 렌더 경로.
    render(<BudgetAllocation />);
    const budgetSlider = document.getElementById("prism-total-budget");
    expect(budgetSlider).toBeTruthy();
    expect(() => {
      fireEvent.change(budgetSlider, { target: { value: budgetSlider.max } });
    }).not.toThrow();

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
    const slider = document.getElementById("prism-total-budget");
    const exact = document.getElementById("prism-total-budget-exact");
    fireEvent.change(exact, { target: { value: String(Number(slider.max) * 2) } });
    fireEvent.blur(exact);
    expect(screen.getByText(/자동 실행안은 만들지 않았습니다/)).toBeTruthy();
    expect(screen.queryByText(/결론 —/)).toBeNull();
  });

  it("효율 목표 모드는 CPI/CPA/ROAS 중 현재 CSV에 있는 목표의 전역 슬라이더로 최대 안전 예산을 찾는다", () => {
    render(<BudgetAllocation />);
    fireEvent.click(screen.getByRole("button", { name: /효율 목표/ }));
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
    fireEvent.click(screen.getByRole("button", { name: /효율 목표/ }));
    const targetSlider = document.getElementById("prism-efficiency-target");
    fireEvent.change(targetSlider, { target: { value: targetSlider.min } });
    expect(screen.getByText(/실행·저장할 수 없습니다/)).toBeTruthy();
    expect(screen.queryByText(/결론 —/)).toBeNull();
  });

  it("효율 목표에서 고른 KPI는 총 예산 모드에도 그대로 이어진다", () => {
    render(<BudgetAllocation />);
    fireEvent.click(screen.getByRole("button", { name: /효율 목표/ }));
    fireEvent.click(screen.getByRole("radio", { name: /ROAS/ }));
    expect(screen.getByRole("radio", { name: /ROAS/ }).getAttribute("aria-checked")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /^배분 대상:/ }));
    fireEvent.click(screen.getByRole("button", { name: "적용 후 곡선 검토" }));
    const finish = screen.getAllByRole("button", { name: /검증 완료 및 예산 배분/ })[0];
    fireEvent.click(finish);
    fireEvent.click(screen.getByRole("button", { name: /총 예산/ }));
    expect(screen.getByRole("radio", { name: /ROAS/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("기본 CPI 목표도 빠른 필터 적용 뒤에 같은 KPI로 검증 단계에 들어간다", () => {
    render(<BudgetAllocation />);
    fireEvent.click(screen.getByRole("button", { name: /효율 목표/ }));
    expect(screen.getByRole("radio", { name: /CPI/ }).getAttribute("aria-checked")).toBe("true");
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
    expect(document.getElementById("prism-total-budget")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Efficiency target" }));
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
