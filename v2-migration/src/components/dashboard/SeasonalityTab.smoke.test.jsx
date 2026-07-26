// @vitest-environment jsdom
//
// Render-smoke for SeasonalityTab (5-2 운영 대시보드 · 시즈널리티 탭). Covers the
// no-data pane, the sufficient multi-year state (overlay + index + heatmap + the
// new trend-removal verification chart), the download hub, and the `source`
// (organic/paid) filter path. Deterministic seed — NO Math.random (harness §8).
import { describe, it, expect, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import SeasonalityTab from "@/components/dashboard/SeasonalityTab";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

// Two full calendar years of ~every-3-days rows across two sources (organic/paid)
// so buildCalendarSeasonality reaches the sufficient branch (>=2 years).
function seedWithData() {
  const headers = ["Date", "Source", "Channel", "Spend", "Installs"];
  const mapping = { Date: "date", Source: "source", Channel: "channel", Spend: "cost", Installs: "installs" };
  const raw = [];
  for (const year of [2024, 2025]) {
    for (let m = 1; m <= 12; m++) {
      for (const day of [3, 12, 21]) {
        const date = `${year}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
        // deterministic seasonal-ish signal
        const seasonal = 1 + 0.2 * Math.sin((m / 12) * Math.PI * 2);
        raw.push({ Date: date, Source: "paid", Channel: "Meta", Spend: Math.round(100000 * seasonal), Installs: Math.round(2000 * seasonal) });
        raw.push({ Date: date, Source: "organic", Channel: "Referral", Spend: 0, Installs: Math.round(900 * seasonal) });
      }
    }
  }
  const slice = { raw, headers, mapping, fileName: "seasonality.csv" };
  useAppStore.setState({
    currentRouteId: "5-2",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice },
    csvData: slice,
    dashboardFilter: { dateStart: null, dateEnd: null, platforms: new Set(), countries: new Set(), channels: new Set(), sources: new Set() },
  });
}

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "5-2",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: EMPTY_CSV },
    csvData: EMPTY_CSV,
    dashboardFilter: { dateStart: null, dateEnd: null, platforms: new Set(), countries: new Set(), channels: new Set(), sources: new Set() },
  });
}

describe("SeasonalityTab render smoke", () => {
  beforeEach(() => seedNoData());

  it("mounts without throwing in the no-data state", () => {
    expect(() => render(<SeasonalityTab />)).not.toThrow();
  });

  it("keeps the no-metric guidance in English", () => {
    render(<SeasonalityTab locale="en" />);
    const koreanCopy = Array.from(new Set((document.body.textContent || "").match(/[가-힣]+/g) || []));
    expect(koreanCopy).toEqual([]);
  });

  it("mounts with sufficient multi-year data and renders the verification chart + download hub", () => {
    seedWithData();
    let utils;
    expect(() => { utils = render(<SeasonalityTab />); }).not.toThrow();
    expect(document.getElementById("tab-seasonality")).toBeTruthy();
    // verification (trend-removal) section is present in the sufficient state
    expect(utils.container.querySelector(".seasonality-verify")).toBeTruthy();
    // download hub button renders
    const dlButton = [...utils.container.querySelectorAll("button")].find((b) => /데이터 받기/.test(b.textContent));
    expect(dlButton).toBeTruthy();
  });

  it("mounts without throwing when a source (paid) is filtered", () => {
    seedWithData();
    useAppStore.setState({
      dashboardFilter: { dateStart: null, dateEnd: null, platforms: new Set(), countries: new Set(), channels: new Set(), sources: new Set(["paid"]) },
    });
    expect(() => render(<SeasonalityTab />)).not.toThrow();
  });
});
