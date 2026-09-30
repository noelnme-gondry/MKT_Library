import { activePro } from "@/test/proEntitlement";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import AnalysisSetupBar from "./AnalysisSetupBar";
import { TOOL_INPUT_KEYS } from "@/lib/analysis-settings/toolInputs";
vi.mock("@/lib/project/repository", () => ({ updateProject: vi.fn(async (_id, patch) => patch({ savedAnalyses: [] })) }));
vi.mock("@/lib/project/savedAnalyses", () => ({ MAX_SAVED_ANALYSES: 20, captureSavedAnalysis: vi.fn(async (_state, toolId, name) => ({ id: "setup", toolId, name })) }));
import { updateProject } from "@/lib/project/repository";
beforeEach(() => {
  vi.clearAllMocks();
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ activeProjectId: "p", entitlement: activePro(), projects: [{ id: "p" }], projectsReady: true, decisionPersistenceEnabled: true, refreshProjects: vi.fn(async () => {}) });
  useAppStore.getState().setCurrentRouteId("5-2");
  useAppStore.getState().setCsvData({ raw: [{ date: "2026-09-01" }], headers: ["date"], mapping: { date: "date" } });
});
it.each(["ko", "en"])("saves a named setup through the actual %s form", async locale => {
  render(<AnalysisSetupBar toolId="5-2" locale={locale} slot="actions" />);
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Save this setup to the project" : "이 설정을 프로젝트에 저장" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "My weekly setup" } });
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Save" : "저장", exact: true }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain(locale === "en" ? "Saved." : "저장했습니다."));
  expect(updateProject).toHaveBeenCalledWith("p", expect.any(Function), expect.any(Function), expect.objectContaining({ plan: "paid" }));
});
it("never offers saving without a project", () => {
  useAppStore.setState({ projects: [] });
  render(<AnalysisSetupBar toolId="5-2" slot="actions" />);
  expect(screen.getByRole("button", { name: "이 설정을 프로젝트에 저장" }).disabled).toBe(true);
});

// 두 자리가 각각 무엇을 맡는지 고정한다. 한쪽으로 몰면 계약이 깨진다 —
// 현재 입력이 아래로 가면 "아래 입력을 확인한 뒤" 문구가 거짓이 되고,
// 저장 버튼이 위로 가면 분석 전에 설정 저장을 묻는 예전 상태로 돌아간다.
it("keeps the pre-analysis context and the post-result actions in separate slots", () => {
  useAppStore.getState().setCurrentRouteId("5-21");
  const { container: top } = render(<AnalysisSetupBar toolId="5-21" slot="context" />);
  expect(top.querySelector(".analysis-setup__context")).toBeTruthy();
  expect(top.querySelector("button")).toBeNull();
  // 기간 필터는 걸렸을 때만 말한다 — "제한 없음 — 제한 없음"을 쓰지 않는다.
  expect(top.textContent).not.toMatch(/제한 없음/);

  const { container: bottom } = render(<AnalysisSetupBar toolId="5-2" slot="actions" />);
  expect(bottom.querySelector(".analysis-setup__context")).toBeNull();
  expect(bottom.querySelector("button")).toBeTruthy();
  // 저장은 보조 버튼, 보관함은 텍스트 링크다. 결과의 주요 행동과 경쟁하지 않는다.
  expect(bottom.querySelector(".analysis-setup__save button.btn")).toBeTruthy();
  const shelf = bottom.querySelector(".analysis-setup__link");
  expect(shelf?.getAttribute("href")).toBe("/projects");
  expect(shelf?.classList.contains("btn")).toBe(false);
});

it("renders no empty actions block for a CSV-only tool with no data", () => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.getState().setCurrentRouteId("5-2");
  expect(TOOL_INPUT_KEYS["5-2"]).toEqual([]);
  const { container } = render(<AnalysisSetupBar toolId="5-2" slot="actions" />);
  expect(container.firstChild).toBeNull();
});

// 회귀 방지: 헤더 유무로 막았더니 CSV 없이 수동 입력만 쓰는 도구에서 저장
// 동선이 통째로 사라졌다. 저장할 설정이 있는지는 컬럼이 아니라 도구 계약이 안다.
it("still offers saving for a tool whose setup is manual inputs, with no CSV", () => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ activeProjectId: "p", entitlement: activePro(), projects: [{ id: "p" }], projectsReady: true, decisionPersistenceEnabled: true });
  useAppStore.getState().setCurrentRouteId("5-26");
  expect(TOOL_INPUT_KEYS["5-26"].length).toBeGreaterThan(0);
  const { container } = render(<AnalysisSetupBar toolId="5-26" slot="actions" />);
  expect(container.querySelector(".analysis-setup__save button.btn")).toBeTruthy();
});

it.each(["ko", "en"])("hides empty input context before a CSV is provided (%s)", locale => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.getState().setCurrentRouteId("5-21");
  const { container } = render(<AnalysisSetupBar toolId="5-21" locale={locale} />);
  expect(container.childElementCount).toBe(0);
});

// 운영 대시보드는 제목 줄이 "파일 · N행"을 말하므로 공통 줄을 한 번 더 두지 않는다(2026-09-29).
it("leaves the data line to the dashboard title row", () => {
  const { container } = render(<AnalysisSetupBar toolId="5-2" slot="context" />);
  expect(container.querySelector(".analysis-setup__context")).toBeNull();
});

it.each(["ko", "en"])("keeps saturation data in its uploader and saving in its own purpose group (%s)", locale => {
  useAppStore.getState().setCurrentRouteId("5-22");
  const { container } = render(<AnalysisSetupBar toolId="5-22" locale={locale} slot="context" />);
  expect(container.firstChild).toBeNull();
  render(<AnalysisSetupBar toolId="5-22" locale={locale} slot="actions" />);
  expect(screen.getByRole("heading", { name: locale === "en" ? "Reuse this analysis setup" : "다음 분석에도 같은 설정 사용하기" })).toBeTruthy();
  expect(screen.getByRole("button", { name: locale === "en" ? "Save this setup to the project" : "이 설정을 프로젝트에 저장" }).disabled).toBe(false);
});
