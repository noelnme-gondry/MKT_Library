// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { act, cleanup, render, screen } from "@testing-library/react";
import ProjectsPage from "./ProjectsPage";
import { useAppStore } from "@/store/useDataStore";
import { activePro } from "@/test/proEntitlement";
vi.mock("@/components/ProjectStorageSummary", () => ({ default: () => null }));
beforeEach(() => {
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ activeProjectId: "p1", projects: [], projectsReady: false, refreshProjects: vi.fn(), entitlement: activePro() });
});
afterEach(cleanup);
it.each(["ko", "en"])("loads saved branding when the active project's async read finishes (%s)", locale => {
  render(<ProjectsPage locale={locale} />);
  act(() => useAppStore.setState({ projectsReady: true, projects: [{ id: "p1", name: "Project", branding: { company: "Existing company", footer: "Existing footer", logo: "" } }] }));
  expect(screen.getByRole("textbox", { name: locale === "en" ? "Company" : "회사명" }).value).toBe("Existing company");
  expect(screen.getByRole("textbox", { name: locale === "en" ? "Closing note / contact" : "보고서 하단 문구·연락처" }).value).toBe("Existing footer");
});
it.each(["ko", "en"])("an empty project list links back to the last analysis the visitor opened (%s)", locale => {
  // 도구에서 '내 프로젝트'로 왔는데 프로젝트가 없으면 돌아갈 길이 '첫 리뷰 시작'뿐이었다.
  act(() => useAppStore.getState().setCurrentRouteId("5-21"));
  act(() => useAppStore.getState().setCurrentRouteId("projects"));
  expect(useAppStore.getState().lastToolRouteId).toBe("5-21");
  useAppStore.setState({ projectsReady: true, projects: [] });
  render(<ProjectsPage locale={locale} />);
  const back = screen.getByRole("link", { name: locale === "en" ? /Reopen the last analysis/ : /방금 본 분석 다시 열기/ });
  expect(back.getAttribute("href")).toBe(`${locale === "en" ? "/en" : ""}/tools/campaign-variance`);
});
