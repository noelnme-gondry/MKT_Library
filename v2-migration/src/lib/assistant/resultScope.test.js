import { beforeEach, describe, expect, it } from "vitest";
import { buildSampleJourney } from "@/lib/sampleJourney";
import { useAppStore } from "@/store/useDataStore";
import { runEfficiencyAnalysis } from "./efficiencyAnalysisAdapters";
import { resultScope } from "./resultScope";

const run = (toolId, csv) => runEfficiencyAnalysis({ toolId, csvData: csv, inputSignature: "i", mappingSignature: "m", locale: "ko" });

describe("result scope handed to the tool", () => {
  beforeEach(() => useAppStore.setState(useAppStore.getInitialState(), true));

  it("opens the weekly check on the window the result compared", () => {
    const csv = buildSampleJourney("ko");
    const dashboard = run("5-2", csv);
    expect(resultScope(dashboard, "5-2")).toEqual({ filterState: {}, windowDays: dashboard.manifest.windowDays });
    // 비교 창은 주간 점검만 읽는다 — 다른 도구로 갈 때 전역 창을 건드리지 않는다.
    expect(resultScope(run("5-22", csv), "5-22")).toEqual({ filterState: {} });
  });

  it("narrows a drill-down to the named channel on the daily view", () => {
    const pvm = run("5-21", buildSampleJourney("ko"));
    expect(resultScope(pvm, "5-2", pvm.verdict.drillDown)).toEqual({
      filterState: { channels: [pvm.verdict.drillDown.value] },
      windowDays: 7,
      dashboardTab: "viz",
    });
  });

  // 도구에 예전 필터가 남아 있으면 결과 화면과 다른 행으로 다른 숫자를 낸다(2026-09-28).
  it("replaces a stale tool filter with the result's scope", () => {
    const csv = buildSampleJourney("ko");
    const store = useAppStore.getState();
    store.setCurrentRouteId("5-2");
    store.setDashboardFilter({ channels: new Set(["TikTok"]) });
    useAppStore.setState({ dashWindowDays: 28, dashboardTab: "funnel" });
    expect(useAppStore.getState().dashboardFilter.channels.has("TikTok")).toBe(true);

    useAppStore.getState().handoffCsvToRoute("5-2", csv, { scope: { filterState: {}, windowDays: 7 } });
    let state = useAppStore.getState();
    expect(state.dashboardFilter.channels.size).toBe(0);
    expect(state.dashboardFilterGroups.efficiency.channels.size).toBe(0);
    expect(state.dashWindowDays).toBe(7);
    // 드릴다운이 아니면 사용자가 고른 탭은 그대로다.
    expect(state.dashboardTab).toBe("funnel");

    useAppStore.getState().handoffCsvToRoute("5-2", csv, { scope: { filterState: { channels: [" Meta AAP "] }, windowDays: 7, dashboardTab: "viz" } });
    state = useAppStore.getState();
    expect([...state.dashboardFilter.channels]).toEqual(["Meta AAP"]);
    expect(state.dashboardTab).toBe("viz");
  });

  it("keeps the tool filter when no scope is handed over", () => {
    const store = useAppStore.getState();
    store.setCurrentRouteId("5-2");
    store.setDashboardFilter({ channels: new Set(["TikTok"]) });
    useAppStore.getState().handoffCsvToRoute("5-2", buildSampleJourney("ko"));
    expect([...useAppStore.getState().dashboardFilter.channels]).toEqual(["TikTok"]);
  });

  it("ignores a window the dashboard does not offer", () => {
    useAppStore.getState().handoffCsvToRoute("5-2", buildSampleJourney("ko"), { scope: { filterState: {}, windowDays: 10 } });
    expect(useAppStore.getState().dashWindowDays).toBe(7);
  });
});
