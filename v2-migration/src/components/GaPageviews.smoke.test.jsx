// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GaPageviews from "@/components/GaPageviews";
import { trackProductEvent } from "@/lib/analytics";

let currentPath = "/dashboard";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPath,
}));

describe("GaPageviews", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    currentPath = "/dashboard";
    delete window.gtag;
    window.sessionStorage.clear();
  });

  afterEach(() => {
    delete window.gtag;
    vi.useRealTimers();
  });

  it("retries the first page and tool view when GA loads after mount", async () => {
    const { rerender } = render(<GaPageviews />);
    window.gtag = vi.fn();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(250);
    });

    expect(window.gtag).toHaveBeenCalledWith("event", "page_view", expect.objectContaining({ page_path: "/dashboard" }));
    expect(window.gtag).toHaveBeenCalledWith("event", "tool_view", expect.objectContaining({ tool_id: "5-2", interaction_source: "route" }));
    expect(window.gtag).toHaveBeenCalledTimes(3);

    rerender(<GaPageviews />);
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(window.gtag).toHaveBeenCalledTimes(3);
  });

  it.each(["ko", "en"])("connects an article CTA to the matching tool arrival (%s)", (locale) => {
    window.gtag = vi.fn();
    currentPath = `${locale === "en" ? "/en" : ""}/blog/performance-marketing-metrics`;
    const view = render(<GaPageviews />);
    trackProductEvent("blog_tool_cta_clicked", {
      content_slug: "performance-marketing-metrics", content_type: "blog",
      tool_id: "5-2", placement: "article_entry", source: "demo", locale,
    });
    currentPath = `${locale === "en" ? "/en" : ""}/dashboard`;
    view.rerender(<GaPageviews />);
    expect(window.gtag).toHaveBeenCalledWith("event", "tool_view", expect.objectContaining({
      tool_id: "5-2", interaction_source: "route", locale,
      content_slug: "performance-marketing-metrics", content_type: "blog", placement: "article_entry",
    }));
    expect(window.gtag.mock.calls.filter(call => call[1] === "analysis_started")).toHaveLength(0);
    expect(window.gtag.mock.calls.filter(call => call[1] === "analysis_completed")).toHaveLength(0);
    currentPath = `${locale === "en" ? "/en" : ""}/tools/budget-allocation`;
    view.rerender(<GaPageviews />);
    const otherTool = window.gtag.mock.calls.find(call => call[1] === "tool_view" && call[2].tool_id === "5-3");
    expect(otherTool[2]).not.toHaveProperty("content_slug");
    expect(otherTool[2]).not.toHaveProperty("source");
  });
});
