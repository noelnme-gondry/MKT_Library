import { activePro } from "@/test/proEntitlement";
// @vitest-environment jsdom
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { saveProjectReview } from "./saveReview";
import { listProjects, readProject } from "./repository";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const record = { toolId: "5-3", action: "Hold budget", dataOrigin: "real", raw: [{ secret: 123 }] };

it("creates the first project and sanitized review together, preserving legacy decisions", async () => {
  const saved = await saveProjectReview({ entitlement: activePro(), name: "Client A", record, initialDecisions: [{ id: "old", toolId: "5-3", action: "Old decision" }] });
  expect(saved.project.id).toBe("default");
  expect(saved.project.decisions).toHaveLength(2);
  expect(saved.record.dataOrigin).toBe("real");
  expect(saved.record.raw).toBeUndefined();
  expect((await readProject("default")).decisions).toEqual(saved.project.decisions);
});
it("appends decisions without replacing earlier records or the latest report", async () => {
  await saveProjectReview({ entitlement: activePro(), name: "Client A", record, report: { text: "Existing report" } });
  await saveProjectReview({ entitlement: activePro(), projectId: "default", record: { ...record, action: "Second decision" } });
  const saved = await readProject("default");
  expect(saved.decisions).toHaveLength(2);
  expect(saved.report.text).toBe("Existing report");
});
it("does not leave an empty project after a cancelled context or invalid review", async () => {
  await expect(saveProjectReview({ entitlement: activePro(), name: "Client A", record, shouldSave: () => false })).rejects.toThrow("SAVE_CONTEXT_CHANGED");
  expect(await listProjects()).toEqual([]);
  await expect(saveProjectReview({ entitlement: activePro(), name: "Client A", record: { toolId: "5-3" } })).rejects.toThrow("INVALID_REVIEW");
  expect(await listProjects()).toEqual([]);
});
it("refuses missing projects and unsigned writes without changing the existing one", async () => {
  await saveProjectReview({ entitlement: activePro(), name: "Client A", record });
  await expect(saveProjectReview({ entitlement: activePro(), projectId: "missing", record })).rejects.toThrow("PROJECT_MISSING");
  await expect(saveProjectReview({ entitlement: activePro(), name: "Client B", record, entitlement: null })).rejects.toThrow("PRO_REQUIRED");
  expect((await listProjects()).map(item => item.name)).toEqual(["Client A"]);
  expect((await readProject("default")).decisions).toHaveLength(1);
});
it("keeps expired-trial projects readable while rejecting new records and project creation", async () => {
  await saveProjectReview({ name: "Client A", record, entitlement: activePro({ trial: true }) });
  const expired = { ...activePro({ trial: true }), expiresAt: Date.now() - 1000 };
  for (const entitlement of [null, expired]) {
    await expect(saveProjectReview({ projectId: "default", record: { ...record, action: "Not allowed" }, entitlement })).rejects.toThrow("PRO_REQUIRED");
    await expect(saveProjectReview({ name: "Client B", record, entitlement })).rejects.toThrow("PRO_REQUIRED");
  }
  expect((await readProject("default")).decisions.map(item => item.action)).toEqual(["Hold budget"]);
  expect(await listProjects()).toHaveLength(1);
});
