export const MIB = 1024 * 1024;
// 제품의 저장 상한이며 브라우저의 공간 보장이나 분석 가능한 행 수가 아니다.
export const PROJECT_LIMITS = Object.freeze({ fileBytes: 25 * MIB, projectBytes: 100 * MIB, workspaceBytes: 250 * MIB, backupBytes: 150 * MIB, metadataBytes: 10 * MIB, logoBytes: MIB });
export const DEFAULT_PROJECT_ID = "default";
export function projectId(value = DEFAULT_PROJECT_ID) {
  if (!/^[a-zA-Z0-9_-]{1,80}$/.test(value)) throw new Error("INVALID_PROJECT_ID");
  return value;
}
export function datasetKey(group, id = DEFAULT_PROJECT_ID) {
  return id === DEFAULT_PROJECT_ID ? group : `${projectId(id)}::${group}`;
}
export function projectMetaKey(id = DEFAULT_PROJECT_ID) { return `project:${projectId(id)}`; }
export function bytesLabel(bytes) { return Number.isFinite(bytes) ? `${(bytes / MIB).toFixed(1)} MiB` : "—"; }
