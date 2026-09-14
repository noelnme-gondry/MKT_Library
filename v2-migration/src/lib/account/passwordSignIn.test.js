import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const db = vi.hoisted(() => ({ query: vi.fn() }));
vi.mock("pg", () => ({ default: { Pool: class { query(...args) { return db.query(...args); } } } }));
import { clearPasswordAttempts, hashPassword, signInWithPassword } from "./passwordLogin";

const origin = "https://growthoptplaybook.com";
const request = (extra = {}) => new Request(`${origin}/api/account/password-login`, { method: "POST", headers: { origin }, ...extra });
const secret = "reviewer-pass-2026";
let stored;

describe("심사용 아이디·비밀번호 로그인", () => {
  beforeEach(async () => {
    vi.stubEnv("ACCOUNTS_ENABLED", "true"); vi.stubEnv("GOOGLE_CLIENT_ID", "test-client"); vi.stubEnv("GOOGLE_CLIENT_SECRET", "test-placeholder");
    vi.stubEnv("PAYMENTS_DATABASE_URL", "postgres://test"); vi.stubEnv("ACCOUNTS_ORIGIN", origin);
    vi.stubEnv("ACCOUNT_PASSWORD_LOGINS", "reviewer@example.com");
    vi.clearAllMocks();
    stored ||= await hashPassword(secret);
    clearPasswordAttempts("reviewer@example.com");
    clearPasswordAttempts("someone@example.com");
    db.query.mockImplementation(async sql => sql.startsWith("SELECT id, password_hash")
      ? { rows: [{ id: "reviewer-account", password_hash: stored }] }
      : sql.startsWith("SELECT email") ? { rows: [{ email: "reviewer@example.com" }] } : { rows: [] });
  });
  afterEach(() => vi.unstubAllEnvs());

  it("맞는 비밀번호에 세션 쿠키를 내준다", async () => {
    const response = await signInWithPassword(request(), "reviewer@example.com", secret);
    expect(response.status).toBe(200);
    expect(response.headers.getSetCookie().some(value => /^gop_account=[a-f0-9]{64}; Path=\/; HttpOnly; SameSite=Lax/.test(value))).toBe(true);
  });

  it("틀린 비밀번호는 세션을 만들지 않는다", async () => {
    await expect(signInWithPassword(request(), "reviewer@example.com", "wrong-password-1")).rejects.toThrow("INVALID_LOGIN");
    expect(db.query.mock.calls.some(([sql]) => sql.startsWith("INSERT INTO gop_account_sessions"))).toBe(false);
  });

  it("목록에 없는 아이디는 데이터베이스를 건드리기 전에 막는다", async () => {
    // 목록 밖 주소로 계정 존재 여부를 떠볼 수 있으면 안 된다.
    await expect(signInWithPassword(request(), "someone@example.com", secret)).rejects.toThrow("INVALID_LOGIN");
    expect(db.query).not.toHaveBeenCalled();
  });

  it("설정이 없으면 기능 자체가 닫혀 있다", async () => {
    vi.stubEnv("ACCOUNT_PASSWORD_LOGINS", "");
    await expect(signInWithPassword(request(), "reviewer@example.com", secret)).rejects.toThrow("ACCOUNTS_UNAVAILABLE");
    expect(db.query).not.toHaveBeenCalled();
  });

  it("다른 출처의 요청을 거절한다", async () => {
    await expect(signInWithPassword(request({ headers: { origin: "https://evil.example" } }), "reviewer@example.com", secret)).rejects.toThrow("INVALID_ORIGIN");
  });

  it("같은 주소에 계정이 둘이면 어느 쪽도 열지 않는다", async () => {
    db.query.mockImplementation(async sql => sql.startsWith("SELECT id, password_hash")
      ? { rows: [{ id: "a", password_hash: stored }, { id: "b", password_hash: stored }] } : { rows: [] });
    await expect(signInWithPassword(request(), "reviewer@example.com", secret)).rejects.toThrow("INVALID_LOGIN");
  });

  it("반복 시도를 잠근다", async () => {
    for (let attempt = 0; attempt < 10; attempt++) await expect(signInWithPassword(request(), "reviewer@example.com", "wrong-password-1")).rejects.toThrow("INVALID_LOGIN");
    db.query.mockClear();
    await expect(signInWithPassword(request(), "reviewer@example.com", secret)).rejects.toThrow("INVALID_LOGIN");
    expect(db.query).not.toHaveBeenCalled();
  });
});
