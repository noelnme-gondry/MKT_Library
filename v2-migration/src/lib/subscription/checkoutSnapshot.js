import { openWorkspaceDb, requestResult, transactionComplete } from "@/lib/workspace-storage/db";
import { useAppStore } from "@/store/useDataStore";

const pointer = "gop:checkout-snapshot";
const ttl = 86400000;
const fields = ["csvGroups", "decisionRecords", "eventMarkers", "viewConfig", "customMetrics", "customCharts", "dashboardFilterGroups", "dashboardTab", "denomBasis", "responseMappingSession", "activeDataGroup"];
async function withMeta(work) {
  const db = await openWorkspaceDb();
  try {
    const tx = db.transaction("meta", "readwrite"), done = transactionComplete(tx);
    try { const value = await work(tx.objectStore("meta")); await done; return value; }
    catch (error) { try { tx.abort(); } catch {} await done.catch(() => {}); throw error; }
  } finally { db.close(); }
}
export async function saveCheckoutSnapshot(now = Date.now()) {
  const state = useAppStore.getState();
  if (state.projectSwitching) throw new Error("PROJECT_SWITCHING");
  const hasWork = Object.values(state.csvGroups).some(slice => slice?.raw?.length) || state.decisionRecords.length;
  if (!hasWork) return false;
  const key = `checkout:${crypto.randomUUID()}`;
  const previous = sessionStorage.getItem(pointer);
  const snapshot = { key, expiresAt: now + ttl, projectId: state.activeProjectId, state: Object.fromEntries(fields.filter(field => state[field] !== undefined).map(field => [field, structuredClone(state[field])])) };
  await withMeta(async store => {
    const records = await requestResult(store.getAll());
    for (const record of records) if (record.key?.startsWith("checkout:") && (record.expiresAt <= now || record.key === previous)) store.delete(record.key);
    store.put(snapshot);
  });
  try { sessionStorage.setItem(pointer, key); }
  catch (error) { await withMeta(store => store.delete(key)); throw error; }
  if (useAppStore.getState().activeProjectId !== state.activeProjectId || useAppStore.getState().projectSwitching || useAppStore.getState().csvGroups !== state.csvGroups) throw new Error("PROJECT_SWITCHING");
  return true;
}
export async function restoreCheckoutSnapshot(now = Date.now()) {
  const key = sessionStorage.getItem(pointer);
  if (!key?.startsWith("checkout:")) return false;
  const snapshot = await withMeta(store => requestResult(store.get(key)));
  if (!snapshot || snapshot.expiresAt <= now) {
    await withMeta(store => store.delete(key)); sessionStorage.removeItem(pointer); return false;
  }
  const state = useAppStore.getState();
  if (state.projectSwitching || state.activeProjectId !== snapshot.projectId) throw new Error("PROJECT_CHANGED");
  // An in-memory analysis still present is newer authority; do not overwrite it.
  if (Object.values(state.csvGroups).some(slice => slice?.raw?.length)) return false;
  {
    const safe = Object.fromEntries(fields.filter(field => snapshot.state[field] !== undefined).map(field => [field, snapshot.state[field]]));
    const currentIds = new Set(state.decisionRecords.map(record => record.id));
    safe.decisionRecords = [...state.decisionRecords, ...(safe.decisionRecords || []).filter(record => !currentIds.has(record.id))];
    useAppStore.setState(safe);
    useAppStore.getState().setCurrentRouteId(state.currentRouteId);
  }
  await withMeta(store => store.delete(key)); sessionStorage.removeItem(pointer);
  return true;
}
export async function sweepCheckoutSnapshots(now = Date.now()) {
  await withMeta(async store => {
    for (const record of await requestResult(store.getAll())) if (record.key?.startsWith("checkout:") && record.expiresAt <= now) store.delete(record.key);
  });
}
