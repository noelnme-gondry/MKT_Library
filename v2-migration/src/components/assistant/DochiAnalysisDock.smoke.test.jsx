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
  useAppStore.setState({ dochiAnalysisSession: null, decisionRecords: [], currentRouteId: "home" });
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

  it("shows the current analysis and its pending review, then returns to the full result workspace", () => {
    useAppStore.setState({
      currentRouteId: "5-2",
      decisionRecords: [{ id: "d1", toolId: "5-2", action: "Hold budget", status: "pending", reviewDate: "2099-01-01" }],
      dochiAnalysisSession: {
        sourceData: SOURCE,
        analyses: [{ toolId: "5-2", status: "ready", recommendationReason: "현재 성과를 확인합니다" }],
      },
    });
    render(<DochiAnalysisDock />);
    fireEvent.click(screen.getByRole("button", { name: "도치가 기억한 분석 열기" }));
    expect(screen.getByText("지금 보는 분석")).toBeTruthy();
    expect(screen.getByText("이 분석의 검토 대기 1건")).toBeTruthy();
    expect(document.querySelector('button[aria-current="page"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /도치 결과함 전체 보기/ }));
    expect(push).toHaveBeenCalledWith("/dochi-result");
  });
});
