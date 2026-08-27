export const WORKSPACE_DB_NAME = "mkt_workspace";
const WORKSPACE_DB_VERSION = 1;

export const WorkspaceStorageErrorCode = Object.freeze({
  UNAVAILABLE: "WORKSPACE_STORAGE_UNAVAILABLE",
  BLOCKED: "WORKSPACE_STORAGE_BLOCKED",
  QUOTA: "WORKSPACE_STORAGE_QUOTA",
  UNKNOWN: "WORKSPACE_STORAGE_UNKNOWN",
});

export const WORKSPACE_DB_OPEN_TIMEOUT_MS = 5000;

export function workspaceStorageError(error) {
  if (!error) return { code: WorkspaceStorageErrorCode.UNKNOWN, cause: error };
  if (error.name === "QuotaExceededError") return { code: WorkspaceStorageErrorCode.QUOTA, cause: error };
  return { code: WorkspaceStorageErrorCode.UNKNOWN, cause: error };
}

export function openWorkspaceDb() {
  if (typeof indexedDB === "undefined") {
    return Promise.reject({ code: WorkspaceStorageErrorCode.UNAVAILABLE });
  }
  return new Promise((resolve, reject) => {
    let request;
    let settled = false;
    let timeoutId = null;
    const rejectOnce = (error) => {
      if (settled) return;
      settled = true;
      if (timeoutId != null) clearTimeout(timeoutId);
      reject(error);
    };
    try {
      request = indexedDB.open(WORKSPACE_DB_NAME, WORKSPACE_DB_VERSION);
    } catch (error) {
      rejectOnce({ code: WorkspaceStorageErrorCode.UNAVAILABLE, cause: error });
      return;
    }
    timeoutId = setTimeout(() => rejectOnce({ code: WorkspaceStorageErrorCode.BLOCKED }), WORKSPACE_DB_OPEN_TIMEOUT_MS);
    request.onupgradeneeded = () => {
      try {
        const db = request.result;
        if (!db.objectStoreNames.contains("datasets")) db.createObjectStore("datasets", { keyPath: "group" });
        if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
      } catch (error) {
        rejectOnce(workspaceStorageError(error));
      }
    };
    request.onblocked = () => rejectOnce({ code: WorkspaceStorageErrorCode.BLOCKED });
    request.onsuccess = () => {
      if (settled) {
        request.result?.close?.();
        return;
      }
      settled = true;
      clearTimeout(timeoutId);
      resolve(request.result);
    };
    request.onerror = () => rejectOnce(workspaceStorageError(request.error));
  });
}

export function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(workspaceStorageError(request.error));
  });
}

export function transactionComplete(transaction) {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(workspaceStorageError(transaction.error));
    transaction.onabort = () => reject(workspaceStorageError(transaction.error));
  });
}
