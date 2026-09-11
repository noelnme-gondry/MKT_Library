import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), identity: {} }));
vi.mock("pg", () => ({ default: { Pool: class { query(...args) { return mocks.query(...args); } } } }));
vi.mock("google-auth-library", () => ({ OAuth2Client: class {
  async getToken() { return { tokens: { id_token: "verified-by-mock" } }; }
  async verifyIdToken() { return { getPayload: () => mocks.identity }; }
} }));
import { accountEmailAllowed } from "./accountAccess";
import { finishGoogleLogin, issueAccountSession, readAccount } from "./accountServer";
const owner = "owner@example.com";
describe("server pilot allowlist", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubEnv("ACCOUNT_ALLOWED_EMAILS", owner);
    vi.stubEnv("ACCOUNTS_ENABLED", "true");
    vi.stubEnv("GOOGLE_CLIENT_ID", "test");
    vi.stubEnv("GOOGLE_CLIENT_SECRET", "test");
    vi.stubEnv("PAYMENTS_DATABASE_URL", "postgres://test");
    mocks.identity = { sub: "verified-sub", email_verified: true, email: owner, nonce: "nonce" };
    mocks.query.mockImplementation(async sql => {
      if (sql.startsWith("DELETE FROM gop_oauth_attempts")) return { rows: [{ verifier: "verifier", nonce: "nonce" }] };
      if (sql.startsWith("INSERT INTO gop_accounts")) return { rows: [{ id: "owner" }] };
      if (sql.startsWith("SELECT")) return { rows: [{ id: "owner", email: mocks.identity.email }] };
      return { rows: [] };
    });
  });
  afterEach(() => vi.unstubAllEnvs());
  it("matches exact normalized emails, not aliases, domains or substrings", () => {
    expect(accountEmailAllowed(" OWNER@example.com ")).toBe(true);
    for (const email of [undefined, "", "other@example.com", "owner+alias@example.com", "owner@example.com.attacker", "*"]) expect(accountEmailAllowed(email)).toBe(false);
    for (const list of ["", " ", ", ,"]) { vi.stubEnv("ACCOUNT_ALLOWED_EMAILS", list); expect(accountEmailAllowed(owner)).toBe(false); }
    vi.stubEnv("ACCOUNT_ALLOWED_EMAILS", undefined);
    expect(accountEmailAllowed("other@example.com")).toBe(true);
  });
  const callback = () => new Request(`https://growthoptplaybook.com/api/account/callback?code=code&state=${"a".repeat(64)}`, { headers: { cookie: `gop_oauth_state=${"a".repeat(64)}` } });
  it("rejects a verified outsider before creating accounts or sessions", async () => {
    mocks.identity.email = "other@example.com";
    await expect(finishGoogleLogin(callback())).rejects.toThrow("INVALID_LOGIN");
    expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(false);
  });
  it("allows the verified pilot owner without starting a trial at login", async () => {
    expect((await finishGoogleLogin(callback())).headers.get("set-cookie")).toContain("gop_account=");
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes("trial_started_at"))).toBe(false);
  });
  it("does not bypass Google verified-email checks", async () => {
    mocks.identity.email_verified = false;
    await expect(finishGoogleLogin(callback())).rejects.toThrow("INVALID_LOGIN");
    expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(false);
  });
  it("blocks session issuance including old email links and existing sessions", async () => {
    mocks.identity.email = "other@example.com";
    await expect(issueAccountSession("outsider")).rejects.toThrow("INVALID_LOGIN");
    expect(await readAccount(new Request("https://growthoptplaybook.com", { headers: { cookie: `gop_account=${"b".repeat(64)}` } }))).toBeNull();
    expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith("INSERT"))).toBe(false);
  });
});
