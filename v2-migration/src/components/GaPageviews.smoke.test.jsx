// @vitest-environment jsdom
import { act, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import GaPageviews from "@/components/GaPageviews";

let currentPath = "/dashboard";

vi.mock("next/navigation", () => ({
  usePathname: () => currentPath,
}));

describe("GaPageviews", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    currentPath = "/dashboard";
    delete window.gtag;
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
    expect(window.gtag).toHaveBeenCalledWith("event", "tool_view", expect.objectContaining({ tool_id: "5-2", source: "route" }));
    expect(window.gtag).toHaveBeenCalledTimes(2);

    rerender(<GaPageviews />);
    await act(async () => {
      await vi.runOnlyPendingTimersAsync();
    });
    expect(window.gtag).toHaveBeenCalledTimes(2);
  });
});
