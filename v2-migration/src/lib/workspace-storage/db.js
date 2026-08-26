export const WORKSPACE_DB_NAME = "mkt_workspace";
const WORKSPACE_DB_VERSION = 1;

export const WorkspaceStorageErrorCode = Object.freeze({
  UNAVAILABLE: "WORKSPACE_STORAGE_UNAVAILABLE",
  QUOTA: "WORKSPACE_STORAGE_QUOTA",
  UNKNOWN: "WORKSPACE_STORAGE_UNKNOWN",
});

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
    try {
      request = indexedDB.open(WORKSPACE_DB_NAME, WORKSPACE_DB_VERSION);
    } catch (error) {
      reject({ code: WorkspaceStorageErrorCode.UNAVAILABLE, cause: error });
      return;
    }
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("datasets")) db.createObjectStore("datasets", { keyPath: "group" });
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta", { keyPath: "key" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(workspaceStorageError(request.error));
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
