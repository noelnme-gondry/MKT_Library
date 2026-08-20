import { MAPPING_MEMORY_SCHEMA_VERSION } from "./mappingMemory";

const DATABASE_NAME = "gop_semantic_mapping_memory";
const STORE_NAME = "bindings";

function openDatabase() {
  if (typeof indexedDB === "undefined") return Promise.reject(new Error("MAPPING_MEMORY_UNAVAILABLE"));
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, MAPPING_MEMORY_SCHEMA_VERSION);
    request.onupgradeneeded = () => {
      const store = request.result.createObjectStore(STORE_NAME, { keyPath: "normalizedColumnName" });
      store.createIndex("confirmedAt", "confirmedAt");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("MAPPING_MEMORY_OPEN_FAILED"));
  });
}

export async function listMappingMemory() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error || new Error("MAPPING_MEMORY_READ_FAILED"));
  }).finally(() => db.close());
}

export async function putMappingMemory(record) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).put(record);
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("MAPPING_MEMORY_WRITE_FAILED"));
  }).finally(() => db.close());
}

export async function clearMappingMemory() {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE_NAME, "readwrite").objectStore(STORE_NAME).clear();
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error || new Error("MAPPING_MEMORY_CLEAR_FAILED"));
  }).finally(() => db.close());
}
