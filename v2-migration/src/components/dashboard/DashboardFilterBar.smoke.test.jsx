// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { act, render } from "@testing-library/react";
import DashboardFilterBar from "./DashboardFilterBar";
import { useAppStore } from "@/store/useDataStore";

const CSV = {
  raw: [
    { Date: "2026-07-01", Platform: "iOS", Country: "KR", Channel: "Meta" },
    { Date: "2026-07-02", Platform: "Android", Country: "US", Channel: "Google" },
  ],
  headers: ["Date", "Platform", "Country", "Channel"],
  mapping: { Date: "date", Platform: "platform", Country: "country", Channel: "channel" },
  fileName: "filters.csv",
};

describe("DashboardFilterBar segment disclosure", () => {
  beforeEach(() => {
    useAppStore.setState({
      csvData: CSV,
      dashboardFilter: {
        dateStart: null,
        dateEnd: null,
        platforms: new Set(),
        countries: new Set(),
        channels: new Set(),
        sources: new Set(),
      },
    });
  });

  it("opens the segment controls when a segment filter is active", () => {
    useAppStore.setState({
      dashboardFilter: {
        ...useAppStore.getState().dashboardFilter,
        platforms: new Set(["iOS"]),
      },
    });
    const { container } = render(<DashboardFilterBar />);
    expect(container.querySelector(".dashboard-filter-more")).toHaveProperty("open", true);
  });

  it("keeps the segment controls collapsed when no segment filter is active", () => {
    const { container } = render(<DashboardFilterBar locale="en" />);
    expect(container.querySelector(".dashboard-filter-more")).toHaveProperty("open", false);
    expect(container.querySelector(".dashboard-filter-bar__scope")?.getAttribute("aria-label")).toBe("Date and segment filters");
    expect(container.querySelector(".dashboard-filter-bar__display")?.getAttribute("aria-label")).toBe("Display settings");
  });

  it("opens after a segment filter becomes active post-mount", () => {
    const { container } = render(<DashboardFilterBar />);
    expect(container.querySelector(".dashboard-filter-more")).toHaveProperty("open", false);

    act(() => {
      useAppStore.setState({
        dashboardFilter: {
          ...useAppStore.getState().dashboardFilter,
          channels: new Set(["Meta"]),
        },
      });
    });

    expect(container.querySelector(".dashboard-filter-more")).toHaveProperty("open", true);
  });
});
