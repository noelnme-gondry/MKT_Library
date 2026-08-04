import { afterEach, describe, expect, it, vi } from "vitest";
import { productAnalysisType, productEventKey, sanitizeProductEventParams, trackProductEvent, trackProductEventOnce } from "./analytics";

afterEach(() => {
  delete globalThis.window;
});

describe("privacy-safe product analytics", () => {
  it("keeps only the aggregate allowlist", () => {
    expect(sanitizeProductEventParams({
      tool_id: "5-3",
      row_count: 42,
      state: "parse_error",
      days_since_decision: "4-9d",
      created_at: "2026-08-01T00:00:00.000Z",
      file_name: "private-client.csv",
      raw_value: "sensitive campaign",
    })).toEqual({ tool_id: "5-3", row_count: 42, state: "parse_error", days_since_decision: "4-9d" });
  });

  it("normalizes marketing-response subroutes into one funnel tool id", () => {
    expect(sanitizeProductEventParams({ tool_id: "5-18-mmm", source: "route" })).toEqual({
      tool_id: "5-18",
      source: "route",
    });
  });

  it("uses the same PVM analysis type for performance and content routes", () => {
    expect(productAnalysisType("5-21")).toBe("pvm");
    expect(productAnalysisType("9-3")).toBe("pvm");
  });

  it("sends an event once per local hash without exposing the key", () => {
    const gtag = vi.fn();
    globalThis.window = { gtag };
    const key = productEventKey("private-client.csv", "Campaign A", 42);

    expect(trackProductEventOnce("analysis_completed", key, {
      tool_id: "5-3",
      source: "csv",
      row_count: 42,
      file_name: "private-client.csv",
    })).toBe(true);
    expect(trackProductEventOnce("analysis_completed", key, { tool_id: "5-3" })).toBe(false);
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "analysis_completed", {
      tool_id: "5-3",
      source: "csv",
      row_count: 42,
    });
    expect(JSON.stringify(gtag.mock.calls)).not.toContain("private-client.csv");
    expect(JSON.stringify(gtag.mock.calls)).not.toContain(key);
  });

  it("reports whether GA is available", () => {
    expect(trackProductEvent("analysis_started", { tool_id: "5-2" })).toBe(false);
  });
});
