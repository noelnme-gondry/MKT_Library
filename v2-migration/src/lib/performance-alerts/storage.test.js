// @vitest-environment jsdom
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { activePro } from "@/test/proEntitlement";
import { useAppStore } from "@/store/useDataStore";
import { createProjectRecord, readProject, updateProject, deleteProject, listProjects } from "@/lib/project/repository";
import { exportProjectBackup, parseProjectBackup } from "@/lib/project/backup";
import { bindAlertRule, checkAlert, shiftDay } from "./rules";
import { observeAlertChecks, saveAlertRule } from "./storage";
const data = () => ({ headers: ["Date", "Cost", "Installs", "Channel"], mapping: { Date: "date", Cost: "cost", Installs: "installs", Channel: "channel" }, currency: "KRW", importSource: "csv", fileName: "same.csv", raw: Array.from({ length: 14 }, (_, i) => ({ Date: shiftDay("2026-08-01", i), Cost: i > 6 ? 140 : 100, Installs: 10, Channel: "Meta" })) });
const ruleFor = (csv, id = "one") => bindAlertRule({ name: id, metric: "cpr", basis: "installs", channel: "", days: 7, comparison: "previous", direction: "up", percent: 20, target: 10000 }, csv, id);
beforeEach(() => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  useAppStore.setState({ ...useAppStore.getInitialState(), entitlement: activePro(), projectsReady: true, decisionPersistenceEnabled: true });
});
afterEach(() => vi.unstubAllGlobals());
const save = async (rule, projectId) => saveAlertRule({ rule, projectId, projectName: "Client A", entitlement: activePro(), shouldSave: () => true });

it("creates project and first condition atomically, then edits one without deleting another", async () => {
  const csv = data();
  await save(ruleFor(csv)); await save(ruleFor(csv, "two"), "default");
  await save({ ...ruleFor(csv), name: "Edited" }, "default");
  expect((await readProject()).performanceAlerts.map(rule => rule.name).sort()).toEqual(["Edited", "two"]);
  await updateProject("default", current => ({ performanceAlerts: current.performanceAlerts.map(rule => ({ ...rule, enabled: false })) }), () => true, activePro());
  await save({ ...ruleFor(csv), name: "Renamed while paused" }, "default");
  expect((await readProject()).performanceAlerts.find(rule => rule.id === "one").enabled).toBe(false);
  await createProjectRecord("other", "Client B", activePro());
  expect((await readProject("other")).performanceAlerts).toBeUndefined();
  await deleteProject("default"); expect(await readProject()).toBeUndefined();
});
it("rolls back when source project changes and allows deletion after expiry", async () => {
  const rule = ruleFor(data());
  await expect(saveAlertRule({ rule, projectName: "A", entitlement: activePro(), shouldSave: () => false })).rejects.toThrow("SAVE_CONTEXT_CHANGED");
  expect(await readProject()).toBeUndefined();
  await save(rule);
  await expect(updateProject("default", { performanceAlerts: [{ ...rule, enabled: false }] })).rejects.toThrow("PRO_REQUIRED");
  await updateProject("default", { performanceAlerts: [] }); expect((await readProject()).performanceAlerts).toEqual([]);
});
it("round-trips rules and daily history in project backup without restoring approval", async () => {
  const csv = data(); await save(checkAlert(ruleFor(csv), csv));
  const backup = await exportProjectBackup("default");
  const parsed = parseProjectBackup(await backup.text());
  expect(parsed.project.performanceAlerts[0].history).toHaveLength(14);
  expect(parsed.project.performanceAlerts[0].issue).toBe("unconfirmed");
  expect(parsed.project.performanceAlerts[0].checkedAt).toBeNull();
});
it("checks enabled rules only after Analyze, excludes demos, and invalidates same-name replacement approval", async () => {
  const csv = data(); await save(ruleFor(csv)); await save({ ...ruleFor(csv, "paused"), enabled: false }, "default");
  await useAppStore.getState().refreshProjects();
  useAppStore.getState().setCurrentRouteId("5-31"); useAppStore.getState().setCsvData(csv);
  let scheduled;
  const stop = observeAlertChecks(useAppStore, work => { scheduled = work; return () => {}; });
  expect(scheduled).toBeUndefined();
  useAppStore.getState().setGroupAnalyzed("5-31"); expect(scheduled).toBeTypeOf("function"); scheduled();
  await vi.waitFor(async () => expect((await readProject()).performanceAlerts[0].checkedAt).not.toBeNull());
  expect((await readProject()).performanceAlerts[1].checkedAt).toBeNull();
  const replacement = data(); replacement.raw[13].Cost = 200;
  useAppStore.getState().setCsvData(replacement);
  expect(useAppStore.getState().isGroupAnalyzed("5-31")).toBe(false);
  stop();
  useAppStore.getState().setCsvData({ ...csv, importSource: "demo" }); useAppStore.getState().setGroupAnalyzed("5-31");
  scheduled = undefined;
  const end = observeAlertChecks(useAppStore, work => { scheduled = work; return () => {}; });
  expect(scheduled).toBeUndefined(); end();
});
it("does not commit a deferred check after switching projects or disabling storage", async () => {
  const csv = data(); await save(ruleFor(csv)); await useAppStore.getState().refreshProjects();
  useAppStore.getState().setCurrentRouteId("5-31"); useAppStore.getState().setCsvData(csv); useAppStore.getState().setGroupAnalyzed("5-31");
  let scheduled; const stop = observeAlertChecks(useAppStore, work => { scheduled = work; return () => {}; });
  useAppStore.setState({ activeProjectId: "other", decisionPersistenceEnabled: false }); scheduled();
  expect((await readProject()).performanceAlerts[0].checkedAt).toBeNull(); stop();
});

it("merges against transaction-current history when two tabs check adjacent files", async () => {
  const first = data(); first.raw = first.raw.slice(0, 7);
  await save(checkAlert(ruleFor(first), first));
  const oldProjects = await listProjects();
  const fakeTab = csv => {
    let state;
    const listeners = new Set();
    const store = { getState: () => state, setState: patch => { state = { ...state, ...patch }; listeners.forEach(listener => listener(state)); }, subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener); } };
    state = { ...useAppStore.getState(), activeProjectId: "default", activeDataGroup: "efficiency", projects: oldProjects, csvGroups: { efficiency: csv }, analyzedByGroup: { efficiency: "confirmed" }, isGroupAnalyzed: () => true,
      refreshProjects: async () => { const projects = await listProjects(); store.setState({ projects }); return projects; } };
    return store;
  };
  const csvA = data(); csvA.raw = csvA.raw.slice(7);
  const csvB = data(); csvB.raw = csvB.raw.slice(7).map(row => ({ ...row, Date: shiftDay(row.Date, 7) }));
  const storeA = fakeTab(csvA), storeB = fakeTab(csvB);
  let runA, runB;
  const stopA = observeAlertChecks(storeA, work => { runA = work; return () => {}; });
  const stopB = observeAlertChecks(storeB, work => { runB = work; return () => {}; });
  runA();
  await vi.waitFor(async () => expect((await readProject()).performanceAlerts[0].history).toHaveLength(14));
  runB();
  await vi.waitFor(async () => expect((await readProject()).performanceAlerts[0].history).toHaveLength(21));
  stopA(); stopB();
});
