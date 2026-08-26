import { describe, expect, it } from "vitest";
import { RETENTION_MS, isExpired, partitionByExpiry, remainingRetentionDays } from "./expiry";

describe("workspace expiry", () => {
  const now = Date.UTC(2026, 7, 26);

  it("keeps data used less than 90 days ago and expires the 90-day boundary", () => {
    expect(isExpired({ lastUsedAt: now - RETENTION_MS + 1 }, now)).toBe(false);
    expect(isExpired({ lastUsedAt: now - RETENTION_MS }, now)).toBe(true);
    expect(isExpired({ lastUsedAt: now - RETENTION_MS - 1 }, now)).toBe(true);
  });

  it("partitions entries and reports remaining whole days deterministically", () => {
    const result = partitionByExpiry([{ group: "keep", lastUsedAt: now - 6 * 24 * 60 * 60 * 1000 }, { group: "expired", lastUsedAt: now - RETENTION_MS }], now);
    expect(result.keep.map((entry) => entry.group)).toEqual(["keep"]);
    expect(result.expired.map((entry) => entry.group)).toEqual(["expired"]);
    expect(remainingRetentionDays(result.keep[0], now)).toBe(84);
  });
});
