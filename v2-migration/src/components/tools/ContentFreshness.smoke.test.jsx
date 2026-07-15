// @vitest-environment jsdom
//
// Render-smoke for ContentFreshness (9-6, creative group). It's a thin wrapper
// that renders <CreativeAnalyzer domain="performance" /> — the surviving 소재 분석
// tool (구 5-6 통합). Same engine (CREATIVE_STATS / CREATIVE_FATIGUE, golden-
// covered) with performance-domain labels (소재/피로도/교체). Asserts the wrapper
// mounts without throwing in the no-data and with-data states, including the
// fatigue + forest-plot chart effects and the WLS decompose path (attributes +
// >=30 clean rows). Deterministic — NO Math.random (§8).
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import ContentFreshness from "@/components/tools/ContentFreshness";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "9-6",
    csvGroups: { ...useAppStore.getState().csvGroups, creative: EMPTY_CSV },
    csvData: EMPTY_CSV,
  });
}

// A minimal VALID creative CSV: creative_id (소재) + date + impressions + clicks
// (deriveMetrics/fatigue inputs) + installs (CVR) + two attribute columns
// (hook_type, format) with >=30 clean rows so the WLS decompose branch runs.
// mapping = { origHeader: standardKey } — the engine contract.
function seedWithData() {
  const headers = ["Date", "Channel", "CreativeID", "Hook", "Format", "Impr", "Clicks", "Inst"];
  const mapping = {
    Date: "date",
    Channel: "channel",
    CreativeID: "creative_id",
    Hook: "hook_type",
    Format: "format",
    Impr: "impressions",
    Clicks: "clicks",
    Inst: "installs",
  };
  const raw = [];
  const creatives = [
    { id: "cr_A", hook: "질문형", format: "영상" },
    { id: "cr_B", hook: "숫자형", format: "글" },
    { id: "cr_C", hook: "질문형", format: "글" },
    { id: "cr_D", hook: "숫자형", format: "영상" },
  ];
  // 10 days × 4 creatives = 40 rows. Deterministic decaying CTR (§8, no Math.random)
  // so at least one creative registers fatigue and the decompose has signal.
  for (let d = 1; d <= 10; d++) {
    const date = `2026-01-${String(d).padStart(2, "0")}`;
    creatives.forEach((c, ci) => {
      const impressions = 5000 + ci * 400 + d * 50;
      const baseCtr = 0.05 + ci * 0.004;
      const ctr = Math.max(0.005, baseCtr - d * 0.002);
      const clicks = Math.round(impressions * ctr);
      const installs = Math.round(clicks * (0.2 + ci * 0.01));
      raw.push({
        Date: date,
        Channel: ci % 2 === 0 ? "Meta AAP" : "TikTok",
        CreativeID: c.id,
        Hook: c.hook,
        Format: c.format,
        Impr: impressions,
        Clicks: clicks,
        Inst: installs,
      });
    });
  }
  const slice = { raw, headers, mapping, fileName: "creative.csv" };
  useAppStore.setState({
    currentRouteId: "9-6",
    csvGroups: { ...useAppStore.getState().csvGroups, creative: slice },
    csvData: slice,
  });
}

describe("ContentFreshness (9-6 소재 분석) render smoke", () => {
  beforeEach(() => seedNoData());

  it("mounts without throwing in the no-data state (auto-loads demo)", () => {
    expect(() => render(<ContentFreshness />)).not.toThrow();
    // No-data → CsvUploader auto-loads sample data, replacing the uploader-prep block.
    expect(screen.queryByText("데이터 준비")).toBeFalsy();
  });

  it("mounts without throwing with a valid seeded creative CSV", () => {
    seedWithData();
    expect(() => render(<ContentFreshness />)).not.toThrow();
    // With-data branch renders the §3 per-creative metrics table heading
    // (performance-domain label: "소재별 성과표").
    expect(screen.getByText(/소재별 성과표/)).toBeTruthy();
    // Ported sections mount with performance labels: §5 피로도 진단, §7 교체 일정 추천.
    expect(screen.getAllByText(/피로도 진단/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/교체 일정 추천/).length).toBeGreaterThan(0);
  });
});
