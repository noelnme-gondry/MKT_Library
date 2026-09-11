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
  afterEach(() => vi.unstubAllEnvs());
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
