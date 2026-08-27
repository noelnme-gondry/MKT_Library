import { openWorkspaceDb, requestResult, transactionComplete } from "./db";
import { partitionByExpiry, remainingRetentionDays } from "./expiry";

function summary(entry) {
  if (!entry) return null;
  const { sourceBlob, ...rest } = entry;
  return { ...rest, remainingDays: remainingRetentionDays(entry, Date.now()) };
}

export async function saveWorkspaceDataset({ group, fileName, sourceBlob, sourceKind = "csv", headers = [], rowCount = 0, mapping = {}, mappingBindingsV2 = [], worksheetName = null }) {
  if (!group || !(sourceBlob instanceof Blob)) throw new TypeError("A workspace dataset requires a group and source Blob.");
  const db = await openWorkspaceDb();
  const now = Date.now();
  const entry = {
    group,
    fileName: String(fileName || "data.csv"),
    sourceBlob,
    sourceKind,
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
    const transaction = db.transaction("datasets", "readwrite");
    transaction.objectStore("datasets").put(entry);
    await transactionComplete(transaction);
    return summary(entry);
  } finally {
    db.close();
  }
}

export async function listWorkspaceDatasets() {
  const db = await openWorkspaceDb();
  try {
    const transaction = db.transaction("datasets", "readonly");
    const entries = await requestResult(transaction.objectStore("datasets").getAll());
    return entries.map(summary).sort((a, b) => b.lastUsedAt - a.lastUsedAt);
  } finally {
    db.close();
  }
}

export async function readWorkspaceDataset(group) {
  const db = await openWorkspaceDb();
  try {
    const transaction = db.transaction("datasets", "readwrite");
    const store = transaction.objectStore("datasets");
    const entry = await requestResult(store.get(group));
    if (entry) {
      entry.lastUsedAt = Date.now();
      store.put(entry);
    }
    await transactionComplete(transaction);
    return entry || null;
  } finally {
    db.close();
  }
}

export async function removeWorkspaceDataset(group) {
  if (!group) return;
  const db = await openWorkspaceDb();
  try {
    const transaction = db.transaction("datasets", "readwrite");
    transaction.objectStore("datasets").delete(group);
    await transactionComplete(transaction);
  } finally {
    db.close();
  }
}

export async function clearWorkspaceDatasets() {
  const db = await openWorkspaceDb();
  try {
    const transaction = db.transaction("datasets", "readwrite");
    transaction.objectStore("datasets").clear();
    await transactionComplete(transaction);
  } finally {
    db.close();
  }
}

export async function sweepExpiredWorkspaceDatasets(now = Date.now()) {
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
    return { keep: keep.map(summary), expired: expired.map(summary) };
  } finally {
    db.close();
  }
}
