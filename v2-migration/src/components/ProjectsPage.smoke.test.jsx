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
