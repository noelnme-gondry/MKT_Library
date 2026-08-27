import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  clearWorkspaceDatasets,
  listWorkspaceDatasets,
  readWorkspaceDataset,
  removeWorkspaceDataset,
  saveWorkspaceDataset,
  sweepExpiredWorkspaceDatasets,
} from "./datasets";

const dbMock = vi.hoisted(() => ({
  openWorkspaceDb: vi.fn(),
  requestResult: vi.fn(),
  transactionComplete: vi.fn(),
}));

vi.mock("./db", () => dbMock);

describe("workspace dataset connection lifecycle", () => {
  let db;
  let store;
  let transaction;

  beforeEach(() => {
    store = {
      put: vi.fn(),
      getAll: vi.fn(() => ({ kind: "getAll" })),
      get: vi.fn(() => ({ kind: "get" })),
      delete: vi.fn(),
      clear: vi.fn(),
    };
    transaction = { objectStore: vi.fn(() => store) };
    db = { transaction: vi.fn(() => transaction), close: vi.fn() };
    dbMock.openWorkspaceDb.mockReset().mockResolvedValue(db);
    dbMock.requestResult.mockReset().mockResolvedValue([]);
    dbMock.transactionComplete.mockReset().mockResolvedValue(undefined);
  });

  it.each([
    ["save", () => {
      dbMock.transactionComplete.mockRejectedValueOnce(new Error("write failed"));
      return saveWorkspaceDataset({ group: "efficiency", fileName: "data.csv", sourceBlob: new Blob(["a,b"]) });
    }],
    ["list", () => {
      dbMock.requestResult.mockRejectedValueOnce(new Error("read failed"));
      return listWorkspaceDatasets();
    }],
    ["read", () => {
      dbMock.requestResult.mockRejectedValueOnce(new Error("read failed"));
      return readWorkspaceDataset("efficiency");
    }],
    ["remove", () => {
      dbMock.transactionComplete.mockRejectedValueOnce(new Error("delete failed"));
      return removeWorkspaceDataset("efficiency");
    }],
    ["clear", () => {
      dbMock.transactionComplete.mockRejectedValueOnce(new Error("clear failed"));
      return clearWorkspaceDatasets();
    }],
    ["sweep read", () => {
      dbMock.requestResult.mockRejectedValueOnce(new Error("sweep failed"));
      return sweepExpiredWorkspaceDatasets(Date.now());
    }],
  ])("closes the database when %s fails", async (_name, operation) => {
    await expect(operation()).rejects.toThrow();
    expect(db.close).toHaveBeenCalledTimes(1);
  });

  it("closes the database when an expiry sweep write fails", async () => {
    dbMock.requestResult.mockResolvedValueOnce([{ group: "old", lastUsedAt: 0 }]);
    dbMock.transactionComplete.mockRejectedValueOnce(new Error("sweep delete failed"));

    await expect(sweepExpiredWorkspaceDatasets(100 * 24 * 60 * 60 * 1000)).rejects.toThrow("sweep delete failed");
    expect(db.close).toHaveBeenCalledTimes(1);
  });
});
