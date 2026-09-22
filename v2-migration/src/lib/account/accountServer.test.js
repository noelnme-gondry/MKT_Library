import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ query: vi.fn(), write: vi.fn(), release: vi.fn(), connect: vi.fn() }));
vi.mock("pg", () => ({ default: { Pool: class { query(...args) { return db.query(...args); } connect() { return db.connect(); } } } }));
import { saveAccountMemo, startAccountTrial, readAccount, accountSameOrigin } from "./accountServer";
import { GET, DELETE } from "@/app/api/account/memos/route";
import { PRO_TRIAL_MS } from "./archiveContract";
const now = new Date("2026-09-11T00:00:00.000Z");
const request = (method = "POST", extra = "") => new Request(`https://growthoptplaybook.com/api/account/memos${extra}`, { method, headers: { origin: "https://growthoptplaybook.com", cookie: `gop_account=${"a".repeat(64)}` } });
const input = { memo: { id: "decision_1", toolId: "5-2", action: "Review acquisition cost", reviewDate: "2026-09-18" }, consent: "decision-memo-v1" };
let account;
describe("server-controlled account archive", () => {
  beforeEach(() => {
    vi.stubEnv("ACCOUNTS_ENABLED", "true"); vi.stubEnv("GOOGLE_CLIENT_ID", "test-client"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-placeholder"); vi.stubEnv("PAYMENTS_DATABASE_URL", "postgres://test"); vi.stubEnv("ACCOUNTS_ORIGIN", "https://growthoptplaybook.com");
    vi.clearAllMocks();
    // 메모 저장은 더 이상 체험을 시작하지 않는다(트리거는 `startAccountTrial` 하나).
    // 그래서 기본 픽스처는 이미 체험 중인 계정이다 — 그게 실제 호출 순서다.
    account = { id: "owner-a", trial_started_at: "2026-09-08T00:00:00Z", paid_until: null };
    db.connect.mockResolvedValue({ query: db.write, release: db.release });
    db.query.mockImplementation(async sql => sql.startsWith("SELECT a.*") ? { rows: [account] } : { rows: [] });
    db.write.mockImplementation(async sql => {
      if (sql.startsWith("SELECT * FROM gop_accounts")) return { rows: [{ ...account }] };
      if (sql.startsWith("SELECT NOW")) return { rows: [{ now }] };
      if (sql.startsWith("SELECT count")) return { rows: [{ count: 0 }] };
      return { rows: [], rowCount: 0 };
    });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("enrolls service reminders only with explicit consent in the memo transaction", async () => {
    await saveAccountMemo(request(), { ...input, reminder: true });
    expect(db.write.mock.calls.some(([sql]) => sql.includes("SET service_reminders"))).toBe(false);
    db.write.mockClear();
    await saveAccountMemo(request(), { ...input, reminder: true, serviceRemindersConsent: "service-reminders-v1" });
    expect(db.write).toHaveBeenCalledWith("UPDATE gop_accounts SET service_reminders=true WHERE id=$1", ["owner-a"]);
    expect(db.write.mock.calls.at(-1)[0]).toBe("COMMIT");
  });
  it("rejects an enrollment without a review date or affirmative reminder choice", async () => {
    await expect(saveAccountMemo(request(), { ...input, serviceRemindersConsent: "service-reminders-v1" })).rejects.toThrow("INVALID_MEMO");
    await expect(saveAccountMemo(request(), { ...input, memo: { ...input.memo, reviewDate: "" }, reminder: true, serviceRemindersConsent: "service-reminders-v1" })).rejects.toThrow("INVALID_MEMO");
    expect(db.connect).not.toHaveBeenCalled();
  });
  it("rolls back both the memo and enrollment when the preference write fails", async () => {
    const normal = db.write.getMockImplementation();
    db.write.mockImplementation((sql, args) => { if (sql.includes("SET service_reminders")) throw new Error("preference failure"); return normal(sql, args); });
    await expect(saveAccountMemo(request(), { ...input, reminder: true, serviceRemindersConsent: "service-reminders-v1" })).rejects.toThrow("preference failure");
    expect(db.write.mock.calls.at(-1)[0]).toBe("ROLLBACK");
    expect(db.write.mock.calls.some(([sql]) => sql === "COMMIT")).toBe(false);
  });
  it("memo persistence rolls back without touching the trial", async () => {
    const normal = db.write.getMockImplementation();
    db.write.mockImplementation((sql, args) => { if (sql.startsWith("INSERT INTO gop_decision_memos")) throw new Error("database failure"); return normal(sql, args); });
    await expect(saveAccountMemo(request(), input)).rejects.toThrow("database failure");
    expect(db.write.mock.calls.at(-1)[0]).toBe("ROLLBACK");
    expect(db.release).toHaveBeenCalledOnce();
  });
  it("memo save never starts a trial — the project gate is the only trigger", async () => {
    // 트리거가 두 벌이면 한쪽만 고치게 된다. 메모 저장은 이미 Pro인 사람만 한다.
    account.trial_started_at = null;
    await expect(saveAccountMemo(request(), input)).rejects.toThrow("PRO_REQUIRED");
    expect(db.write.mock.calls.some(([sql]) => sql.startsWith("UPDATE gop_accounts SET trial_started_at"))).toBe(false);
    expect(db.write.mock.calls.at(-1)[0]).toBe("ROLLBACK");
  });
  it("starts exactly one trial length on the first project, with a row lock and server clock", async () => {
    // 서버 시계로 재야 한다 — 클라이언트가 시작하면 기기 시계를 되돌려 무한 체험이 된다.
    account.trial_started_at = null;
    const result = await startAccountTrial(request());
    expect(result.trialStarted).toBe(true);
    // 일수를 여기 다시 적지 않는다 — 정책을 바꾸면 화면은 따라가고 테스트만
    // 옛 숫자를 지킨다. 소급 분기가 있던 동안 이 단언은 픽스처 날짜 덕에
    // 조용히 통과하고 있었다.
    expect(result.entitlement.expiresAt).toBe(now.getTime() + PRO_TRIAL_MS);
    expect(result.entitlement.trial).toBe(true);
    expect(db.write.mock.calls.map(([sql]) => sql)).toContain("SELECT * FROM gop_accounts WHERE id=$1 FOR UPDATE");
    expect(db.write).toHaveBeenCalledWith("UPDATE gop_accounts SET trial_started_at=$2 WHERE id=$1", ["owner-a", now]);
    expect(db.write.mock.calls.at(-1)[0]).toBe("COMMIT");
    expect(db.release).toHaveBeenCalledOnce();
  });
  it("is idempotent — a second project never restarts the trial", async () => {
    const result = await startAccountTrial(request());
    expect(result.trialStarted).toBe(false);
    expect(db.write.mock.calls.some(([sql]) => sql.startsWith("UPDATE gop_accounts SET trial_started_at"))).toBe(false);
    expect(db.write.mock.calls.at(-1)[0]).toBe("COMMIT");
  });
  it("never resets an expired trial and says so instead of throwing", async () => {
    // 거절하면 화면이 "계정 기능을 쓸 수 없다"로 읽힌다. 실제로는 "체험을 이미 썼다"이므로
    // 권한 없음(null)을 그대로 돌려주고 화면이 구독을 권해야 한다.
    account.trial_started_at = "2026-08-01T00:00:00Z";
    const result = await startAccountTrial(request());
    expect(result.trialStarted).toBe(false);
    expect(result.entitlement).toBeNull();
    expect(db.write.mock.calls.some(([sql]) => sql.startsWith("UPDATE gop_accounts SET trial_started_at"))).toBe(false);
  });
  it("keeps paid access when the trial has expired", async () => {
    account.trial_started_at = "2026-08-01T00:00:00Z";
    account.paid_until = "2026-12-01T00:00:00Z";
    db.query.mockImplementation(async sql => sql.startsWith("SELECT a.*") ? { rows: [account] } : { rows: [] });
    const result = await startAccountTrial(request());
    expect(result.entitlement.trial).toBe(false);
    expect(result.entitlement.expiresAt).toBe(Date.parse("2026-12-01T00:00:00Z"));
  });
  it("requires identity and same origin before any trial write", async () => {
    db.query.mockResolvedValue({ rows: [] });
    await expect(startAccountTrial(request())).rejects.toThrow("LOGIN_REQUIRED");
    expect(db.connect).not.toHaveBeenCalled();
    // async 함수라 동기 throw가 아니라 거절이다 — `toThrow`로 적으면 통과해 버린다.
    await expect(startAccountTrial(new Request("https://growthoptplaybook.com", { method: "POST", headers: { origin: "https://attacker.example" } }))).rejects.toThrow("INVALID_ORIGIN");
  });
  it("rolls back and releases when the trial write fails", async () => {
    account.trial_started_at = null;
    const normal = db.write.getMockImplementation();
    db.write.mockImplementation((sql, args) => { if (sql.startsWith("UPDATE gop_accounts SET trial_started_at")) throw new Error("database failure"); return normal(sql, args); });
    await expect(startAccountTrial(request())).rejects.toThrow("database failure");
    expect(db.write.mock.calls.at(-1)[0]).toBe("ROLLBACK");
    expect(db.release).toHaveBeenCalledOnce();
  });
  it("rejects raw data or absent explicit consent before any write", async () => {
    await expect(saveAccountMemo(request(), { ...input, memo: { ...input.memo, raw: [{ private: true }] } })).rejects.toThrow("INVALID_MEMO");
    await expect(saveAccountMemo(request(), { memo: input.memo })).rejects.toThrow("INVALID_MEMO");
    expect(db.connect).not.toHaveBeenCalled();
  });
  it("requires identity and exact same origin for mutations", async () => {
    expect(() => accountSameOrigin(new Request("https://growthoptplaybook.com", { headers: { origin: "https://attacker.example" } }))).toThrow("INVALID_ORIGIN");
    expect(await readAccount(new Request("https://growthoptplaybook.com"))).toBeNull();
    db.query.mockResolvedValue({ rows: [] });
    await expect(saveAccountMemo(request(), input)).rejects.toThrow("LOGIN_REQUIRED");
    expect(db.connect).not.toHaveBeenCalled();
  });
  it("lets expired users read and delete only their own account copies", async () => {
    account.trial_started_at = "2026-08-01T00:00:00Z";
    expect((await GET(request("GET"))).status).toBe(200);
    expect(db.query.mock.calls.find(([sql]) => sql.startsWith("SELECT memo"))[1]).toEqual(["owner-a"]);
    expect((await DELETE(request("DELETE", "?id=decision_1"))).status).toBe(200);
    expect(db.query.mock.calls.find(([sql]) => sql.startsWith("DELETE FROM gop_decision_memos"))[1]).toEqual(["owner-a", "decision_1"]);
  });
});
