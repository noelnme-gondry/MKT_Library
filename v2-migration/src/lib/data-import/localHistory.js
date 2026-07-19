const DB_NAME = "growth-opt-playbook";
const VERSION = 1;

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("recipes")) db.createObjectStore("recipes", { keyPath: "signature" });
      if (!db.objectStoreNames.contains("runs")) db.createObjectStore("runs", { keyPath: "id" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

export const schemaSignature = (headers = []) => headers.map((header) => String(header).trim().toLowerCase()).sort().join("|");

export async function getTransformRecipe(headers) {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve, reject) => {
    const request = db.transaction("recipes", "readonly").objectStore("recipes").get(schemaSignature(headers));
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

export async function saveTransformRecipe({ headers, mapping, source }) {
  const db = await openDb();
  if (!db) return;
  const record = { signature: schemaSignature(headers), mapping, source, updatedAt: new Date().toISOString() };
  await new Promise((resolve, reject) => {
    const request = db.transaction("recipes", "readwrite").objectStore("recipes").put(record);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

export async function saveAnalysisRun(run) {
  const db = await openDb();
  if (!db) return;
  const record = { ...run, id: `${run.toolId}:${Date.now()}`, savedAt: new Date().toISOString() };
  await new Promise((resolve, reject) => {
    const request = db.transaction("runs", "readwrite").objectStore("runs").put(record);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

export async function listAnalysisRuns(toolId) {
  const db = await openDb();
  if (!db) return [];
  return new Promise((resolve, reject) => {
    const request = db.transaction("runs", "readonly").objectStore("runs").getAll();
    request.onsuccess = () => resolve((request.result || []).filter((run) => run.toolId === toolId).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))).slice(0, 5));
    request.onerror = () => reject(request.error);
  });
}
