import { afterEach, describe, expect, it, vi } from "vitest";
import { SUBSCRIPTION, canCreateProject, hasPaidAccess, resolveLicenseResult, validateLicenseHash } from "./entitlement";
const now = Date.parse("2026-09-09T00:00:00Z");
const hash = "a".repeat(64);
const valid = { valid: true, expires_at: "2026-10-09T00:00:00Z" };
const cached = { ...resolveLicenseResult(null, valid, now), keyHash: hash };
afterEach(() => vi.unstubAllEnvs());
describe("license and interest plan", () => {
  it("free users can create one project; existing reads are not an entitlement operation", () => {
    expect(SUBSCRIPTION.monthlyKrw).toBe(5900);
    expect(canCreateProject(0, null, now)).toBe(true);
    expect(canCreateProject(1, null, now)).toBe(false);
    expect(canCreateProject(20, cached, now)).toBe(true);
  });
  it("transport failures have a bounded grace; explicit invalidity never has grace", () => {
    expect(resolveLicenseResult(cached, null, now)).toMatchObject({ offline: true });
    expect(resolveLicenseResult(cached, { valid: false }, now)).toBeNull();
    expect(resolveLicenseResult(cached, { valid: true, expires_at: "2026-09-08" }, now)).toBeNull();
    expect(hasPaidAccess(cached, now + SUBSCRIPTION.graceMs)).toBe(false);
  });
  it("the request contains only a hash and cannot borrow another key's cache", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.invalid");
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "public-test-key");
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => [valid] });
    const result = await validateLicenseHash(hash, null, { fetcher, now });
    expect(result.status).toBe("valid");
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual({ input_hash: hash });
    const failed = vi.fn().mockRejectedValue(new Error("offline"));
    expect((await validateLicenseHash("b".repeat(64), cached, { fetcher: failed, now })).entitlement).toBeNull();
    expect((await validateLicenseHash(hash, cached, { fetcher: failed, now })).entitlement.offline).toBe(true);
    expect((await validateLicenseHash(hash, cached, { fetcher: async () => ({ ok: true, json: async () => [{ valid: false }] }), now })).entitlement).toBeNull();
  });
});
