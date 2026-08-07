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
  const headers = ["Date", "Country", "Platform", "Channel", "Spend", "Installs"];
  const mapping = {
    Date: "date",
    Country: "country",
    Platform: "platform",
    Channel: "channel",
    Spend: "cost",
    Installs: "installs",
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
      raw.push({ Date: date, Country: "KR", Platform: "iOS", Channel: ch, Spend: cost, Installs: installs });
    }
  }
  useAppStore.setState({
    currentRouteId: "5-3",
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

    expect(screen.getByText(/추세선 검증/)).toBeTruthy();
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
    const budgetInput = document.querySelector('input[type="text"]');
    expect(budgetInput).toBeTruthy();
    expect(() => {
      fireEvent.change(budgetInput, { target: { value: "1000000" } });
      fireEvent.blur(budgetInput);
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

  it("수동 시뮬레이션 모드에서 채널별 드래그 슬라이더(range)가 throw 없이 렌더 (P3b)", () => {
    render(<BudgetAllocation />);
    // 결과-먼저 착지(step3, 예산 자동 시드) → 수동 시뮬레이션 탭 → 채널별 슬라이더 노출.
    fireEvent.click(screen.getByText(/캠페인별 수동 시뮬레이션/));
    const sliders = document.querySelectorAll('input[type="range"]');
    expect(sliders.length).toBeGreaterThan(0);
  });

  it("자동 분배 모드(기본 착지)에서도 채널별 드래그 슬라이더가 렌더되고 드래그가 채널을 고정한다 (P3b 자동)", () => {
    render(<BudgetAllocation />);
    // 기본 landing = 자동 분배(simMode auto) + step3 + 예산 자동 시드 → 슬라이더 노출.
    const sliders = document.querySelectorAll('input[type="range"]');
    expect(sliders.length).toBeGreaterThan(0);
    // Cost 입력은 자동 모드에서도 disabled가 아니어야 함(드래그/입력=고정 override).
    const costInputs = document.querySelectorAll('input.tnum');
    expect(costInputs.length).toBeGreaterThan(0);
    expect([...costInputs].every((el) => !el.disabled)).toBe(true);
    // 슬라이더 드래그 후 release → costDrafts 커밋(override) 경로가 throw 없이 동작.
    expect(() => {
      fireEvent.change(sliders[0], { target: { value: "50000" } });
      fireEvent.mouseUp(sliders[0]);
    }).not.toThrow();
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
});
