import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({ query: vi.fn(), sendMail: vi.fn(), close: vi.fn(), createTransport: vi.fn() }));
vi.mock("./accountServer", () => ({ accountDatabase: () => ({ query: mocks.query }) }));
vi.mock("nodemailer", () => ({ default: { createTransport: mocks.createTransport } }));
import { authorizeMailJob, dispatchAccountMail, sendAccountMail, serviceMailCopy } from "./accountMail";
describe("private account notification delivery", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    for (const key of ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "SMTP_FROM"]) vi.stubEnv(key, "test@example.com");
    vi.stubEnv("ACCOUNT_MAIL_ENABLED", "true");
    vi.stubEnv("ACCOUNT_JOB_SECRET", "a".repeat(40));
    mocks.createTransport.mockReturnValue({ sendMail: mocks.sendMail, close: mocks.close });
    mocks.sendMail.mockResolvedValue({ accepted: ["reader@example.com"] });
  });
  afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("uses the existing Resend key over HTTPS without opening SMTP", async () => {
    vi.stubEnv("SMTP_HOST", "smtp.resend.com");
    vi.stubEnv("SMTP_USER", "resend");
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ id: "message-id" }) });
    vi.stubGlobal("fetch", fetch);
    await sendAccountMail("reader@example.com", "Title", "Body", "<job@example.com>");
    expect(mocks.createTransport).not.toHaveBeenCalled();
    expect(fetch).toHaveBeenCalledWith("https://api.resend.com/emails", expect.objectContaining({ method: "POST", redirect: "error", signal: expect.any(AbortSignal) }));
    const options = fetch.mock.calls[0][1];
    expect(options.headers.Authorization).toBe("Bearer test@example.com");
    expect(options.headers["Idempotency-Key"]).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.parse(options.body)).toEqual({ from: "test@example.com", to: ["reader@example.com"], subject: "Title", text: "Body" });
  });
  it.each(["rejected", "missing-id", "network"])("fails closed for Resend %s without SMTP fallback", async kind => {
    vi.stubEnv("SMTP_HOST", "smtp.resend.com");
    vi.stubEnv("SMTP_USER", "resend");
    const fetch = vi.fn().mockImplementation(async () => {
      if (kind === "network") throw new Error("private provider error");
      return { ok: kind !== "rejected", json: async () => ({}) };
    });
    vi.stubGlobal("fetch", fetch);
    await expect(sendAccountMail("reader@example.com", "Title", "Body")).rejects.toThrow("MAIL_UNAVAILABLE");
    expect(mocks.createTransport).not.toHaveBeenCalled();
  });
  it("requires a strong job credential, never an anonymous GET", () => {
    expect(() => authorizeMailJob(new Request("https://example.com"))).toThrow();
    expect(() => authorizeMailJob(new Request("https://example.com", { headers: { authorization: `Bearer ${"a".repeat(40)}` } }))).not.toThrow();
  });
  it("enforces TLS and disables filesystem/URL content in SMTP", async () => {
    await sendAccountMail("reader@example.com", "Title", "Body");
    expect(mocks.createTransport).toHaveBeenCalledWith(expect.objectContaining({ requireTLS: true, disableFileAccess: true, disableUrlAccess: true, logger: false, debug: false }));
    expect(mocks.close).toHaveBeenCalledOnce();
  });
  it.each(["ko", "en"])("does not include memo content or raw data in reminder text (%s)", locale => {
    const copy = serviceMailCopy("review", locale, { reference: "private_campaign", raw: "secret", memo: "private_note" });
    expect(JSON.stringify(copy)).not.toMatch(/private_campaign|private_note|secret/);
    expect(copy.text).toContain("/subscription");
  });
  it("rechecks opt-out immediately before sending a leased reminder", async () => {
    let claimed = false;
    mocks.query.mockImplementation(async sql => {
      if (sql.startsWith("UPDATE gop_account_mail SET lease_until=NOW()+INTERVAL '5 minutes'")) { if (claimed) return { rows: [] }; claimed = true; return { rows: [{ id: "review:id:2026-09-11", kind: "review", account_id: "a", reference: "id", due_at: new Date() }] }; }
      if (sql.startsWith("SELECT a.*")) return { rows: [{ id: "a", email: "reader@example.com", service_reminders: false }] };
      if (sql.startsWith("SELECT memo")) return { rows: [{ memo: { reviewDate: "2026-09-11" }, reminder_enabled: true }] };
      return { rows: [] };
    });
    expect(await dispatchAccountMail()).toEqual({ sent: 0, failed: 0 });
    expect(mocks.sendMail).not.toHaveBeenCalled();
  });
  it("does not mark SMTP failures as sent; leases them for retry", async () => {
    let claimed = false;
    mocks.query.mockImplementation(async sql => {
      if (sql.startsWith("UPDATE gop_account_mail SET lease_until=NOW()+INTERVAL '5 minutes'")) { if (claimed) return { rows: [] }; claimed = true; return { rows: [{ id: "receipt:id", kind: "receipt", account_id: "a", reference: "order" }] }; }
      if (sql.startsWith("SELECT a.*")) return { rows: [{ id: "a", email: "reader@example.com", locale: "en" }] };
      if (sql.startsWith("SELECT amount")) return { rows: [{ amount: 5900, expires_at: new Date() }] };
      return { rows: [] };
    });
    mocks.sendMail.mockRejectedValue(new Error("transport unavailable"));
    expect(await dispatchAccountMail()).toEqual({ sent: 0, failed: 1 });
    expect(mocks.query.mock.calls.some(([sql]) => sql.startsWith("UPDATE gop_account_mail SET sent_at"))).toBe(false);
    expect(mocks.query.mock.calls.some(([sql]) => sql.includes("INTERVAL '15 minutes'"))).toBe(true);
  });
});
