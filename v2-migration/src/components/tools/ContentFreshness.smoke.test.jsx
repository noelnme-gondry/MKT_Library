// @vitest-environment jsdom
//
// Render-smoke for ContentFreshness (9-6, content_freshness group). It's a thin
// wrapper that renders <CreativeAnalyzer domain="content" /> — same engine
// (CREATIVE_STATS / CREATIVE_FATIGUE, golden-covered, CTR/CVR ratio-based so
// scale-safe) as 5-6, content-domain labels (콘텐츠/신선도 저하/발행). Asserts the
// wrapper mounts without throwing in the no-data and with-data states, including
// the fatigue + forest-plot chart effects and the WLS decompose path (content
// attributes + >=30 clean rows). Deterministic — NO Math.random (§8).
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import ContentFreshness from "@/components/tools/ContentFreshness";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "9-6",
    csvGroups: { ...useAppStore.getState().csvGroups, content_freshness: EMPTY_CSV },
    csvData: EMPTY_CSV,
  });
}

// A minimal VALID content CSV: creative_id (콘텐츠) + date + impressions + clicks
// (deriveMetrics/fatigue inputs) + installs (CVR) + two attribute columns
// (hook_type, format) with >=30 clean rows so the WLS decompose branch runs.
// mapping = { origHeader: standardKey }. Field names are the engine contract
// (unchanged from 5-6); only the domain LABELS differ.
function seedWithData() {
  const headers = ["Date", "Channel", "ContentID", "Hook", "Format", "Impr", "Clicks", "Subs"];
  const mapping = {
    Date: "date",
    Channel: "channel",
    ContentID: "creative_id",
    Hook: "hook_type",
    Format: "format",
    Impr: "impressions",
    Clicks: "clicks",
    Subs: "installs",
  };
  const raw = [];
  const contents = [
    { id: "post_A", hook: "질문형", format: "영상" },
    { id: "post_B", hook: "숫자형", format: "글" },
    { id: "post_C", hook: "질문형", format: "글" },
    { id: "post_D", hook: "숫자형", format: "영상" },
  ];
  // 10 days × 4 contents = 40 rows. Deterministic decaying CTR (§8, no Math.random)
  // so at least one content registers freshness-decay and the decompose has signal.
  for (let d = 1; d <= 10; d++) {
    const date = `2026-01-${String(d).padStart(2, "0")}`;
    contents.forEach((c, ci) => {
      const impressions = 5000 + ci * 400 + d * 50;
      const baseCtr = 0.05 + ci * 0.004;
      const ctr = Math.max(0.005, baseCtr - d * 0.002);
      const clicks = Math.round(impressions * ctr);
      const installs = Math.round(clicks * (0.2 + ci * 0.01));
      raw.push({
        Date: date,
        Channel: ci % 2 === 0 ? "블로그" : "유튜브",
        ContentID: c.id,
        Hook: c.hook,
        Format: c.format,
        Impr: impressions,
        Clicks: clicks,
        Subs: installs,
      });
    });
  }
  const slice = { raw, headers, mapping, fileName: "content_freshness.csv" };
  useAppStore.setState({
    currentRouteId: "9-6",
    csvGroups: { ...useAppStore.getState().csvGroups, content_freshness: slice },
    csvData: slice,
  });
}

describe("ContentFreshness render smoke", () => {
  beforeEach(() => seedNoData());

  it("mounts without throwing in the no-data state (auto-loads demo)", () => {
    expect(() => render(<ContentFreshness />)).not.toThrow();
    // No-data → CsvUploader auto-loads sample data, replacing the uploader-prep block.
    expect(screen.queryByText("데이터 준비")).toBeFalsy();
  });

  it("mounts without throwing with a valid seeded content CSV", () => {
    seedWithData();
    expect(() => render(<ContentFreshness />)).not.toThrow();
    // With-data branch renders the §3 per-content metrics table heading
    // (content-domain label: "콘텐츠별 성과표").
    expect(screen.getByText(/콘텐츠별 성과표/)).toBeTruthy();
    // Ported sections mount with content labels: §5 신선도 저하 진단, §7 발행 일정 추천.
    expect(screen.getAllByText(/신선도 저하 진단/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/발행 일정 추천/).length).toBeGreaterThan(0);
    // §8 Concept Matrix section is present (falls back to "생성 불가" here since
    // message_angle isn't in the seed mapping — honest empty state).
    expect(screen.getAllByText(/조합별 성과표/).length).toBeGreaterThan(0);
  });
});
