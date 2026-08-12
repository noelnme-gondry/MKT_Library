// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import PaidOrganicTrend from "@/components/tools/PaidOrganicTrend";
import { buildPaidOrganicTrendDemo } from "@/utils/paidOrganicTrend";
import { buildDemoCsv } from "@/utils/demoData";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seed(slice = EMPTY_CSV) {
  useAppStore.setState({
    currentRouteId: "5-18-paid-organic",
    csvGroups: { ...useAppStore.getState().csvGroups, response: slice },
    csvData: slice,
    isDarkMode: false,
  });
}

describe("PaidOrganicTrend render smoke", () => {
  beforeEach(() => seed());

  it("shows a low-friction upload state without loading a deep model", () => {
    const { container } = render(<PaidOrganicTrend />);
    expect(screen.getByRole("heading", { name: "Paid·Organic 변화맵" })).toBeTruthy();
    expect(screen.getByText(/날짜·Paid 성과/)).toBeTruthy();
    expect(container.querySelector("canvas")).toBeNull();
  });

  it("renders the darker-is-newer movement map and detailed-diagnosis handoff", () => {
    seed(buildPaidOrganicTrendDemo());
    const { container } = render(<PaidOrganicTrend />);
    expect(screen.getByText("주별 WoW 변화 궤적")).toBeTruthy();
    expect(container.querySelector("canvas")).toBeTruthy();
    const link = screen.getByRole("link", { name: /카니발 정밀 진단 열기/ });
    expect(link.getAttribute("href")).toBe("/tools/cannibalization-diagnosis");
  });

  it("runs from the shared marketing-response demo without another upload", () => {
    seed(buildDemoCsv("response"));
    const { container } = render(<PaidOrganicTrend />);
    expect(screen.getByText("주별 WoW 변화 궤적")).toBeTruthy();
    expect(screen.getByText("Organic = 전체 − Paid")).toBeTruthy();
    expect(container.querySelector("canvas")).toBeTruthy();
  });

  it("keeps KR and EN routes functionally equivalent", () => {
    seed(buildPaidOrganicTrendDemo("en"));
    render(<PaidOrganicTrend locale="en" />);
    expect(screen.getByRole("heading", { name: "Paid · Organic Movement Map" })).toBeTruthy();
    expect(screen.getByRole("link", { name: /Open detailed cannibalization diagnosis/ }).getAttribute("href"))
      .toBe("/en/tools/cannibalization-diagnosis");
  });

  it("loads deterministic example data from the empty state", () => {
    render(<PaidOrganicTrend />);
    fireEvent.click(screen.getByRole("button", { name: "예시로 보기" }));
    expect(useAppStore.getState().csvData.fileName).toBe("demo_paid_organic_trend.csv");
  });
});
