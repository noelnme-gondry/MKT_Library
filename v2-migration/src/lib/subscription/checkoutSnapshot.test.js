// @vitest-environment jsdom
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { useAppStore } from "@/store/useDataStore";
import { saveCheckoutSnapshot, restoreCheckoutSnapshot, sweepCheckoutSnapshots } from "./checkoutSnapshot";
import { clearWorkspaceDatasets } from "@/lib/workspace-storage/datasets";
describe("local payment checkpoint lifecycle", () => {
  beforeEach(() => {
    vi.stubGlobal("indexedDB", new IDBFactory());
    sessionStorage.clear();
    useAppStore.setState({ ...useAppStore.getInitialState(), activeProjectId: "default", decisionPersistenceEnabled: false });
    useAppStore.getState().setCurrentRouteId("5-2");
    useAppStore.getState().setCsvData({ raw: [{ cost: "123" }], headers: ["cost"], mapping: { cost: "cost" }, fileName: "private.csv" });
  });
  afterEach(() => vi.unstubAllGlobals());
  it("restores data through a redirect without changing long-term storage consent or Pro", async () => {
    expect(await saveCheckoutSnapshot(100)).toBe(true);
    const key = sessionStorage.getItem("gop:checkout-snapshot");
    expect(key).toMatch(/^checkout:/);
    expect(sessionStorage.getItem("gop:checkout-snapshot")).not.toContain("private");
    useAppStore.setState({ csvGroups: useAppStore.getInitialState().csvGroups, csvData: { raw: [] }, entitlement: null });
    expect(await restoreCheckoutSnapshot(200)).toBe(true);
    useAppStore.getState().setCurrentRouteId("5-2");
    expect(useAppStore.getState().csvData.raw).toEqual([{ cost: "123" }]);
    expect(useAppStore.getState().decisionPersistenceEnabled).toBe(false);
    expect(useAppStore.getState().entitlement).toBeNull();
    expect(sessionStorage.getItem("gop:checkout-snapshot")).toBeNull();
  });
  it("does not overwrite newer data or a different project", async () => {
    await saveCheckoutSnapshot(100);
    useAppStore.getState().setCsvData({ raw: [{ cost: "999" }], mapping: {} });
    expect(await restoreCheckoutSnapshot(200)).toBe(false);
    expect(useAppStore.getState().csvData.raw[0].cost).toBe("999");
    useAppStore.setState({ activeProjectId: "another" });
    await expect(restoreCheckoutSnapshot(200)).rejects.toThrow("PROJECT_CHANGED");
  });
  it("expires temporary files after 24 hours and honors clear-all storage", async () => {
    await saveCheckoutSnapshot(100);
    await sweepCheckoutSnapshots(86400200);
    expect(await restoreCheckoutSnapshot(86400200)).toBe(false);
    await saveCheckoutSnapshot(100);
    await clearWorkspaceDatasets();
    expect(await restoreCheckoutSnapshot(200)).toBe(false);
  });
});
