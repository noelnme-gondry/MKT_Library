// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";

import { useAppStore } from "@/store/useDataStore";

const { push } = vi.hoisted(() => ({ push: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import DochiAnalysisDock from "@/components/assistant/DochiAnalysisDock";

const SOURCE = {
  raw: [{ Date: "2026-08-01", Channel: "Search", Spend: "100", Installs: "10" }],
  headers: ["Date", "Channel", "Spend", "Installs"],
  mapping: { Date: "date", Channel: "channel", Spend: "cost", Installs: "installs" },
  fileName: "campaign.csv",
};

afterEach(() => {
  push.mockReset();
  useAppStore.setState({ dochiAnalysisSession: null });
  document.body.innerHTML = "";
});

describe("DochiAnalysisDock", () => {
  it("appears only after Dochi has an analysis session and reopens its remembered analyses", () => {
    const { rerender } = render(<DochiAnalysisDock />);
    expect(document.querySelector(".dochi-analysis-dock")).toBeNull();

    useAppStore.setState({
      dochiAnalysisSession: {
        sourceData: SOURCE,
        analyses: [{ toolId: "5-2", status: "ready", recommendationReason: "현재 성과를 확인합니다" }],
      },
    });
    rerender(<DochiAnalysisDock />);

    fireEvent.click(screen.getByRole("button", { name: "도치가 기억한 분석 열기" }));
    expect(screen.getByText("도치가 기억한 분석")).toBeTruthy();
    expect(screen.getByText("주간 성과 점검")).toBeTruthy();
    expect(screen.getByText("campaign.csv")).toBeTruthy();
  });

  it("hands the remembered mapping to a detailed tool before navigating", async () => {
    const requestAnimationFrame = window.requestAnimationFrame;
    window.requestAnimationFrame = (callback) => { callback(); return 1; };
    useAppStore.setState({
      dochiAnalysisSession: {
        sourceData: SOURCE,
        analyses: [{ toolId: "5-2", status: "ready", recommendationReason: "현재 성과를 확인합니다" }],
      },
    });
    render(<DochiAnalysisDock />);

    fireEvent.click(screen.getByRole("button", { name: "도치가 기억한 분석 열기" }));
    fireEvent.click(screen.getByRole("button", { name: /주간 성과 점검/ }));

    await waitFor(() => expect(push).toHaveBeenCalledWith("/dashboard"));
    expect(useAppStore.getState().csvGroups.efficiency.mapping.Date).toBe("date");
    window.requestAnimationFrame = requestAnimationFrame;
  });
});
