const DB_NAME = "growth-opt-playbook";
const VERSION = 2;

function openDb() {
  if (typeof indexedDB === "undefined") return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("recipes")) db.createObjectStore("recipes", { keyPath: "signature" });
      if (!db.objectStoreNames.contains("runs")) db.createObjectStore("runs", { keyPath: "id" });
      // 공개 시트 URL·표시 이름만 보관한다. 원본 행·컬럼 값·분석 결과는 절대 넣지 않는다.
      if (!db.objectStoreNames.contains("sheetSources")) db.createObjectStore("sheetSources", { keyPath: "id" });
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

function sheetSourceId(toolId, url) {
  return `${toolId}:${url}`;
}

// 같은 브라우저에서만 "최근 연결한 공개 시트"를 다시 고르는 용도다. URL은 민감할 수
// 있으므로 최대 5개·명시적 삭제를 제공하고, CSV 원본/분석 수치는 저장하지 않는다.
export async function rememberSheetSource({ toolId, url, label = "" }) {
  const db = await openDb();
  if (!db || !toolId || !url) return;
  const record = { id: sheetSourceId(toolId, url), toolId, url, label, updatedAt: new Date().toISOString() };
  await new Promise((resolve, reject) => {
    const request = db.transaction("sheetSources", "readwrite").objectStore("sheetSources").put(record);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
  const sources = await listSheetSources(toolId);
  const stale = sources.slice(5);
  if (!stale.length) return;
  await new Promise((resolve, reject) => {
    const transaction = db.transaction("sheetSources", "readwrite");
    const store = transaction.objectStore("sheetSources");
    stale.forEach((source) => store.delete(source.id));
    transaction.oncomplete = resolve;
    transaction.onerror = () => reject(transaction.error);
  });
}

export async function listSheetSources(toolId) {
  const db = await openDb();
  if (!db || !toolId) return [];
  return new Promise((resolve, reject) => {
    const request = db.transaction("sheetSources", "readonly").objectStore("sheetSources").getAll();
    request.onsuccess = () => resolve((request.result || [])
      .filter((source) => source.toolId === toolId)
      .sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)))
      .slice(0, 5));
    request.onerror = () => reject(request.error);
  });
}

export async function forgetSheetSource(id) {
  const db = await openDb();
  if (!db || !id) return;
  await new Promise((resolve, reject) => {
    const request = db.transaction("sheetSources", "readwrite").objectStore("sheetSources").delete(id);
    request.onsuccess = resolve;
    request.onerror = () => reject(request.error);
  });
}
