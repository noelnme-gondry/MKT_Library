import { projectTransaction, migrateLegacyProject } from "./repository";
import { projectMetaKey, DEFAULT_PROJECT_ID, PROJECT_LIMITS } from "./projectLimits";
import { requestResult } from "@/lib/workspace-storage/db";
import { canCreateProject } from "@/lib/subscription/entitlement";
import { sanitizeDecisionReviewRecord } from "@/lib/decisionReview";

// Creation and the first record commit together. Never switch/clear the source CSV.
export async function saveProjectReview({ projectId, name, record, report, entitlement, initialDecisions = [], shouldSave = () => true }) {
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
    let savedRecord = null;
    if (!target.name?.trim()) {
      if (!name?.trim()) throw new Error("PROJECT_NAME_REQUIRED");
      target = { ...target, name: name.trim().slice(0, 120) };
    }
    if (record) {
      savedRecord = sanitizeDecisionReviewRecord({ ...record, id: record.id || crypto.randomUUID(), updatedAt: new Date(now).toISOString() }, record.toolId);
      if (!savedRecord) throw new Error("INVALID_REVIEW");
      target = { ...target, decisions: [savedRecord, ...(target.decisions || []).filter(item => item.id !== savedRecord.id)] };
    }
    if (report) target = { ...target, report };
    target = { ...target, lastUsedAt: now };
    if (new Blob([JSON.stringify(target)]).size > PROJECT_LIMITS.metadataBytes) throw new Error("PROJECT_METADATA_LIMIT");
    if (!shouldSave()) throw new Error("SAVE_CONTEXT_CHANGED");
    meta.put(target);
    return { project: target, record: savedRecord };
  });
}
