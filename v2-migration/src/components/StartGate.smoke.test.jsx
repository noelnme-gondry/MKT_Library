// @vitest-environment jsdom
import { afterEach, describe, it, expect, beforeEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { TOOL_GROUP, useAppStore } from "@/store/useDataStore";
import StartGate from "@/components/StartGate";
import AsaKeywordFinder from "@/components/tools/AsaKeywordFinder";
import { PUBLISHED_TOOL_IDS, toolIndexEntry } from "@/lib/toolIndex";
import { buildDatasetContinuitySnapshot, serializeDatasetContinuitySnapshot } from "@/lib/dataContinuity";

// 이름은 레지스트리에서 — 손으로 적으면 리네임마다 깨진다.
const nameOf = (id, locale = "ko") => toolIndexEntry(id, locale).name;
const questionOf = nameOf;
let search = "";
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }), useSearchParams: () => new URLSearchParams(search) }));
async function analyzePreparedFile() {
  fireEvent.click(screen.getByRole("button", { name: "원 ₩" }));
  fireEvent.click(document.querySelector(".csv-analysis-action"));
  await waitFor(() => expect(document.querySelector(".workspace-input-summary")).toBeTruthy());
}

describe("StartGate render smoke", () => {
  beforeEach(() => {
    search = "";
    const empty = { raw: [], headers: [], mapping: {}, fileName: "" };
    useAppStore.setState({
      demoDisabled: false,
      currentRouteId: "start-gate",
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: empty },
      csvData: empty,
      analyzedByGroup: { ...useAppStore.getState().analyzedByGroup, efficiency: null },
      decisionRecords: [],
    });
    window.gtag = vi.fn();
  });

  afterEach(() => { delete window.gtag; window.sessionStorage.clear(); vi.useRealTimers(); });

  it("does not run an analysis or show a mascot from a legacy handoff marker", () => {
    vi.useFakeTimers();
    const slice = {
      raw: [{ date: "2026-08-01", cost: "100", installs: "10" }],
      headers: ["date", "cost", "installs"],
      mapping: { date: "date", cost: "cost", installs: "installs" },
      fileName: "weekly.csv",
      canonicalData: { records: [{ date: "2026-08-01", dimensions: {}, metrics: { cost: 100, installs: 10 } }] },
      mappedRows: [{ date: "2026-08-01", cost: 100, installs: 10 }],
    };
    useAppStore.setState({
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice },
      csvData: slice,
    });
    window.sessionStorage.setItem("dochi_analysis_handoff", JSON.stringify({ locale: "ko", startedAt: Date.now() }));
    render(<StartGate />);
    act(() => vi.advanceTimersByTime(0));
    act(() => vi.advanceTimersByTime(1500));
    expect(document.querySelector(".dochi-arrival")).toBeNull();
    const mapping = document.querySelector(".csv-mapping-block");
    expect(mapping.tagName).toBe("SECTION");
    expect(document.querySelector(".dochi-mapping-coach")).toBeNull();
    expect(document.querySelector(".dochi-workspace")).toBeNull();
    expect(screen.getByRole("button", { name: "원 ₩" })).toBeTruthy();
  });

  it("mounts with one upload entry and no premature analysis catalog", () => {
    expect(() => render(<StartGate />)).not.toThrow();
    // 진입 시 데모 자동로드 억제 플래그 on.
    expect(useAppStore.getState().demoDisabled).toBe(true);
    // 도구 인덱스가 발행 도구를 전부 버튼으로 내놓는다. 예전에는 <details>로 접혀
    // 있어 "무엇을 할 수 있는지"가 첫 화면에 없었다. 격자로 바뀐 뒤에도 개수 계약은
    // 같다 — 접는 것과 격자에 담는 것은 다르다(상세만 눌러서 연다).
    expect(document.querySelectorAll(".tool-index__chip")).toHaveLength(0);
    expect(screen.getByRole("heading", { name: "내 데이터로 시작" })).toBeTruthy();
    expect(screen.getByText(/도구별 데이터 조건/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "⬇ 기본 CSV 템플릿 받기" })).toBeTruthy();
    expect(document.querySelector(".start-direct-actions")).toBeNull();
    expect(document.querySelector(".start-presets")).toBeNull();
  });

  it("loads one clearly labeled example in the recommendation flow", () => {
    render(<StartGate />);
    fireEvent.click(screen.getByRole("button", { name: /예시 데이터로 결과 바로 보기/ }));
    expect(useAppStore.getState().csvGroups.efficiency.fileName).toMatch(/^demo_/);
    expect(window.gtag).toHaveBeenCalledWith("event", "example_run_started", {
      tool_id: "start-gate",
      interaction_source: "csv_guide",
      placement: "before_upload",
      locale: "ko",
    });
  });

  it("keeps upload, calculator, diagnosis, and generic example equivalent in English", () => {
    render(<StartGate locale="en" />);
    expect(screen.getByRole("heading", { name: "Start with my data" })).toBeTruthy();
    expect(screen.getByText(/check each tool’s data requirements/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "⬇ Download starter CSV template" })).toBeTruthy();
    expect(document.querySelector(".tool-index")).toBeNull();
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

  it("requires an explicit analysis action and summarizes the input until it is edited", async () => {
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
    const workspace = document.querySelector(".dochi-workspace");
    const mapping = document.querySelector(".csv-mapping-block");
    expect(workspace).toBeNull();
    expect(mapping).toBeTruthy();
    expect(mapping.tagName).toBe("SECTION");
    await analyzePreparedFile();
    expect(document.querySelector(".start-upload-panel").hidden).toBe(true);
    expect(document.querySelectorAll(".tool-index")).toHaveLength(1);
    fireEvent.click(screen.getByRole("button", { name: "입력·매핑 수정" }));
    expect(document.querySelector(".start-upload-panel").hidden).toBe(false);
    expect(document.querySelector(".dochi-workspace")).toBeNull();
    await analyzePreparedFile();
    act(() => useAppStore.getState().setCsvData({ ...slice, mapping: { ...slice.mapping, cost: "__ignore__" } }));
    expect(document.querySelector(".dochi-workspace")).toBeNull();
  });

  it("guides an identical upload back to its prior decision after analysis is requested", async () => {
    const slice = {
      raw: [{ date: "2026-08-01", cost: "100", installs: "10" }],
      headers: ["date", "cost", "installs"],
      mapping: { date: "date", cost: "cost", installs: "installs" },
      fileName: "closed-week.csv",
      canonicalData: { records: [{ date: "2026-08-01", dimensions: {}, metrics: { cost: 100, installs: 10 } }] },
      mappedRows: [{ date: "2026-08-01", cost: 100, installs: 10 }],
    };
    const datasetSnapshot = serializeDatasetContinuitySnapshot(buildDatasetContinuitySnapshot(slice.canonicalData, { dataGroup: "efficiency", mapping: slice.mapping }));
    expect(typeof datasetSnapshot).toBe("string");
    useAppStore.setState({
      currentRouteId: "start-gate",
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice },
      csvData: slice,
      decisionRecords: [{ id: "decision-1", toolId: "5-2", datasetSnapshot, createdAt: "2026-08-02T00:00:00.000Z", updatedAt: "2026-08-02T00:00:00.000Z" }],
    });

    render(<StartGate />);
    await analyzePreparedFile();
    expect(screen.getByRole("heading", { name: "같은 데이터입니다. 새 분석 대신 지난 판단을 확인하세요." })).toBeTruthy();
    expect(document.querySelector('.decision-data-update-guide a[href="/weekly-review"]')).toBeTruthy();
  });

  it("dims tools blocked by the uploaded data while keeping eligible tools available", async () => {
    const slice = {
      raw: [{ date: "2026-08-01", cost: "100", installs: "10" }],
      headers: ["date", "cost", "installs"],
      mapping: { date: "date", cost: "cost", installs: "installs" },
      fileName: "daily.csv",
      canonicalData: { records: [{ date: "2026-08-01", dimensions: {}, metrics: { cost: 100, installs: 10 } }] },
      mappedRows: [{ date: "2026-08-01", cost: 100, installs: 10 }],
    };
    useAppStore.setState({
      currentRouteId: "start-gate",
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice },
      csvData: slice,
    });

    render(<StartGate />);
    await analyzePreparedFile();
    const itemFor = (toolId) => [...document.querySelectorAll(".tool-index__cell")]
      .find((cell) => cell.querySelector(".tool-index__q")?.textContent === questionOf(toolId));

    await waitFor(() => {
      expect(itemFor("5-2").classList.contains("is-dim")).toBe(false);
      expect(itemFor("5-27").classList.contains("is-dim")).toBe(true);
    });
  });

  it("opens an eligible start recommendation with the same analyzed gate as the Dochi dock", async () => {
    const slice = {
      raw: [{ date: "2026-08-01", cost: "100", installs: "10" }],
      headers: ["date", "cost", "installs"],
      mapping: { date: "date", cost: "cost", installs: "installs" },
      fileName: "daily.csv",
      canonicalData: { records: [{ date: "2026-08-01", dimensions: {}, metrics: { cost: 100, installs: 10 } }] },
      mappedRows: [{ date: "2026-08-01", cost: 100, installs: 10 }],
    };
    useAppStore.setState({
      currentRouteId: "start-gate",
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice },
      csvData: slice,
    });

    render(<StartGate />);
    await analyzePreparedFile();
    // 격자에서는 버튼을 눌러 상세를 연 뒤 그 안의 실행 링크를 누른다 — 목록이
    // 세로로 길어 도구 이름이 늘 보이던 시절의 한 단계 클릭과 다르다.
    const chipFor = (toolId) => [...document.querySelectorAll(".tool-index__chip")]
      .find((button) => button.querySelector(".tool-index__q")?.textContent === questionOf(toolId));
    // 여는 것은 멱등이어야 한다 — waitFor가 콜백을 여러 번 돌리므로 매번 토글하면
    // 짝수 번째에 도로 닫힌다.
    const openTool = (toolId) => {
      const chip = chipFor(toolId);
      if (chip.getAttribute("aria-expanded") !== "true") fireEvent.click(chip);
      return chip;
    };
    // 상세는 한 번에 하나만 열린다 — 연 뒤의 유일한 실행 링크가 그 도구의 것이다.
    const pickTool = (toolId) => {
      openTool(toolId);
      const links = [...document.querySelectorAll(".tool-index__panel button")].filter(button => button.textContent.includes("추가 차트·상세 분석 열기"));
      expect(links).toHaveLength(1);
      return links[0];
    };

    // 5-2는 이 파일로 되는 분석이므로 위쪽 묶음에 있어야 한다.
    await waitFor(() => expect(chipFor("5-2").closest(".tool-index__stage").classList.contains("tool-index__stage--ready")).toBe(true));
    fireEvent.click(pickTool("5-2"));
    await waitFor(() => expect(useAppStore.getState().isGroupAnalyzed("5-2")).toBe(true));
    act(() => useAppStore.getState().setCurrentRouteId("5-2"));
    expect(useAppStore.getState().isGroupAnalyzed("5-2")).toBe(true);
  });

  it("uses one parsed input for detailed-tool handoff and keeps incompatible tools gated", async () => {
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

    let startView = render(<StartGate />);
    await analyzePreparedFile();

    expect(screen.getByRole("heading", { name: "데이터로 가능한 분석" })).toBeTruthy();
    expect(document.querySelector(".data-journey")).toBeNull();
    expect(screen.queryByText(/필수 컬럼이 매핑되지 않았습니다/)).toBeNull();
    expect(document.querySelector(".csv-mapping-block")).toBeTruthy();

    // 인덱스에서 도구를 고르면 올린 CSV가 그 도구용으로 다시 매핑돼 따라가야 한다.
    // 평범한 링크 이동이 되면 도구가 빈 상태로 열린다.
    // 격자에서는 버튼을 눌러 상세를 연 뒤 그 안의 실행 링크를 누른다 — 목록이
    // 세로로 길어 도구 이름이 늘 보이던 시절의 한 단계 클릭과 다르다.
    const chipFor = (toolId) => [...document.querySelectorAll(".tool-index__chip")]
      .find((button) => button.querySelector(".tool-index__q")?.textContent === questionOf(toolId));
    // 여는 것은 멱등이어야 한다 — waitFor가 콜백을 여러 번 돌리므로 매번 토글하면
    // 짝수 번째에 도로 닫힌다.
    const openTool = (toolId) => {
      const chip = chipFor(toolId);
      if (chip.getAttribute("aria-expanded") !== "true") fireEvent.click(chip);
      return chip;
    };
    // 상세는 한 번에 하나만 열린다 — 연 뒤의 유일한 실행 링크가 그 도구의 것이다.
    const pickTool = (toolId) => {
      openTool(toolId);
      const links = [...document.querySelectorAll(".tool-index__panel button")].filter(button => button.textContent.includes("추가 차트·상세 분석 열기"));
      expect(links).toHaveLength(1);
      return links[0];
    };

    fireEvent.click(pickTool("5-23"));
    await waitFor(() => expect(useAppStore.getState().csvGroups.incrementality.raw).toHaveLength(raw.length));
    startView.unmount();
    // handoff는 대상 그룹에 먼저 쓰고, 실제 페이지 전환이 csvData 미러를 대상
    // 그룹으로 바꾼다. 이 진입 경로까지 밟아야 분석 게이트를 올바르게 검증한다.
    act(() => useAppStore.getState().setCurrentRouteId("5-23"));
    expect(useAppStore.getState().isGroupAnalyzed("5-23")).toBe(false);

    act(() => useAppStore.getState().setCurrentRouteId("start-gate"));
    startView = render(<StartGate />);
    expect(useAppStore.getState().csvData.raw).toHaveLength(raw.length);
    await analyzePreparedFile();
    expect(useAppStore.getState().csvData.raw).toHaveLength(raw.length);
    fireEvent.click(pickTool("5-26"));
    await waitFor(() => expect(useAppStore.getState().csvGroups.asa_keyword.raw).toHaveLength(raw.length));
    act(() => useAppStore.getState().setCurrentRouteId("5-26"));
    expect(useAppStore.getState().csvGroups.asa_keyword.raw).toHaveLength(raw.length);
    expect(useAppStore.getState().csvGroups.asa_keyword.fileName).toContain("channel_spend.csv");
    expect(useAppStore.getState().isGroupAnalyzed("5-26")).toBe(false);

    startView.unmount();
    const { container } = render(<AsaKeywordFinder />);
    expect(screen.getByText(/필수 컬럼이 매핑되지 않았습니다/)).toBeTruthy();
    expect(container.querySelector(".asa-tool__summary-grid")).toBeNull();
    expect(container.querySelector('[data-decision-review-tool="5-26"]')).toBeNull();
  });

  it.each(["ko", "en"])("offers the full methods catalog separately from file preparation (%s)", locale => {
    search = "view=methods";
    render(<StartGate locale={locale} />);
    expect(document.querySelectorAll(".tool-index__chip")).toHaveLength(PUBLISHED_TOOL_IDS.length);
    expect(document.querySelector(".start-upload-panel")).toBeNull();
    fireEvent.click(document.querySelector(".tool-index__chip"));
    expect(document.querySelector(".tool-index__guidance p").textContent.length).toBeGreaterThan(40);
    expect(document.querySelector(`a[href="${locale === "en" ? "/en" : ""}/calculator"]`)).toBeTruthy();
  });
});
