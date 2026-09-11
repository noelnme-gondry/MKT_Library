import { describe, expect, it } from "vitest";
import { accountEntitlement, archiveMemo, PRO_TRIAL_MS } from "./archiveContract";
describe("account archive boundary", () => {
  it("never starts a trial just by logging in", () => expect(accountEntitlement({ email: "reader@example.com" })).toBeNull());
  it("expires exactly fourteen days after the first save", () => {
    const start = Date.parse("2026-09-11T00:00:00Z");
    const account = { trial_started_at: new Date(start).toISOString() };
    expect(accountEntitlement(account, start + PRO_TRIAL_MS - 1)?.trial).toBe(true);
    expect(accountEntitlement(account, start + PRO_TRIAL_MS)).toBeNull();
  });
  it("uses purchased account access after a trial", () => expect(accountEntitlement({ paid_until: "2026-10-01T00:00:00Z", trial_started_at: "2026-08-01" }, Date.parse("2026-09-11"))?.trial).toBe(false));
  it("projects only selected memo fields and never sends raw data or local snapshots", () => {
    const projected = archiveMemo({ id: "decision-1", action: "Review", raw: [{ secret: "row" }], datasetSnapshot: "private", comparisonScope: { secret: true }, fileName: "customer.csv" });
    expect(projected.action).toBe("Review");
    for (const field of ["raw", "datasetSnapshot", "comparisonScope", "fileName"]) expect(projected).not.toHaveProperty(field);
  });
});
