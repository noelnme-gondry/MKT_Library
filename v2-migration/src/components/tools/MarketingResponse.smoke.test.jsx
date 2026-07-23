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
import { describe, it, expect, beforeEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import MarketingResponse, {
  MMM_EXPERIMENT_GEO_LONG_TEMPLATE_CSV,
  MMM_EXPERIMENT_GEO_WIDE_TEMPLATE_CSV,
  MMM_EXPERIMENT_ONOFF_TEMPLATE_CSV,
  MMM_TEMPLATE_CSV,
  buildForecastCsv,
  buildForecastOnlyModelFromPanel,
  buildForecastRecentBacktest,
  mmmDerivedTrafficValue,
  mmmComposeEvidenceTarget,
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
    seedNoData();
  });

  it("mounts without throwing in the no-data state", () => {
    expect(() => render(<MarketingResponse />)).not.toThrow();
    expect(document.body.querySelector("*")).toBeTruthy();
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
      histLabels: ["W1", "W2"], futLabels: ["W3"], actual: [100 + offset, 110 + offset],
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
    const english = render(<MarketingResponse locale="en" />).container;
    const enLink = Array.from(english.querySelectorAll("a")).find((link) => link.textContent.includes("View the MMM manual"));
    expect(enLink?.getAttribute("href")).toBe("/manuals/mmm-model-manual-en.pdf");
    expect(enLink?.getAttribute("download")).toBe("growth-opt-mmm-model-manual-en.pdf");
    expect(enLink?.textContent).toContain("View the MMM manual");
  });

  it("shows the colMap mapper + analyze gate by default (MMM primary) with a valid CSV", () => {
    seedWithData();
    render(<MarketingResponse />);
    // Primary mapper + analyze gate should render (not the analysis yet).
    expect(document.body.textContent).toContain("컬럼 역할 매핑");
    expect(document.body.textContent).toContain("분석하기");
  });

  it("renders trend→diagnose panel (§1 macro/audit, §4.5 ranking) after analyze without throwing", async () => {
    seedWithData();
    const { container } = render(<MarketingResponse />);
    expect(() => enterMmmAndAnalyze(container)).not.toThrow();
    await flushRaf();
    clickByText(container, "카니발 진단");
    expect(document.body.textContent).toContain("데이터 위생");
  });

  it("renders the honest RMS label, health diagnostics, and shared footer manual in MMM results", async () => {
    seedWithData();
    const { container } = render(<MarketingResponse />);
    enterMmmAndAnalyze(container);
    await flushRaf();
    clickByText(container, "기여 분해");
    expect(document.body.textContent).toContain("RMS 기여 크기 비중");
    expect(document.body.textContent).toContain("모델 건강 진단");
    expect(document.body.textContent).toContain("R-hat");
    const footerManual = container.querySelector('[data-mmm-manual-placement="footer"] a');
    expect(footerManual?.getAttribute("href")).toBe("/manuals/mmm-model-manual-ko.pdf");
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
    expect(document.body.textContent).toContain("기본 수요·추세를 분모와 표시에서 제외");
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

  it("keeps the last-24-week backtest for short iOS Cost windows and additive Total", async () => {
    seedWithOsForecastData();
    const slice = useAppStore.getState().csvData;
    const map = autoGuessColMap(slice.headers, slice.raw);
    const built = buildPanelFromColMap(slice.headers, slice.raw, map, "ios");
    const panel = trimToActive(built.panel);
    const cfg = { ...MMM_METH_CONFIG, absorbed: new Set() };
    cfg.absorbed = mmmResolveAbsorb(panel, cfg).absorbed;
    const directModel = buildForecastOnlyModelFromPanel(panel, cfg, "Regs");
    expect(directModel.run).toBeTruthy();
    const directBacktest = buildForecastRecentBacktest(directModel);
    expect(directBacktest).toBeTruthy();
    const { container } = render(<MarketingResponse />);
    enterMmmAndAnalyze(container);
    await flushRaf();
    clickByText(container, "회귀 · 미래 예측");
    await flushRaf();
    const iosTab = Array.from(container.querySelectorAll("button")).find((button) => button.textContent.trim() === "iOS");
    expect(iosTab).toBeTruthy();
    fireEvent.click(iosTab);
    await flushRaf();
    expect(document.body.textContent).toContain("미래 예측 전 최근 24주 검증");
    clickByText(container, "Total");
    await flushRaf();
    expect(document.body.textContent).toContain("Total 예측 = Android 예측 + iOS 예측");
    expect(document.body.textContent).toContain("미래 예측 전 최근 24주 검증");
  });
});
