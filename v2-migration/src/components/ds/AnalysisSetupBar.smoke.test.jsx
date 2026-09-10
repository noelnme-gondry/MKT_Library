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
  useAppStore.setState({ activeProjectId: "p", projects: [{ id: "p" }], projectsReady: true, decisionPersistenceEnabled: true, refreshProjects: vi.fn(async () => {}) });
  useAppStore.getState().setCurrentRouteId("5-2");
  useAppStore.getState().setCsvData({ raw: [{ date: "2026-09-01" }], headers: ["date"], mapping: { date: "date" } });
});
it.each(["ko", "en"])("saves a named setup through the actual %s form", async locale => {
  render(<AnalysisSetupBar toolId="5-2" locale={locale} />);
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Save analysis setup" : "분석 설정 저장" }));
  fireEvent.change(screen.getByRole("textbox"), { target: { value: "My weekly setup" } });
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Save" : "저장", exact: true }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toContain(locale === "en" ? "Saved." : "저장했습니다."));
  expect(updateProject).toHaveBeenCalledWith("p", expect.any(Function), expect.any(Function));
});
it("never offers saving without a project", () => {
  useAppStore.setState({ projects: [] });
  render(<AnalysisSetupBar toolId="5-2" />);
  expect(screen.getByRole("button", { name: "분석 설정 저장" }).disabled).toBe(true);
});
