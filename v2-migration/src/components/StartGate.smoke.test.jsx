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

  it("mounts with upload first, direct no-file actions, and tool browser", () => {
    expect(() => render(<StartGate />)).not.toThrow();
    // 진입 시 데모 자동로드 억제 플래그 on.
    expect(useAppStore.getState().demoDisabled).toBe(true);
    // 도구 카드(질문/제목) 최소 1개.
    expect(document.querySelectorAll(".phase-card").length).toBeGreaterThan(0);
    expect(screen.getByText(/CSV나 Google Sheets를 가져오세요/)).toBeTruthy();
    expect(document.querySelector('a[href="/calculator"]')).toBeTruthy();
    expect(document.querySelector('a[href="/diagnose"]')).toBeTruthy();
    expect(document.querySelector(".start-presets")).toBeNull();
  });

  it("opens one clearly labeled generic example and tracks it", () => {
    render(<StartGate />);
    fireEvent.click(screen.getByRole("button", { name: /예시 데이터로 둘러보기/ }));
    expect(useAppStore.getState().demoDisabled).toBe(false);
    expect(useAppStore.getState().csvGroups.efficiency.fileName).toMatch(/^demo_/);
    expect(window.gtag).toHaveBeenCalledWith("event", "example_run_started", {
      tool_id: "5-2",
      source: "start",
      placement: "after_upload_entry",
      locale: "ko",
    });
  });

  it("keeps upload, calculator, diagnosis, and generic example equivalent in English", () => {
    render(<StartGate locale="en" />);
    expect(screen.getByText("Bring a CSV or Google Sheet")).toBeTruthy();
    expect(document.querySelector('a[href="/en/calculator"]')).toBeTruthy();
    expect(document.querySelector('a[href="/en/diagnose"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: /Explore example data/ })).toBeTruthy();
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
