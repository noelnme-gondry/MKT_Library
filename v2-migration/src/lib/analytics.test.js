import { afterEach, describe, expect, it, vi } from "vitest";
import { productAnalysisType, productElapsedBucket, productEventKey, sanitizeProductEventParams, trackProductEvent, trackProductEventOnce } from "./analytics";

afterEach(() => {
  delete globalThis.window;
});

describe("privacy-safe product analytics", () => {
  it("attributes upload and results only to the clicked tool and locale within 30 minutes", () => {
    const values = new Map();
    globalThis.window = { gtag: vi.fn(), sessionStorage: {
      getItem: (key) => values.get(key), setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key),
    } };
    const clock = vi.spyOn(Date, "now").mockReturnValue(1000);
    const route = { tool_id: "5-26", locale: "ko", source: "csv" };
    trackProductEvent("blog_tool_cta_clicked", {
      ...route, content_slug: "apple-search-ads-guide", content_type: "blog",
      file_name: "secret.csv", raw_value: "private",
    });
    expect(JSON.stringify([...values.values()])).not.toMatch(/secret|private|file_name/);
    for (const name of ["data_import_success", "analysis_completed"]) {
      trackProductEvent(name, route);
      expect(window.gtag.mock.lastCall[2].content_slug).toBe("apple-search-ads-guide");
    }
    for (const params of [{ ...route, tool_id: "5-27" }, { ...route, locale: "en" }, { ...route, source: "demo" }]) {
      trackProductEvent("analysis_completed", params);
      expect(window.gtag.mock.lastCall[2].content_slug).toBeUndefined();
    }
    clock.mockReturnValue(1_802_000);
    trackProductEvent("analysis_completed", route);
    expect(window.gtag.mock.lastCall[2].content_slug).toBeUndefined();
    expect(values.size).toBe(0);
    clock.mockRestore();
  });

  it("buckets time to first result without sending an exact timestamp", () => {
    expect(productElapsedBucket(30_000)).toBe("under_1m");
    expect(productElapsedBucket(120_000)).toBe("1_3m");
    expect(productElapsedBucket(300_000)).toBe("3_10m");
    expect(productElapsedBucket(900_000)).toBe("10m_plus");
  });
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
    expect(sanitizeProductEventParams({ tool_id: "5-18-paid-organic", source: "route" }).tool_id).toBe("5-18");
  });

  it("uses the same PVM analysis type for performance and content routes", () => {
    expect(productAnalysisType("5-21")).toBe("pvm");
    expect(productAnalysisType("9-3")).toBe("pvm");
    expect(productAnalysisType("5-24")).toBe("brand_incrementality");
    expect(productAnalysisType("5-25")).toBe("multicollinearity");
    expect(productAnalysisType("5-26")).toBe("asa_keyword");
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

  it("adds elapsed time only to the first non-demo ready completion", () => {
    const gtag = vi.fn();
    globalThis.window = { gtag };
    const clock = vi.spyOn(Date, "now")
      .mockReturnValueOnce(1_000)
      .mockReturnValueOnce(31_000);

    trackProductEvent("tool_view", { tool_id: "5-2", source: "route" });
    trackProductEvent("analysis_completed", { tool_id: "5-2", source: "demo", result_state: "ready" });
    trackProductEvent("analysis_completed", { tool_id: "5-2", source: "csv", result_state: "insufficient" });
    trackProductEvent("analysis_completed", { tool_id: "5-2", source: "csv", result_state: "ready" });
    trackProductEvent("analysis_completed", { tool_id: "5-3", source: "csv", result_state: "ready" });

    const completions = gtag.mock.calls.filter((call) => call[1] === "analysis_completed");
    expect(completions.map((call) => call[2].elapsed_bucket)).toEqual([undefined, undefined, "under_1m", undefined]);
    clock.mockRestore();
  });
});
