// @vitest-environment jsdom
import { afterEach, describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import StartGate from "@/components/StartGate";

describe("StartGate render smoke", () => {
  beforeEach(() => {
    const empty = { raw: [], headers: [], mapping: {}, fileName: "" };
    useAppStore.setState({
      demoDisabled: false,
      currentRouteId: "start-gate",
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: empty },
      csvData: empty,
      analyzedByGroup: { ...useAppStore.getState().analyzedByGroup, efficiency: null },
    });
    window.gtag = vi.fn();
  });

  afterEach(() => { delete window.gtag; });

  it("mounts + sets demoDisabled(true) + lists tools", () => {
    expect(() => render(<StartGate />)).not.toThrow();
    // 진입 시 데모 자동로드 억제 플래그 on.
    expect(useAppStore.getState().demoDisabled).toBe(true);
    // 도구 카드(질문/제목) 최소 1개.
    expect(document.querySelectorAll(".phase-card").length).toBeGreaterThan(0);
    expect(screen.getByText(/데이터부터 살펴볼게요/)).toBeTruthy();
    expect(document.querySelector('a[href="/diagnose"]')).toBeTruthy();
    expect(document.querySelectorAll(".start-preset-card")).toHaveLength(4);
    expect(window.gtag).toHaveBeenCalledWith("event", "preset_exposed", {
      source: "start",
      placement: "before_upload",
      locale: "ko",
    });
  });

  it("opens a deterministic situation result with the selected scale and fixed GA enums", () => {
    render(<StartGate />);
    fireEvent.click(screen.getByRole("button", { name: /스케일 · 월 3억 이상/ }));
    fireEvent.click(screen.getByRole("button", { name: /모바일 게임 · 이 상황으로 결과 보기/ }));

    const state = useAppStore.getState();
    const slice = state.csvGroups.efficiency;
    expect(slice.fileName).toBe("demo_preset_mobile-game_scale.csv");
    expect(slice.demoPresetId).toBe("mobile-game");
    expect(slice.raw.length).toBeGreaterThan(0);
    expect(state.analyzedByGroup.efficiency).toBeTruthy();
    expect(window.gtag).toHaveBeenCalledWith("event", "preset_selected", {
      tool_id: "5-2",
      source: "industry_preset",
      placement: "before_upload",
      locale: "ko",
      preset_id: "mobile-game",
      preset_scale: "scale",
    });
    expect(window.gtag).toHaveBeenCalledWith("event", "example_run_started", expect.objectContaining({
      preset_id: "mobile-game",
      preset_scale: "scale",
    }));
  });

  it("keeps the preset chooser equivalent in English", () => {
    render(<StartGate locale="en" />);
    expect(screen.getByRole("button", { name: /Lead generation · View this situation/ })).toBeTruthy();
    expect(screen.getByText("See a result that resembles your situation before uploading")).toBeTruthy();
  });

  it("startMyData clears demo-loaded groups only (real uploads kept)", () => {
    useAppStore.setState({
      csvGroups: {
        ...useAppStore.getState().csvGroups,
        efficiency: { raw: [{ a: 1 }], headers: ["a"], mapping: {}, fileName: "demo_efficiency.csv" },
        aha: { raw: [{ a: 1 }], headers: ["a"], mapping: {}, fileName: "my_real.csv" },
      },
    });
    useAppStore.getState().startMyData();
    const g = useAppStore.getState().csvGroups;
    expect(g.efficiency.raw.length).toBe(0); // 데모 → 비움
    expect(g.aha.raw.length).toBe(1); // 실제 업로드 → 보존
  });

  it("shows analysis eligibility immediately after a real file is prepared", () => {
    const slice = {
      raw: [{ date: "2026-08-01", cost: "100", installs: "10" }],
      headers: ["date", "cost", "installs"],
      mapping: { date: "date", cost: "cost", installs: "installs" },
      fileName: "weekly.csv",
      canonicalData: { records: [{ date: "2026-08-01", dimensions: {}, metrics: { cost: 100, installs: 10 } }] },
      mappedRows: [{ date: "2026-08-01", cost: 100, installs: 10 }],
    };
    useAppStore.setState({
      currentRouteId: "start-gate",
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice },
      csvData: slice,
    });
    render(<StartGate />);
    expect(document.querySelector(".analysis-recommendations")).toBeTruthy();
    expect(screen.getByText(/업로드 직후 자동 매핑 기준/)).toBeTruthy();
  });
});
