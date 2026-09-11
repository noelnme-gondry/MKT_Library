import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { createHash } from "node:crypto";
const mocks = vi.hoisted(() => ({ query: vi.fn(), send: vi.fn(), issue: vi.fn() }));
vi.mock("./accountServer", () => ({
  accountDatabase: () => ({ query: mocks.query }),
  accountHash: value => createHash("sha256").update(value).digest("hex"),
  accountCookie: (name, value) => `${name}=${value}; HttpOnly; SameSite=Lax`,
  readCookie: (request, name) => request.headers.get("cookie")?.split(`${name}=`)[1] || "",
  accountSameOrigin: request => { if (request.headers.get("origin") !== "https://growthoptplaybook.com") throw new Error("INVALID_ORIGIN"); },
  issueAccountSession: mocks.issue,
}));
vi.mock("./accountMail", () => ({ mailEnabled: () => true, sendAccountMail: mocks.send }));
import { requestEmailLogin, finishEmailLogin } from "./emailLogin";
describe("existing-account email login fallback", () => {
  beforeEach(() => { vi.clearAllMocks(); mocks.send.mockResolvedValue(undefined); mocks.issue.mockImplementation(async () => new Response("ready")); });
  afterEach(() => vi.unstubAllEnvs());
  it("silently skips blocked pilot email without querying accounts or sending mail", async () => {
    vi.stubEnv("ACCOUNT_ALLOWED_EMAILS", "owner@example.com");
    const response = await requestEmailLogin(new Request("https://growthoptplaybook.com", { headers: { origin: "https://growthoptplaybook.com" } }), "other@example.com");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(mocks.query).not.toHaveBeenCalled();
    expect(mocks.send).not.toHaveBeenCalled();
  });
  it("does not create accounts or trials for unknown email addresses", async () => {
    mocks.query.mockResolvedValue({ rows: [] });
    const response = await requestEmailLogin(new Request("https://growthoptplaybook.com", { headers: { origin: "https://growthoptplaybook.com" } }), "unknown@example.com");
    expect(response.status).toBe(200);
    expect(mocks.send).not.toHaveBeenCalled();
    expect(mocks.query).toHaveBeenCalledOnce();
  });
  it("hashes both token and requesting-browser secret and consumes only a matching unexpired link", async () => {
    mocks.query.mockImplementation(async sql => ({ rows: sql.startsWith("SELECT id") ? [{ id: "account" }] : [] }));
    const response = await requestEmailLogin(new Request("https://growthoptplaybook.com", { headers: { origin: "https://growthoptplaybook.com" } }), "known@example.com", "en");
    const token = mocks.send.mock.calls[0][2].match(/token=([a-f0-9]{64})/)[1];
    const browser = response.headers.get("set-cookie").split(";")[0];
    const insert = mocks.query.mock.calls.find(([sql]) => sql.startsWith("INSERT"));
    expect(insert[1][0]).not.toBe(token);
    await expect(finishEmailLogin(new Request(`https://growthoptplaybook.com/api/account/email-callback?token=${token}`))).rejects.toThrow("INVALID_LOGIN");
    mocks.query.mockResolvedValueOnce({ rows: [{ account_id: "account" }] });
    expect((await finishEmailLogin(new Request(`https://growthoptplaybook.com/api/account/email-callback?token=${token}`, { headers: { cookie: browser } }))).status).toBe(200);
    expect(mocks.query.mock.calls.at(-1)[0]).toContain("browser_hash=$2 AND expires_at>NOW() RETURNING account_id");
    expect(mocks.issue).toHaveBeenCalledWith("account");
  });
});
