import { describe, expect, it, vi } from "vitest";
import { checkPublicReadiness } from "../../scripts/check-public-readiness.mjs";

describe("public release configuration check", () => {
  it("does not mistake a configured mail provider or test payment mode for verified purchases and delivery", async () => {
    const fetchImpl = vi.fn(async url => ({ ok: true, json: async () => url.pathname.includes("payments")
      ? { enabled: false, mode: "test", privateExtra: "do not log" }
      : { enabled: true, signupRestricted: true, mailEnabled: true, email: "private@example.com" } }));
    const result = await checkPublicReadiness({ fetchImpl });
    expect(result.publicConfigurationReady).toBe(false);
    expect(result.unknown).toEqual([]);
    expect(result.unverified).toContain("mail_delivery");
    expect(JSON.stringify(result)).not.toMatch(/private@example|do not log/);
    for (const [, options] of fetchImpl.mock.calls) expect(options.method).toBe("GET");
  });
  it("marks failed requests and malformed flags unknown rather than disabled or healthy", async () => {
    const result = await checkPublicReadiness({ fetchImpl: async () => { throw Error("offline"); } });
    expect(result.unknown).toHaveLength(5);
    expect(result.publicConfigurationReady).toBe(false);
    expect(result.observed.signupRestricted).toBeNull();
  });
  it("only declares the public configuration ready when live payments, public access and mail are configured", async () => {
    const result = await checkPublicReadiness({ fetchImpl: async url => ({ ok: true, json: async () => url.pathname.includes("payments")
      ? { enabled: true, mode: "live" } : { enabled: true, signupRestricted: false, mailEnabled: true } }) });
    expect(result.publicConfigurationReady).toBe(true);
    expect(result.verified).toEqual(["public_configuration_only"]);
    expect(result.unverified).toContain("live_purchase");
  });
});
