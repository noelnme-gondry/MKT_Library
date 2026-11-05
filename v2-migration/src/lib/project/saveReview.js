import { projectTransaction, migrateLegacyProject } from "./repository";
import { projectMetaKey, DEFAULT_PROJECT_ID, PROJECT_LIMITS } from "./projectLimits";
import { requestResult } from "@/lib/workspace-storage/db";
import { canCreateProject, hasPaidAccess } from "@/lib/subscription/entitlement";
import { sanitizeDecisionReviewRecord } from "@/lib/decisionReview";

// Creation and the first record commit together. Never switch/clear the source CSV.
// `records` saves several decisions of one plan in the same transaction (all or none).
export async function saveProjectReview({ projectId, name, record, records, report, entitlement, initialDecisions = [], shouldSave = () => true }) {
  const list = Array.isArray(records) && records.length ? records : record ? [record] : [];
  if (!hasPaidAccess(entitlement)) throw new Error("PRO_REQUIRED");
  return projectTransaction("readwrite", async meta => {
    const projects = (await requestResult(meta.getAll())).filter(item => item.key === `project:${item.id}`);
    let target = projects.find(item => item.id === projectId);
    const now = Date.now();
    if (!target) {
      if (projectId) throw new Error("PROJECT_MISSING");
      if (!name?.trim()) throw new Error("PROJECT_NAME_REQUIRED");
      if (!canCreateProject(projects.length, entitlement)) throw new Error("PROJECT_LIMIT");
      const id = projects.length ? crypto.randomUUID() : DEFAULT_PROJECT_ID;
      target = { ...migrateLegacyProject(null, [], projects.length ? [] : initialDecisions, now), id, key: projectMetaKey(id), name: name.trim().slice(0, 120) };
    }
    let savedRecords = [];
    if (!target.name?.trim()) {
      if (!name?.trim()) throw new Error("PROJECT_NAME_REQUIRED");
      target = { ...target, name: name.trim().slice(0, 120) };
    }
    if (list.length) {
      savedRecords = list.map(item => sanitizeDecisionReviewRecord({ ...item, id: item.id || crypto.randomUUID(), updatedAt: new Date(now).toISOString() }, item.toolId));
      if (savedRecords.some(item => !item)) throw new Error("INVALID_REVIEW");
      const ids = new Set(savedRecords.map(item => item.id));
      target = { ...target, decisions: [...savedRecords, ...(target.decisions || []).filter(item => !ids.has(item.id))] };
    }
    if (report) target = { ...target, report };
    target = { ...target, lastUsedAt: now };
    if (new Blob([JSON.stringify(target)]).size > PROJECT_LIMITS.metadataBytes) throw new Error("PROJECT_METADATA_LIMIT");
    if (!shouldSave()) throw new Error("SAVE_CONTEXT_CHANGED");
    if (!hasPaidAccess(entitlement)) throw new Error("PRO_REQUIRED");
    meta.put(target);
    return { project: target, record: savedRecords[0] || null, records: savedRecords };
  });
}
