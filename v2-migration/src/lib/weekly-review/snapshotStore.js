import { readProject, updateProject } from "@/lib/project/repository";
/**
 * 주간 스냅샷 보관함.
 *
 * 이게 있어야 "이번 주 +8%가 평소 범위인지"를 판정할 수 있다 — 2주치 비교만으로는 원리적으로
 * 불가능하다(§2.3). 대신 저장하는 것은 **주 × 캠페인 집계뿐**이고 원본 행은 들어가지 않는다.
 *
 * 저장 위치는 기존 워크스페이스 IndexedDB의 `meta` 스토어다. 전용 스토어를 만들려면 DB 버전을
 * 올려야 하고 그건 기존 사용자 데이터에 마이그레이션 위험을 만든다 — 8주를 모아도 수백 행이라
 * 한 레코드에 담긴다.
 *
 * **순수 로직과 I/O를 가른다.** 병합·정리·이력 추출은 순수 함수라 골든으로 고정하고,
 * IndexedDB 접근은 그 위의 얇은 껍데기다. 저장소를 못 쓰면 조용히 빈 목록으로 떨어진다 —
 * 스냅샷이 없다고 리뷰 자체가 막히면 안 된다(2주치 업로드 경로가 계속 동작해야 한다).
 */

import { openWorkspaceDb, requestResult, transactionComplete } from "@/lib/workspace-storage/db";
import { RETENTION_MS } from "@/lib/workspace-storage/expiry";

export const SNAPSHOT_META_KEY = "weekly-review:snapshots";
export const PROJECT_META_KEY = "weekly-review:project";
/** 평소 범위 판정에 8주를 쓰므로 여유를 두고 보관한다. */
export const MAX_SNAPSHOTS = 16;

/** 저장 대상만 남긴다 — 원본 행이 섞여 들어가지 않도록 화이트리스트로 재조립한다. */
export function toStoredSnapshot(snapshot) {
  if (!snapshot || !snapshot.ok || !snapshot.period) return null;
  return {
    currency: snapshot.currency || null,
    period: { start: snapshot.period.start, end: snapshot.period.end, days: snapshot.period.days ?? null },
    rows: (snapshot.rows || []).map((row) => ({
      channel: row.channel ?? null,
      campaign: row.campaign,
      cost: row.cost ?? null,
      impressions: row.impressions ?? null,
      clicks: row.clicks ?? null,
      installs: row.installs ?? null,
      actions: row.actions ?? null,
      revenue: row.revenue ?? null,
    })),
    availableFields: [...(snapshot.availableFields || [])],
    savedAt: snapshot.createdAt || null,
  };
}

/**
 * 같은 기간이면 덮어쓰고, 오래된 것부터 잘라낸다. 정렬은 기간 시작일 오름차순(결정론).
 * 재분석하면 같은 주를 다시 저장하게 되므로 덮어쓰기가 기본이다.
 */
export function mergeSnapshots(existing = [], incoming = null, max = MAX_SNAPSHOTS) {
  const stored = toStoredSnapshot(incoming);
  const list = Array.isArray(existing) ? existing.filter((item) => item?.period?.start) : [];
  if (!stored) return list.slice(-max);
  const next = list.filter((item) => item.period.start !== stored.period.start || item.period.end !== stored.period.end || item.currency !== stored.currency);
  next.push(stored);
  next.sort((a, b) => (a.period.start < b.period.start ? -1 : a.period.start > b.period.start ? 1 : 0));
  return next.slice(-max);
}

/**
 * 지표별 주간 값 이력. **이번 기간은 뺀다** — 평소 범위는 비교 대상 자신을 포함하면 안 된다.
 *
 * @param {object[]} snapshots  저장된 스냅샷(오래된 것 → 최신)
 * @param {string} excludeStart 이번 기간 시작일
 * @param {function} derive     `(rows) => { cpa, roas, ... }` — 호출부가 파생 규칙을 준다
 */
export function historyFor(snapshots = [], { excludeStart = null, days = null, currency = null, derive } = {}) {
  const history = {};
  for (const snapshot of Array.isArray(snapshots) ? snapshots : []) {
    if (!snapshot?.period?.start || (excludeStart && snapshot.period.start >= excludeStart)) continue;
    if (currency && snapshot.currency !== currency) continue;
    if (days !== null && snapshot.period.days !== days) continue;
    const metrics = typeof derive === "function" ? derive(snapshot.rows || []) : null;
    if (!metrics) continue;
    for (const [key, value] of Object.entries(metrics)) {
      if (value === null || value === undefined || !Number.isFinite(value)) continue;
      (history[key] ||= []).push(value);
    }
  }
  return history;
}

async function withMetaStore(mode, run) {
  const db = await openWorkspaceDb();
  try {
    const transaction = db.transaction("meta", mode);
    const store = transaction.objectStore("meta");
    const result = await run(store);
    await transactionComplete(transaction);
    return result;
  } finally {
    db.close?.();
  }
}

function retainSnapshots(snapshots) {
  return (Array.isArray(snapshots) ? snapshots : []).filter((snapshot) => {
    const age = Date.now() - Date.parse(snapshot?.savedAt);
    return Number.isFinite(age) && age >= 0 && age < RETENTION_MS;
  });
}

/** 저장된 스냅샷 목록. 저장소를 못 쓰면 빈 배열 — 리뷰를 막지 않는다. */
export async function listStoredSnapshots(projectId = null) {
  if (projectId) { try { return retainSnapshots((await readProject(projectId))?.snapshots); } catch { return []; } }
  try {
    return await withMetaStore("readwrite", async (store) => {
      const record = await requestResult(store.get(SNAPSHOT_META_KEY));
      const snapshots = retainSnapshots(record?.snapshots);
      if (record && snapshots.length !== record.snapshots?.length) store.put({ ...record, snapshots });
      return snapshots;
    });
  } catch {
    return [];
  }
}

/** 스냅샷 한 장을 보관한다. 성공 여부를 돌려주되 실패해도 던지지 않는다. */
export async function saveStoredSnapshot(snapshot, { shouldSave = () => true, projectId = null } = {}) {
  if (projectId) {
    if (!toStoredSnapshot(snapshot)) return { ok: false, reason: "not_storable" };
    try {
      if (!shouldSave()) return { ok: false, reason: "storage_disabled" };
      const saved = await updateProject(projectId, existing => ({ snapshots: mergeSnapshots(retainSnapshots(existing?.snapshots), { ...snapshot, createdAt: new Date().toISOString() }) }), shouldSave);
      return saved ? { ok: true, count: saved.snapshots.length } : { ok: false, reason: "storage_disabled" };
    } catch { return { ok: false, reason: "storage_unavailable" }; }
  }
  const stored = toStoredSnapshot(snapshot);
  if (!stored) return { ok: false, reason: "not_storable" };
  try {
    const count = await withMetaStore("readwrite", async (store) => {
      const record = await requestResult(store.get(SNAPSHOT_META_KEY));
      if (!shouldSave()) return null;
      const snapshots = mergeSnapshots(retainSnapshots(record?.snapshots), { ...snapshot, createdAt: new Date().toISOString() });
      store.put({ key: SNAPSHOT_META_KEY, snapshots, updatedAt: new Date().toISOString() });
      return snapshots.length;
    });
    return count === null ? { ok: false, reason: "storage_disabled" } : { ok: true, count };
  } catch (error) {
    return { ok: false, reason: "storage_unavailable", error };
  }
}

export async function clearStoredSnapshots() {
  try {
    await withMetaStore("readwrite", (store) => requestResult(store.delete(SNAPSHOT_META_KEY)));
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function readReviewProject(projectId = null) {
  if (projectId) { try { const project = await readProject(projectId); return project?.settings || (project ? { name: project.name, metric: "cpa", basis: "actions", currency: "KRW", target: "", period: null } : null); } catch { return null; } }
  try {
    return await withMetaStore("readwrite", async (store) => {
      const record = await requestResult(store.get(PROJECT_META_KEY));
      const age = Date.now() - Date.parse(record?.updatedAt);
      if (Number.isFinite(age) && age >= 0 && age < RETENTION_MS) return record.project;
      if (record) store.delete(PROJECT_META_KEY);
      return null;
    });
  } catch { return null; }
}

export function normalizePeriodPreference(value) {
  if (!value || typeof value !== "object") return null;
  if (["completed_week", "recent_seven", "month"].includes(value.preset)) return { preset: value.preset };
  const fields = ["currentStart", "currentEnd", "previousStart", "previousEnd"];
  return Object.fromEntries(fields.filter((key) => /^\d{4}-\d{2}-\d{2}$/.test(value[key] || "")).map((key) => [key, value[key]]));
}

export async function saveReviewProject(project, { shouldSave = () => true, projectId = null } = {}) {
  // 원본이나 임의 필드를 저장하지 않는다. 매핑은 기존 업로더의 recipe가 소유한다.
  const safe = {
    period: normalizePeriodPreference(project.period),
    name: String(project.name || "").slice(0, 120),
    metric: ["cpa", "cpi", "roas", "conversions"].includes(project.metric) ? project.metric : "cpa",
    basis: project.basis === "installs" ? "installs" : "actions",
    currency: project.currency === "USD" ? "USD" : "KRW",
    target: project.target === "" ? "" : String(project.target || "").slice(0, 30),
  };
  if (projectId) {
    try {
      if (!shouldSave()) return { ok: false };
      const saved = await updateProject(projectId, { name: safe.name, settings: safe }, shouldSave);
      return { ok: Boolean(saved) };
    } catch { return { ok: false }; }
  }
  try {
    return await withMetaStore("readwrite", async (store) => {
      if (!shouldSave()) return { ok: false };
      await requestResult(store.put({ key: PROJECT_META_KEY, project: safe, updatedAt: new Date().toISOString() }));
      return { ok: true };
    });
  } catch { return { ok: false }; }
}
