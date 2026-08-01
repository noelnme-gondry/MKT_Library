// @vitest-environment jsdom
//
// Render-smoke for CampaignPvm (5-21). Regression net for render/mount-effect
// crashes (the class of bug this component is named after). Golden tests cover
// the pure PVM_MATH decomposition; this asserts the component MOUNTS without
// throwing in the no-data and with-data states.
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import CampaignPvm, { buildPvmCache } from "@/components/tools/CampaignPvm";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "5-21",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: EMPTY_CSV },
    csvData: EMPTY_CSV,
  });
}

// A minimal VALID efficiency CSV for PVM: channel/cost/installs/date. PVM needs
// >=2 calendar weeks so the lookback compare (P1 vs P2) isn't fully locked, so
// span 21 days (3 weeks) across 2 channels. mapping = { origHeader: standardKey }.
function seedWithData() {
  const headers = ["Date", "Country", "Platform", "Channel", "Spend", "Installs"];
  const mapping = {
    Date: "date",
    Country: "country",
    Platform: "platform",
    Channel: "channel",
    Spend: "cost",
    Installs: "installs",
  };
  const raw = [];
  const channels = ["Google", "Meta"];
  // 2026-01-05 is a Monday → 3 full calendar weeks (05..25).
  for (let d = 5; d <= 25; d++) {
    const date = `2026-01-${String(d).padStart(2, "0")}`;
    for (const ch of channels) {
      const cost = ch === "Google" ? 100000 + d * 3000 : 80000 + d * 2500;
      const installs = Math.round(cost / (ch === "Google" ? 5000 : 4200)); // NO Math.random — §8
      raw.push({ Date: date, Country: "KR", Platform: "iOS", Channel: ch, Spend: cost, Installs: installs });
    }
  }
  const slice = { raw, headers, mapping, fileName: "pvm.csv" };
  useAppStore.setState({
    currentRouteId: "5-21",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice },
    csvData: slice,
  });
}

function zeroResultSlice() {
  const headers = ["Date", "Channel", "Spend", "Installs"];
  const mapping = { Date: "date", Channel: "channel", Spend: "cost", Installs: "installs" };
  const raw = [
    ["2026-01-05", "Measured", 100, 10],
    ["2026-01-05", "Zero result", 50, 0],
    ["2026-01-12", "Measured", 100, 10],
    ["2026-01-12", "Zero result", 60, 0],
    ["2026-01-18", "Measured", 0, 0],
  ].map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]])));
  return { raw, headers, mapping, fileName: "pvm-zero-result.csv" };
}

function seedZeroResultData() {
  const slice = zeroResultSlice();
  useAppStore.setState({
    currentRouteId: "5-21",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice },
    csvData: slice,
  });
}

function formattedNumberSlice(spendP1 = "1,000") {
  const headers = ["Date", "Channel", "Spend", "Installs"];
  const mapping = { Date: "date", Channel: "channel", Spend: "cost", Installs: "installs" };
  const raw = [
    ["2026-01-05", "Search", spendP1, "100"],
    ["2026-01-12", "Search", "1 200", "100"],
    ["2026-01-18", "Search", "0", "0"],
  ].map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]])));
  return { raw, headers, mapping, fileName: "pvm-formatted-numbers.csv" };
}

function overflowSlice() {
  const headers = ["Date", "Channel", "Spend", "Installs"];
  const mapping = { Date: "date", Channel: "channel", Spend: "cost", Installs: "installs" };
  const raw = [
    ["2026-01-05", "A", Number.MAX_VALUE, 1],
    ["2026-01-05", "B", Number.MAX_VALUE, 1],
    ["2026-01-12", "A", Number.MAX_VALUE, 1],
    ["2026-01-12", "B", Number.MAX_VALUE, 1],
    ["2026-01-18", "A", 0, 0],
  ].map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]])));
  return { raw, headers, mapping, fileName: "pvm-overflow.csv" };
}

describe("CampaignPvm render smoke", () => {
  beforeEach(() => seedNoData());

  it("mounts without throwing in the no-data state (auto-loads demo)", () => {
    expect(() => render(<CampaignPvm />)).not.toThrow();
    // No-data → CsvUploader auto-loads sample data, replacing the uploader-prep block.
    expect(screen.queryByRole("heading", { name: "데이터 준비" })).toBeFalsy();
  });

  it("mounts without throwing with a valid seeded CSV", () => {
    seedWithData();
    expect(() => render(<CampaignPvm />)).not.toThrow();
    // With-data branch renders the "한눈에 보기" §0 section (heading, distinct
    // from the ToolPageShell TOC link of the same name).
    expect(screen.getByRole("heading", { name: /한눈에 보기/ })).toBeTruthy();
  });

  it("rolls campaign and creative rows up from one finest-grain decomposition", () => {
    const headers = ["Date", "Channel", "Campaign", "Creative", "Spend", "Installs"];
    const mapping = { Date: "date", Channel: "channel", Campaign: "campaign_name", Creative: "creative_id", Spend: "cost", Installs: "installs" };
    const raw = [
      ["2026-01-05", "Search", "A", "c1", 100, 10], ["2026-01-05", "Search", "A", "c2", 100, 5],
      ["2026-01-06", "Search", "A", "c1", 100, 10], ["2026-01-06", "Search", "A", "c2", 100, 5],
      ["2026-01-12", "Search", "A", "c1", 100, 20], ["2026-01-12", "Search", "A", "c2", 100, 5],
      ["2026-01-18", "Search", "A", "c1", 100, 20], ["2026-01-18", "Search", "A", "c2", 100, 5],
    ].map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index]])));
    const cache = buildPvmCache({ raw, headers, mapping, fileName: "pvm.csv" }, {
      metric: "cpi", weekBasis: "calendar", lookback: 1, currency: "KRW", denomBasis: "installs", dashboardFilter: {}, locale: "ko",
    });
    const channel = cache.layer1[0];
    const campaignSum = cache.layer2.reduce((sum, row) => sum + row.contribution, 0);
    const creativeSum = cache.layer3.reduce((sum, row) => sum + row.contribution, 0);

    expect(cache.insufficientData).toBe(false);
    expect(campaignSum).toBeCloseTo(channel.contribution, 10);
    expect(creativeSum).toBeCloseTo(channel.contribution, 10);
  });

  it("marks positive-cost zero-result cells NOT_IDENTIFIED instead of certifying a broken identity", () => {
    const cache = buildPvmCache(zeroResultSlice(), {
      metric: "cpi", weekBasis: "calendar", lookback: 1, currency: "KRW", denomBasis: "installs", dashboardFilter: {}, locale: "ko",
    });

    expect(cache).toMatchObject({
      insufficientData: true,
      analysisStatus: "NOT_IDENTIFIED",
      reasonCode: "POSITIVE_COST_WITH_ZERO_RESULT",
    });
    expect(cache.invalidCells).toHaveLength(2);
  });

  it("does not show complete, no-residual, or export controls for a NOT_IDENTIFIED result", () => {
    seedZeroResultData();
    render(<CampaignPvm />);

    expect(screen.getByText("분해 불가")).toBeTruthy();
    expect(screen.queryByText("계산 완료")).toBeNull();
    expect(screen.queryByText(/잔차 없이/)).toBeNull();
    expect(screen.queryByRole("button", { name: "결과 받기" })).toBeNull();
    const pngButtons = screen.getAllByRole("button", { name: /PNG/ });
    expect(pngButtons.length).toBeGreaterThan(0);
    expect(pngButtons.every((button) => button.disabled)).toBe(true);
  });

  it("keeps formatted numeric strings and blocks malformed numeric input", () => {
    const state = {
      metric: "cpi", weekBasis: "calendar", lookback: 1, currency: "KRW", denomBasis: "installs", dashboardFilter: {}, locale: "ko",
    };
    const valid = buildPvmCache(formattedNumberSlice(), state);
    expect(valid).toMatchObject({
      insufficientData: false,
      analysisStatus: "COMPLETE",
      CPA1: 10,
      CPA2: 12,
    });
    expect(valid.identity.ok).toBe(true);

    const invalid = buildPvmCache(formattedNumberSlice("1,0x0"), state);
    expect(invalid).toMatchObject({
      insufficientData: true,
      analysisStatus: "NOT_IDENTIFIED",
      reasonCode: "INVALID_NUMERIC_VALUE",
    });
  });

  it("keeps malformed and non-finite identities out of the result and export UI", () => {
    const state = {
      metric: "cpi", weekBasis: "calendar", lookback: 1, currency: "KRW", denomBasis: "installs", dashboardFilter: {}, locale: "ko",
    };
    const overflow = buildPvmCache(overflowSlice(), state);
    expect(overflow).toMatchObject({
      insufficientData: true,
      analysisStatus: "NOT_IDENTIFIED",
      reasonCode: "ADDITIVE_IDENTITY_FAILED",
    });
    expect(overflow.identity.ok).toBe(false);

    const slice = formattedNumberSlice("1,0x0");
    useAppStore.setState({
      currentRouteId: "5-21",
      csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice },
      csvData: slice,
    });
    render(<CampaignPvm />);
    expect(screen.getAllByText(/숫자로 읽을 수 없는/).length).toBeGreaterThan(0);
    expect(screen.queryByText("계산 완료")).toBeNull();
    expect(screen.queryByRole("button", { name: "결과 받기" })).toBeNull();
    expect(screen.getAllByRole("button", { name: /PNG/ }).every((button) => button.disabled)).toBe(true);
  });
});
