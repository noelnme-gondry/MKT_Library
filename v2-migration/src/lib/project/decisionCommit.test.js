import { beforeEach, afterEach, it, expect, vi } from "vitest";
import { IDBFactory } from "fake-indexeddb";
import { useAppStore } from "@/store/useDataStore";
import { activePro } from "@/test/proEntitlement";
import { saveProjectReview } from "./saveReview";
import * as repository from "./repository";

beforeEach(async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  useAppStore.setState(useAppStore.getInitialState(), true);
  const result = await saveProjectReview({ name: "Client A", entitlement: activePro(), record: { id: "d1", toolId: "5-3", action: "Budget review", actual: "100" } });
  useAppStore.setState({ projectSwitching: true, activeProjectId: result.project.id, projects: [result.project], decisionRecords: result.project.decisions, projectsReady: true, decisionPersistenceEnabled: true, entitlement: activePro() });
  useAppStore.setState({ projectSwitching: false });
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it("keeps the original record when the disk write fails", async () => {
  vi.spyOn(repository, "updateProject").mockRejectedValueOnce(new Error("QuotaExceededError"));
  await expect(useAppStore.getState().commitDecisionRecord("d1", { actual: "200" })).rejects.toThrow("QuotaExceededError");
  expect(useAppStore.getState().decisionRecords[0].actual).toBe("100");
  expect((await repository.readProject("default")).decisions[0].actual).toBe("100");
});
it("rejects an edit when device storage is disabled", async () => {
  useAppStore.setState({ decisionPersistenceEnabled: false });
  await expect(useAppStore.getState().commitDecisionRecord("d1", { actual: "200" })).rejects.toThrow("STORAGE_DISABLED");
  expect(useAppStore.getState().decisionRecords[0].actual).toBe("100");
});
it("resolves only after the edited record can be read from disk", async () => {
  await useAppStore.getState().commitDecisionRecord("d1", { actual: "200" });
  expect((await repository.readProject("default")).decisions[0].actual).toBe("200");
  expect(useAppStore.getState().decisionRecords[0].actual).toBe("200");
});

it("creates the first project and imported record in one committed write", async () => {
  await repository.deleteProject("default");
  useAppStore.setState({ projectSwitching: true, projects: [], decisionRecords: [] });
  useAppStore.setState({ projectSwitching: false });
  await useAppStore.getState().commitImportedDecisionRecords([{ id: "first", toolId: "5-3", action: "Imported review", actual: "200" }]);
  expect((await repository.readProject("default")).decisions[0]).toMatchObject({ id: "first", actual: "200" });
  expect(useAppStore.getState().projects).toHaveLength(1);
});
