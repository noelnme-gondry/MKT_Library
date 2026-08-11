// @vitest-environment jsdom
//
// Render-smoke for the BudgetAllocation (5-3) multi-step wizard flow.
// Complements BudgetAllocation.smoke.test.jsx (which only mounts the Step 1
// default) — drives real DOM clicks through Step1 -> Step2 (추세선 검증) ->
// Step3 (§4 배분 비중 bar chart) so render-throw bugs in step-transition JSX
// and Chart.js effects are caught (golden tests only cover pure math, §7).
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import BudgetAllocation, { buildAllocationModels, buildScatterDatasets } from "@/components/tools/BudgetAllocation";

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
}

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

  it("renders the §4 bar chart as a real <canvas> (Chart.js) once a budget is entered", () => {
    // 결과-먼저 착지라 위저드 네비 없이 바로 예산 입력 → 바 차트 렌더 경로.
    render(<BudgetAllocation />);
    const budgetSlider = document.getElementById("prism-total-budget");
    expect(budgetSlider).toBeTruthy();
    expect(() => {
      fireEvent.change(budgetSlider, { target: { value: budgetSlider.max } });
    }).not.toThrow();

    const barCanvas = document.getElementById("alloc-bar");
    expect(barCanvas).toBeTruthy();
    expect(barCanvas.tagName).toBe("CANVAS");
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
    const quickGoal = [...document.querySelectorAll(".tool-instrument-header__controls select")]
      .find((select) => [...select.options].some((option) => option.value === "roas"));
    expect(quickGoal).toBeTruthy();
    expect(quickGoal.value).toBe("roas");
    fireEvent.click(screen.getByRole("button", { name: "적용됨" }));
    const finish = screen.getAllByRole("button", { name: /검증 완료 및 예산 배분/ })[0];
    fireEvent.click(finish);
    fireEvent.click(screen.getByRole("button", { name: /총 예산/ }));
    expect(screen.getByRole("radio", { name: /ROAS/ }).getAttribute("aria-checked")).toBe("true");
  });

  it("기본 CPI 목표도 빠른 필터 적용 뒤에 같은 KPI로 검증 단계에 들어간다", () => {
    render(<BudgetAllocation />);
    fireEvent.click(screen.getByRole("button", { name: /효율 목표/ }));
    const quickGoal = [...document.querySelectorAll(".tool-instrument-header__controls select")]
      .find((select) => [...select.options].some((option) => option.value === "install"));
    expect(quickGoal).toBeTruthy();
    expect(quickGoal.value).toBe("install");
    fireEvent.click(screen.getByRole("button", { name: "적용됨" }));
    expect(screen.getByText(/데이터가 예산 변화에 반응했나/)).toBeTruthy();
  });

  it("keeps the same global-driver behavior in English", () => {
    render(<BudgetAllocation locale="en" />);
    expect(document.getElementById("prism-total-budget")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Efficiency target" }));
    expect(document.getElementById("prism-efficiency-target")).toBeTruthy();
    expect(document.querySelector(".prism-driver__status")?.textContent).toMatch(/largest daily budget|observed maximum spend|observed-spend ceiling|No budget below the observed-spend ceilings/);
  });

  it("§6 채널 반응 곡선이 canvas로 렌더되고 채널 pill 전환이 throw 없이 동작 (P4)", () => {
    render(<BudgetAllocation />);
    // 결과-먼저 착지(step3, 예산 자동 시드) → §6 반응 곡선 canvas + 채널 pill 노출.
    const section = document.querySelector("#s-response");
    expect(section).toBeTruthy();
    const canvas = document.getElementById("alloc-response-curve");
    expect(canvas).toBeTruthy();
    expect(canvas.tagName).toBe("CANVAS");
    // 다른 채널 pill 클릭 → 곡선 재빌드 경로 throw 없음.
    const pills = [...section.querySelectorAll("button")];
    expect(pills.length).toBeGreaterThan(1);
    expect(() => fireEvent.click(pills[1])).not.toThrow();
    // 마커 해석 평어(현재/계획)가 노출.
    expect(section.textContent).toMatch(/현재|계획/);
  });

  it("§1 진단 산점도가 <details>로 접혀 있고, 펼쳐도(toggle) throw 없이 canvas resize 경로가 동작 (P5)", () => {
    render(<BudgetAllocation />);
    const scatter = document.querySelector("#s-scatter");
    expect(scatter).toBeTruthy();
    // 접힘 섹션은 <details>, 기본 collapsed(open=false).
    expect(scatter.tagName).toBe("DETAILS");
    expect(scatter.open).toBe(false);
    // 산점도 canvas는 접힌 상태로도 DOM에 존재.
    expect(document.getElementById("chart-alloc-scatter")).toBeTruthy();
    // 펼치기(toggle) → onToggle resize 경로 throw 없음.
    expect(() => {
      scatter.open = true;
      scatter.dispatchEvent(new Event("toggle"));
    }).not.toThrow();
  });
});
