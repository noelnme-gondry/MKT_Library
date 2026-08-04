// @vitest-environment jsdom
import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AnalysisHistory from "./AnalysisHistory";
import { listAnalysisRuns, saveAnalysisRun } from "@/lib/data-import/localHistory";

vi.mock("@/lib/data-import/localHistory", () => ({
  clearAnalysisRuns: vi.fn(() => Promise.resolve()),
  deleteAnalysisRun: vi.fn(() => Promise.resolve()),
  listAnalysisRuns: vi.fn(),
  saveAnalysisRun: vi.fn(),
}));

describe("AnalysisHistory revisit telemetry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.gtag;
    delete window.IntersectionObserver;
  });

  it("tracks a previous-result view only after the history enters the viewport", async () => {
    const observers = [];
    class VisibilityObserver {
      constructor(callback) {
        this.callback = callback;
        observers.push(this);
      }
      observe(target) { this.target = target; }
      disconnect() {}
    }
    window.IntersectionObserver = VisibilityObserver;
    window.gtag = vi.fn();
    saveAnalysisRun.mockResolvedValue({});
    listAnalysisRuns.mockResolvedValue([
      { id: "current-run", locale: "ko", savedAt: "2026-08-04T00:00:00.000Z", summary: { headline: "현재 결과", stats: [] } },
      { id: "previous-run-private", locale: "ko", savedAt: "2026-07-28T00:00:00.000Z", summary: { headline: "민감한 이전 판단", stats: [{ label: "CPA", value: "12,345" }] } },
    ]);

    const { container } = render(<AnalysisHistory toolId="5-2" locale="ko" summary={{ headline: "현재 결과", stats: [] }} />);
    await waitFor(() => expect(container.querySelector(".analysis-history")).toBeTruthy());
    expect(window.gtag.mock.calls.filter((call) => call[1] === "analysis_history_viewed")).toHaveLength(0);

    act(() => observers.at(-1).callback([{
      target: observers.at(-1).target,
      isIntersecting: true,
      intersectionRatio: 0.2,
    }]));

    expect(window.gtag).toHaveBeenCalledWith("event", "analysis_history_viewed", {
      tool_id: "5-2",
      source: "local_history",
      result_state: "previous_available",
      data_continuity: "summary_only",
      locale: "ko",
    });
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("민감한 이전 판단");
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("12,345");
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("previous-run-private");
  });
});
