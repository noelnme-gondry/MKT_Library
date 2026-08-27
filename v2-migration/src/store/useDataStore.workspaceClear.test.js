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

    expect(storage.removeWorkspaceDataset).toHaveBeenCalledWith("efficiency");
    expect(useAppStore.getState().csvData.raw).toEqual([]);
    expect(useAppStore.getState().workspaceDatasetSummaries).toEqual([]);
  });

  it("surfaces deletion failure instead of removing the stored-file summary", async () => {
    storage.removeWorkspaceDataset.mockRejectedValueOnce(Object.assign(new Error("blocked"), { code: "WORKSPACE_STORAGE_UNKNOWN" }));

    await expect(useAppStore.getState().clearCsvGroup()).resolves.toBe(false);

    expect(useAppStore.getState().csvData.raw).toEqual([]);
    expect(useAppStore.getState().workspaceDatasetSummaries).toHaveLength(1);
    expect(useAppStore.getState().workspaceStorageError).toBe("WORKSPACE_STORAGE_UNKNOWN");
  });
});
