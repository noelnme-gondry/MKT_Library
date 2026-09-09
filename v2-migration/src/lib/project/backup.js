import { sanitizeEventMarkers } from "./eventMarkers";
import { validateProjectFile } from "./projectSchema";
import { canCreateProject } from "@/lib/subscription/entitlement";
import { requestResult } from "@/lib/workspace-storage/db";
import { toStoredSnapshot, MAX_SNAPSHOTS, normalizePeriodPreference } from "@/lib/weekly-review/snapshotStore";
import { projectTransaction } from "./repository";
import { PROJECT_LIMITS, DEFAULT_PROJECT_ID, datasetKey, projectMetaKey } from "./projectLimits";
import { DATA_GROUPS } from "@/lib/toolGroups";
import { sanitizeDecisionReviewRecords } from "@/lib/decisionReview";
import { readStoredTable } from "@/lib/workspace-storage/readTable";

function assertObjectSafe(value, depth = 0) {
  if (depth > 20) throw new Error("BACKUP_TOO_DEEP");
  if (!value || typeof value !== "object") return;
  for (const [key, child] of Object.entries(value)) {
    if (["__proto__", "constructor", "prototype"].includes(key)) throw new Error("BACKUP_UNSAFE");
    assertObjectSafe(child, depth + 1);
  }
}
async function encodeBlob(blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  for (let i = 0; i < bytes.length; i += 32768) binary += String.fromCharCode(...bytes.subarray(i, i + 32768));
  return btoa(binary);
}

export async function exportProjectBackup(id) {
  const content = await projectTransaction("readonly", async (meta, store) => {
    const project = await new Promise((resolve, reject) => { const request = meta.get(projectMetaKey(id)); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    if (!project) throw new Error("PROJECT_MISSING");
    const files = await new Promise((resolve, reject) => { const request = store.getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    return { project, files: files.filter(file => (file.projectId || DEFAULT_PROJECT_ID) === id) };
  });
  const files = await Promise.all(content.files.map(async file => {
    const { sourceBlob, ...metadata } = file;
    return { ...metadata, group: file.dataGroup || file.group, base64: await encodeBlob(sourceBlob) };
  }));
  const text = JSON.stringify({ product: "growthopt-playbook-backup", version: 1, exportedAt: new Date().toISOString(), project: content.project, files });
  if (new Blob([text]).size > PROJECT_LIMITS.backupBytes) throw new Error("BACKUP_TOO_LARGE");
  return new Blob([text], { type: "application/json" });
}

export function parseProjectBackup(text) {
  if (new Blob([text]).size > PROJECT_LIMITS.backupBytes) throw new Error("BACKUP_TOO_LARGE");
  const payload = JSON.parse(text);
  assertObjectSafe(payload);
  if (payload.product !== "growthopt-playbook-backup" || payload.version !== 1 || !payload.project || !Array.isArray(payload.files)) throw new Error("BACKUP_VERSION_INVALID");
  if (payload.files.length > DATA_GROUPS.length) throw new Error("BACKUP_FILE_COUNT");
  const seen = new Set();
  const files = payload.files.map(file => {
    if (!DATA_GROUPS.includes(file.group) || seen.has(file.group)) throw new Error("BACKUP_GROUP_INVALID");
    seen.add(file.group);
    const binary = atob(file.base64);
    const blob = new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))]);
    if (blob.size > PROJECT_LIMITS.fileBytes) throw new Error("BACKUP_FILE_TOO_LARGE");
    if (!Array.isArray(file.headers) || !file.mapping || typeof file.mapping !== "object" || !["csv", "xlsx"].includes(file.sourceKind)) throw new Error("BACKUP_FILE_INVALID");
    return { group: file.group, dataGroup: file.group, sourceBlob: blob, byteSize: blob.size, fileName: String(file.fileName || "data.csv").slice(0, 250), sourceKind: file.sourceKind, transform: file.transform === "wide_to_long" ? "wide_to_long" : null, headers: file.headers.map(String), rowCount: Number(file.rowCount) || 0, mapping: file.mapping, mappingBindingsV2: file.mappingBindingsV2 || [], worksheetName: file.worksheetName || null, series: file.series || null };
  });
  const bytes = files.reduce((sum, file) => sum + file.byteSize, 0);
  if (bytes > PROJECT_LIMITS.projectBytes) throw new Error("BACKUP_PROJECT_TOO_LARGE");
  if (!Array.isArray(payload.project.snapshots) || payload.project.snapshots.length > MAX_SNAPSHOTS) throw new Error("BACKUP_SNAPSHOTS_INVALID");
  const snapshots = payload.project.snapshots.map(snapshot => {
    if (!Array.isArray(snapshot.rows) || !snapshot.period?.start || !snapshot.period?.end || !Array.isArray(snapshot.availableFields)) throw new Error("BACKUP_SNAPSHOT_INVALID");
    const stored = toStoredSnapshot({ ...snapshot, ok: true, createdAt: snapshot.savedAt });
    if (!stored) throw new Error("BACKUP_SNAPSHOT_INVALID");
    return stored;
  });
  const settings = payload.project.settings;
  if (settings && (!["cpa", "cpi", "roas", "conversions"].includes(settings.metric) || !["actions", "installs"].includes(settings.basis) || !["USD", "KRW"].includes(settings.currency))) throw new Error("BACKUP_SETTINGS_INVALID");
  const project = { name: String(payload.project.name || "").slice(0, 120), settings: settings ? { name: String(settings.name || "").slice(0, 120), metric: settings.metric, basis: settings.basis, currency: settings.currency, target: String(settings.target || "").slice(0, 30), period: normalizePeriodPreference(settings.period) } : null, snapshots, decisions: sanitizeDecisionReviewRecords(payload.project.decisions), branding: null, report: null };
  project.eventMarkers = sanitizeEventMarkers(payload.project.eventMarkers);
  if (payload.project.configuration) project.configuration = validateProjectFile(payload.project.configuration);
  // 백업으로 권한을 가져오지 않는다. 로고와 보고서는 허용된 타입만 복원한다.
  if (payload.project.branding && (!payload.project.branding.logo || /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(payload.project.branding.logo) && payload.project.branding.logo.length <= PROJECT_LIMITS.logoBytes * 1.4)) {
    project.branding = { logo: payload.project.branding.logo || "", company: String(payload.project.branding.company || "").slice(0, 120), footer: String(payload.project.branding.footer || "").slice(0, 300) };
  }
  if (typeof payload.project.report?.text === "string" && payload.project.report.text.length < 500000) project.report = { text: payload.project.report.text, generatedAt: String(payload.project.report.generatedAt || "").slice(0, 40), period: payload.project.report.period || null };
  if (new Blob([JSON.stringify(project)]).size > PROJECT_LIMITS.metadataBytes) throw new Error("PROJECT_METADATA_LIMIT");
  return { project, files, bytes };
}

// 사용자 확인 후에만 덮어쓴다. 기존 삭제와 새 저장은 같은 트랜잭션이다.
export async function importProjectBackup(parsed, id, { replace = false, entitlement = null } = {}) {
  // 파싱 실패가 기존 프로젝트를 지운 뒤 발견되지 않도록 원본을 먼저 검사한다.
  for (const file of parsed.files) {
    const table = await readStoredTable(file);
    file.rowCount = table.raw.length;
  }
  if (parsed.project.branding?.logo) {
    const binary = atob(parsed.project.branding.logo.split(",")[1]);
    if (binary.length > PROJECT_LIMITS.logoBytes) throw new Error("LOGO_TOO_LARGE");
    const blob = new Blob([Uint8Array.from(binary, char => char.charCodeAt(0))]);
    const bitmap = await createImageBitmap(blob);
    const valid = bitmap.width <= 4096 && bitmap.height <= 4096;
    bitmap.close();
    if (!valid) throw new Error("LOGO_DIMENSIONS");
  }
  return projectTransaction("readwrite", async (meta, datasets) => {
    const existingRequest = meta.get(projectMetaKey(id));
    const existing = await new Promise((resolve, reject) => { existingRequest.onsuccess = () => resolve(existingRequest.result); existingRequest.onerror = () => reject(existingRequest.error); });
    if (!existing) {
      const projects = (await requestResult(meta.getAll())).filter(record => record.key === `project:${record.id}`);
      if (!canCreateProject(projects.length, entitlement)) throw new Error("PROJECT_LIMIT");
    }
    if (replace && !existing) throw new Error("PROJECT_MISSING");
    if (existing && !replace) throw new Error("PROJECT_EXISTS");
    const request = datasets.getAll();
    const allFiles = await new Promise((resolve, reject) => { request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const others = allFiles.filter(file => (file.projectId || DEFAULT_PROJECT_ID) !== id);
    if (others.reduce((sum, file) => sum + file.byteSize, 0) + parsed.bytes > PROJECT_LIMITS.workspaceBytes) throw new Error("WORKSPACE_STORAGE_LIMIT");
    allFiles.filter(file => (file.projectId || DEFAULT_PROJECT_ID) === id).forEach(file => datasets.delete(file.group));
    const now = Date.now();
    parsed.files.forEach(file => datasets.put({ ...file, group: datasetKey(file.group, id), projectId: id, savedAt: now, lastUsedAt: now }));
    meta.put({ ...parsed.project, key: projectMetaKey(id), id, createdAt: existing?.createdAt || now, lastUsedAt: now });
    return id;
  });
}
