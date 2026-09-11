import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ query: vi.fn(), write: vi.fn(), release: vi.fn(), connect: vi.fn() }));
vi.mock("pg", () => ({ default: { Pool: class { query(...args) { return db.query(...args); } connect() { return db.connect(); } } } }));
import { saveAccountMemo, readAccount, accountSameOrigin } from "./accountServer";
import { GET, DELETE } from "@/app/api/account/memos/route";
const now = new Date("2026-09-11T00:00:00.000Z");
const request = (method = "POST", extra = "") => new Request(`https://growthoptplaybook.com/api/account/memos${extra}`, { method, headers: { origin: "https://growthoptplaybook.com", cookie: `gop_account=${"a".repeat(64)}` } });
const input = { memo: { id: "decision_1", toolId: "5-2", action: "Review acquisition cost", reviewDate: "2026-09-18" }, consent: "decision-memo-v1" };
let account;
describe("server-controlled account archive", () => {
  beforeEach(() => {
    vi.stubEnv("ACCOUNTS_ENABLED", "true"); vi.stubEnv("GOOGLE_CLIENT_ID", "test-client"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-placeholder"); vi.stubEnv("PAYMENTS_DATABASE_URL", "postgres://test"); vi.stubEnv("ACCOUNTS_ORIGIN", "https://growthoptplaybook.com");
    vi.clearAllMocks();
    account = { id: "owner-a", trial_started_at: null, paid_until: null };
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
  it("starts exactly 14 days with a row lock and the first successful save", async () => {
    const result = await saveAccountMemo(request(), input);
    expect(result.trialStarted).toBe(true);
    expect(result.entitlement.expiresAt).toBe(now.getTime() + 14 * 86400000);
    expect(db.write.mock.calls.map(([sql]) => sql)).toContain("SELECT * FROM gop_accounts WHERE id=$1 FOR UPDATE");
    expect(db.write.mock.calls.at(-1)[0]).toBe("COMMIT");
    const insert = db.write.mock.calls.find(([sql]) => sql.startsWith("INSERT INTO gop_decision_memos"));
    expect(insert[1][0]).toBe("owner-a");
    expect(db.release).toHaveBeenCalledOnce();
  });
  it("never resets an expired trial", async () => {
    account.trial_started_at = "2026-08-01T00:00:00Z";
    await expect(saveAccountMemo(request(), input)).rejects.toThrow("PRO_REQUIRED");
    expect(db.write.mock.calls.some(([sql]) => sql.startsWith("UPDATE gop_accounts"))).toBe(false);
    expect(db.write.mock.calls.at(-1)[0]).toBe("ROLLBACK");
  });
  it("rolls back the trial on failed memo persistence", async () => {
    const normal = db.write.getMockImplementation();
    db.write.mockImplementation((sql, args) => { if (sql.startsWith("INSERT INTO gop_decision_memos")) throw new Error("database failure"); return normal(sql, args); });
    await expect(saveAccountMemo(request(), input)).rejects.toThrow("database failure");
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
