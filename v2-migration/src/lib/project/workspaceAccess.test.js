// @vitest-environment jsdom
import { Blob as NodeBlob } from "node:buffer";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { activePro } from "@/test/proEntitlement";
import { useAppStore } from "@/store/useDataStore";
import { saveWorkspaceDataset, listWorkspaceDatasets } from "@/lib/workspace-storage/datasets";
import { saveReviewProject, saveStoredSnapshot } from "@/lib/weekly-review/snapshotStore";
import { exportProjectBackup, importProjectBackup, parseProjectBackup } from "./backup";
import { createProjectRecord, listProjects, readProject, updateProject, deleteProject } from "./repository";
import { saveProjectReview } from "./saveReview";

beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  vi.stubGlobal("Blob", NodeBlob);
  useAppStore.setState(useAppStore.getInitialState(), true);
});
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const record = { toolId: "5-2", action: "Review budget", id: "decision-a" };
const source = () => ({ group: "efficiency", sourceBlob: new Blob(["date,cost\r\n2026-09-01,50\r\n"]), headers: ["date", "cost"], mapping: { date: "date", cost: "cost" }, fileName: "original.csv" });

it.each([null, "expired"])("denies every first-project write without valid Pro (%s)", async state => {
  const entitlement = state ? { ...activePro(), expiresAt: Date.now() - 1 } : null;
  await expect(createProjectRecord("default", "Client", entitlement)).rejects.toThrow("PROJECT_LIMIT");
  await expect(saveProjectReview({ name: "Client", record, entitlement })).rejects.toThrow("PRO_REQUIRED");
  await expect(saveWorkspaceDataset({ ...source(), entitlement })).rejects.toThrow("PRO_REQUIRED");
  expect(await saveReviewProject({ name: "Client" }, { entitlement })).toMatchObject({ ok: false, reason: "pro_required" });
  expect(await saveStoredSnapshot({}, { entitlement })).toMatchObject({ ok: false, reason: "pro_required" });
  expect(await listProjects()).toEqual([]);
  expect(await listWorkspaceDatasets()).toEqual([]);
});

it("does not let expiry or backup replacement rewrite existing projects, while preserving export and deletion", async () => {
  const entitlement = activePro({ trial: true });
  await saveProjectReview({ name: "Client", record, entitlement });
  await saveWorkspaceDataset({ ...source(), entitlement });
  const before = await readProject("default");
  const exported = await exportProjectBackup("default");
  const parsed = parseProjectBackup(await exported.text());
  parsed.project.name = "Not allowed";
  for (const access of [null, { ...entitlement, expiresAt: Date.now() - 1 }]) {
    await expect(updateProject("default", { name: "Not allowed" }, () => true, access)).rejects.toThrow("PRO_REQUIRED");
    await expect(importProjectBackup(parsed, "default", { replace: true, entitlement: access })).rejects.toThrow("PRO_REQUIRED");
    await expect(importProjectBackup(parsed, "another", { entitlement: access })).rejects.toThrow("PRO_REQUIRED");
  }
  expect(await readProject("default")).toEqual(before);
  expect((await listWorkspaceDatasets())[0].fileName).toBe("original.csv");
  expect(JSON.parse(await (await exportProjectBackup("default")).text()).project.decisions).toEqual(before.decisions);
  // Deleting is not permission to change or duplicate a saved record.
  await expect(updateProject("default", { decisions: [{ ...before.decisions[0], action: "Changed" }] })).rejects.toThrow("PRO_REQUIRED");
  await expect(updateProject("default", { decisions: [before.decisions[0], before.decisions[0]] })).rejects.toThrow("PRO_REQUIRED");
  await updateProject("default", { decisions: [] });
  expect((await readProject("default")).decisions).toEqual([]);
  await deleteProject("default");
  expect(await listProjects()).toEqual([]);
  expect(await listWorkspaceDatasets()).toEqual([]);
});

it("keeps uploaded analysis in memory until Pro starts, then persists without replacing results", async () => {
  const store = useAppStore.getState();
  store.setCurrentRouteId("5-2");
  const data = { raw: [{ date: "2026-09-01", cost: "50" }], headers: ["date", "cost"], mapping: { date: "date", cost: "cost" }, fileName: "original.csv", workspaceSource: { blob: source().sourceBlob, kind: "csv" } };
  store.setCsvData(data);
  expect(useAppStore.getState().csvData.raw).toBe(data.raw);
  expect(await listProjects()).toEqual([]);
  expect(await listWorkspaceDatasets()).toEqual([]);
  store.addDecisionRecord(record);
  store.importDecisionRecords([{ record_id: "import", tool_id: "5-2", action: "Import" }]);
  expect(useAppStore.getState().decisionRecords).toEqual([]);
  const entitlement = activePro({ trial: true });
  store.setEntitlement(entitlement);
  await saveProjectReview({ name: "Client", record, entitlement });
  const findings = useAppStore.getState().findingsByGroup;
  expect(await store.persistWorkspaceGroup("efficiency")).toBe(true);
  expect(useAppStore.getState().csvData.raw).toBe(data.raw);
  expect(useAppStore.getState().findingsByGroup).toBe(findings);
  expect(await listWorkspaceDatasets()).toHaveLength(1);
  const original = await readProject("default");
  useAppStore.setState({ decisionRecords: original.decisions });
  store.setEntitlement(null);
  store.updateDecisionRecord(record.id, { actual: "fake update" });
  expect(useAppStore.getState().decisionRecords).toEqual(original.decisions);
  store.setCsvData({ ...data, fileName: "must-not-replace.csv" });
  expect((await listWorkspaceDatasets())[0].fileName).toBe("original.csv");
});

it("rechecks expiry inside a review transaction and rolls it back", async () => {
  const entitlement = activePro();
  await expect(saveProjectReview({ name: "Client", record, entitlement, shouldSave: () => {
    vi.spyOn(Date, "now").mockReturnValue(entitlement.expiresAt);
    return true;
  } })).rejects.toThrow("PRO_REQUIRED");
  expect(await listProjects()).toEqual([]);
});
