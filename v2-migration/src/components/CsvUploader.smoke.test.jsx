// @vitest-environment jsdom
//
// Render-smoke for CsvUploader. Regression net for a render throw. CsvUploader
// takes a `toolId` prop (Dashboard mounts it with "5-2") and reads csvData +
// TOOL_REQUIRED/OPTIONAL_FIELDS to render the dropzone (no data) or the mapping
// grid + required-columns table (data present). Both branches must mount.
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Papa from "papaparse";
import { useAppStore } from "@/store/useDataStore";
import CsvUploader from "@/components/CsvUploader";

vi.mock("papaparse", () => ({ default: { parse: vi.fn() } }));

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "5-2",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: EMPTY_CSV },
    csvData: EMPTY_CSV,
    analyzedByGroup: {
      ...useAppStore.getState().analyzedByGroup,
      efficiency: null,
    },
    demoDisabled: false,
    csvClearedByGroup: {},
  });
}

// Valid efficiency CSV for 5-2: needs date + one of installs/actions/cost.
// mapping = { originalHeader: standardKey }.
function seedWithData() {
  const headers = ["Date", "Country", "Platform", "Channel", "Spend", "Installs"];
  const mapping = { Date: "date", Country: "country", Platform: "platform", Channel: "channel", Spend: "cost", Installs: "installs" };
  const raw = [];
  for (let d = 1; d <= 10; d++) for (const ch of ["Google", "Meta"]) {
    const cost = ch === "Google" ? 100000 + d * 3000 : 80000 + d * 2500;
    raw.push({ Date: `2026-01-${String(d).padStart(2, "0")}`, Country: "KR", Platform: "iOS", Channel: ch, Spend: cost, Installs: Math.round(cost / (ch === "Google" ? 5000 : 4200)) });
  }
  const slice = { raw, headers, mapping, fileName: "x.csv" };
  useAppStore.setState({ currentRouteId: "5-2", csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice }, csvData: slice });
}

describe("CsvUploader render smoke", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete window.gtag;
    seedNoData();
  });
  it("no-data는 업로드 화면 — 데모를 자동으로 켜지 않는다", () => {
    // 예전에는 진입 즉시 샘플 분석이 떠서 "내 데이터를 올리는 곳"이 가려졌다.
    expect(() => render(<CsvUploader toolId="5-2" />)).not.toThrow();
    expect(document.querySelector(".csv-dropzone")).toBeTruthy();
    expect(document.querySelector(".mapping-grid")).toBeFalsy();
    expect(useAppStore.getState().csvGroups.efficiency.fileName).toBe("");
  });

  it("예시 버튼이 눈에 띄는 자리에 있고 누르면 그때 로드된다", () => {
    render(<CsvUploader toolId="5-2" />);
    const demo = document.querySelector(".csv-entry-actions__demo");
    expect(demo).toBeTruthy();
    fireEvent.click(demo);
    expect(useAppStore.getState().csvGroups.efficiency.fileName).toMatch(/^demo_/);
  });

  it("/start 업로드 화면에는 도구용 예시 버튼을 두지 않는다", () => {
    // 여긴 "내 파일로 시작"이 목적이라 예시 버튼이 목적과 충돌한다.
    render(<CsvUploader toolId="start-gate" />);
    expect(document.querySelector(".csv-entry-actions__demo")).toBeFalsy();
  });
  it("with-data mounts (mapping grid)", () => {
    seedWithData();
    expect(() => render(<CsvUploader toolId="5-2" />)).not.toThrow();
    expect(document.querySelector(".mapping-grid")).toBeTruthy();
    expect(document.querySelector('[data-analysis-status="READY"]')).toBeTruthy();
    expect(document.querySelectorAll("[data-mapping-source]")).toHaveLength(6);
    expect(document.querySelectorAll("[data-mapping-target]")).toHaveLength(6);
    expect(document.querySelectorAll("[data-mapping-status]")).toHaveLength(6);
    expect(document.querySelector("[data-mapping-target]")?.getAttribute("aria-label")).toContain("표준 필드");
    expect(document.querySelector(".csv-preview-table")).toBeTruthy();
    expect(document.querySelector(".csv-guide")).toBeNull();
    expect(document.querySelector(".data-journey")).toBeNull();
    expect(screen.getByText("x.csv")).toBeTruthy();
  });

  it("uses semantic mapping only as a second stage, projected back into the same CSV mapping UI", () => {
    const headers = ["week", "ad_cost", "registrations"];
    const raw = [{ week: "2026-01-05", ad_cost: "100", registrations: "10" }];
    const bindings = [
      { sourceColumn: "week", canonicalKey: "date", role: "TIME", decision: "SUGGEST" },
      { sourceColumn: "ad_cost", canonicalKey: "media_spend", role: "MEDIA", decision: "SUGGEST" },
      { sourceColumn: "registrations", canonicalKey: "outcome_installs", role: "OUTCOME", decision: "SUGGEST" },
    ];
    const slice = {
      raw,
      headers,
      mapping: Object.fromEntries(headers.map((header) => [header, "__ignore__"])),
      mappingBindingsV2: bindings,
      semanticMapping: { bindings, candidatesByHeader: {} },
      fileName: "fallback.csv",
    };
    useAppStore.setState({
      currentRouteId: "start-gate",
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice },
      csvData: slice,
    });
    const needsSemantic = vi.fn();
    const view = render(<CsvUploader
      toolId="start-gate"
      showMappingReview
      mappingReviewStage="legacy"
      mappingReviewActionLabel="결과 열기"
      mappingReviewFallbackLabel="의미 매핑으로 계속"
      onMappingReviewNeedsSemanticFallback={needsSemantic}
      onMappingReviewConfirmed={vi.fn()}
    />);

    expect(document.querySelector(".mapping-grid")).toBeTruthy();
    expect(screen.queryByText("Semantic Mapper V2 미리보기")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "의미 매핑으로 계속" }));
    expect(needsSemantic).toHaveBeenCalledTimes(1);
    expect(useAppStore.getState().csvData.mapping).toMatchObject({ week: "date", ad_cost: "cost", registrations: "installs" });

    const semanticConfirmed = vi.fn();
    view.rerender(<CsvUploader
      toolId="start-gate"
      showMappingReview
      mappingReviewStage="semantic"
      mappingReviewActionLabel="의미 매핑 확정"
      onMappingReviewConfirmed={semanticConfirmed}
    />);
    expect(document.querySelector(".mapping-grid")).toBeTruthy();
    expect(screen.queryByText("Semantic Mapper V2 미리보기")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "의미 매핑 확정" }));
    expect(semanticConfirmed).toHaveBeenCalledTimes(1);
  });

  it("tracks one typed analysis start for repeated confirmation of the same input", () => {
    seedWithData();
    window.gtag = vi.fn();
    render(<CsvUploader toolId="5-2" />);
    const analyze = screen.getByRole("button", { name: "데이터 분석하기" });

    fireEvent.click(analyze);
    fireEvent.click(analyze);

    const starts = window.gtag.mock.calls.filter((call) => call[1] === "analysis_started");
    expect(starts).toEqual([["event", "analysis_started", expect.objectContaining({
      tool_id: "5-2",
      analysis_type: "dashboard",
      row_count: 20,
      locale: "ko",
    })]]);
  });
  it("shows analysis feedback before opening the shared analysis gate", () => {
    seedWithData();
    const frames = [];
    const requestFrame = vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
      frames.push(callback);
      return frames.length;
    });
    const scrollTo = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    render(<CsvUploader toolId="5-2" />);

    fireEvent.click(screen.getByRole("button", { name: "데이터 분석하기" }));
    expect(screen.getByText("분석 중…")).toBeTruthy();
    expect(useAppStore.getState().isGroupAnalyzed("5-2")).toBe(false);

    act(() => frames.shift()());
    expect(useAppStore.getState().isGroupAnalyzed("5-2")).toBe(false);
    act(() => frames.shift()());
    expect(useAppStore.getState().isGroupAnalyzed("5-2")).toBe(true);
    expect(screen.queryByText("분석 중…")).toBeNull();

    requestFrame.mockRestore();
    scrollTo.mockRestore();
  });
  it("keeps one live status node across upload branch transition", () => {
    useAppStore.setState({ demoDisabled: true, csvClearedByGroup: { efficiency: true } });
    const { container } = render(<CsvUploader toolId="5-2" />);
    const statusBefore = container.querySelector('[role="status"]');
    expect(statusBefore).toBeTruthy();
    act(() => seedWithData());
    expect(container.querySelector('[role="status"]')).toBe(statusBefore);
  });

  it("tracks an empty import failure without sending the filename or values", async () => {
    useAppStore.setState({ demoDisabled: true, csvClearedByGroup: { efficiency: true } });
    window.gtag = vi.fn();
    Papa.parse.mockImplementation((_file, options) => options.complete({ data: [], meta: { fields: [] } }));
    const { container } = render(<CsvUploader toolId="5-2" />);
    const file = new File(["secret-value"], "private-client.csv", { type: "text/csv" });

    fireEvent.change(container.querySelector('input[type="file"]'), { target: { files: [file] } });

    await waitFor(() => expect(window.gtag).toHaveBeenCalledWith("event", "data_import_failed", {
      tool_id: "5-2",
      source: "csv",
      state: "empty_file",
      locale: "ko",
    }));
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("private-client.csv");
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("secret-value");
  });

  it("ignores a cancelled worker callback instead of reporting a late failure", async () => {
    useAppStore.setState({ demoDisabled: true, csvClearedByGroup: { efficiency: true } });
    window.gtag = vi.fn();
    let parseOptions;
    Papa.parse.mockImplementation((_file, options) => { parseOptions = options; });
    const { container } = render(<CsvUploader toolId="5-2" />);

    fireEvent.change(container.querySelector('input[type="file"]'), {
      target: { files: [new File(["late-secret"], "cancelled-private.csv", { type: "text/csv" })] },
    });
    fireEvent.click(screen.getByRole("button", { name: "가져오기 취소" }));
    // CSV는 이제 파싱 전 file.arrayBuffer()로 인코딩을 복원하므로 Papa.parse가 마이크로태스크
    // 뒤에 호출된다 — 콜백을 수동 발화하기 전 호출을 기다린다.
    await waitFor(() => expect(Papa.parse).toHaveBeenCalled());
    await act(async () => parseOptions.complete({ data: [], meta: { fields: [] } }));

    expect(window.gtag.mock.calls.filter((call) => call[1] === "data_import_failed")).toHaveLength(0);
    expect(container.querySelector('[role="alert"]')).toBeNull();
  });

  it("tracks a required-field blocker once with aggregate counts only", async () => {
    const slice = {
      raw: [{ SecretColumn: "private-value" }],
      headers: ["SecretColumn"],
      mapping: { SecretColumn: "__ignore__" },
      fileName: "blocked-private.csv",
      importSource: "csv",
    };
    useAppStore.setState({
      currentRouteId: "5-2",
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice },
      csvData: slice,
      demoDisabled: true,
    });
    window.gtag = vi.fn();
    render(<CsvUploader toolId="5-2" />);

    await waitFor(() => expect(window.gtag).toHaveBeenCalledWith("event", "analysis_blocked", expect.objectContaining({
      tool_id: "5-2",
      source: "csv",
      row_count: 1,
      state: "missing_required",
      locale: "ko",
    })));
    expect(window.gtag.mock.calls.filter((call) => call[1] === "analysis_blocked")).toHaveLength(1);
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("blocked-private.csv");
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("SecretColumn");
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain("private-value");
  });
});
