import { afterEach, it, expect, vi } from "vitest";
import { cleanup, render } from "@testing-library/react";
import { useReviewDraftGuard } from "./reviewDraftGuard";
import { activePro } from "@/test/proEntitlement";
import { IDBFactory } from "fake-indexeddb";
import { createProjectRecord, listProjects } from "./repository";
import { useAppStore } from "@/store/useDataStore";

function Draft({ dirty }) { useReviewDraftGuard(dirty); return null; }
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
it.each(["/weekly-review", "/en/weekly-review"])("protects a draft-only switch through the shared store (%s)", async path => {
  window.history.replaceState(null, "", path);
  useAppStore.setState(useAppStore.getInitialState(), true);
  useAppStore.setState({ activeProjectId: "a", projectsReady: true });
  const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<Draft dirty />);
  expect(await useAppStore.getState().switchProject("b")).toBe(false);
  expect(confirm).toHaveBeenCalledOnce();
  expect(useAppStore.getState().activeProjectId).toBe("a");
});

it("does not create an empty project when the draft owner cancels", async () => {
  vi.stubGlobal("indexedDB", new IDBFactory());
  useAppStore.setState(useAppStore.getInitialState(), true);
  await createProjectRecord("default", "Original", activePro());
  useAppStore.setState({ projectsReady: true, decisionPersistenceEnabled: true, entitlement: activePro() });
  vi.spyOn(window, "confirm").mockReturnValue(false);
  render(<Draft dirty />);
  expect(await useAppStore.getState().createProject("Cancelled")).toEqual({ ok: false, reason: "cancelled" });
  expect((await listProjects()).map(project => project.name)).toEqual(["Original"]);
});
