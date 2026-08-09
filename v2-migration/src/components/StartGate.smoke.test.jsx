// @vitest-environment jsdom
import { afterEach, describe, it, expect, beforeEach, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { TOOL_GROUP, useAppStore } from "@/store/useDataStore";
import StartGate from "@/components/StartGate";
import AsaKeywordFinder from "@/components/tools/AsaKeywordFinder";

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
    expect(screen.getByText(/데이터를 올리면 첫 분석을 골라드립니다/)).toBeTruthy();
    expect(screen.getByText(/도구별 데이터 조건/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "⬇ 기본 CSV 템플릿 받기" })).toBeTruthy();
    expect(document.querySelector('a[href="/calculator"]')).toBeTruthy();
    expect(document.querySelector('a[href="/diagnose"]')).toBeTruthy();
    expect(document.querySelector(".start-presets")).toBeNull();
  });

  it("loads one clearly labeled example in the recommendation flow", () => {
    render(<StartGate />);
    fireEvent.click(screen.getByRole("button", { name: /예시 데이터로 결과 바로 보기/ }));
    expect(useAppStore.getState().csvGroups.efficiency.fileName).toMatch(/^demo_/);
    expect(window.gtag).toHaveBeenCalledWith("event", "example_run_started", {
      tool_id: "start-gate",
      source: "csv_guide",
      placement: "before_upload",
      locale: "ko",
    });
  });

  it("keeps upload, calculator, diagnosis, and generic example equivalent in English", () => {
    render(<StartGate locale="en" />);
    expect(screen.getByText("Upload data. Get the right first analysis.")).toBeTruthy();
    expect(screen.getByText(/check each tool’s data requirements/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "⬇ Download starter CSV template" })).toBeTruthy();
    expect(document.querySelector('a[href="/en/calculator"]')).toBeTruthy();
    expect(document.querySelector('a[href="/en/diagnose"]')).toBeTruthy();
    expect(screen.getByRole("button", { name: /Run the example and see results/ })).toBeTruthy();
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
    expect(screen.getByText(/자동 매핑을 마쳤습니다/)).toBeTruthy();
  });

  it("uses per-tool eligibility without showing a contradictory generic mapping gate", () => {
    const raw = Array.from({ length: 5 }, (_, day) => ["Google", "Meta"].map((channel, index) => ({
      date: `2026-08-0${day + 1}`,
      channel,
      cost: String(100 + day * (index + 1)),
    }))).flat();
    const slice = {
      raw,
      headers: ["date", "channel", "cost"],
      mapping: { date: "date", channel: "channel", cost: "cost" },
      fileName: "channel_spend.csv",
      canonicalData: { records: raw.map((row) => ({ date: row.date, dimensions: { channel: row.channel }, metrics: { cost: Number(row.cost) } })) },
      mappedRows: raw,
    };
    useAppStore.setState({
      currentRouteId: "start-gate",
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice },
      csvData: slice,
    });

    const startView = render(<StartGate />);

    expect(screen.getByRole("heading", { name: /VIF 다중공선성 점검/ })).toBeTruthy();
    expect(screen.getAllByText("추천 분석 선택").length).toBeGreaterThan(0);
    expect(screen.queryByText(/필수 컬럼이 매핑되지 않았습니다/)).toBeNull();
    expect(document.querySelector(".csv-mapping-block")).toBeNull();

    const incrementalityCard = [...document.querySelectorAll(".start-tool-browser .phase-card")]
      .find((card) => card.querySelector(".phase-card-title")?.textContent.startsWith("증분 분석 ("));
    fireEvent.click(incrementalityCard);
    expect(useAppStore.getState().analyzedByGroup[TOOL_GROUP["5-23"]]).toBeNull();

    const asaCard = [...document.querySelectorAll(".start-tool-browser .phase-card")]
      .find((card) => card.textContent.includes("ASA 키워드 발굴"));
    fireEvent.click(asaCard);
    expect(useAppStore.getState().csvGroups.asa_keyword.raw).toHaveLength(raw.length);
    expect(useAppStore.getState().csvGroups.asa_keyword.fileName).toContain("channel_spend.csv");
    expect(useAppStore.getState().analyzedByGroup.asa_keyword).toBeNull();

    startView.unmount();
    useAppStore.getState().setCurrentRouteId("5-26");
    const { container } = render(<AsaKeywordFinder />);
    expect(screen.getByText(/필수 컬럼이 매핑되지 않았습니다/)).toBeTruthy();
    expect(container.querySelector(".asa-tool__summary-grid")).toBeNull();
    expect(container.querySelector('[data-decision-review-tool="5-26"]')).toBeNull();
  });
});
