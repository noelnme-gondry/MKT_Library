// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { act, fireEvent, render, screen } from "@testing-library/react";
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

describe("DashboardFilterBar scope controls", () => {
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

  // 축마다 "이름 값" 버튼이 바로 보인다 — "세그먼트 1" 묶음 뒤에 걸린 값이 숨지 않는다(2026-09-29).
  it("shows each filterable dimension as its own button with the selected value", () => {
    useAppStore.setState({
      dashboardFilter: { ...useAppStore.getState().dashboardFilter, channels: new Set(["Meta"]) },
    });
    const { container } = render(<DashboardFilterBar />);
    expect(container.querySelector(".dashboard-filter-more")).toBeNull();
    const channel = screen.getByRole("button", { name: /채널\s*Meta/ });
    expect(channel.classList.contains("is-active")).toBe(true);
    const platform = screen.getByRole("button", { name: /플랫폼\s*전체/ });
    expect(platform.classList.contains("is-active")).toBe(false);
    // 폰 요약 줄도 걸린 값을 말한다.
    expect(container.querySelector(".dashboard-filter-bar__summary strong")?.textContent).toBe("채널 Meta");
  });

  it("hides a dimension that has only one value unless it is already filtered", () => {
    useAppStore.setState({
      csvData: { ...CSV, raw: CSV.raw.map((row) => ({ ...row, Country: "KR" })) },
    });
    const { container } = render(<DashboardFilterBar locale="en" />);
    expect(screen.queryByRole("button", { name: /Country/ })).toBeNull();
    expect(container.querySelector(".dashboard-filter-bar__scope")?.getAttribute("aria-label")).toBe("Date and segment filters");
    expect(container.querySelector(".dashboard-filter-bar__display")?.getAttribute("aria-label")).toBe("Display settings");

    act(() => {
      useAppStore.setState({ dashboardFilter: { ...useAppStore.getState().dashboardFilter, countries: new Set(["KR"]) } });
    });
    expect(screen.getByRole("button", { name: /Country\s*KR/ })).toBeTruthy();
  });

  it("toggles the controls from the phone summary and keeps the state on the DOM", () => {
    const { container } = render(<DashboardFilterBar />);
    const bar = container.querySelector(".dashboard-filter-bar");
    const toggle = screen.getByRole("button", { name: "조건 바꾸기" });
    expect(bar.getAttribute("data-controls-open")).toBe("false");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(toggle.getAttribute("aria-controls")).toBe(container.querySelector(".dashboard-filter-bar__controls").id);
    fireEvent.click(toggle);
    expect(bar.getAttribute("data-controls-open")).toBe("true");
    expect(screen.getByRole("button", { name: "조건 닫기" }).getAttribute("aria-expanded")).toBe("true");
  });
});
