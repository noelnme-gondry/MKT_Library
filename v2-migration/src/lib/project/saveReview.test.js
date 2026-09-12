// @vitest-environment jsdom
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { saveProjectReview } from "./saveReview";
import { listProjects, readProject } from "./repository";

beforeEach(() => vi.stubGlobal("indexedDB", new IDBFactory()));
afterEach(() => vi.unstubAllGlobals());
const record = { toolId: "5-3", action: "Hold budget", dataOrigin: "real", raw: [{ secret: 123 }] };

it("creates the first project and sanitized review together, preserving legacy decisions", async () => {
  const saved = await saveProjectReview({ name: "Client A", record, initialDecisions: [{ id: "old", toolId: "5-3", action: "Old decision" }] });
  expect(saved.project.id).toBe("default");
  expect(saved.project.decisions).toHaveLength(2);
  expect(saved.record.dataOrigin).toBe("real");
  expect(saved.record.raw).toBeUndefined();
  expect((await readProject("default")).decisions).toEqual(saved.project.decisions);
});
it("appends decisions without replacing earlier records or the latest report", async () => {
  await saveProjectReview({ name: "Client A", record, report: { text: "Existing report" } });
  await saveProjectReview({ projectId: "default", record: { ...record, action: "Second decision" } });
  const saved = await readProject("default");
  expect(saved.decisions).toHaveLength(2);
  expect(saved.report.text).toBe("Existing report");
});
it("does not leave an empty project after a cancelled context or invalid review", async () => {
  await expect(saveProjectReview({ name: "Client A", record, shouldSave: () => false })).rejects.toThrow("SAVE_CONTEXT_CHANGED");
  expect(await listProjects()).toEqual([]);
  await expect(saveProjectReview({ name: "Client A", record: { toolId: "5-3" } })).rejects.toThrow("INVALID_REVIEW");
  expect(await listProjects()).toEqual([]);
});
it("refuses missing projects and a second free project without changing the existing one", async () => {
  await saveProjectReview({ name: "Client A", record });
  await expect(saveProjectReview({ projectId: "missing", record })).rejects.toThrow("PROJECT_MISSING");
  await expect(saveProjectReview({ name: "Client B", record })).rejects.toThrow("PROJECT_LIMIT");
  expect((await listProjects()).map(item => item.name)).toEqual(["Client A"]);
  expect((await readProject("default")).decisions).toHaveLength(1);
});
