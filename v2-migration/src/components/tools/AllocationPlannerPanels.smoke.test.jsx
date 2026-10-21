// @vitest-environment jsdom
// 5-3 결과에 붙은 플래너 근거(예측·대상별 상태·단가 변화 분해·소재 상태)가 실제 진입 경로에서
// 그려지는지 본다. 문구와 행 수를 단언한다 — 렌더만 확인하면 빈 표도 통과한다(§7).
import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent, screen, within } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import BudgetAllocation from "@/components/tools/BudgetAllocation";
import { buildSampleJourney } from "@/lib/sampleJourney";
import { PlannerCreativeStatus, PlannerForecast, PlannerPlanReview } from "@/components/tools/AllocationPlannerPanels";
import { allocationAt, loserOffScenarioAt, newCreativeScenarioAt, prepareAllocationPlanner } from "@/lib/budgetPlanner/allocationAdapter";
import { reviewAllocationPlan } from "@/lib/budgetPlanner/planReview";
import { serializeAllocationPlan } from "@/lib/budgetPlanner/planSnapshot";
import { vi } from "vitest";

function seed(locale) {
  const csv = buildSampleJourney(locale);
  useAppStore.setState({
    currentRouteId: "5-3",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: csv },
    csvData: csv,
  });
  useAppStore.getState().setGroupAnalyzed("5-3");
}

describe("5-3 플래너 근거 구역", () => {
  beforeEach(() => useAppStore.setState({ analyzedByGroup: {} }));

  it.each([
    ["ko", "이 배분안으로 앞으로 14일", "확인", "대상별 소진 상태와 변화 원인", "소재 상태"],
    ["en", "Next 14 days with this plan", "Checks", "Spend state and change cause by target", "Creative status"],
  ])("%s: 배분안 탭에 기간 예측, 확인 탭에 상태·분해·소재 표가 숫자와 함께 나온다", (locale, forecastTitle, checksTab, statusTitle, creativeTitle) => {
    seed(locale);
    render(<BudgetAllocation locale={locale} />);
    const forecast = document.querySelector(".planner-forecast");
    expect(forecast, "예측 구역이 없다").toBeTruthy();
    expect(forecast.textContent).toContain(forecastTitle);
    const values = [...forecast.querySelectorAll(".planner-forecast__stats dd")].map((node) => node.textContent);
    expect(values.length).toBeGreaterThanOrEqual(4);
    for (const value of values) expect(value).toMatch(/\d/);
    // 예측 오차를 확인한 경우와 못 한 경우 중 하나는 반드시 말한다.
    expect(forecast.querySelector(".planner-forecast__notes").textContent.length).toBeGreaterThan(20);

    fireEvent.click(screen.getByRole("tab", { name: checksTab, exact: true }));
    const status = screen.getByRole("table", { name: statusTitle });
    const statusRows = within(status).getAllByRole("row").slice(1);
    expect(statusRows.length).toBeGreaterThan(2);
    for (const row of statusRows) expect(row.querySelectorAll("td").length).toBeGreaterThanOrEqual(4);
    expect(document.querySelector(".planner-breakdown")).toBeTruthy();
    // 예시 데이터에는 소재 열이 있다 — 구역이 없으면 소재 매핑이 5-3에 닿지 않은 것이다.
    // 예시 소재는 모두 첫날부터 쓰던 소재라 표 대신 무엇을 확인했는지 한 줄로 말한다.
    const creatives = document.querySelector(".planner-creatives");
    expect(creatives, "소재 구역이 없다").toBeTruthy();
    expect(creatives.textContent).toContain(creativeTitle);
    expect(creatives.textContent).toMatch(/24/);
  });

  it("분해 표는 전체 행이 먼저 오고 대상별 행이 이어진다", () => {
    seed("ko");
    render(<BudgetAllocation locale="ko" />);
    fireEvent.click(screen.getByRole("tab", { name: "확인", exact: true }));
    const table = document.querySelector(".planner-breakdown table");
    expect(table, "분해 표가 없다").toBeTruthy();
    const rows = [...table.querySelectorAll("tbody tr")];
    expect(rows[0].textContent).toContain("전체");
    expect(rows.length).toBeGreaterThan(2);
  });

  it("신규 소재가 있으면 행동이 필요한 상태부터 표로 보인다", () => {
    const start = Date.parse("2026-06-01T00:00:00Z");
    const day = (t) => new Date(start + t * 86400000).toISOString().slice(0, 10);
    const rows = [];
    for (let t = 0; t <= 40; t += 1) {
      rows.push({ date: day(t), country: "KR", channel: "Meta", platform: "", creative_id: "old", cost: 20000 + (t % 5) * 1000, installs: (20000 + (t % 5) * 1000) / 1000 });
      if (t >= 36) rows.push({ date: day(t), country: "KR", channel: "Meta", platform: "", creative_id: "fresh", cost: 8000, installs: 4 });
    }
    const planner = prepareAllocationPlanner(rows, { unitField: "channel", metric: "installs", adv: { trendType: "auto", outlierMethod: "none" } });
    expect(planner.ok).toBe(true);
    render(<PlannerCreativeStatus planner={planner} locale="ko" metricLabel="CPI" />);
    const table = screen.getByRole("table", { name: "소재 상태" });
    const first = within(table).getAllByRole("row")[1];
    expect(first.textContent).toContain("fresh");
    expect(first.textContent).toContain("학습 중");
  });

  it("새 소재를 넣는다면: 대상을 고르면 같은 배분의 예측이 어떻게 바뀌는지 출시 이력 근거와 함께 말한다", () => {
    const start = Date.parse("2026-06-01T00:00:00Z");
    const day = (t) => new Date(start + t * 86400000).toISOString().slice(0, 10);
    const rows = [];
    for (let t = 0; t <= 40; t += 1) {
      for (const [channel, base] of [["Meta", 20000], ["TikTok", 12000]]) {
        const cost = base * (1 + 0.4 * Math.sin(t / 3.7 + base));
        rows.push({ date: day(t), country: "KR", channel, platform: "", cost, installs: cost / (base / 20) });
      }
    }
    const planner = prepareAllocationPlanner(rows, { unitField: "channel", metric: "installs", adv: { trendType: "auto", outlierMethod: "none" } });
    expect(planner.ok).toBe(true);
    const budget = planner.allocationNodes.reduce((acc, node) => acc + node.current, 0);
    const { forecast } = allocationAt(planner, budget, { withForecast: true });
    const scenario = newCreativeScenarioAt(planner, budget, "KR · Meta");
    const onUnit = vi.fn();
    const props = { forecast, backtest: planner.backtest, locale: "ko", resultLabel: "설치", metricLabel: "CPI", fmtMoney: (v) => `₩${Math.round(v)}`, fmtCount: (v) => String(Math.round(v)), fmtUnitCost: (v) => `₩${Math.round(v)}`, units: ["KR · Meta", "KR · TikTok"], onNewCreativeUnit: onUnit };
    const { rerender } = render(<PlannerForecast {...props} />);
    fireEvent.change(screen.getByLabelText("새 소재를 넣는다면"), { target: { value: "KR · Meta" } });
    expect(onUnit).toHaveBeenCalledWith("KR · Meta");
    rerender(<PlannerForecast {...props} newCreativeUnit="KR · Meta" newCreativeScenario={scenario} />);
    const text = screen.getByText(/KR · Meta에 내일 새 소재를 넣으면 14일 예상 설치/).textContent;
    expect(text).toContain(`${Math.round(scenario.base.results)} → ${Math.round(scenario.scenario.results)}`);
    expect(scenario.scenario.results).toBeLessThan(scenario.base.results);
    expect(text).toContain("기본 가정");
  });

  it("지난 배분안 대조: 검토일 전에는 기록 버튼을 막고, 지나면 문장과 함께 넘긴다", () => {
    const plan = serializeAllocationPlan({ start: "2026-09-01", days: 7, metric: "installs", unitField: "channel", byPlatform: false, targets: [{ unit: "KR · Meta", cost: 7000, results: 70 }, { unit: "KR · TikTok", cost: 7000, results: 35 }] });
    const rows = [];
    for (let d = 1; d <= 9; d += 1) {
      const date = `2026-09-0${d}`;
      rows.push({ date, country: "KR", channel: "Meta", cost: 1000, installs: 10 }, { date, country: "KR", channel: "TikTok", cost: 1000, installs: 4 });
    }
    const match = reviewAllocationPlan({ id: "p", toolId: "5-3", action: "배분안 적용", comparisonKind: "allocation_plan", allocationPlan: plan, reviewDate: "2026-09-08" }, rows);
    const onApply = vi.fn();
    const props = { matches: [match], locale: "ko", fmtCpr: () => (v) => `₩${Math.round(v)}`, fmtCount: (v) => String(Math.round(v)), onApply };
    const { rerender } = render(<PlannerPlanReview {...props} today="2026-09-07" />);
    expect(screen.getByRole("heading", { name: "지난 배분안 대조 1건" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "이 대조 결과 기록" }).disabled).toBe(true);
    rerender(<PlannerPlanReview {...props} today="2026-09-08" />);
    fireEvent.click(screen.getByRole("button", { name: "이 대조 결과 기록" }));
    expect(onApply.mock.calls[0][1].actual).toContain("실제 CPI ₩143 · 계획 ₩133");
  });

  it("학습 예산 부족과 '나쁜 소재를 끄면' 안이 소재 표 안팎에 숫자와 함께 나온다", () => {
    const start = Date.parse("2026-06-01T00:00:00Z");
    const day = (t) => new Date(start + t * 86400000).toISOString().slice(0, 10);
    const rows = [];
    for (let t = 0; t <= 60; t += 1) {
      const cost = 70000 * (1 + 0.45 * Math.sin(t / 4.3));
      rows.push({ date: day(t), country: "KR", channel: "Meta", platform: "", creative_id: "old", cost, installs: cost / (40 * Math.pow(cost, 0.3)) });
      if (t >= 30) rows.push({ date: day(t), country: "KR", channel: "Meta", platform: "", creative_id: "bad", cost: 30000, installs: 30000 / (80 * Math.pow(30000, 0.3)) });
      if (t >= 58) rows.push({ date: day(t), country: "KR", channel: "Meta", platform: "", creative_id: "fresh", cost: 2000, installs: 1 });
    }
    const planner = prepareAllocationPlanner(rows, { unitField: "channel", metric: "installs", adv: { trendType: "auto", outlierMethod: "none" } });
    const budget = planner.allocationNodes.reduce((acc, node) => acc + node.current, 0);
    const { allocation } = allocationAt(planner, budget);
    expect(allocation.learningWarnings.map((w) => [w.creativeId, w.status])).toEqual([["fresh", "short"]]);
    const loser = loserOffScenarioAt(planner, budget);
    render(<PlannerCreativeStatus planner={planner} locale="ko" metricLabel="CPI" learningWarnings={allocation.learningWarnings} loserScenario={loser} resultLabel="설치" fmtMoney={(v) => `₩${Math.round(v)}`} fmtCount={(v) => String(Math.round(v))} />);
    const table = screen.getByRole("table", { name: "소재 상태" });
    expect(within(table).getByText(/이 배분으로는 학습 완료가 어려움: 하루 약 ₩\d+ 필요/)).toBeTruthy();
    expect(screen.getByText(/기존보다 나쁜 소재 bad \(KR · Meta\)를 끄면 같은 예산으로 14일 예상 설치/)).toBeTruthy();
  });
});
