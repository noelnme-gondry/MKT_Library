// 복원 배선 가드 (2026-09-17) — 순수함수 밖이라 골든이 못 잡는다(§6.1).
// 계약: 구세대 레코드는 **파일은 살리고 매핑만** 다시 인식하며, 그 사실을
// 화면이 말할 수 있게 남긴다.
import { beforeEach, describe, expect, it, vi } from "vitest";

const CSV = "Date,Cost,Impressions,Clicks,Installs\n2026-07-01,1000,10000,500,100\n2026-07-02,1200,11000,520,110\n";
const HEADERS = ["Date", "Cost", "Impressions", "Clicks", "Installs"];

const entryFor = (overrides) => ({
  group: "efficiency",
  dataGroup: "efficiency",
  fileName: "saved.csv",
  sourceBlob: new Blob([CSV], { type: "text/csv" }),
  sourceKind: "csv",
  headers: HEADERS,
  transform: null,
  mappingBindingsV2: [],
  lastUsedAt: Date.now(),
  ...overrides,
});

const storage = vi.hoisted(() => ({ read: vi.fn(), sweep: vi.fn() }));

vi.mock("@/lib/workspace-storage", async () => {
  const actual = await vi.importActual("@/lib/workspace-storage/datasets");
  return {
    clearWorkspaceDatasets: vi.fn(async () => undefined),
    listWorkspaceDatasets: vi.fn(async () => []),
    readWorkspaceDataset: storage.read,
    removeWorkspaceDataset: vi.fn(async () => undefined),
    saveWorkspaceDataset: vi.fn(async ({ group }) => ({ group })),
    sweepExpiredWorkspaceDatasets: storage.sweep,
    WORKSPACE_DATASET_SCHEMA_VERSION: actual.WORKSPACE_DATASET_SCHEMA_VERSION,
    isCurrentDatasetSchema: actual.isCurrentDatasetSchema,
  };
});

import { useAppStore } from "@/store/useDataStore";
import { WORKSPACE_DATASET_SCHEMA_VERSION } from "@/lib/workspace-storage/datasets";

const restoreWith = async (entry) => {
  storage.read.mockResolvedValue(entry);
  storage.sweep.mockResolvedValue({ keep: [{ group: "efficiency", fileName: "saved.csv" }], expired: [] });
  useAppStore.setState({ decisionPersistenceEnabled: true, csvGroups: { ...useAppStore.getState().csvGroups, efficiency: { raw: [], headers: [], mapping: {}, fileName: "" } } });
  await useAppStore.getState().restoreWorkspaceDatasets();
  return useAppStore.getState();
};

beforeEach(() => {
  storage.read.mockReset();
  storage.sweep.mockReset();
});

describe("구세대 레코드 복원", () => {
  const staleMapping = { Cost: "legacy_cost_key", Installs: "legacy_installs_key" };

  it("파일은 살리고 매핑만 현재 규칙으로 다시 잡는다", async () => {
    const state = await restoreWith(entryFor({ mapping: staleMapping }));
    const slice = state.csvGroups.efficiency;
    // 파일은 그대로 — 행이 사라지지 않는다.
    expect(slice.raw).toHaveLength(2);
    expect(slice.headers).toEqual(HEADERS);
    // 폐기 키는 사라지고 현재 표준키가 잡힌다.
    expect(Object.values(slice.mapping)).not.toContain("legacy_cost_key");
    expect(Object.values(slice.mapping)).toContain("cost");
    expect(state.workspaceRemappedGroups).toContain("efficiency");
  });

  it("세대 표식이 없는 레코드(도입 전 저장분)도 같은 취급", async () => {
    const state = await restoreWith(entryFor({ mapping: staleMapping, schemaVersion: undefined }));
    expect(state.workspaceRemappedGroups).toContain("efficiency");
  });
});

describe("현재 세대 레코드 복원", () => {
  it("저장된 매핑을 그대로 쓰고 다시 잡지 않는다", async () => {
    const saved = { Date: "date", Cost: "cost", Installs: "installs" };
    const state = await restoreWith(entryFor({ mapping: saved, schemaVersion: WORKSPACE_DATASET_SCHEMA_VERSION }));
    expect(state.csvGroups.efficiency.mapping).toEqual(saved);
    expect(state.workspaceRemappedGroups).toEqual([]);
  });
});
