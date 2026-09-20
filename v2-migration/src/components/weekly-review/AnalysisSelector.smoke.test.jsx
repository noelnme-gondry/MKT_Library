// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import AnalysisSelector from "./AnalysisSelector";
import { useAppStore } from "@/store/useDataStore";
import { prepareDatasetForTool } from "@/lib/data-import/prepareDatasetForTool";

// 무거운 도구는 마운트 여부만 본다 — 여기서 검증할 것은 "고르고 돌리는 흐름"이다.
vi.mock("@/components/Dashboard", () => ({ default: () => <div data-testid="tool-5-2" /> }));
vi.mock("@/components/tools/BudgetAllocation", () => ({ default: () => <div data-testid="tool-5-3" /> }));
vi.mock("@/components/tools/CampaignPvm", () => ({ default: () => <div data-testid="tool-5-21" /> }));
vi.mock("@/components/tools/MarketingEfficiency", () => ({ default: () => <div data-testid="tool-5-22" /> }));

function rows() {
  return Array.from({ length: 28 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 7, 10 + Math.floor(index / 2))).toISOString().slice(0, 10),
    channel: index % 2 ? "Meta" : "Google",
    campaign_name: index % 2 ? "AAP" : "UAC",
    cost: 1000 + index * 37,
    installs: 40 + index,
    actions: 20 + index,
    clicks: 500 + index * 5,
    impressions: 20000 + index * 90,
  }));
}

beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  const state = useAppStore.getState();
  state.setCurrentRouteId("weekly-review");
  // 상태를 손으로 주입하면 `canonicalData`가 없어 적격 판정이 전부 "0행"으로 막힌다.
  // 실제 업로드가 밟는 경로를 그대로 밟는다(§7 — 셋업이 진입 경로를 우회하면 안 된다).
  const data = rows();
  state.setCsvData(prepareDatasetForTool({ raw: data, headers: Object.keys(data[0]), toolId: "5-2", source: "test" }));
});
afterEach(cleanup);

it("이 데이터로 할 수 있는 분석을 목록에서 파생해 보여준다", () => {
  // 손으로 쓴 배열이 아니라 ANALYSIS_CONTRACTS에서 나온다 — 도구가 늘면 같이 는다.
  render(<AnalysisSelector locale="ko" />);
  expect(screen.getByRole("heading", { name: "이 데이터로 할 수 있는 분석" })).toBeTruthy();
  expect(screen.getAllByRole("button", { pressed: true }).length).toBeGreaterThan(0);
  expect(screen.getAllByRole("button").length).toBeGreaterThan(2);
});

it("여러 개를 함께 고를 수 있다", () => {
  render(<AnalysisSelector locale="ko" />);
  const options = screen.getAllByRole("button").filter((node) => node.className.includes("analysis-selector__option") && !node.disabled);
  expect(options.length).toBeGreaterThan(1);
  fireEvent.click(options[1]);
  const pressed = options.filter((node) => node.getAttribute("aria-pressed") === "true");
  expect(pressed.length).toBeGreaterThan(1);
});

it("고른 결과를 탭으로 보여주고 처음 결과를 선택한다", () => {
  render(<AnalysisSelector locale="ko" />);
  const options = screen.getAllByRole("button").filter((node) => node.className.includes("analysis-selector__option") && !node.disabled);
  fireEvent.click(options[1]);
  fireEvent.click(screen.getByRole("button", { name: /분석 시작/ }));
  expect(screen.getByRole("heading", { name: "분석 결과" })).toBeTruthy();
  // 고른 수만큼 접기가 생긴다 — 4~5개를 골라도 버튼 하나로 하나씩 관리된다.
  expect(screen.getAllByRole("tab")).toHaveLength(2);
  // 한 번에 여러 개를 펴면 어느 것을 읽는지 알 수 없다.
  expect(screen.getAllByRole("tab", { selected: true })).toHaveLength(1);
  expect(screen.getAllByRole("tab", { selected: false })).toHaveLength(1);
});

it("선택된 탭을 다시 눌러도 결과가 사라지지 않는다", () => {
  render(<AnalysisSelector locale="ko" />);
  fireEvent.click(screen.getByRole("button", { name: /분석 시작/ }));
  const open = screen.getByRole("tab", { selected: true });
  expect(document.querySelectorAll(".analysis-selector__result-body")).toHaveLength(1);
  fireEvent.click(open);
  // 닫으면 언마운트한다 — 무거운 도구 넷을 동시에 붙들고 있으면 메인 스레드가 멈춘다.
  expect(document.querySelectorAll(".analysis-selector__result-body")).toHaveLength(1);
});

it("다시 고를 수 있다", () => {
  render(<AnalysisSelector locale="ko" />);
  fireEvent.click(screen.getByRole("button", { name: /분석 시작/ }));
  fireEvent.click(screen.getByRole("button", { name: "분석 다시 고르기" }));
  expect(screen.getByRole("heading", { name: "이 데이터로 할 수 있는 분석" })).toBeTruthy();
});

it("데이터가 없으면 아무것도 그리지 않는다", () => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  const { container } = render(<AnalysisSelector locale="ko" />);
  expect(container.querySelector(".analysis-selector")).toBeNull();
});

it("EN도 같은 구조로 렌더된다", () => {
  render(<AnalysisSelector locale="en" />);
  expect(screen.getByRole("heading", { name: "Analyses available for this data" })).toBeTruthy();
});
