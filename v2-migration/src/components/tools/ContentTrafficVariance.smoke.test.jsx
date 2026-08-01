// @vitest-environment jsdom
//
// Render-smoke for ContentTrafficVariance (9-3, content_traffic group). It's a
// thin wrapper that renders <CampaignPvm domain="content" /> — same engine
// (PVM_MATH, golden-covered) as 5-21, content-domain labels (유입경로/카테고리/
// 콘텐츠, 방문당 비용). Asserts the wrapper mounts without throwing in the
// no-data and with-data states (content vocabulary CSV: traffic_source /
// category / content_id / cost / traffic across 3 calendar weeks so the PVM
// lookback compare isn't fully locked). Deterministic — NO Math.random (§8).
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import ContentTrafficVariance from "@/components/tools/ContentTrafficVariance";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "9-3",
    csvGroups: { ...useAppStore.getState().csvGroups, content_traffic: EMPTY_CSV },
    csvData: EMPTY_CSV,
  });
}

// A minimal VALID content-traffic CSV. PVM needs >=2 calendar weeks; span 21
// days (3 weeks) from Monday 2026-01-05 across 2 traffic sources. Only traffic
// maps to installs (no actions) → bothMetricsMapped=false → metric toggle hidden.
function seedWithData() {
  const headers = ["date", "traffic_source", "category", "content_id", "cost", "traffic"];
  const mapping = {
    date: "date",
    traffic_source: "channel",
    category: "campaign_id",
    content_id: "creative_id",
    cost: "cost",
    traffic: "installs",
  };
  const raw = [];
  const sources = ["organic", "social"];
  for (let d = 5; d <= 25; d++) {
    const date = `2026-01-${String(d).padStart(2, "0")}`;
    for (const src of sources) {
      const traffic = src === "organic" ? 800 + d * 10 : 400 + d * 6; // NO Math.random
      const cost = src === "organic" ? traffic * 120 : traffic * 420;
      raw.push({
        date,
        traffic_source: src,
        category: "튜토리얼",
        content_id: `${src}_tut_1`,
        cost,
        traffic,
      });
    }
  }
  const slice = { raw, headers, mapping, fileName: "content_traffic.csv" };
  useAppStore.setState({
    currentRouteId: "9-3",
    csvGroups: { ...useAppStore.getState().csvGroups, content_traffic: slice },
    csvData: slice,
  });
}

function seedZeroTrafficData() {
  seedWithData();
  const current = useAppStore.getState().csvData;
  const raw = [
    ...current.raw,
    { date: "2026-01-08", traffic_source: "referral", category: "가이드", content_id: "zero_traffic", cost: 5000, traffic: 0 },
    { date: "2026-01-15", traffic_source: "referral", category: "가이드", content_id: "zero_traffic", cost: 7000, traffic: 0 },
  ];
  const slice = { ...current, raw, fileName: "content_zero_traffic.csv" };
  useAppStore.setState({
    csvGroups: { ...useAppStore.getState().csvGroups, content_traffic: slice },
    csvData: slice,
  });
}

describe("ContentTrafficVariance render smoke", () => {
  beforeEach(() => seedNoData());

  it("mounts without throwing in the no-data state (auto-loads demo)", () => {
    expect(() => render(<ContentTrafficVariance />)).not.toThrow();
    // No-data → CsvUploader auto-loads sample data, replacing the uploader-prep block.
    expect(screen.queryByRole("heading", { name: "데이터 준비" })).toBeFalsy();
  });

  it("mounts without throwing with a valid seeded content-traffic CSV", () => {
    seedWithData();
    expect(() => render(<ContentTrafficVariance />)).not.toThrow();
    // With-data branch renders the "한눈에 보기" §0 section (heading).
    expect(screen.getByRole("heading", { name: /한눈에 보기/ })).toBeTruthy();
  });

  it("uses content vocabulary when zero traffic makes the decomposition unidentified", () => {
    seedZeroTrafficData();
    render(<ContentTrafficVariance />);

    expect(screen.getByText("분해 불가")).toBeTruthy();
    expect(screen.getAllByText(/비용은 있지만 트래픽이 0/).length).toBeGreaterThan(0);
    expect(screen.queryByText(/비용은 있지만 전환이 0/)).toBeNull();
    expect(screen.queryByRole("button", { name: "결과 받기" })).toBeNull();
  });
});
