import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { IDBFactory } from "fake-indexeddb";
import { activePro } from "@/test/proEntitlement";
import { useAppStore } from "@/store/useDataStore";
import { createProjectRecord, readProject } from "@/lib/project/repository";
import { shiftDay } from "@/lib/performance-alerts/rules";
import PerformanceAlerts from "./PerformanceAlerts";
vi.mock("./AlertTrend", () => ({ default: ({ rule }) => <figure aria-label="Observed chart">{rule.history.length} days</figure>, alertNumber: (_rule, value) => String(value ?? "—") }));
vi.mock("@/lib/account/accountClient", () => ({ refreshAccount: async () => ({ account: { id: "test" } }) }));
beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  useAppStore.setState({ ...useAppStore.getInitialState(), projectsReady: true, decisionPersistenceEnabled: true, entitlement: activePro() });
  const mapping = { Date: "date", Cost: "cost", Installs: "installs", Channel: "channel" };
  const data = { mapping, headers: Object.keys(mapping), currency: "KRW", importSource: "csv", fileName: "actual-upload.csv", raw: Array.from({ length: 84 }, (_, i) => ({ Date: shiftDay("2026-08-01", i), Cost: i > 76 ? 140 : 100, Installs: 10, Channel: "Meta" })) };
  useAppStore.getState().setCurrentRouteId("5-31"); useAppStore.getState().setCsvData(data); useAppStore.getState().setGroupAnalyzed("5-31");
});
afterEach(() => vi.unstubAllGlobals());
it("creates project without clearing the CSV and preserves independent conditions through edit and pause", async () => {
  render(<PerformanceAlerts />);
  const raw = useAppStore.getState().csvData.raw;
  fireEvent.change(screen.getByRole("textbox", { name: "새 프로젝트 이름" }), { target: { value: "Client A" } });
  fireEvent.change(screen.getByRole("textbox", { name: "조건 이름", exact: true }), { target: { value: "Meta CPR" } });
  fireEvent.click(screen.getByRole("button", { name: "현재 CSV로 미리보기" }));
  expect(screen.getByRole("figure", { name: "Observed chart" }).textContent).toContain("84 days");
  fireEvent.click(screen.getByRole("button", { name: "프로젝트 만들고 조건 저장" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Meta CPR", level: 4 })).not.toBeNull());
  expect(useAppStore.getState().csvData.raw).toBe(raw);
  fireEvent.click(screen.getByRole("button", { name: "새 조건", exact: true }));
  fireEvent.change(screen.getByRole("textbox", { name: "조건 이름", exact: true }), { target: { value: "Second condition" } });
  fireEvent.click(screen.getByRole("button", { name: "조건 추가 저장" }));
  await waitFor(() => expect(screen.getAllByRole("article")).toHaveLength(2));
  const first = screen.getByRole("heading", { name: "Meta CPR", level: 4 }).closest("article");
  fireEvent.click(within(first).getByRole("button", { name: "조건 수정" }));
  fireEvent.change(screen.getByRole("textbox", { name: "조건 이름", exact: true }), { target: { value: "Edited CPR" } });
  fireEvent.click(screen.getByRole("button", { name: "이 조건 변경 저장" }));
  await waitFor(() => expect(screen.getByRole("heading", { name: "Edited CPR", level: 4 })).not.toBeNull());
  const second = screen.getByRole("heading", { name: "Second condition", level: 4 }).closest("article");
  fireEvent.click(within(second).getByRole("button", { name: "일시 중지", exact: true }));
  await waitFor(() => expect(within(second).getByText("일시 중지됨")).not.toBeNull());
  expect((await readProject()).performanceAlerts).toHaveLength(2);
});
it("retains a draft when storage is off and renders English controls equally", async () => {
  useAppStore.setState({ decisionPersistenceEnabled: false });
  render(<PerformanceAlerts locale="en" />);
  fireEvent.change(screen.getByRole("textbox", { name: "Condition name", exact: true }), { target: { value: "Keep draft" } });
  fireEvent.click(screen.getByRole("button", { name: "Create project and save condition" }));
  await screen.findByText("Enable project device storage to save conditions.");
  expect(screen.getByRole("textbox", { name: "Condition name", exact: true }).value).toBe("Keep draft");
  expect(await readProject()).toBeUndefined();
  await act(async () => {});
});

it("adopts the new default project after storage was cleared from a different project", async () => {
  useAppStore.setState({ activeProjectId: "removed-project", projects: [] });
  const raw = useAppStore.getState().csvData.raw;
  render(<PerformanceAlerts />);
  fireEvent.change(screen.getByRole("textbox", { name: "새 프로젝트 이름", exact: true }), { target: { value: "Fresh project" } });
  fireEvent.click(screen.getByRole("button", { name: "프로젝트 만들고 조건 저장" }));
  await waitFor(() => expect(useAppStore.getState().activeProjectId).toBe("default"));
  expect(useAppStore.getState().csvData.raw).toBe(raw);
  expect((await readProject()).performanceAlerts).toHaveLength(1);
});

it("keeps fictional samples preview-only without offering a save submission", async () => {
  const data = useAppStore.getState().csvData;
  useAppStore.getState().setCsvData({ ...data, importSource: "demo" });
  useAppStore.getState().setGroupAnalyzed("5-31");
  render(<PerformanceAlerts />);
  expect(screen.getByRole("button", { name: "프로젝트 만들고 조건 저장" }).disabled).toBe(true);
  fireEvent.click(screen.getByRole("button", { name: "현재 CSV로 미리보기" }));
  expect(screen.getByRole("figure", { name: "Observed chart" })).not.toBeNull();
});

it("names the upload-created default project and saves its first rule without clearing the source", async () => {
  await createProjectRecord("default", "", activePro());
  await useAppStore.getState().refreshProjects();
  const raw = useAppStore.getState().csvData.raw;
  render(<PerformanceAlerts />);
  fireEvent.change(screen.getByRole("textbox", { name: "새 프로젝트 이름", exact: true }), { target: { value: "Named upload project" } });
  fireEvent.click(screen.getByRole("button", { name: "프로젝트 만들고 조건 저장" }));
  await waitFor(async () => expect((await readProject()).performanceAlerts).toHaveLength(1));
  expect((await readProject()).name).toBe("Named upload project");
  expect(useAppStore.getState().csvData.raw).toBe(raw);
});
