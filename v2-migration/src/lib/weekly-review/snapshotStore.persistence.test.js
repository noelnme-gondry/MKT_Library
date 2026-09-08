import { beforeEach, describe, expect, it, vi } from "vitest";
import { listStoredSnapshots, readReviewProject, saveReviewProject, SNAPSHOT_META_KEY, PROJECT_META_KEY } from "./snapshotStore";
import { RETENTION_MS } from "@/lib/workspace-storage/expiry";

const db = vi.hoisted(() => ({ records: new Map(), close: vi.fn() }));
vi.mock("@/lib/workspace-storage/db", () => ({
  openWorkspaceDb: async () => ({ close: db.close, transaction: () => ({ objectStore: () => ({
    get: key => db.records.get(key),
    put: record => db.records.set(record.key, record),
    delete: key => db.records.delete(key),
  }) }) }),
  requestResult: async value => value,
  transactionComplete: async () => {},
}));

beforeEach(() => { db.records.clear(); db.close.mockClear(); });

describe("주간 보관 정책", () => {
  it("90일 지난 집계는 조회 결과뿐 아니라 저장된 레코드에서도 제거한다", async () => {
    const expired = { savedAt: new Date(Date.now() - RETENTION_MS - 1000).toISOString(), rows: [{ campaign: "old" }] };
    const current = { savedAt: new Date().toISOString(), rows: [{ campaign: "current" }] };
    db.records.set(SNAPSHOT_META_KEY, { key: SNAPSHOT_META_KEY, snapshots: [expired, current] });
    expect(await listStoredSnapshots()).toEqual([current]);
    expect(db.records.get(SNAPSHOT_META_KEY).snapshots).toEqual([current]);
    expect(db.close).toHaveBeenCalledOnce();
  });
  it("90일 지난 프로젝트 설정도 실제로 삭제한다", async () => {
    db.records.set(PROJECT_META_KEY, { key: PROJECT_META_KEY, updatedAt: new Date(Date.now() - RETENTION_MS - 1000).toISOString(), project: { name: "old" } });
    expect(await readReviewProject()).toBeNull();
    expect(db.records.has(PROJECT_META_KEY)).toBe(false);
  });
  it("설정은 KPI·통화·기간만 복원하고 임의 원자료는 저장하지 않는다", async () => {
    expect(await saveReviewProject({ name: "Example", metric: "roas", basis: "actions", currency: "USD", target: "2", period: { preset: "recent_seven" }, raw: [{ secret: "private" }] })).toEqual({ ok: true });
    expect(await readReviewProject()).toEqual({ name: "Example", metric: "roas", basis: "actions", currency: "USD", target: "2", period: { preset: "recent_seven" } });
    expect(JSON.stringify([...db.records.values()])).not.toContain("private");
  });
});
