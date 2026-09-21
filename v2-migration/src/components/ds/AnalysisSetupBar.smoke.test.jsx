import { activePro } from "@/test/proEntitlement";
import { beforeEach, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import AnalysisSetupBar from "./AnalysisSetupBar";
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
  const { container: top } = render(<AnalysisSetupBar toolId="5-2" slot="context" />);
  expect(top.querySelector(".analysis-setup__context")).toBeTruthy();
  expect(top.querySelector("button")).toBeNull();

  const { container: bottom } = render(<AnalysisSetupBar toolId="5-2" slot="actions" />);
  expect(bottom.querySelector(".analysis-setup__context")).toBeNull();
  expect(bottom.querySelector("button")).toBeTruthy();
  // 위계: 저장은 primary 버튼, 보관함은 텍스트 링크다(§5.3).
  expect(bottom.querySelector("button.btn.primary")).toBeTruthy();
  const shelf = bottom.querySelector(".analysis-setup__link");
  expect(shelf?.getAttribute("href")).toBe("/projects");
  expect(shelf?.classList.contains("btn")).toBe(false);
});

it("renders no empty actions block before any data is loaded", () => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.getState().setCurrentRouteId("5-2");
  const { container } = render(<AnalysisSetupBar toolId="5-2" slot="actions" />);
  expect(container.firstChild).toBeNull();
});
