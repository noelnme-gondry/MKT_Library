import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { openWorkspaceDb, WorkspaceStorageErrorCode, WORKSPACE_DB_OPEN_TIMEOUT_MS } from "./db";

describe("openWorkspaceDb", () => {
  let originalIndexedDb;
  let request;

  beforeEach(() => {
    originalIndexedDb = globalThis.indexedDB;
    request = {};
    globalThis.indexedDB = { open: vi.fn(() => request) };
  });

  afterEach(() => {
    vi.useRealTimers();
    globalThis.indexedDB = originalIndexedDb;
  });

  it("rejects a blocked upgrade instead of leaving deletion pending forever", async () => {
    const pending = openWorkspaceDb();
    request.onblocked();
    await expect(pending).rejects.toMatchObject({ code: WorkspaceStorageErrorCode.BLOCKED });
  });

  it("closes a database that opens after the blocked promise already settled", async () => {
    const close = vi.fn();
    const pending = openWorkspaceDb();
    request.onblocked();
    await expect(pending).rejects.toMatchObject({ code: WorkspaceStorageErrorCode.BLOCKED });

    request.result = { close };
    request.onsuccess();
    expect(close).toHaveBeenCalledTimes(1);
  });

  it("times out a request that emits no terminal event", async () => {
    vi.useFakeTimers();
    const pending = openWorkspaceDb();
    const assertion = expect(pending).rejects.toMatchObject({ code: WorkspaceStorageErrorCode.BLOCKED });
    await vi.advanceTimersByTimeAsync(WORKSPACE_DB_OPEN_TIMEOUT_MS);
    await assertion;
  });
});
