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
  const signature = run.signature || JSON.stringify(run.summary || {});
  const record = { ...run, id: `${run.toolId}:${signature}`, signature, savedAt: new Date().toISOString() };
  await new Promise((resolve, reject) => {
    const request = db.transaction("runs", "readwrite").objectStore("runs").put(record);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  const runs = await new Promise((resolve, reject) => {
    const request = db.transaction("runs", "readonly").objectStore("runs").getAll();
    request.onsuccess = () => resolve((request.result || []).filter((item) => item.toolId === run.toolId).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt))));
    request.onerror = () => reject(request.error);
  });
  const staleIds = runs.slice(5).map((item) => item.id);
  if (staleIds.length) {
    await new Promise((resolve, reject) => {
      const transaction = db.transaction("runs", "readwrite");
      const store = transaction.objectStore("runs");
      staleIds.forEach((id) => store.delete(id));
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
  }
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

export async function deleteAnalysisRun(id) {
  const db = await openDb();
  if (!db || !id) return;
  await new Promise((resolve, reject) => {
    const request = db.transaction("runs", "readwrite").objectStore("runs").delete(id);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}

export async function clearAnalysisRuns(toolId) {
  const db = await openDb();
  if (!db) return;
  const runs = await new Promise((resolve, reject) => {
    const request = db.transaction("runs", "readonly").objectStore("runs").getAll();
    request.onsuccess = () => resolve((request.result || []).filter((run) => run.toolId === toolId));
    request.onerror = () => reject(request.error);
  });
  if (!runs.length) return;
  await new Promise((resolve, reject) => {
    const transaction = db.transaction("runs", "readwrite");
    const store = transaction.objectStore("runs");
    runs.forEach((run) => store.delete(run.id));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}
