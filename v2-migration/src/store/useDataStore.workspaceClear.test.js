import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = vi.hoisted(() => ({
  removeWorkspaceDataset: vi.fn(async () => undefined),
}));

vi.mock("@/lib/workspace-storage", () => ({
  clearWorkspaceDatasets: vi.fn(async () => undefined),
  listWorkspaceDatasets: vi.fn(async () => []),
  readWorkspaceDataset: vi.fn(async () => null),
  removeWorkspaceDataset: storage.removeWorkspaceDataset,
  saveWorkspaceDataset: vi.fn(async ({ group }) => ({ group })),
  sweepExpiredWorkspaceDatasets: vi.fn(async () => ({ keep: [], expired: [] })),
}));

import { useAppStore } from "@/store/useDataStore";

describe("clearCsvGroup workspace deletion", () => {
  beforeEach(() => {
    storage.removeWorkspaceDataset.mockReset();
    storage.removeWorkspaceDataset.mockResolvedValue(undefined);
    useAppStore.setState((state) => ({
      currentRouteId: "5-2",
      activeProjectId: "client-a",
      activeDataGroup: "efficiency",
      csvData: { raw: [{ cost: "100" }], headers: ["cost"], mapping: { cost: "cost" }, fileName: "private.csv" },
      csvGroups: {
        ...state.csvGroups,
        efficiency: { raw: [{ cost: "100" }], headers: ["cost"], mapping: { cost: "cost" }, fileName: "private.csv" },
      },
      workspaceDatasetSummaries: [{ group: "efficiency", fileName: "private.csv" }],
      workspaceStorageError: null,
    }));
  });

  it("removes the IndexedDB group before clearing the active memory slice", async () => {
    await expect(useAppStore.getState().clearCsvGroup()).resolves.toBe(true);

    expect(storage.removeWorkspaceDataset).toHaveBeenCalledWith("efficiency", "client-a");
    expect(useAppStore.getState().csvData.raw).toEqual([]);
    expect(useAppStore.getState().workspaceDatasetSummaries).toEqual([]);
  });

  it("does not clear another project while the old project's deletion finishes", async () => {
    let finish;
    storage.removeWorkspaceDataset.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = useAppStore.getState().clearCsvGroup();
    const other = { raw: [{ cost: "900" }], headers: ["cost"], mapping: { cost: "cost" }, fileName: "other.csv" };
    useAppStore.setState({ activeProjectId: "client-b", csvData: other, csvGroups: { ...useAppStore.getState().csvGroups, efficiency: other } });
    finish();
    await pending;
    expect(storage.removeWorkspaceDataset).toHaveBeenCalledWith("efficiency", "client-a");
    expect(useAppStore.getState().csvData).toBe(other);
    expect(useAppStore.getState().csvGroups.efficiency).toBe(other);
  });

  it("preserves the active mirror when navigation switches to another data group", async () => {
    let finish;
    storage.removeWorkspaceDataset.mockImplementationOnce(() => new Promise(resolve => { finish = resolve; }));
    const pending = useAppStore.getState().clearCsvGroup();
    const other = { raw: [{ event: "checkout" }], headers: ["event"], mapping: {}, fileName: "events.csv" };
    useAppStore.setState({ currentRouteId: "5-20", activeDataGroup: "aha", csvData: other });
    finish();
    await pending;
    expect(useAppStore.getState().csvData).toBe(other);
    expect(useAppStore.getState().csvGroups.efficiency.raw).toEqual([]);
  });

  it("surfaces deletion failure instead of removing the stored-file summary", async () => {
    storage.removeWorkspaceDataset.mockRejectedValueOnce(Object.assign(new Error("blocked"), { code: "WORKSPACE_STORAGE_UNKNOWN" }));

    await expect(useAppStore.getState().clearCsvGroup()).resolves.toBe(false);

    expect(useAppStore.getState().csvData.raw).toEqual([]);
    expect(useAppStore.getState().workspaceDatasetSummaries).toHaveLength(1);
    expect(useAppStore.getState().workspaceStorageError).toBe("WORKSPACE_STORAGE_UNKNOWN");
  });
});
