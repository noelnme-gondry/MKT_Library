// @vitest-environment jsdom
//
// Render-smoke for MarketingResponse (5-18, response group). Regression net for
// the CampaignPvm-class crashes: a route component that throws during render or
// a mount effect. Golden tests (src/utils/*.test.js) cover the MMM/regression
// engines; this asserts the component MOUNTS without throwing in the no-data
// and with-data states.
//
// 5-18 uses the DnD colMap (MmmColumnMapper) as the PRIMARY mapper — a single
// generic WIDE CSV (one column per channel spend + a target column) is dragged
// into roles, then "분석하기" gates the analysis. autoGuessColMap seeds roles by
// name (week→week, Regs→reg, *_spend→channel). Channels must vary INDEPENDENTLY
// so the OLS panel is non-singular. Deterministic — NO Math.random (harness §3).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import Papa from "papaparse";
import { useAppStore } from "@/store/useDataStore";
import MarketingResponse, {
  MMM_EXPERIMENT_GEO_LONG_TEMPLATE_CSV,
  MMM_EXPERIMENT_GEO_WIDE_TEMPLATE_CSV,
  MMM_EXPERIMENT_ONOFF_TEMPLATE_CSV,
  MMM_TEMPLATE_CSV,
  buildForecastCsv,
  buildForecastAssistInsight,
  forecastDownloadTitle,
  forecastHorizonDraftState,
  forecastWorkerConfigDto,
  mergeForecastSelectionCache,
  forecastIntervalContract,
  forecastPlatformRouteGuard,
  selectForecastProductionRoute,
  buildForecastProductionModel,
  forecastCandidateSearchProvenance,
  forecastRegimeInputChanged,
  forecastRegimeStateForInput,
  safeForecastRegimeScan,
  forecastPct,
  forecastOrganicTargetValues,
  hasForecastSpendHistory,
  hasPaidRegistrationTargets,
  buildForecastOnlyModelFromPanel,
  buildForecastRecentBacktest,
  calendarizeForecastPanel,
  certifyForecastBacktest,
  combinePaidOrganicForecastParts,
  combinePaidOrganicPlatforms,
  sliceForecastTrainingWindow,
  scanAnnualForecastRegimeWindows,
  scanForecastRegimeWindows,
  mmmDerivedTrafficValue,
  mmmComposeEvidenceTarget,
  mmmAnalysisGateOpen,
  mmmCsvParseFailure,
  mmmCsvSourceChanged,
  mmmDetectTargetCountry,
  mmmEvidenceNumber,
  mmmEvidencePlatformSlice,
  mmmEvidenceSpendHeaders,
  mmmEvidenceTreatmentContrast,
  mmmHealthFlagMessage,
  mmmFindEvidenceTimeHeader,
  mmmFindEvidencePeriodHeader,
  mmmFindExperimentBinaryHeader,
  mmmIsEvidenceSpendHeader,
  mmmIsEvidenceTimeHeader,
  mmmNormalizeExperimentLongMedia,
  mmmNormalizeGeoWideEvidence,
  mmmResolveExperimentType,
  mmmSumOsForecasts,
  mmmTargetHeader,
  paidOrganicHaloBudgets,
  reconcileForecastScenarioAudit,
  scheduleChartResize,
  BADGE_TONE,
  trimToActive,
} from "@/components/tools/MarketingResponse";
import { autoGuessColMap, buildPanelFromColMap } from "@/components/tools/MmmColumnMapper";
import { MMM_METH_CONFIG, mmmResolveAbsorb } from "@/utils/mmmMath";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function parseSimpleTemplateCsv(csv) {
  const [headerLine, ...lines] = String(csv).replace(/^\uFEFF/, "").trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  return {
    headers,
    rows: lines.map((line) => Object.fromEntries(headers.map((header, index) => [header, line.split(",")[index]]))),
  };
}

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "5-18",
    csvGroups: { ...useAppStore.getState().csvGroups, response: EMPTY_CSV },
    csvData: EMPTY_CSV,
  });
}

function seedWithData() {
  // WIDE weekly panel: one row per week, independent channel spend columns +
  // Regs target. colMap autoGuess: week→week, Regs→reg, g_spend/m_spend→channel.
  const headers = ["week", "Regs", "g_spend", "m_spend"];
  const raw = [];
  for (let w = 0; w < 16; w++) {
    const gCost = 100000 + (w % 5) * 15000 + (w % 3) * 8000;
    const mCost = 80000 + (w % 4) * 12000 + ((w + 2) % 6) * 6000;
    const regs = Math.round(gCost / 5000 + mCost / 4200);
    raw.push({ week: w + 1, Regs: regs, g_spend: gCost, m_spend: mCost });
  }
  const slice = { raw, headers, mapping: {}, fileName: "response.csv", currency: "USD" };
  useAppStore.setState({
    currentRouteId: "5-18",
    csvGroups: { ...useAppStore.getState().csvGroups, response: slice },
    csvData: slice,
  });
}

function seedWithDatedData() {
  const headers = ["week", "Regs", "g_spend", "m_spend"];
  const raw = Array.from({ length: 16 }, (_, index) => {
    const gCost = 100000 + (index % 5) * 15000 + (index % 3) * 8000;
    const mCost = 80000 + (index % 4) * 12000 + ((index + 2) % 6) * 6000;
    const date = new Date(Date.UTC(2026, 3, 20 + index * 7));
    return {
      week: date.toISOString().slice(0, 10),
      Regs: Math.round(gCost / 5000 + mCost / 4200),
      g_spend: gCost,
      m_spend: mCost,
    };
  });
  const slice = { raw, headers, mapping: {}, fileName: "response_dated.csv", currency: "USD" };
  useAppStore.setState({
    currentRouteId: "5-18",
    csvGroups: { ...useAppStore.getState().csvGroups, response: slice },
    csvData: slice,
  });
  return raw.at(-1);
}

function seedWithOsForecastData() {
  const headers = ["week", "android_regs", "ios_regs", "google_android_cost", "meta_android_cost", "asa_ios_cost", "meta_ios_cost"];
  const raw = Array.from({ length: 56 }, (_, index) => {
    const week = index + 1;
    const googleAndroid = 90000 + (week % 7) * 9000 + (week % 3) * 4000;
    const metaAndroid = 70000 + (week % 5) * 11000 + (week % 4) * 2500;
    const asaIos = 60000 + (week % 6) * 8500 + (week % 4) * 2200;
    const metaIos = 50000 + (week % 5) * 7500 + (week % 3) * 3300;
    return {
      week,
      android_regs: Math.round(3800 + googleAndroid / 38 + metaAndroid / 55 + week * 9),
      ios_regs: Math.round(2600 + asaIos / 42 + metaIos / 58 + week * 7),
      google_android_cost: googleAndroid,
      meta_android_cost: metaAndroid,
      asa_ios_cost: asaIos,
      meta_ios_cost: metaIos,
    };
  });
  const slice = { raw, headers, mapping: {}, fileName: "response_os_forecast.csv", currency: "USD" };
  useAppStore.setState({
    currentRouteId: "5-18",
    csvGroups: { ...useAppStore.getState().csvGroups, response: slice },
    csvData: slice,
  });
}

function seedWithPaidOrganicForecastData() {
  const headers = [
    "week",
    "ANDROID_RR",
    "ANDROID_PAID_RR",
    "IOS_RR",
    "IOS_PAID_RR",
    "GOOGLE_ANDROID_COST",
    "META_ANDROID_COST",
    "ASA_IOS_COST",
    "META_IOS_COST",
  ];
  const raw = Array.from({ length: 134 }, (_, index) => {
    const week = index + 1;
    const googleAndroid = 70000 + (week % 11) * 6000 + (week % 4) * 1700;
    const metaAndroid = 52000 + (week % 7) * 7100 + (week % 5) * 1300;
    const asaIos = 48000 + (week % 9) * 5300 + (week % 4) * 2100;
    const metaIos = 41000 + (week % 8) * 4900 + (week % 3) * 1800;
    const androidPaid = 500 + googleAndroid / 75 + metaAndroid / 92;
    const iosPaid = 420 + asaIos / 82 + metaIos / 98;
    const androidOrganic = 5400 + week * 8 + 420 * Math.sin(week * 2 * Math.PI / 52)
      + googleAndroid / 950 + metaAndroid / 1200;
    const iosOrganic = 4300 + week * 6 + 350 * Math.cos(week * 2 * Math.PI / 52)
      + asaIos / 1050 + metaIos / 1300;
    return {
      week,
      ANDROID_RR: Math.round(androidOrganic + androidPaid),
      ANDROID_PAID_RR: Math.round(androidPaid),
      IOS_RR: Math.round(iosOrganic + iosPaid),
      IOS_PAID_RR: Math.round(iosPaid),
      GOOGLE_ANDROID_COST: googleAndroid,
      META_ANDROID_COST: metaAndroid,
      ASA_IOS_COST: asaIos,
      META_IOS_COST: metaIos,
    };
  });
  const slice = { raw, headers, mapping: {}, fileName: "paid_organic_forecast.csv", currency: "USD" };
  useAppStore.setState({
    currentRouteId: "5-18",
    csvGroups: { ...useAppStore.getState().csvGroups, response: slice },
    csvData: slice,
  });
}

function seedWithOrganicOnlyForecastData() {
  const headers = ["week", "ANDROID_RR", "IOS_RR"];
  const raw = Array.from({ length: 134 }, (_, index) => {
    const week = index + 1;
    return {
      week,
      ANDROID_RR: Math.round(5400 + week * 8 + 420 * Math.sin(week * 2 * Math.PI / 52)),
      IOS_RR: Math.round(4300 + week * 6 + 350 * Math.cos(week * 2 * Math.PI / 52)),
    };
  });
  const slice = { raw, headers, mapping: {}, fileName: "organic_only_forecast.csv", currency: "USD" };
  useAppStore.setState({
    currentRouteId: "5-18",
    csvGroups: { ...useAppStore.getState().csvGroups, response: slice },
    csvData: slice,
  });
}

function seedWithCalendarGap() {
  const headers = ["date", "Regs", "g_spend"];
  const start = Date.UTC(2025, 0, 6);
  const raw = [];
  for (let w = 0; w < 16; w++) {
    const calendarWeek = w >= 8 ? w + 1 : w;
    const date = new Date(start + calendarWeek * 7 * 86400000).toISOString().slice(0, 10);
    raw.push({ date, Regs: 100 + w * 3, g_spend: 50000 + (w % 4) * 8000 });
  }
  const slice = { raw, headers, mapping: {}, fileName: "response_gap.csv", currency: "USD" };
  useAppStore.setState({
    currentRouteId: "5-18",
    csvGroups: { ...useAppStore.getState().csvGroups, response: slice },
    csvData: slice,
  });
}

function seedWithOneInvalidTarget() {
  const headers = ["week", "Regs", "Revenue", "g_spend"];
  const raw = Array.from({ length: 20 }, (_, week) => ({
    week: week + 1,
    Regs: 100 + week * 3,
    Revenue: week === 9 ? "" : 1000000 + week * 25000,
    g_spend: 50000 + (week % 5) * 7000,
  }));
  const slice = { raw, headers, mapping: {}, fileName: "response_multi_y.csv", currency: "USD" };
  useAppStore.setState({
    currentRouteId: "5-18",
    csvGroups: { ...useAppStore.getState().csvGroups, response: slice },
    csvData: slice,
  });
}

function clickByText(container, text) {
  const btn = Array.from(container.querySelectorAll("button")).find((b) =>
    b.textContent.includes(text),
  );
  expect(btn, document.body.textContent).toBeTruthy();
  fireEvent.click(btn);
}
// Default mode is MMM (colMap primary), so the analyze gate shows immediately.
// colMap is auto-seeded on mount → "▶ 분석하기" present.
function enterMmmAndAnalyze(container) {
  clickByText(container, "분석하기");
}
// 분석하기는 로딩 오버레이를 먼저 페인트하려고 더블 rAF로 시그니처 커밋을 미룬다 →
// 결과 검증 전 프레임을 flush해야 함(§7 성능: 큰 데이터 멈춤 방지 디퍼).
async function flushRaf() {
  await act(async () => {
    await new Promise((r) =>
      requestAnimationFrame(() => requestAnimationFrame(() => requestAnimationFrame(r))),
    );
  });
}

describe("MarketingResponse render smoke", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    seedNoData();
  });

  it("cancels a pending chart resize and ignores a detached canvas", () => {
    let callback = null;
    const request = vi.spyOn(window, "requestAnimationFrame").mockImplementation((next) => {
      callback = next;
      return 73;
    });
    const cancel = vi.spyOn(window, "cancelAnimationFrame").mockImplementation(() => undefined);
    const chart = { canvas: document.createElement("canvas"), resize: vi.fn() };

    document.body.appendChild(chart.canvas);
    const cleanup = scheduleChartResize(chart);
    cleanup();

    expect(request).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledWith(73);
    chart.canvas.remove();
    expect(() => callback()).not.toThrow();
    expect(chart.resize).not.toHaveBeenCalled();
  });

  it("uses theme-aware semantic colors for shared MMM status badges", () => {
    expect(BADGE_TONE.ok).toMatchObject({ color: "var(--success)" });
    expect(BADGE_TONE.warn).toMatchObject({ color: "var(--warning)" });
    expect(BADGE_TONE.danger).toMatchObject({ color: "var(--danger)" });
    expect(BADGE_TONE.ok.bg).toContain("var(--success)");
    expect(BADGE_TONE.danger.border).toContain("var(--danger)");
  });

  it("resets MMM mapping when the same-named CSV has a new raw source", () => {
    const firstRaw = [{ week: "2025-01-06", RR: "100" }];
    const secondRaw = [{ week: "2025-01-06", RR: "110" }];
    expect(mmmCsvSourceChanged("same.csv|week,RR", "same.csv|week,RR", firstRaw, secondRaw)).toBe(true);
    expect(mmmCsvSourceChanged("same.csv|week,RR", "same.csv|week,RR", firstRaw, firstRaw)).toBe(false);
    expect(mmmAnalysisGateOpen({
      analyzedSignature: "mapping-a",
      analysisSignature: "mapping-a",
      analyzedRaw: firstRaw,
      currentRaw: secondRaw,
    })).toBe(false);
    expect(mmmAnalysisGateOpen({
      analyzedSignature: "mapping-a",
      analysisSignature: "mapping-a",
      analyzedRaw: firstRaw,
      currentRaw: firstRaw,
    })).toBe(true);
  });

  it("keeps only the latest CSV parse and ignores callbacks after unmount", async () => {
    seedWithData();
    window.gtag = vi.fn();
    const queued = [];
    vi.spyOn(Papa, "parse").mockImplementation((file, options) => {
      queued.push({ file, options });
      return undefined;
    });
    const view = render(<MarketingResponse />);
    const upload = () => view.container.querySelector('input[type="file"][accept=".csv,text/csv"]');
    const fileA = new File(["week,Regs\n1,10"], "a.csv", { type: "text/csv" });
    const fileB = new File(["week,Regs\n1,20"], "b.csv", { type: "text/csv" });

    fireEvent.change(upload(), { target: { files: [fileA] } });
    fireEvent.change(upload(), { target: { files: [fileB] } });
    expect(queued).toHaveLength(2);

    await act(async () => {
      queued[1].options.complete({
        data: [{ week: "1", Regs: "20" }],
        errors: [],
        meta: { fields: ["week", "Regs"] },
      });
    });
    expect(useAppStore.getState().csvData.fileName).toBe("b.csv");

    await act(async () => {
      queued[0].options.complete({
        data: [{ week: "1", Regs: "10" }],
        errors: [],
        meta: { fields: ["week", "Regs"] },
      });
    });
    expect(useAppStore.getState().csvData.fileName).toBe("b.csv");

    const fileC = new File(["week,Regs\n1,\"20"], "broken.csv", { type: "text/csv" });
    fireEvent.change(upload(), { target: { files: [fileC] } });
    await act(async () => {
      queued[2].options.complete({
        data: [{ week: "1", Regs: "20" }],
        errors: [{ type: "Quotes", code: "MissingQuotes", row: 0 }],
        meta: { fields: ["week", "Regs"] },
      });
    });
    expect(useAppStore.getState().csvData.fileName).toBe("b.csv");
    expect(document.body.textContent).toContain("기존 데이터는 유지했습니다");

    const fileD = new File(["week,Regs\n1,30"], "late.csv", { type: "text/csv" });
    fireEvent.change(upload(), { target: { files: [fileD] } });
    view.unmount();
    await act(async () => {
      queued[3].options.complete({
        data: [{ week: "1", Regs: "30" }],
        errors: [],
        meta: { fields: ["week", "Regs"] },
      });
    });
    expect(useAppStore.getState().csvData.fileName).toBe("b.csv");

    const eventCalls = window.gtag.mock.calls.filter(([kind]) => kind === "event");
    expect(eventCalls.filter(([, name]) => name === "data_import_start")).toHaveLength(4);
    expect(eventCalls.filter(([, name]) => name === "data_import_success")).toEqual([
      ["event", "data_import_success", expect.objectContaining({ tool_id: "5-18", source: "csv", row_count: 1, column_count: 2 })],
    ]);
    expect(eventCalls.filter(([, name]) => name === "data_import_failed")).toEqual([
      ["event", "data_import_failed", expect.objectContaining({ tool_id: "5-18", source: "csv", state: "parse_error" })],
    ]);
    expect(JSON.stringify(eventCalls)).not.toMatch(/a\.csv|b\.csv|broken\.csv|late\.csv|Regs|g_spend/);
    delete window.gtag;
  });

  it("classifies only empty or structurally broken CSV parses as failures", () => {
    expect(mmmCsvParseFailure({ data: [], errors: [] })).toBe("empty");
    expect(mmmCsvParseFailure({
      data: [{ week: "1", Regs: "" }],
      errors: [{ type: "FieldMismatch", code: "TooFewFields", row: 0 }],
    })).toBe(null);
    expect(mmmCsvParseFailure({
      data: [{ week: "1", Regs: "10" }],
      errors: [{ type: "Quotes", code: "MissingQuotes", row: 0 }],
    })).toBe("parse");
  });

  it("mounts without throwing in the no-data state", () => {
    const view = render(<MarketingResponse />);
    expect(document.body.querySelector("*")).toBeTruthy();
    const tabs = view.getAllByRole("tab");
    expect(tabs.length).toBeGreaterThanOrEqual(3);
    expect(tabs.filter((tab) => tab.getAttribute("aria-selected") === "true")).toHaveLength(1);
    expect(view.getByRole("tabpanel")).toBeTruthy();
  });

  it("keeps the most recent observations when preparing a current-regime training window", () => {
    const panel = {
      week: [1, 2, 3, 4, 5],
      weekLabel: ["2024-01-01", "2024-01-08", "2024-01-15", "2024-01-22", "2024-01-29"],
      targets: { Regs: [10, 11, 12, 13, 14] },
      channels: [],
      ch: {},
      reach: { media: [1, 2, 3, 4, 5] },
      frequency: { media: [6, 7, 8, 9, 10] },
      external: { market: [100, 200, 300, 400, 500] },
      geo: ["A", "B", "C", "D", "E"],
    };
    expect(sliceForecastTrainingWindow(panel, 3)).toMatchObject({
      week: [3, 4, 5],
      targets: { Regs: [12, 13, 14] },
      reach: { media: [3, 4, 5] },
      frequency: { media: [8, 9, 10] },
      external: { market: [300, 400, 500] },
      geo: ["C", "D", "E"],
    });
    expect(sliceForecastTrainingWindow(panel, 10)).toBe(panel);
  });

  it("does not invent a regime-window recommendation without a forecast source", () => {
    expect(scanForecastRegimeWindows([])).toMatchObject({ available: false, reason: "missing-source", recommended: null });
    expect(scanAnnualForecastRegimeWindows()).toMatchObject({ available: false, reason: "missing-source", recommended: null });
  });

  it("resets a requested regime scan when the CSV or mapping signature changes", () => {
    expect(forecastRegimeInputChanged(null, "csv-a|map-a")).toBe(false);
    expect(forecastRegimeInputChanged("csv-a|map-a", "csv-a|map-a")).toBe(false);
    expect(forecastRegimeInputChanged("csv-a|map-a", "csv-b|map-a")).toBe(true);
    expect(forecastRegimeInputChanged("csv-a|map-a", "csv-a|map-b")).toBe(true);
  });

  it("turns a synchronous regime scan exception into a safe unavailable result", () => {
    expect(safeForecastRegimeScan(() => {
      throw new Error("candidate failed");
    })).toEqual({
      available: false,
      calculationFailed: true,
      reason: "regime-scan-error",
      candidates: [],
      recommended: null,
    });
  });

  it("uses one effective regime wave before and after the passive reset", () => {
    const beforePassiveReset = forecastRegimeStateForInput({
      stateSignature: "target:Regs|platform:all|horizon:13",
      currentSignature: "target:Revenue|platform:all|horizon:13",
      trainingWeeks: 104,
      scanRequested: true,
    });
    const afterPassiveReset = forecastRegimeStateForInput({
      stateSignature: null,
      currentSignature: "target:Revenue|platform:all|horizon:13",
      trainingWeeks: null,
      scanRequested: false,
    });
    expect(beforePassiveReset).toEqual({ trainingWeeks: null, scanRequested: false });
    expect(afterPassiveReset).toEqual(beforePassiveReset);
    expect(forecastRegimeStateForInput({
      stateSignature: "target:Regs|platform:all|horizon:13",
      currentSignature: "target:Regs|platform:all|horizon:13",
      trainingWeeks: 104,
      scanRequested: true,
    })).toEqual({ trainingWeeks: 104, scanRequested: true });
    expect(forecastRegimeStateForInput({
      stateSignature: null,
      currentSignature: "target:Regs|platform:all|horizon:13",
      trainingWeeks: 104,
      scanRequested: true,
    })).toEqual({ trainingWeeks: null, scanRequested: false });
  });

  it("serializes forecast worker config without executable values", () => {
    const dto = forecastWorkerConfigDto({
      absorbed: new Set(["channel_a"]),
      hacAutoLag: () => 4,
      nested: {
        values: [1, 2],
        callback: () => "not cloneable",
      },
    });
    expect(dto).toEqual({
      absorbed: ["channel_a"],
      nested: { values: [1, 2] },
    });
    expect(() => structuredClone(dto)).not.toThrow();
  });

  it("keeps earlier worker results when a later fallback task completes", () => {
    const first = mergeForecastSelectionCache(
      { signature: null, results: {} },
      "csv-a",
      { "direct-total": { enabled: true } },
    );
    const second = mergeForecastSelectionCache(
      first,
      "csv-a",
      { "annual-fallback-total": { selected: { spec: { id: "flat-8" } } } },
    );
    expect(second.results).toHaveProperty("direct-total");
    expect(second.results).toHaveProperty("annual-fallback-total");
    expect(mergeForecastSelectionCache(
      second,
      "csv-b",
      { "direct-total": { enabled: false } },
    ).results).toEqual({ "direct-total": { enabled: false } });
  });

  it("keeps component candidate-search audits in reproducibility provenance", () => {
    const complete = { complete: true, planned: 8, attempted: 8, evaluated: 8, missingAxes: {}, reasons: [] };
    const incomplete = { complete: false, planned: 8, attempted: 24, evaluated: 6, missingAxes: { spec: ["annual"] }, reasons: ["candidate-search-incomplete"] };
    const android = { platform: "android", rollingSelection: { candidateSearchAudit: complete } };
    const ios = { platform: "ios", rollingSelection: { candidateSearchAudit: incomplete } };
    const provenance = forecastCandidateSearchProvenance({
      components: [android, ios],
      platformForecasts: [android, ios],
    });
    expect(provenance).toEqual([
      { scope: "forecast.components[0]", platform: "android", ...complete },
      { scope: "forecast.components[1]", platform: "ios", ...incomplete },
    ]);
  });

  it("includes a 208-week current-regime candidate for annual forecasts when available", () => {
    const length = 220;
    const makePanel = (values) => ({
      week: values.map((_, index) => index + 1),
      weekLabel: values.map((_, index) => `W${index + 1}`),
      ch: {},
      dummy: {},
      targets: { Regs: values },
      steps: {},
    });
    const android = Array(length).fill(200);
    const ios = Array(length).fill(300);
    const result = scanAnnualForecastRegimeWindows({
      totalPanel: makePanel(android.map((value, index) => value + ios[index])),
      androidPanel: makePanel(android),
      iosPanel: makePanel(ios),
      target: "Regs",
      horizon: 12,
    });
    expect(result.candidates.map((candidate) => candidate.trainingWeeks))
      .toEqual([220, 208, 156, 130, 104, 91]);
  });

  it("renders an unavailable annual OS metric without throwing", () => {
    expect(forecastPct(null)).toBe("—");
    expect(forecastPct(undefined, 1)).toBe("—");
    expect(forecastPct(12.345, 1)).toBe("12.3%");
  });

  it("subtracts Paid only for registration counts, not unrelated KPI targets", () => {
    expect(forecastOrganicTargetValues("Regs", [100, 120], [30, 40])).toEqual([70, 80]);
    expect(forecastOrganicTargetValues("Revenue", [100, 120], [30, 40])).toEqual([100, 120]);
    expect(forecastOrganicTargetValues("Traffic", [100, 120], [30, 40])).toEqual([100, 120]);
    const platform = (target) => ({
      target,
      sourcePanel: { targets: { Regs: [100, 120], PaidRegs: [30, 40], Revenue: [500, 600] } },
    });
    expect(hasPaidRegistrationTargets({
      all: platform("Regs"),
      android: platform("Regs"),
      ios: platform("Regs"),
    })).toBe(true);
    expect(hasPaidRegistrationTargets({
      all: platform("Revenue"),
      android: platform("Revenue"),
      ios: platform("Revenue"),
    })).toBe(false);
    expect(hasForecastSpendHistory({
      ch: { android: [0, 0], ios: [0, 0], web: [0, 5] },
    })).toBe(true);
    expect(hasForecastSpendHistory({
      ch: { android: [0, 0], ios: [0, 0], web: [0, 0] },
    })).toBe(false);
  });

  it("uses one normalized platform contract for OS routing and blocks third-platform partial totals", () => {
    expect(forecastPlatformRouteGuard([])).toMatchObject({
      hasAndroid: false,
      hasIos: false,
      hasDisaggregatedPlatformRows: false,
      hasAggregatePlatformRows: false,
    });
    expect(forecastPlatformRouteGuard(["Total"])).toMatchObject({
      hasAndroid: false,
      hasIos: false,
      hasDisaggregatedPlatformRows: false,
      hasAggregatePlatformRows: true,
    });
    expect(forecastPlatformRouteGuard(["Android"])).toMatchObject({
      hasAndroid: true,
      hasIos: false,
      hasDisaggregatedPlatformRows: true,
      hasAggregatePlatformRows: false,
    });
    expect(forecastPlatformRouteGuard(["Android", "iPhone"])).toMatchObject({
      hasAndroid: true,
      hasIos: true,
      hasOnlyAndroidIos: true,
      hasAggregatePlatformRows: false,
    });
    expect(forecastPlatformRouteGuard(["AOS", "IOS", "Web"])).toMatchObject({
      hasAndroid: true,
      hasIos: true,
      hasOnlyAndroidIos: false,
      hasAggregatePlatformRows: false,
    });
    expect(forecastPlatformRouteGuard(["ANDROID", "iOS", "Total"])).toMatchObject({
      hasAndroid: true,
      hasIos: true,
      hasOnlyAndroidIos: true,
      hasAggregatePlatformRows: true,
    });
  });

  it("keeps a third-platform Total on the direct production model", () => {
    const nested = (route, predicted) => {
      const folds = [
        {
          offset: 12,
          actual: [100, 100],
          predicted,
          baselinePredicted: [85, 85],
          wmape: predicted === undefined ? null : predicted.reduce((sum, value) =>
            sum + Math.abs(100 - value), 0) / 200 * 100,
          baselineWmape: 15,
        },
        {
          offset: 0,
          actual: [100, 100],
          predicted,
          baselinePredicted: [85, 85],
          wmape: predicted === undefined ? null : predicted.reduce((sum, value) =>
            sum + Math.abs(100 - value), 0) / 200 * 100,
          baselineWmape: 15,
        },
      ];
      return {
        route,
        horizon: 12,
        folds,
        latest: folds[1],
        ...(route === "android-ios-sum" ? {
          componentMetrics: [
            { component: "android", latestWmape: 3, developmentWmape: 3 },
            { component: "ios", latestWmape: 3, developmentWmape: 3 },
          ],
        } : {}),
      };
    };
    const decision = selectForecastProductionRoute(
      nested("direct-total", [96, 104]),
      nested("android-ios-sum", [100, 100]),
      { horizon: 12, allowOsProduction: false },
    );
    expect(decision).toMatchObject({
      diagnosticProductionRoute: "android-ios-sum",
      productionRoute: "direct-total",
      componentGuardrailRequired: false,
      certified: true,
    });
    expect(decision.candidates.map((candidate) => candidate.route))
      .toEqual(["android-ios-sum", "direct-total"]);

    const direct = {
      platform: "all",
      actual: [1000, 1010],
      predFut: [1020, 1030],
    };
    const result = buildForecastProductionModel(
      direct,
      [{ platform: "android" }, { platform: "ios" }],
      decision,
    );
    expect(result).toMatchObject({
      platform: "all",
      actual: [1000, 1010],
      predFut: [1020, 1030],
      isAdditiveTotal: false,
      isNestedDirect: true,
    });
  });

  it("never lets one good latest fold override an authoritative OOS gate", () => {
    expect(certifyForecastBacktest({
      actual: [100, 100],
      predicted: [95, 105],
      wmape: 5,
      certificationGate: false,
    })).toMatchObject({ reliable: false, certificationThreshold: 10 });
    expect(certifyForecastBacktest({
      actual: [100, 100],
      predicted: [95, 105],
      wmape: 5,
      certificationGate: true,
    })).toMatchObject({ reliable: true, certificationThreshold: 10 });
  });

  it("reuses the selector's sealed outer fold without reserving the horizon twice", () => {
    const actual = Array.from({ length: 13 }, (_, index) => 100 + index);
    const predicted = actual.map((value) => value - 2);
    const backtest = buildForecastRecentBacktest({
      target: "Regs",
      sourcePanel: {
        week: Array.from({ length: 78 }, (_, index) => index + 1),
        weekLabel: Array.from({ length: 78 }, (_, index) => `W${index + 1}`),
      },
      selection: {
        horizon: 13,
        decisionEligible: false,
        decisionReasons: ["naive-baseline-selected"],
        forecastDecisionEligible: true,
        forecastDecisionReasons: [],
        nested: {
          latest: { candidateId: "sealed", window: 26, actual, predicted },
        },
      },
    });
    expect(backtest).toMatchObject({
      validationStartIndex: 0,
      validationHorizon: 13,
      selectionTrainingWeeks: 65,
      selectionWindow: 26,
      certificationGate: true,
    });
    expect(backtest.actual).toEqual(actual);
    expect(backtest.predicted).toEqual(predicted);
  });

  it("uses the hub only to choose an independent analysis after mapping", async () => {
    seedWithData();
    const { container } = render(<MarketingResponse initialStage="hub" />);
    const saveMapping = Array.from(container.querySelectorAll("button")).find((button) => button.textContent.includes("매핑 저장 후 분석 선택"));
    expect(saveMapping).toBeTruthy();
    fireEvent.click(saveMapping);
    await flushRaf();
    const links = Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"));
    expect(links).toContain("/tools/marketing-trend");
    expect(links).toContain("/tools/cannibalization-diagnosis");
    expect(links).toContain("/tools/mmm-contribution");
    expect(links).toContain("/tools/marketing-forecast");
  });

  it("summarizes the loaded forecast result into a concrete hold/action recommendation", () => {
    const insight = buildForecastAssistInsight({
      isAdditiveTotal: true,
      predFut: Array(12).fill(100),
      components: [
        { platform: "android", rollingSelection: { decisionEligible: true, selected: { window: 78 } } },
        { platform: "ios", rollingSelection: { decisionEligible: true, selected: { window: 26 } } },
      ],
    }, { wmape: 18.42, conditionalWmape: 1.11 }, { eligible: false });
    expect(insight.titleKo).toContain("미인증");
    expect(insight.summaryKo).toContain("18.42%");
    expect(insight.summaryKo).not.toContain("1.11%");
    expect(insight.summaryKo).toContain("android 78주");
    expect(insight.actionsKo.join(" ")).toContain("예산 증감");
    expect(insight.actionsEn.join(" ")).toContain("Cost scenarios locked");
  });

  it("does not certify an annual fallback from the latest window alone", () => {
    const insight = buildForecastAssistInsight({
      isAnnualAnalog: true,
      annualQualified: false,
      annualComponentGuardrailRequired: false,
      annualOsGuardrail: [
        { component: "android", developmentWmape: 18, latestWmape: 7, passed: false },
      ],
      selectedRoute: "direct-total",
      predFut: Array(12).fill(100),
      rollingSelection: { selected: { wmape: 24.51 } },
    }, { wmape: 6.44 }, { eligible: false });
    expect(insight.titleKo).toContain("미인증");
    expect(insight.summaryKo).toContain("6.44%");
    expect(insight.summaryKo).toContain("24.51%");
    expect(insight.summaryKo).toContain("예산 변경 잠금");
  });

  it("defines Total forecast as the exact weekly sum of Android and iOS forecasts", () => {
    const android = {
      actual: [100, 120, 140], fittedHist: [98, 121, 139], predFut: [150, 160], baselineFut: [110, 115], lo: [130, 140], hi: [170, 180],
      histLabels: ["W1", "W2", "W3"], futLabels: ["W4", "W5"], chans: [{ key: "android_cost" }], recentMean: { android_cost: 10 }, futSpendByKey: { android_cost: [10, 10] },
    };
    const ios = {
      actual: [40, 50, 60], fittedHist: [42, 48, 61], predFut: [70, 80], baselineFut: [55, 60], lo: [60, 70], hi: [80, 90],
      histLabels: ["W1", "W2", "W3"], futLabels: ["W4", "W5"], chans: [{ key: "ios_cost" }], recentMean: { ios_cost: 20 }, futSpendByKey: { ios_cost: [20, 20] },
    };
    expect(mmmSumOsForecasts([android, ios])).toMatchObject({
      isAdditiveTotal: true,
      actual: [140, 170, 200],
      fittedHist: [140, 169, 200],
      predFut: [220, 240],
      baselineFut: [165, 175],
      lo: [190, 210],
      hi: [250, 270],
      futLabels: ["W4", "W5"],
    });
  });

  it("exports Empirical-Bayes forecast as live spend → adstock → Hill formulas", () => {
    const model = (platform, offset = 0) => ({
      platform,
      target: "Regs",
      formulaCapability: "exact",
      names: ["trend", `media_${platform}_cost`],
      beta: [2, 8],
      intercept: 100,
      featureMeans: [1, 0.5],
      featureScales: [1, 0.25],
      rawFeatureHistory: [[0, 0.4], [1, 0.5]],
      futureRawFeatures: [[2, 0.6]],
      params: { [`${platform}_cost`]: { alpha: 0.4, ec: 100, slope: 1.2 } },
      chans: [{ key: `${platform}_cost`, label: `${platform}_cost` }],
      histSpendByKey: { [`${platform}_cost`]: [100, 120] },
      futSpendByKey: { [`${platform}_cost`]: [140] },
      histLabels: ["=1+1", "W2"], futLabels: ["W3"], actual: [100 + offset, 110 + offset],
      historyOffset: [0, 0], futureOffset: [0], futureMargins: [12],
    });
    const lines = buildForecastCsv({
      isBayesian: true,
      isAdditiveTotal: true,
      model: "android-ios-additive",
      excelModels: [model("android"), model("ios", 20)],
    }, "Regs", "ko", "USD", "USD");
    const csv = lines.join("\n");
    expect(csv).toContain("adstock_android_cost");
    expect(csv).toContain("hill_android_cost");
    expect(csv).toContain("ln1p_adstock_android_cost_audit");
    expect(csv).toContain("Total = Android + iOS");
    expect(csv).toContain("^$D$");
    expect(csv).toContain("fitted_or_forecast_live,organic_predicted_live,performance_predicted_live,lower_live,upper_live");
    expect(csv).toContain("prediction_total_live,organic_total_live,performance_total_live,lower_total_live,upper_total_live");
    expect(csv).toContain("1,'=1+1,history");
    expect(csv).not.toContain("1,=1+1,history");
    expect(csv).toMatch(/=E\d+-G\d+/);
    expect(csv).toMatch(/=MAX\(0,\$B\$/);
  });

  it("exports one editable Cost source that drives Organic halo, Paid levels, OS totals, and Total", () => {
    const component = (platform, componentType, offset = 0) => {
      const isOrganic = componentType === "organic";
      const perfKey = isOrganic ? "performance_total" : `${platform}_perf`;
      const brandKey = isOrganic ? "branding_total" : `${platform}_brand`;
      return {
        platform,
        componentType,
        formulaCapability: "exact",
        target: isOrganic ? "OrganicRegs" : "PaidRegs",
        names: ["trend", `media_${perfKey}`, `media_${brandKey}`],
        beta: [2, 8, 3],
        intercept: 100,
        featureMeans: [1, 0.5, 0.25],
        featureScales: [1, 0.25, 0.2],
        rawFeatureHistory: [[0, 0.4, 0.2], [1, 0.5, 0.25]],
        futureRawFeatures: [[2, 0.6, 0.3]],
        params: {
          [perfKey]: { alpha: 0.4, ec: 100, slope: 1.2, family: "hill" },
          [brandKey]: { alpha: 0.2, ec: 50, slope: 1, family: "log1p" },
        },
        chans: [
          { key: perfKey, label: perfKey, kind: "perf" },
          { key: brandKey, label: brandKey, kind: "brand" },
        ],
        aggregateMediaGroups: isOrganic ? [
          { key: "performance_total", members: [`${platform}_perf`] },
          { key: "branding_total", members: [`${platform}_brand`] },
        ] : [],
        spendRanges: {
          [perfKey]: { min: isOrganic ? 0 : 50, max: isOrganic ? 500 : 200 },
          [brandKey]: { min: 0, max: isOrganic ? 200 : 100 },
        },
        histSpendByKey: {
          [perfKey]: [100, 120],
          [brandKey]: [30, 35],
        },
        futSpendByKey: {
          [perfKey]: [140],
          [brandKey]: [40],
        },
        requestedFutSpendByKey: {
          [perfKey]: [140],
          [brandKey]: [40],
        },
        histLabels: ["W1", "W2"],
        futLabels: ["W3"],
        actual: [100 + offset, 110 + offset],
        historyOffset: [0, 0],
        futureOffset: [0],
        futureMargins: [12],
      };
    };
    const forecast = {
      isBayesian: true,
      isPaidOrganicSplit: true,
      isAdditiveTotal: true,
      model: "android-ios-organic-paid-spend-split",
      excelModels: [
        component("android", "organic"),
        component("android", "paid", 20),
        component("ios", "organic", 40),
        component("ios", "paid", 60),
      ],
    };
    const lines = buildForecastCsv(forecast, "Regs", "ko", "USD", "USD");
    const csv = lines.join("\n");
    const enCsv = buildForecastCsv(forecast, "Regs", "en", "USD", "USD").join("\n");
    const lockedCsv = buildForecastCsv({
      ...forecast,
      exportScenarioGate: { eligible: false, reasons: ["identification-failed"] },
    }, "Regs", "ko", "USD", "USD").join("\n");
    const androidCostIndex = lines.findIndex((line) =>
      line.startsWith("W3,forecast_cost_input,140.0000000000,40.0000000000"));
    expect(androidCostIndex).toBeGreaterThan(0);
    const androidCostRow = androidCostIndex + 1;
    const androidOrganicModelIndex = lines.findIndex((line) =>
      line.includes("# 모델,android · OrganicRegs"));
    const androidOrganicFuture = lines
      .slice(androidOrganicModelIndex)
      .find((line) => line.startsWith("3,W3,forecast"));
    expect(androidOrganicFuture).toBeTruthy();
    expect(csv).toContain("android 미래 Cost 입력 — 이 표만 수정");
    expect(csv).toContain("ios 미래 Cost 입력 — 이 표만 수정");
    expect(csv).toContain("android · OrganicRegs · Organic 기저 + Spend 연관 halo");
    expect(csv).toContain("android · PaidRegs · Cost 조건부 Paid 예측 수준");
    expect(csv).toContain("organic_baseline_live,organic_spend_halo_live");
    expect(csv).toContain("paid_predicted_level_live");
    expect(csv).toContain("Total = Android + iOS");
    expect(csv).toContain(`MAX(0,$C$${androidCostRow})`);
    expect(csv).toContain(`$C$${androidCostRow}-140.0000000000`);
    expect(csv).toContain(`$D$${androidCostRow}-40.0000000000`);
    expect((androidOrganicFuture.match(/\(\(0-\$C\$/g) || [])).toHaveLength(2);
    expect(androidOrganicFuture).toMatch(/=E\d+-F\d+/);
    expect(csv).toMatch(/=G\d+\+H\d+/);
    expect(csv).toMatch(/=G\d+-E\d+/);
    expect(csv).toContain("observed_spend_min_USD,observed_spend_max_USD");
    expect(enCsv).toContain("future Cost inputs — edit this table only");
    expect(enCsv).toContain("Organic baseline + spend-associated halo");
    expect(enCsv).toContain("Paid predicted level");
    expect(csv).toContain("Cost 수정 후 참고범위");
    expect(lockedCsv).toContain("잠김 · 운영 판단에 사용 금지");
    expect(lockedCsv).toContain("identification-failed");
    expect(forecastDownloadTitle({
      isPaidOrganicSplit: true,
      excelModels: [
        { platform: "android", target: "OrganicRegs", names: ["trend"], formulaCapability: "exact" },
        { platform: "android", target: "PaidRegs", names: ["trend"], formulaCapability: "exact" },
      ],
    }, "en")).toContain("editing Cost by OS");
  });

  it("falls back honestly when a Paid/Organic model graph cannot be reproduced by CSV formulas", () => {
    const csv = buildForecastCsv({
      isBayesian: true,
      isPaidOrganicSplit: true,
      excelModels: [{
        platform: "android",
        target: "OrganicRegs",
        names: ["trend"],
        formulaCapability: "snapshot",
      }],
      actual: [100],
      fittedHist: [98],
      organicHist: [80],
      performanceHist: [18],
      histLabels: ["=1+1"],
      predFut: [110],
      organicBaseFut: [82],
      organicHaloFut: [3],
      organicFut: [85],
      performanceFut: [25],
      lo: [100],
      hi: [120],
      futLabels: ["@SUM(1)"],
      platformForecasts: [],
    }, "Regs", "en", "USD", "USD").join("\n");
    expect(csv).toContain("Organic baseline + spend halo + Paid spend regression");
    expect(csv).toContain("Total,'@SUM(1),forecast,,110,82,3,85,25,100,120");
    expect(csv).toContain("Total,'=1+1,history");
    expect(csv).not.toContain("future Cost inputs");
    expect(forecastDownloadTitle({
      isPaidOrganicSplit: true,
      excelModels: [{ names: ["trend"], formulaCapability: "snapshot" }],
    }, "en")).toContain("Fixed snapshot");
  });

  it("exports the selected regression-naive blend without overstating spend response", () => {
    const model = {
      platform: "android",
      target: "Regs",
      formulaCapability: "exact",
      names: ["trend", "media_android_cost"],
      beta: [2, 8],
      intercept: 100,
      featureMeans: [1, 0.5],
      featureScales: [1, 0.25],
      rawFeatureHistory: [[0, 0.4], [1, 0.5]],
      futureRawFeatures: [[2, 0.6]],
      params: { android_cost: { alpha: 0.4, ec: 100, slope: 1.2 } },
      chans: [{ key: "android_cost", label: "android_cost", kind: "perf" }],
      histSpendByKey: { android_cost: [100, 120] },
      futSpendByKey: { android_cost: [140] },
      histLabels: ["W1", "W2"],
      futLabels: ["W3"],
      actual: [100, 110],
      historyOffset: [0, 0],
      futureOffset: [0],
      futureMargins: [12],
      selectedBlend: { baselineId: "recent-mean-8", regressionWeight: 0.5 },
      blendApplied: true,
      blendBaselineFut: [123],
    };
    const csv = buildForecastCsv({
      isBayesian: true,
      excelModels: [model],
    }, "Regs", "ko", "USD", "USD").join("\n");
    expect(csv).toContain("회귀 50% + recent-mean-8 50%");
    expect(csv).toMatch(/=MAX\(0,0\.5000000000\*\(MAX\(0,\$B\$\d+.*\)\)\+0\.5000000000\*123\.0000000000\)/);
    expect(csv).toMatch(/=MAX\(0,0\.5000000000\*\(\$B\$/);
  });

  it("exports structural forecasts with adjacent absolute Organic and Performance columns", () => {
    const lines = buildForecastCsv({
      isStructural: true,
      structuralEligible: true,
      structuralRoute: "direct-total",
      structuralThreshold: 10,
      actual: [100],
      fittedHist: [98],
      organicHist: [80],
      performanceHist: [18],
      histLabels: ["W1"],
      predFut: [110],
      organicFut: [85],
      performanceFut: [25],
      lo: [100],
      hi: [120],
      futLabels: ["W2"],
    }, "Regs", "ko");
    const csv = lines.join("\n");
    expect(csv).toContain("fitted_or_forecast_live,Organic Predicted,Perf Predicted,lower_live,upper_live");
    expect(csv).toContain("W1,history,100,=E14+F14,80,18");
    expect(csv).toContain("W2,forecast,,=E15+F15,85,25,100,120");
  });

  it("labels aggregate calibration separately from summed component envelopes", () => {
    expect(forecastIntervalContract({
      horizon: 2,
      rollingSelection: {
        nested: {
          intervalCalibrationEligible: true,
          intervalCalibrationMinFolds: 8,
          developmentFolds: Array(8).fill({}),
        },
        productionSelected: { selectionFolds: 8, blendMargins: [2, 3] },
      },
    })).toMatchObject({ kind: "aggregate-oos-envelope", observedFolds: 8 });
    const component = {
      rollingSelection: {
        nested: {
          intervalCalibrationEligible: true,
          intervalCalibrationMinFolds: 8,
          developmentFolds: Array(8).fill({}),
        },
        productionSelected: { selectionFolds: 8, blendMargins: [2, 3] },
      },
    };
    expect(forecastIntervalContract({
      isAdditiveTotal: true,
      horizon: 2,
      components: [component, component],
    })).toMatchObject({ kind: "component-oos-envelope", observedFolds: 8 });
  });

  it("labels structural and annual bounds as point forecasts plus outer-OOS P90 errors", () => {
    expect(forecastIntervalContract({
      isStructural: true,
      intervalCalibrationEligible: true,
      intervalObservedOuterFolds: 9,
      intervalCalibrationMinFolds: 8,
    })).toMatchObject({
      kind: "point-plus-outer-oos-p90",
      method: "point-forecast-plus-nested-outer-oos-p90-absolute-error",
      observedFolds: 9,
    });
    expect(forecastIntervalContract({
      isAnnualAnalog: true,
      intervalCalibrationEligible: true,
      intervalCalibrationFoldCount: 8,
      intervalCalibrationMinFolds: 8,
    })).toMatchObject({
      kind: "point-plus-outer-oos-p90",
      method: "point-forecast-plus-nested-outer-oos-p90-absolute-error",
      observedFolds: 8,
    });
    expect(forecastIntervalContract({
      isStructural: true,
      intervalCalibrationEligible: true,
      intervalObservedOuterFolds: 7,
      intervalCalibrationMinFolds: 8,
    })).toMatchObject({ kind: "point", observedFolds: 7 });
  });

  it("keeps exact gate reasons and adds latest-audit-failed only for an actual threshold breach", () => {
    expect(reconcileForecastScenarioAudit(
      { eligible: true, reasons: [] },
      {
        reliable: false,
        wmape: 5,
        certificationGate: false,
        decisionReasons: ["development-oos-above-threshold"],
      },
    )).toEqual({
      eligible: false,
      reasons: ["development-oos-above-threshold"],
    });
    expect(reconcileForecastScenarioAudit(
      { eligible: true, reasons: ["does-not-beat-best-naive"] },
      { reliable: false, wmape: 12, certificationThreshold: 10 },
    )).toEqual({
      eligible: false,
      reasons: ["does-not-beat-best-naive", "latest-audit-failed"],
    });
  });

  it("normalizes horizon drafts before deciding whether recalculation is needed", () => {
    expect(forecastHorizonDraftState("13", 13)).toMatchObject({ horizon: 13, normalized: "13", dirty: false });
    expect(forecastHorizonDraftState("013", 13)).toMatchObject({ horizon: 13, normalized: "13", dirty: true });
    expect(forecastHorizonDraftState("99", 52)).toMatchObject({ horizon: 52, normalized: "52", dirty: true });
  });

  it("describes annual downloads as fixed snapshots and generic formulas by selected transforms", () => {
    expect(forecastDownloadTitle({ isAnnualAnalog: true }, "ko")).toContain("고정 스냅샷");
    expect(forecastDownloadTitle({ isAnnualAnalog: true }, "en")).toContain("Fixed snapshot");
    const genericTitle = forecastDownloadTitle({
      isBayesian: true,
      excelModels: [{ names: ["trend"], formulaCapability: "exact" }],
    }, "en");
    expect(genericTitle).toContain("selected adstock, media transform");
    expect(genericTitle).not.toContain("Hill transforms");
    expect(forecastDownloadTitle({
      isBayesian: true,
      excelModels: [{ names: ["trend"], formulaCapability: "snapshot" }],
    }, "en")).toContain("fixed snapshot");
  });

  it("uses the same interval contract and provenance in Bayesian fixed-snapshot exports", () => {
    const forecast = {
      isBayesian: true,
      excelModels: [],
      model: "profile-snapshot",
      r2: 0.8,
      intervalLabel: "legacy conflicting label",
      horizon: 2,
      rollingSelection: {
        nested: {
          intervalCalibrationEligible: true,
          intervalCalibrationMinFolds: 8,
          developmentFolds: Array(8).fill({}),
        },
        productionSelected: { selectionFolds: 8, blendMargins: [3, 4] },
      },
      labels: ["W1"],
      actual: [100],
      fittedHist: [98],
      predFut: [105, 110],
      futLabels: ["W2", "W3"],
      lo: [100, 104],
      hi: [110, 116],
      chans: [],
    };
    const contract = forecastIntervalContract(forecast);
    const csv = buildForecastCsv(forecast, "Regs", "ko", "USD", "USD").join("\n");
    expect(csv).toContain(`# 예측 범위,${contract.method}`);
    expect(csv).toContain("# 구간 출처");
    expect(csv).toContain("nested 바깥 OOS 8회");
    expect(csv).not.toContain("legacy conflicting label");
  });

  it("exports uncertified annual fallback totals without inventing Paid/Organic parts", () => {
    const lines = buildForecastCsv({
      isAnnualAnalog: true,
      annualQualified: false,
      annualComponentGuardrailRequired: false,
      annualOsGuardrail: [
        { component: "android", developmentWmape: 18, latestWmape: 7, passed: false },
      ],
      selectedRoute: "direct-total",
      rollingSelection: { selected: { latestWmape: 6.44, wmape: 24.51 } },
      adaptiveModelSearch: true,
      modelSearch: {
        maxTrainingWeeks: 104,
        blendWeights: [0, 0.5, 1],
        routeDecision: {
          candidatesCompared: 8,
          candidatesEvaluated: 10,
          scoreGap: 1.25,
          winner: {
            overallWmape: 17.8,
            recentWmape: 8.1,
            tailRiskWmape: 24.2,
            instabilityWmape: 5.4,
            ranks: { overall: 1, recent: 2, tailRisk: 1, instability: 3 },
            reasonCodes: ["overall", "tailRisk"],
          },
          guardrail: {
            enabled: true,
            fallbackUsed: false,
            rejectedCount: 2,
            rejectedByReason: {
              "overall-worse-than-baseline": 1,
              "recent-worse-than-baseline": 2,
            },
          },
        },
      },
      actual: [100],
      fittedHist: [98],
      histLabels: ["W1"],
      predFut: [110],
      lo: [90],
      hi: [130],
      futLabels: ["W2"],
    }, "Regs", "ko");
    const csv = lines.join("\n");
    expect(csv).toContain("미인증 best-available");
    expect(csv).toContain("# OS 진단(인증 비적용)");
    expect(csv).toContain("fitted_or_forecast_live,Organic Predicted,Perf Predicted,lower_live,upper_live");
    expect(csv).toContain("W2,best_available_uncertified,,110,,,90,130");
    expect(csv).toContain("Paid/Organic 실측이 없어");
    expect(csv).toContain("# 선정 이유");
    expect(csv).toContain("전체 OOS 17.80%(#1)");
    expect(csv).toContain("2위보다 1.25p 낮았습니다");
    expect(csv).toContain("성과가 악화된 후보 2개를 자동 제외");
    expect(csv).toContain("전체 OOS 악화 1");
    expect(csv).toContain("최근 OOS 악화 2");
    expect(csv).toContain("후보로 비교했으나 현재 데이터에서는 다른 모델이 우세");
  });

  it("exports annual Paid/Organic history and future parts in their declared columns", () => {
    const csv = buildForecastCsv({
      isAnnualAnalog: true,
      annualQualified: true,
      paidOrganicHybrid: true,
      selectedRoute: "android-ios-sum",
      rollingSelection: {
        selected: { latestWmape: 5, wmape: 6 },
        productionSelected: { latestWmape: 5, wmape: 6 },
      },
      annualOsGuardrail: [],
      actual: [100],
      fittedHist: [98],
      organicHist: [70],
      performanceHist: [28],
      histLabels: ["W1"],
      predFut: [110],
      organicFut: [75],
      performanceFut: [35],
      lo: [95],
      hi: [125],
      futLabels: ["W2"],
    }, "Regs", "en").join("\n");
    expect(csv).toContain("W1,history,100,98,70,28,,");
    expect(csv).toContain("W2,forecast,,110,75,35,95,125");
  });

  it("parses formatted experiment values before deriving traffic", () => {
    expect(mmmEvidenceNumber("2,488")).toBe(2488);
    expect(mmmEvidenceNumber("₩ 1,250.5")).toBe(1250.5);
    expect(mmmEvidenceNumber("1e6")).toBe(1_000_000);
    expect(mmmEvidenceNumber("1.2E+06")).toBe(1_200_000);
    expect(Number.isNaN(mmmEvidenceNumber(""))).toBe(true);
    expect(mmmDerivedTrafficValue("1,200", "300")).toBe(1500);
    expect(Number.isNaN(mmmDerivedTrafficValue("1,200", ""))).toBe(true);
  });

  it("does not mistake spend for Y and isolates one treated channel in a wide experiment", () => {
    expect(mmmTargetHeader(["revenue_spend", "revenue"], "Revenue")).toBe("revenue");
    expect(mmmTargetHeader(["signup_cost", "registrations"], "Regs")).toBe("registrations");
    const rows = [
      { state: "off", meta_spend: 0, google_spend: 100 },
      { state: "off", meta_spend: 0, google_spend: 100 },
      { state: "on", meta_spend: 120, google_spend: 102 },
      { state: "on", meta_spend: 140, google_spend: 98 },
    ];
    expect(mmmEvidenceTreatmentContrast(rows, "meta_spend", { stateHeader: "state" })).toMatchObject({
      design: "on-off",
      isChanged: true,
    });
    expect(mmmEvidenceTreatmentContrast(rows, "google_spend", { stateHeader: "state" })).toMatchObject({
      isChanged: false,
    });
    expect(mmmEvidenceTreatmentContrast(rows.map(({ meta_spend, google_spend }) => ({ meta_spend, google_spend })), "meta_spend")).toMatchObject({
      design: "spend-zero-inferred-on-off",
      isChanged: true,
    });
  });

  it("keeps experiment priors on the selected platform grain", () => {
    const wideHeaders = ["week", "registrations_android", "registrations_ios", "meta_spend_android", "meta_spend_ios"];
    expect(mmmTargetHeader(wideHeaders, "Regs", { platform: "ios", allowCommon: false })).toBe("registrations_ios");
    expect(mmmTargetHeader(["week", "registrations_android"], "Regs", { platform: "ios", allowCommon: false })).toBeNull();

    const rows = [
      { week: 1, platform: "Android", registrations: 100, reactivations: 20 },
      { week: 1, platform: "iOS", registrations: 40, reactivations: 0 },
    ];
    const selected = mmmEvidencePlatformSlice(["week", "platform", "registrations"], rows, "ios");
    expect(selected.platformHeader).toBe("platform");
    expect(selected.requireTaggedTarget).toBe(false);
    expect(selected.rows).toEqual([rows[1]]);
    expect(mmmTargetHeader(["week", "platform", "registrations"], "Regs", { platform: "ios", allowCommon: true })).toBe("registrations");

    const iosTraffic = mmmComposeEvidenceTarget(selected.rows, ["registrations", "reactivations"], "__traffic");
    expect(iosTraffic.rows[0].__traffic).toBe(40);

    const nonLatin = mmmEvidencePlatformSlice(
      ["week", "segment", "registrations"],
      [
        { week: 1, segment: "日本", registrations: 30 },
        { week: 1, segment: "台湾", registrations: 20 },
      ],
      "台湾",
    );
    expect(nonLatin.rows).toEqual([{ week: 1, segment: "台湾", registrations: 20 }]);
  });

  it("composes Total evidence from every mapped platform Y without filling missing values", () => {
    const rows = [
      { registrations_android: "100", registrations_ios: "40" },
      { registrations_android: "120", registrations_ios: "" },
    ];
    const total = mmmComposeEvidenceTarget(rows, ["registrations_android", "registrations_ios"], "__total_regs");
    expect(total.targetHeader).toBe("__total_regs");
    expect(total.rows[0].__total_regs).toBe(140);
    expect(Number.isNaN(total.rows[1].__total_regs)).toBe(true);
  });

  it("detects one target market with case/trim normalization and localizes health flags", () => {
    expect(mmmDetectTargetCountry(["country"], [{ country: " KR " }, { country: "kr" }])).toMatchObject({
      status: "single",
      value: "KR",
      normalized: "kr",
    });
    expect(mmmDetectTargetCountry(["market"], [{ market: "KR" }, { market: "JP" }]).status).toBe("ambiguous");
    expect(mmmDetectTargetCountry(["country"], [{ country: "KR" }, { country: "" }])).toMatchObject({
      status: "incomplete",
      blankRows: 1,
    });
    expect(mmmHealthFlagMessage("priorScale", "ko")).toContain("수렴하지 않았습니다");
    expect(mmmHealthFlagMessage("priorScale", "en")).toContain("did not converge");
  });

  it("keeps experiment and reference aliases aligned with main MMM date and spend mappings", () => {
    expect(["meta_spend", "meta_budget", "meta_expense", "메타_예산"].every(mmmIsEvidenceSpendHeader)).toBe(true);
    expect(["date", "day", "ds", "week", "일자", "주차"].every(mmmIsEvidenceTimeHeader)).toBe(true);
    expect(mmmIsEvidenceSpendHeader("registrations")).toBe(false);
    expect(mmmEvidenceSpendHeaders(["PERIOD_ID", "FB_INVESTMENT", "meta_budget"], ["FB_INVESTMENT"])).toEqual(["FB_INVESTMENT", "meta_budget"]);
    expect(mmmIsEvidenceTimeHeader("period")).toBe(false);
    expect(mmmFindEvidenceTimeHeader(["PERIOD_ID", "outcome"], "PERIOD_ID")).toBe("PERIOD_ID");
    expect(mmmFindEvidenceTimeHeader(["PERIOD_ID", "ds"], "PERIOD_ID", "PERIOD_ID")).toBe("ds");
    const periodRows = [
      { PERIOD_ID: "2025-W01", phase: "pre", state: "off" },
      { PERIOD_ID: "2025-W02", phase: "post", state: "on" },
    ];
    const mappedTime = mmmFindEvidenceTimeHeader(["PERIOD_ID", "phase", "state"], "PERIOD_ID");
    expect(mappedTime).toBe("PERIOD_ID");
    expect(mmmFindEvidencePeriodHeader(["PERIOD_ID", "phase", "state"], periodRows, mappedTime)).toBe("phase");
    expect(mmmFindEvidencePeriodHeader(["PERIOD_ID", "state"], periodRows, mappedTime)).toBeNull();
    const [header, first, second] = MMM_TEMPLATE_CSV.replace(/^﻿/, "").trim().split("\r\n");
    expect(header.startsWith("country,date,")).toBe(true);
    expect(first.startsWith("KR,")).toBe(true);
    expect(second.startsWith("KR,")).toBe(true);
  });

  it("resolves experiment type by explicit choice, type column, then schema", () => {
    const wideHeaders = ["week", "type", "target_geo", "control_geo"];
    const typeRows = [{ week: 1, type: "On/Off", target_geo: "Seoul", control_geo: "Busan" }];
    expect(mmmResolveExperimentType(wideHeaders, typeRows, "geo")).toEqual({ type: "geo", source: "user" });
    expect(mmmResolveExperimentType(wideHeaders, typeRows)).toMatchObject({ type: "onoff", source: "type-column", typeHeader: "type" });
    expect(mmmResolveExperimentType(["week", "target_geo", "control_geo"], typeRows)).toMatchObject({ type: "geo", source: "wide-schema" });
    const longGeoRows = [
      { week: 1, geo: "T1", arm: "treatment", period: "pre" },
      { week: 2, geo: "T1", arm: "treatment", period: "post" },
      { week: 1, geo: "C1", arm: "control", period: "pre" },
      { week: 2, geo: "C1", arm: "control", period: "post" },
    ];
    expect(mmmResolveExperimentType(["week", "geo", "arm", "period"], longGeoRows)).toMatchObject({ type: "geo", source: "long-schema" });
    expect(mmmResolveExperimentType(["week", "state", "spend"], [])).toMatchObject({ type: "onoff", source: "fallback" });
    const ambiguousStateRows = [
      { state: "California", treatment_state: "off" },
      { state: "Texas", treatment_state: "on" },
    ];
    expect(mmmFindExperimentBinaryHeader(["state", "treatment_state"], ambiguousStateRows, "state")).toBe("treatment_state");
  });

  it("normalizes paired Geo-wide rows into deterministic treatment and control rows", () => {
    const headers = [
      "week", "period", "target_geo", "control_geo",
      "target_meta_spend", "control_meta_spend",
      "target_registrations", "control_registrations",
    ];
    const rows = [{
      week: "2025-W01",
      period: "pre",
      target_geo: "Seoul",
      control_geo: "Busan",
      target_meta_spend: "120",
      control_meta_spend: "20",
      target_registrations: "540",
      control_registrations: "410",
    }];
    const normalized = mmmNormalizeGeoWideEvidence(headers, rows, {
      targetHeaders: ["registrations"],
      channelHeaders: ["meta_spend"],
    });
    expect(normalized).toMatchObject({ normalized: true, mode: "geo-wide-to-long" });
    expect(normalized.headers).toEqual(expect.arrayContaining(["registrations", "meta_spend", "__mmm_geo", "__mmm_arm"]));
    expect(normalized.rows).toEqual([
      expect.objectContaining({ week: "2025-W01", period: "pre", __mmm_geo: "Seoul", __mmm_arm: "treatment", registrations: "540", meta_spend: "120" }),
      expect.objectContaining({ week: "2025-W01", period: "pre", __mmm_geo: "Busan", __mmm_arm: "control", registrations: "410", meta_spend: "20" }),
    ]);

    const incomplete = mmmNormalizeGeoWideEvidence(
      [...headers, "target_google_spend"],
      [{ ...rows[0], target_google_spend: "90" }],
      { targetHeaders: ["registrations"], channelHeaders: ["meta_spend", "google_spend"] },
    );
    expect(incomplete).toMatchObject({ normalized: false, error: "missing-wide-pairs" });
    expect(incomplete.incompletePairs).toEqual([expect.objectContaining({ baseHeader: "google_spend", targetHeader: "target_google_spend", controlHeader: null })]);

  });

  it("pivots long experiment media onto the main MMM channel headers", () => {
    const headers = ["week", "channel", "spend", "registrations"];
    const rows = [
      { week: "2025-W01", channel: "Meta", spend: "100", registrations: "500" },
      { week: "2025-W01", channel: "Google", spend: "80", registrations: "500" },
      { week: "2025-W02", channel: "Meta", spend: "120", registrations: "530" },
      { week: "2025-W02", channel: "Google", spend: "90", registrations: "530" },
    ];
    const channelRoles = [
      { header: "meta_spend", label: "MMM spend · Meta" },
      { header: "google_spend", label: "MMM spend · Google" },
    ];
    const normalized = mmmNormalizeExperimentLongMedia(headers, rows, channelRoles, ["registrations"]);
    expect(normalized).toMatchObject({ normalized: true, mode: "long-media-to-wide", unmatchedChannels: [], repeatedTargetConflicts: 0 });
    expect(normalized.rows).toHaveLength(2);
    expect(normalized.rows).toEqual([
      expect.objectContaining({ week: "2025-W01", registrations: "500", meta_spend: 100, google_spend: 80 }),
      expect.objectContaining({ week: "2025-W02", registrations: "530", meta_spend: 120, google_spend: 90 }),
    ]);
    const conflicting = mmmNormalizeExperimentLongMedia(
      ["week", "channel", "spend", "registrations", "treatment_state"],
      [
        { week: "2025-W01", channel: "Meta", spend: "100", registrations: "500", treatment_state: "off" },
        { week: "2025-W01", channel: "Google", spend: "80", registrations: "500", treatment_state: "on" },
      ],
      channelRoles,
      ["registrations"],
    );
    expect(conflicting.repeatedDesignConflicts).toBe(1);
  });

  it("ships an On/Off example with enough weeks, state replication, and transitions", () => {
    const parsed = parseSimpleTemplateCsv(MMM_EXPERIMENT_ONOFF_TEMPLATE_CSV);
    expect(parsed.headers).toEqual(["type", "week", "treatment_state", "registrations", "meta_spend"]);
    expect(parsed.rows).toHaveLength(16);
    expect(mmmResolveExperimentType(parsed.headers, parsed.rows)).toMatchObject({ type: "onoff", source: "type-column" });
    const states = parsed.rows.map((row) => row.treatment_state.toLowerCase());
    expect(states.filter((state) => state === "on")).toHaveLength(8);
    expect(states.filter((state) => state === "off")).toHaveLength(8);
    expect(states.slice(1).filter((state, index) => state !== states[index]).length).toBeGreaterThanOrEqual(2);
    expect(new Set(parsed.rows.map((row) => row.week)).size).toBe(16);
  });

  it("ships a Geo-wide example that normalizes to four balanced pre/post geos", () => {
    const parsed = parseSimpleTemplateCsv(MMM_EXPERIMENT_GEO_WIDE_TEMPLATE_CSV);
    expect(parsed.headers).toEqual([
      "type", "week", "period", "target_geo", "control_geo",
      "target_registrations", "control_registrations", "target_meta_spend", "control_meta_spend",
    ]);
    expect(mmmResolveExperimentType(parsed.headers, parsed.rows)).toMatchObject({ type: "geo", source: "type-column" });
    const normalized = mmmNormalizeGeoWideEvidence(parsed.headers, parsed.rows, {
      targetHeaders: ["registrations"],
      channelHeaders: ["meta_spend"],
    });
    expect(normalized).toMatchObject({ normalized: true, mode: "geo-wide-to-long" });
    const geos = [...new Set(normalized.rows.map((row) => row.__mmm_geo))].sort();
    const treatmentGeos = [...new Set(normalized.rows.filter((row) => row.__mmm_arm === "treatment").map((row) => row.__mmm_geo))].sort();
    const controlGeos = [...new Set(normalized.rows.filter((row) => row.__mmm_arm === "control").map((row) => row.__mmm_geo))].sort();
    expect(geos).toEqual(["C1", "C2", "T1", "T2"]);
    expect(treatmentGeos).toEqual(["T1", "T2"]);
    expect(controlGeos).toEqual(["C1", "C2"]);
    geos.forEach((geo) => {
      const geoRows = normalized.rows.filter((row) => row.__mmm_geo === geo);
      expect(new Set(geoRows.map((row) => row.__mmm_arm)).size).toBe(1);
      expect(new Set(geoRows.map((row) => row.period))).toEqual(new Set(["pre", "post"]));
      expect(new Set(geoRows.map((row) => row.week)).size).toBe(8);
    });
  });

  it("ships a Geo-long example with two geos per arm and pre/post coverage", () => {
    const parsed = parseSimpleTemplateCsv(MMM_EXPERIMENT_GEO_LONG_TEMPLATE_CSV);
    expect(parsed.headers).toEqual(["type", "week", "period", "geo", "arm", "registrations", "meta_spend"]);
    expect(parsed.rows).toHaveLength(32);
    expect(mmmResolveExperimentType(parsed.headers, parsed.rows)).toMatchObject({ type: "geo", source: "type-column" });
    const geos = [...new Set(parsed.rows.map((row) => row.geo))].sort();
    expect(geos).toEqual(["C1", "C2", "T1", "T2"]);
    expect(new Set(parsed.rows.filter((row) => row.arm === "treatment").map((row) => row.geo))).toEqual(new Set(["T1", "T2"]));
    expect(new Set(parsed.rows.filter((row) => row.arm === "control").map((row) => row.geo))).toEqual(new Set(["C1", "C2"]));
    geos.forEach((geo) => {
      const geoRows = parsed.rows.filter((row) => row.geo === geo);
      expect(new Set(geoRows.map((row) => row.arm)).size).toBe(1);
      expect(new Set(geoRows.map((row) => row.period))).toEqual(new Set(["pre", "post"]));
      expect(new Set(geoRows.map((row) => row.week)).size).toBe(8);
    });
  });

  it("does not trim leading or trailing invalid model inputs before validation", () => {
    const panel = {
      week: [1, 2, 3, 4, 5, 6],
      ch: { meta: [0, 10, 10, 10, 10, NaN] },
      targets: { Regs: [NaN, 100, 110, 120, 130, 0] },
      dummy: { promo: [NaN, 0, 0, 0, 0, 0] },
      steps: {},
    };
    const trimmed = trimToActive(panel);
    expect(trimmed.week).toEqual(panel.week);
    expect(Number.isNaN(trimmed.targets.Regs[0])).toBe(true);
    expect(Number.isNaN(trimmed.ch.meta.at(-1))).toBe(true);
  });

  it("keeps every time-aligned model input on the same rows when trimming", () => {
    const panel = {
      week: [1, 2, 3, 4, 5, 6],
      ch: { meta: [0, 10, 10, 10, 10, 0] },
      reach: { meta: [0, 1, 2, 3, 4, 0] },
      frequency: { meta: [0, 5, 6, 7, 8, 0] },
      targets: { Regs: [0, 100, 110, 120, 130, 0] },
      dummy: { promo: [0, 0, 0, 0, 0, 0] },
      steps: {},
      external: { market: [90, 100, 110, 120, 130, 140] },
      geo: ["A", "B", "C", "D", "E", "F"],
    };
    expect(trimToActive(panel)).toMatchObject({
      week: [2, 3, 4, 5],
      ch: { meta: [10, 10, 10, 10] },
      reach: { meta: [1, 2, 3, 4] },
      frequency: { meta: [5, 6, 7, 8] },
      targets: { Regs: [100, 110, 120, 130] },
      external: { market: [100, 110, 120, 130] },
      geo: ["B", "C", "D", "E"],
    });
  });

  it("blocks modeling when a real calendar week is missing instead of compressing t", async () => {
    seedWithCalendarGap();
    const { container } = render(<MarketingResponse />);
    enterMmmAndAnalyze(container);
    await flushRaf();
    expect(document.body.textContent).toContain("분석 차단 이슈 1건");
    expect(document.body.textContent).toContain("달력 주차 1개가 비어 있습니다");
  });

  it("keeps the sticky Y selector available when one mapped target is invalid", async () => {
    seedWithOneInvalidTarget();
    const { container } = render(<MarketingResponse />);
    enterMmmAndAnalyze(container);
    await flushRaf();
    clickByText(container, "매출");
    expect(document.body.textContent).toContain("분석 중");
    await flushRaf();
    expect(document.body.textContent).toContain("타깃");
    expect(Array.from(container.querySelectorAll("button")).some((button) => button.textContent.includes("가입"))).toBe(true);
    clickByText(container, "가입");
    await flushRaf();
    expect(document.body.textContent).not.toContain("선택 목표 Revenue에 결측값");
  });

  it("links the locale-specific PDF manual beside the upload area", () => {
    const { container, unmount } = render(<MarketingResponse locale="ko" />);
    const koLink = Array.from(container.querySelectorAll("a")).find((link) => link.textContent.includes("MMM 설명서 확인"));
    expect(koLink?.getAttribute("href")).toBe("/manuals/mmm-model-manual-ko.pdf");
    expect(koLink?.getAttribute("download")).toBe("growth-opt-mmm-model-manual-ko.pdf");
    expect(koLink?.textContent).toContain("MMM 설명서 확인");
    unmount();

    seedNoData();
    const englishRender = render(<MarketingResponse locale="en" />);
    const enLink = Array.from(englishRender.container.querySelectorAll("a")).find((link) => link.textContent.includes("View the MMM manual"));
    expect(enLink?.getAttribute("href")).toBe("/manuals/mmm-model-manual-en.pdf");
    expect(enLink?.getAttribute("download")).toBe("growth-opt-mmm-model-manual-en.pdf");
    expect(enLink?.textContent).toContain("View the MMM manual");
    englishRender.unmount();
  }, 10_000);

  it("keeps every MMM stage free of Korean UI copy in English", async () => {
    seedWithData();
    const { container } = render(<MarketingResponse locale="en" />);
    clickByText(container, "Analyze");
    await flushRaf();
    for (const stage of ["Cannibalization", "Contribution", "Regression · Forecast", "Time series"]) {
      clickByText(container, stage);
      await flushRaf();
      const koreanCopy = Array.from(new Set(document.body.textContent.match(/[가-힣]+/g) || []));
      expect(koreanCopy, `${stage}: ${koreanCopy.join(", ")}`).toEqual([]);
    }
  }, 20_000);

  it("shows the colMap mapper + analyze gate by default (MMM primary) with a valid CSV", () => {
    seedWithData();
    render(<MarketingResponse />);
    // Primary mapper + analyze gate should render (not the analysis yet).
    expect(document.body.textContent).toContain("컬럼 역할 매핑");
    expect(document.body.textContent).toContain("분석하기");
  });

  it("keeps the current scroll position when MMM analysis starts", async () => {
    seedWithData();
    const originalScrollTo = window.scrollTo;
    const scrollTo = vi.fn();
    window.scrollTo = scrollTo;
    try {
      const { container } = render(<MarketingResponse />);
      enterMmmAndAnalyze(container);
      await flushRaf();
      expect(scrollTo).not.toHaveBeenCalled();
    } finally {
      window.scrollTo = originalScrollTo;
    }
  });

  it("keeps the analyze button visible and explains the block when source currency is unselected", () => {
    seedWithData();
    const slice = useAppStore.getState().csvData;
    const noCurrency = { ...slice };
    delete noCurrency.currency;
    useAppStore.setState({
      csvGroups: { ...useAppStore.getState().csvGroups, response: noCurrency },
      csvData: noCurrency,
    });
    const { container } = render(<MarketingResponse />);
    const analyze = Array.from(container.querySelectorAll("button")).find((button) => button.textContent.includes("분석하기"));
    expect(analyze).toBeTruthy();
    expect(analyze?.disabled).toBe(true);
    expect(document.body.textContent).toContain("원본 CSV 통화만 선택하면 분석할 수 있습니다");
  });

  it("renders trend→diagnose panel (§1 macro/audit, §4.5 ranking) after analyze without throwing", async () => {
    seedWithData();
    const { container } = render(<MarketingResponse />);
    expect(() => enterMmmAndAnalyze(container)).not.toThrow();
    await flushRaf();
    expect(container.querySelector('.decision-review[data-decision-review-tool="5-18"]')).toBeTruthy();
    expect(container.textContent).toContain("다음 검토 약속 만들기");
    clickByText(container, "카니발 진단");
    expect(document.body.textContent).toContain("데이터 위생");
  });

  it("suggests a same-period forecast actual and applies it only after confirmation", async () => {
    const latest = seedWithDatedData();
    useAppStore.setState({
      decisionRecords: [{
        id: "forecast_1", toolId: "5-18", locale: "ko", action: "첫 예측 주 실제값 확인", metric: "가입", baseline: "50명/주",
        targetDirection: "neutral", comparisonKind: "forecast_actual", forecastPeriod: latest.week, forecastTarget: "Regs",
        forecastPlatform: "all", forecastValue: "50", forecastLower: "40", forecastUpper: "60", forecastSourceThrough: "2026-07-27",
        reviewDate: "2026-08-05", actual: "", learning: "", status: "pending", conclusion: "", hypothesis: "", reviewQuestion: "", sourcePeriod: "", createdAt: "", updatedAt: "",
      }],
    });
    window.gtag = vi.fn();
    const { container } = render(<MarketingResponse />);
    enterMmmAndAnalyze(container);
    await flushRaf();

    expect(container.textContent).toContain("새 CSV에서 대조 가능한 실제값 1건을 찾았습니다");
    expect(container.textContent).toContain("이 실제값 반영");
    fireEvent.click(Array.from(container.querySelectorAll("button")).find((button) => button.textContent.includes("이 실제값 반영")));

    expect(useAppStore.getState().decisionRecords[0].actual).toContain("명/주");
    expect(window.gtag).toHaveBeenCalledWith("event", "forecast_actual_applied", expect.objectContaining({
      tool_id: "5-18", source: "forecast_review", result_state: "reviewed", locale: "ko",
    }));
    expect(JSON.stringify(window.gtag.mock.calls)).not.toContain(String(latest.Regs));
  });

  it("renders the Classic model, channel totals, health diagnostics, and shared footer manual", async () => {
    seedWithData();
    const { container } = render(<MarketingResponse />);
    enterMmmAndAnalyze(container);
    await flushRaf();
    clickByText(container, "기여 분해");
    expect(document.body.textContent).toContain("Classic");
    expect(document.body.textContent).not.toContain("PR #416");
    expect(document.body.textContent).toContain("Classic은 관측 데이터만 사용");
    expect(document.body.textContent).toContain("Bayesian");
    expect(document.body.textContent).not.toContain("Bayesian-like MMM");
    expect(document.body.textContent).toContain("평균 Cost/주");
    expect(document.body.textContent).toContain("전체 Spend");
    expect(document.body.textContent).toContain("전체 가입");
    expect(document.body.textContent).toContain("그룹 총량 기반 배분");
    expect(document.body.textContent).toContain("RMS 기여 크기 비중");
    expect(document.body.textContent).toContain("모델 건강");
    expect(document.body.textContent).toContain("R-hat");
    const bayesian = Array.from(container.querySelectorAll("button")).find((button) => button.textContent.trim() === "Bayesian");
    expect(bayesian).toBeTruthy();
    fireEvent.click(bayesian);
    await flushRaf();
    expect(bayesian.classList.contains("active")).toBe(true);
    expect(document.body.textContent).not.toContain("conditional posterior 채널 적합");
    // T1: Bayesian 모드 → 정보 prior 토글 + 적합도 신뢰 칩 노출, 끄기(평면 OLS) 재적합 throw 없음.
    expect(document.body.textContent).toContain("정보 prior");
    expect(document.body.textContent).toContain("적합도");
    const priorOff = Array.from(container.querySelectorAll("button")).find((button) => button.textContent.includes("끄기 (평면 OLS)"));
    expect(priorOff).toBeTruthy();
    expect(() => fireEvent.click(priorOff)).not.toThrow();
    await flushRaf();
    expect(priorOff.classList.contains("active")).toBe(true);
    const footerManual = container.querySelector('[data-mmm-manual-placement="footer"] a');
    expect(footerManual?.getAttribute("href")).toBe("/manuals/mmm-model-manual-ko.pdf");
    // T2: 계산 상세 아코디언 열면 ① 변환 파라미터 Laplace 90% 구간 범례가 throw 없이 렌더.
    const detailSummary = Array.from(container.querySelectorAll("summary")).find((summary) => summary.textContent.includes("계산 과정 자세히 보기"));
    expect(detailSummary).toBeTruthy();
    expect(() => fireEvent.click(detailSummary)).not.toThrow();
    await flushRaf();
    expect(document.body.textContent).toContain("90% 구간");
  });

  it("re-normalizes the RMS contribution share after excluding base demand and trend", async () => {
    seedWithData();
    const { container } = render(<MarketingResponse />);
    enterMmmAndAnalyze(container);
    await flushRaf();
    clickByText(container, "기여 분해");
    const exclude = Array.from(container.querySelectorAll("button")).find((button) => button.textContent === "제외");
    expect(exclude).toBeTruthy();
    fireEvent.click(exclude);
    expect(exclude?.className).toContain("active");
    expect(document.querySelector(".mmm-chart-help")?.getAttribute("title")).toContain("기본 수요·추세를 분모와 표시에서 제외");
  });

  it("renders the 회귀·미래 예측 (lab) stage without throwing", async () => {
    seedWithData();
    const { container } = render(<MarketingResponse />);
    expect(() => enterMmmAndAnalyze(container)).not.toThrow();
    await flushRaf();
    // 구 "시뮬레이션" 탭은 제거됨 — 없어야 함.
    const simTab = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("시뮬레이션"),
    );
    expect(simTab).toBeFalsy();
    const labTab = Array.from(container.querySelectorAll("button")).find((b) =>
      b.textContent.includes("회귀 · 미래 예측"),
    );
    expect(labTab).toBeTruthy();
    expect(() => fireEvent.click(labTab)).not.toThrow();
    expect(document.body.textContent.length).toBeGreaterThan(0);
    const footerManual = container.querySelector('[data-mmm-manual-placement="footer"] a');
    expect(footerManual?.getAttribute("href")).toBe("/manuals/mmm-model-manual-ko.pdf");
  });

  it("keeps Organic baseline, Organic spend halo, Paid, OS, and Total additive", () => {
    const part = (actual, fittedHist, predFut, baselineFut, key) => ({
      actual,
      fittedHist,
      predFut,
      baselineFut,
      lo: predFut.map((value) => value - 2),
      hi: predFut.map((value) => value + 2),
      histLabels: ["w1", "w2"],
      futLabels: ["w3", "w4"],
      labels: ["w1", "w2", "w3", "w4"],
      chans: [{ key, label: key }],
      recentMean: { [key]: 100 },
      futSpendByKey: { [key]: [100, 100] },
      scenarioWarnings: [],
      steps: [],
    });
    const android = combinePaidOrganicForecastParts(
      part([100, 110], [98, 111], [120, 125], [105, 107], "android_cost"),
      part([20, 25], [21, 24], [30, 32], [4, 4], "android_cost"),
      "android",
    );
    const ios = combinePaidOrganicForecastParts(
      part([80, 85], [81, 84], [90, 92], [82, 83], "ios_cost"),
      part([15, 17], [14, 18], [20, 21], [3, 3], "ios_cost"),
      "ios",
    );
    const total = combinePaidOrganicPlatforms([android, ios]);
    expect(android.predFut).toEqual(android.organicFut.map((value, index) => value + android.performanceFut[index]));
    expect(android.organicFut).toEqual(android.organicBaseFut.map((value, index) => value + android.organicHaloFut[index]));
    expect(total.predFut).toEqual(total.organicFut.map((value, index) => value + total.performanceFut[index]));
    expect(total.predFut).toEqual([260, 270]);
    expect(total.baselineFut).toEqual(total.organicBaseFut);
  });

  it("feeds Organic halo with aggregate budgets while keeping Paid channel budgets separate", () => {
    expect(paidOrganicHaloBudgets({
      panel: {
        ch: {
          performance_total: Array(12).fill(120),
          branding_total: Array(12).fill(20),
        },
        aggregateMediaGroups: [
          { key: "performance_total", members: ["meta", "google"] },
          { key: "branding_total", members: ["youtube"] },
        ],
      },
      haloMemberRecentMean: { meta: 80, google: 40, youtube: 20 },
    }, {
      meta: 100,
      google: 50,
      youtube: 25,
    })).toEqual({
      performance_total: 150,
      branding_total: 25,
    });
    expect(paidOrganicHaloBudgets({
      panel: {
        ch: { performance_total: Array(12).fill(120) },
        aggregateMediaGroups: [{ key: "performance_total", members: ["meta", "google"] }],
      },
      haloMemberRecentMean: { meta: 80, google: 40 },
    }, { meta: 100 })).toEqual({ performance_total: 140 });
  });

  it("anchors forecast seasonality to calendar weeks instead of CSV row offsets", () => {
    const panel = (labels) => ({
      week: labels.map((_, index) => index + 1),
      weekLabel: labels,
      dates: labels.map((label) => new Date(`${label}T00:00:00Z`)),
      ch: { cost: labels.map(() => 1) },
      dummy: {},
      steps: {},
      targets: { Regs: labels.map(() => 10) },
    });
    const recentLabels = ["2024-01-01", "2024-01-08", "2024-01-15"];
    const longer = calendarizeForecastPanel(panel(["2023-12-18", "2023-12-25", ...recentLabels]));
    const shorter = calendarizeForecastPanel(panel(recentLabels));
    expect(longer.week.slice(-recentLabels.length)).toEqual(shorter.week);
  });

  it("does not certify a good Total when an OS/component error is hidden by cancellation", () => {
    const audited = certifyForecastBacktest(
      { wmape: 9, actual: [100], predicted: [91], validationStartIndex: 0 },
      [
        { platform: "android", component: "organic", wmape: 7 },
        { platform: "ios", component: "organic", wmape: 24 },
      ],
    );
    expect(audited.reliable).toBe(false);
    expect(audited.worstComponent).toMatchObject({ platform: "ios", wmape: 24, passed: false });
    expect(certifyForecastBacktest(
      { wmape: 9, actual: [100], predicted: [91], validationStartIndex: 0 },
      [{ platform: "android", component: "total", wmape: 8 }],
    ).reliable).toBe(true);
  });

  it("routes mapped Total, PaidRegs, and Spend through the OS-level split forecast", async () => {
    seedWithPaidOrganicForecastData();
    const { container } = render(<MarketingResponse initialStage="lab" />);
    enterMmmAndAnalyze(container);
    await flushRaf();
    expect(document.body.textContent).toContain("Organic 기저+halo · Paid Spend 회귀");
    expect(document.body.textContent).toContain("Total = Android(Organic + Paid) + iOS(Organic + Paid)");
    expect(document.body.textContent).toContain("Android·iOS 성분 검증");
    expect(document.body.textContent).not.toContain("기간·연간 패턴 자동 탐색");
  }, 90_000);

  it("shows an Organic trend/seasonality forecast without empty budget scenarios when Spend is absent", async () => {
    seedWithOrganicOnlyForecastData();
    const { container } = render(<MarketingResponse initialStage="lab" />);
    enterMmmAndAnalyze(container);
    await flushRaf();
    expect(document.body.textContent).toContain("Organic 추세·계절성 · Spend 없음");
    expect(document.body.textContent).toContain("Spend 없음 · Organic 예측만 표시");
    expect(document.body.textContent).toContain("자동 선택 예측 CSV (고정 스냅샷)");
    expect(document.body.textContent).not.toContain("살아있는 예측 CSV");
    expect(document.body.textContent).not.toContain("미디어 OFF");
  }, 30000);

  it("keeps the transform-family search contract in the final forecast refit", () => {
    seedWithPaidOrganicForecastData();
    const slice = useAppStore.getState().csvData;
    const map = autoGuessColMap(slice.headers, slice.raw);
    const built = buildPanelFromColMap(slice.headers, slice.raw, map, "android");
    const panel = trimToActive(built.panel);
    const cfg = { ...MMM_METH_CONFIG, absorbed: new Set() };
    cfg.absorbed = mmmResolveAbsorb(panel, cfg).absorbed;
    const model = buildForecastOnlyModelFromPanel(panel, cfg, "Regs", { horizon: 13 });
    const grid = model.selection.transformGrid;
    expect(grid.families).toEqual(["identity", "log1p", "hill"]);
    expect(grid.perChannelUpperBound).toBe(
      grid.adstock.length
        * (2 + grid.halfSaturationQuantiles.length * grid.hillSlopes.length),
    );
    expect(model.cfg.mediaTransformFamilies).toEqual(model.forecastSelected.mediaTransformFamilies);
    const selectedFamilies = Object.values(model.run.params || {}).map((params) => params.family);
    expect(selectedFamilies.length).toBeGreaterThan(0);
    expect(selectedFamilies.every((family) => grid.families.includes(family))).toBe(true);
  }, 30000);

  it("withholds validation when the requested horizon lacks a meaningful training window", async () => {
    seedWithOsForecastData();
    const slice = useAppStore.getState().csvData;
    const map = autoGuessColMap(slice.headers, slice.raw);
    const built = buildPanelFromColMap(slice.headers, slice.raw, map, "ios");
    const panel = trimToActive(built.panel);
    const cfg = { ...MMM_METH_CONFIG, absorbed: new Set() };
    cfg.absorbed = mmmResolveAbsorb(panel, cfg).absorbed;
    const directModel = buildForecastOnlyModelFromPanel(panel, cfg, "Regs");
    expect(directModel.run).toBeNull();
    expect(directModel.selection.reason).toBe("insufficient-history");
    const directBacktest = buildForecastRecentBacktest(directModel);
    // 예측기간보다 짧은 학습창을 억지로 만들지 않고 미인증으로 남긴다.
    expect(directBacktest).toBeNull();
    const { container } = render(<MarketingResponse />);
    enterMmmAndAnalyze(container);
    await flushRaf();
    clickByText(container, "회귀 · 미래 예측");
    await flushRaf();
    const iosTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent.trim() === "iOS");
    expect(iosTab).toBeTruthy();
    fireEvent.click(iosTab);
    await flushRaf();
    expect(document.body.textContent).toContain("봉인 13주 검증을 만들 수 없어 예측을 인증하지 않습니다");
    clickByText(container, "Total");
    await flushRaf();
    expect(document.body.textContent).toContain("봉인 13주 검증을 만들 수 없어 예측을 인증하지 않습니다");
  });
});
