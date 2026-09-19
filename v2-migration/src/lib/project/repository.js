import { canCreateProject, hasPaidAccess } from "@/lib/subscription/entitlement";
import { openWorkspaceDb, requestResult, transactionComplete } from "@/lib/workspace-storage/db";
import { RETENTION_MS } from "@/lib/workspace-storage/expiry";
import { sanitizeDecisionReviewRecords } from "@/lib/decisionReview";
import { projectMetaKey, DEFAULT_PROJECT_ID, PROJECT_LIMITS } from "./projectLimits";

export async function projectTransaction(mode, run) {
  const db = await openWorkspaceDb();
  try {
    const tx = db.transaction(["meta", "datasets"], mode);
    const complete = transactionComplete(tx);
    // 요청 실패 시에도 트랜잭션 실패를 처리한다.
    complete.catch(() => {});
    try {
      const result = await run(tx.objectStore("meta"), tx.objectStore("datasets"));
      await complete;
      return result;
    } catch (error) { try { tx.abort(); } catch {} throw error; }
  } finally { db.close(); }
}

export function migrateLegacyProject(project, snapshots, decisions, now) {
  return { key: projectMetaKey(), id: DEFAULT_PROJECT_ID, name: project?.name || "", createdAt: now, lastUsedAt: now,
    settings: project || null, snapshots: Array.isArray(snapshots) ? snapshots : [], decisions: sanitizeDecisionReviewRecords(decisions), branding: null, report: null };
}

export async function initializeProjects(legacyDecisions = [], shouldSave = () => true, legacySettings = {}) {
  return projectTransaction("readwrite", async (meta, datasets) => {
    const records = await requestResult(meta.getAll());
    let projects = records.filter(record => record.key === `project:${record.id}`);
    if (!projects.length) {
      const legacyProject = records.find(record => record.key === "weekly-review:project");
      const legacySnapshots = records.find(record => record.key === "weekly-review:snapshots");
      const files = await requestResult(datasets.getAll());
      if (!shouldSave()) return [];
      if (legacyProject || legacySnapshots || legacyDecisions.length || files.length) {
        const project = { ...migrateLegacyProject(legacyProject?.project, legacySnapshots?.snapshots, legacyDecisions, Date.now()), ...legacySettings };
        meta.put(project);
        projects = [project];
      }
      // 새 기록 저장과 구 키 삭제는 같은 트랜잭션이므로 실패하면 함께 복구된다.
      meta.delete("weekly-review:project"); meta.delete("weekly-review:snapshots");
    }
    return projects;
  });
}

export async function listProjects() {
  return projectTransaction("readonly", async meta => (await requestResult(meta.getAll())).filter(record => record.key === `project:${record.id}`));
}
export async function readProject(id = DEFAULT_PROJECT_ID) {
  return projectTransaction("readonly", meta => requestResult(meta.get(projectMetaKey(id))));
}
export async function updateProject(id, patch, shouldSave = () => true, entitlement = null, { initializeEmpty = false } = {}) {
  return projectTransaction("readwrite", async meta => {
    const key = projectMetaKey(id);
    let existing = await requestResult(meta.get(key));
    if (!existing && initializeEmpty && id === DEFAULT_PROJECT_ID && hasPaidAccess(entitlement)) {
      const projects = (await requestResult(meta.getAll())).filter(record => record.key === `project:${record.id}`);
      if (!projects.length) existing = migrateLegacyProject(null, [], [], Date.now());
    }
    if (!shouldSave() || !existing) return null;
    const changes = typeof patch === "function" ? patch(existing) : patch;
    // Expiry must not prevent reading or deleting a user's own saved records.
    const removalsOnly = Object.entries(changes).every(([field, value]) =>
      ["decisions", "savedAnalyses"].includes(field) && Array.isArray(value)
      && value.length <= (existing[field] || []).length && new Set(value.map(item => item.id)).size === value.length
      && value.every(item => (existing[field] || []).some(saved => JSON.stringify(saved) === JSON.stringify(item))));
    if (!hasPaidAccess(entitlement) && !removalsOnly) throw new Error("PRO_REQUIRED");
    const next = { ...existing, ...changes, key, id, lastUsedAt: Date.now() };
    if (new Blob([JSON.stringify(next)]).size > PROJECT_LIMITS.metadataBytes) throw new Error("PROJECT_METADATA_LIMIT");
    meta.put(next);
    return next;
  });
}
export async function deleteProject(id) {
  return projectTransaction("readwrite", async (meta, datasets) => {
    meta.delete(projectMetaKey(id));
    const files = await requestResult(datasets.getAll());
    files.filter(file => (file.projectId || DEFAULT_PROJECT_ID) === id).forEach(file => datasets.delete(file.group));
  });
}
export async function expireProjects(now = Date.now()) {
  return projectTransaction("readwrite", async (meta, datasets) => {
    const records = await requestResult(meta.getAll());
    const expired = records.filter(record => record.key === `project:${record.id}` && now - record.lastUsedAt >= RETENTION_MS);
    const ids = new Set(expired.map(record => record.id));
    expired.forEach(record => meta.delete(record.key));
    const files = await requestResult(datasets.getAll());
    files.filter(file => ids.has(file.projectId || DEFAULT_PROJECT_ID)).forEach(file => datasets.delete(file.group));
    return [...ids];
  });
}

export async function createProjectRecord(id, name, entitlement = null) {
  return projectTransaction("readwrite", async meta => {
    const records = await requestResult(meta.getAll());
    const projects = records.filter(record => record.key === `project:${record.id}`);
    if (!canCreateProject(projects.length, entitlement)) throw new Error("PROJECT_LIMIT");
    if (projects.some(project => project.id === id)) throw new Error("PROJECT_EXISTS");
    const record = { ...migrateLegacyProject(null, [], [], Date.now()), id, key: projectMetaKey(id), name: String(name).slice(0, 120) };
    meta.put(record);
    return record;
  });
}
