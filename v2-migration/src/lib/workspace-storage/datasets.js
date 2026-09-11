import { migrateLegacyProject } from "@/lib/project/repository";
import { DEFAULT_PROJECT_ID, datasetKey, PROJECT_LIMITS, projectMetaKey } from "@/lib/project/projectLimits";
import { openWorkspaceDb, requestResult, transactionComplete } from "./db";
import { SNAPSHOT_META_KEY, PROJECT_META_KEY, listStoredSnapshots, readReviewProject } from "@/lib/weekly-review/snapshotStore";
import { partitionByExpiry, remainingRetentionDays } from "./expiry";

function summary(entry) {
  if (!entry) return null;
  const { sourceBlob, ...rest } = entry;
  return { ...rest, group: entry.dataGroup || entry.group, remainingDays: remainingRetentionDays(entry, Date.now()) };
}

export async function saveWorkspaceDataset({ group, fileName, sourceBlob, sourceKind = "csv", headers = [], rowCount = 0, mapping = {}, mappingBindingsV2 = [], worksheetName = null, projectId = DEFAULT_PROJECT_ID, series = null, transform = null, shouldSave = () => true }) {
  if (!group || !(sourceBlob instanceof Blob)) throw new TypeError("A workspace dataset requires a group and source Blob.");
  const db = await openWorkspaceDb();
  const now = Date.now();
  const entry = {
    group: datasetKey(group, projectId),
    dataGroup: group, projectId, series,
    fileName: String(fileName || "data.csv"),
    sourceBlob,
    sourceKind, transform,
    headers: Array.isArray(headers) ? headers.map(String) : [],
    rowCount: Number(rowCount) || 0,
    byteSize: sourceBlob.size,
    mapping: mapping && typeof mapping === "object" ? mapping : {},
    mappingBindingsV2: Array.isArray(mappingBindingsV2) ? mappingBindingsV2 : [],
    worksheetName: worksheetName || null,
    savedAt: now,
    lastUsedAt: now,
  };
  try {
    const transaction = db.transaction(["datasets", "meta"], "readwrite");
    const store = transaction.objectStore("datasets");
    const existing = await requestResult(store.getAll());
    const others = existing.filter(file => file.group !== entry.group);
    const bytes = files => files.reduce((sum, file) => sum + (file.byteSize || 0), 0);
    if (sourceBlob.size > PROJECT_LIMITS.fileBytes || bytes(others) + sourceBlob.size > PROJECT_LIMITS.workspaceBytes || bytes(others.filter(file => (file.projectId || DEFAULT_PROJECT_ID) === projectId)) + sourceBlob.size > PROJECT_LIMITS.projectBytes) throw { code: "WORKSPACE_STORAGE_LIMIT" };
    if (!shouldSave()) throw new Error("STORAGE_CANCELLED");
    const meta = transaction.objectStore("meta");
    let project = await requestResult(meta.get(projectMetaKey(projectId)));
    if (!shouldSave()) throw new Error("STORAGE_CANCELLED");
    if (!project) {
      const records = await requestResult(meta.getAll());
      if (projectId !== DEFAULT_PROJECT_ID || records.some(record => record.key === `project:${record.id}`)) throw new Error("PROJECT_MISSING");
      project = migrateLegacyProject(null, [], [], now);
    }
    if (!shouldSave()) throw new Error("STORAGE_CANCELLED");
    meta.put({ ...project, lastUsedAt: now });
    store.put(entry);
    await transactionComplete(transaction);
    return summary(entry);
  } finally {
    db.close();
  }
}

export async function listWorkspaceDatasets(projectId = DEFAULT_PROJECT_ID) {
  const db = await openWorkspaceDb();
  try {
    const transaction = db.transaction("datasets", "readonly");
    const entries = await requestResult(transaction.objectStore("datasets").getAll());
    return entries.filter(entry => projectId === null || (entry.projectId || DEFAULT_PROJECT_ID) === projectId).map(summary).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  } finally {
    db.close();
  }
}

export async function readWorkspaceDataset(group, projectId = DEFAULT_PROJECT_ID) {
  const db = await openWorkspaceDb();
  try {
    const transaction = db.transaction("datasets", "readwrite");
    const store = transaction.objectStore("datasets");
    const entry = await requestResult(store.get(datasetKey(group, projectId)));
    if (entry) {
      entry.lastUsedAt = Date.now();
      store.put(entry);
    }
    await transactionComplete(transaction);
    return entry ? { ...entry, group: entry.dataGroup || entry.group } : null;
  } finally {
    db.close();
  }
}

export async function removeWorkspaceDataset(group, projectId = DEFAULT_PROJECT_ID) {
  if (!group) return;
  const db = await openWorkspaceDb();
  try {
    const transaction = db.transaction("datasets", "readwrite");
    transaction.objectStore("datasets").delete(datasetKey(group, projectId));
    await transactionComplete(transaction);
  } finally {
    db.close();
  }
}

export async function clearWorkspaceDatasets() {
  const db = await openWorkspaceDb();
  try {
    const transaction = db.transaction(["datasets", "meta"], "readwrite");
    transaction.objectStore("datasets").clear();
    transaction.objectStore("meta").delete(SNAPSHOT_META_KEY);
    transaction.objectStore("meta").delete(PROJECT_META_KEY);
    const meta = transaction.objectStore("meta");
    const records = await requestResult(meta.getAll());
    records.filter(record => record.key?.startsWith("project:") || record.key?.startsWith("checkout:")).forEach(record => meta.delete(record.key));
    await transactionComplete(transaction);
  } finally {
    db.close();
  }
}

export async function sweepExpiredWorkspaceDatasets(now = Date.now(), projectId = DEFAULT_PROJECT_ID) {
  const db = await openWorkspaceDb();
  try {
    const read = db.transaction("datasets", "readonly");
    const entries = await requestResult(read.objectStore("datasets").getAll());
    const { keep, expired } = partitionByExpiry(entries, now);
    if (expired.length) {
      const write = db.transaction("datasets", "readwrite");
      const store = write.objectStore("datasets");
      expired.forEach((entry) => store.delete(entry.group));
      await transactionComplete(write);
    }
    await Promise.all([listStoredSnapshots(), readReviewProject()]);
    return { keep: keep.filter(entry => (entry.projectId || DEFAULT_PROJECT_ID) === projectId).map(summary), expired: expired.map(summary) };
  } finally {
    db.close();
  }
}
