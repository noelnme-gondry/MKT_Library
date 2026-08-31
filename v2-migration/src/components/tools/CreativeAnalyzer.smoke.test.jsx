// @vitest-environment jsdom
//
// Render-smoke for CreativeAnalyzer (5-6). Regression net for render/mount-effect
// crashes. Golden tests cover CREATIVE_STATS / CREATIVE_FATIGUE; this asserts the
// component MOUNTS without throwing in the no-data and with-data states,
// including the fatigue + forest-plot chart effects and the WLS decompose path
// (needs creative attributes + >=30 clean rows).
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import CreativeAnalyzer from "@/components/tools/CreativeAnalyzer";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "5-6",
    csvGroups: { ...useAppStore.getState().csvGroups, creative: EMPTY_CSV },
    csvData: EMPTY_CSV,
    decisionRecords: [],
  });
}

// A minimal VALID creative CSV: creative_id + date + impressions + clicks (the
// deriveMetrics/fatigue inputs), plus installs (CVR) and two attribute columns
// (hook_type, message_angle, format) with >=30 clean rows so the WLS decompose
// and concept-matrix branches run.
// mapping = { origHeader: standardKey }.
function seedWithData() {
  const headers = ["Date", "Channel", "CreativeID", "Hook", "MessageAngle", "Format", "Impr", "Clicks", "Installs", "Spend"];
  const mapping = {
    Date: "date",
    Channel: "channel",
    CreativeID: "creative_id",
    Hook: "hook_type",
    MessageAngle: "message_angle",
    Format: "format",
    Impr: "impressions",
    Clicks: "clicks",
    Installs: "installs",
    Spend: "spend",
  };
  const raw = [];
  const creatives = [
    { id: "cr_A", hook: "question", format: "video" },
    { id: "cr_B", hook: "stat", format: "static" },
    { id: "cr_C", hook: "question", format: "static" },
    { id: "cr_D", hook: "stat", format: "video" },
    { id: "cr_E", hook: "question", format: "video" },
    { id: "cr_F", hook: "stat", format: "static" },
  ];
  // 20 days × 6 creatives = 120 rows. Deterministic decaying CTR (§8, no Math.random)
  // so first-signal risk zones also have a complete 7-day follow-up window.
  for (let d = 1; d <= 20; d++) {
    const date = `2026-01-${String(d).padStart(2, "0")}`;
    creatives.forEach((c, ci) => {
      const impressions = 5000 + ci * 400 + d * 50;
      // CTR decays over time (fatigue) + varies by creative attributes.
      const baseCtr = 0.05 + ci * 0.004;
      const ctr = Math.max(0.005, baseCtr - d * 0.002);
      const clicks = Math.round(impressions * ctr);
      const installs = Math.round(clicks * (0.2 + ci * 0.01));
      raw.push({
        Date: date,
        Channel: ci % 2 === 0 ? "Google" : "Meta",
        CreativeID: c.id,
        Hook: c.hook,
        MessageAngle: c.hook,
        Format: c.format,
        Impr: impressions,
        Clicks: clicks,
        Installs: installs,
        Spend: 1000 + ci * 100 + d * 20,
      });
    });
  }
  const slice = { raw, headers, mapping, fileName: "creative.csv" };
  useAppStore.setState({
    currentRouteId: "5-6",
    csvGroups: { ...useAppStore.getState().csvGroups, creative: slice },
    csvData: slice,
  });
}

// Full CSV incl. spend + actions + revenue_d7 so the CPA/ROAS decompose branches
// (metric='cpa': _metricVal=spend/actions,_w=actions; 'roas': rev/spend,_w=spend)
// are computed and their toggles enabled — lets us exercise the CPA/ROAS render
// paths (decomposeMetricMeta 원/배 fmtVal + sign-reversed color) via click.
function seedWithCpaRoasData() {
  const headers = [
    "Date", "Channel", "CreativeID", "Hook", "Format",
    "Impr", "Clicks", "Installs", "Actions", "Spend", "RevD7",
  ];
  const mapping = {
    Date: "date",
    Channel: "channel",
    CreativeID: "creative_id",
    Hook: "hook_type",
    Format: "format",
    Impr: "impressions",
    Clicks: "clicks",
    Installs: "installs",
    Actions: "actions",
    Spend: "spend",
    RevD7: "revenue_d7",
  };
  const raw = [];
  const creatives = [
    { id: "cr_A", hook: "question", format: "video" },
    { id: "cr_B", hook: "stat", format: "static" },
    { id: "cr_C", hook: "question", format: "static" },
    { id: "cr_D", hook: "stat", format: "video" },
  ];
  for (let d = 1; d <= 10; d++) {
    const date = `2026-01-${String(d).padStart(2, "0")}`;
    creatives.forEach((c, ci) => {
      const impressions = 5000 + ci * 400 + d * 50;
      const clicks = Math.round(impressions * 0.05);
      const installs = Math.round(clicks * 0.25);
      const isVideo = c.format === "video";
      const spend = 1000 + ci * 100 + d * 20;
      const actions = isVideo ? 20 + ci : 40 + ci; // video CPA↑
      raw.push({
        Date: date,
        Channel: ci % 2 === 0 ? "Google" : "Meta",
        CreativeID: c.id,
        Hook: c.hook,
        Format: c.format,
        Impr: impressions,
        Clicks: clicks,
        Installs: installs,
        Actions: actions,
        Spend: spend,
        RevD7: isVideo ? spend * 3 : spend * 1.5, // video ROAS↑
      });
    });
  }
  const slice = { raw, headers, mapping, fileName: "creative.csv" };
  useAppStore.setState({
    currentRouteId: "5-6",
    csvGroups: { ...useAppStore.getState().csvGroups, creative: slice },
    csvData: slice,
  });
}

describe("CreativeAnalyzer render smoke", () => {
  beforeEach(() => seedNoData());

  it("mounts without throwing in the no-data state (upload screen)", () => {
    // 데모 자동로드를 없앴으므로 no-data는 업로드/데이터 준비 화면이 정상이다.
    expect(() => render(<CreativeAnalyzer />)).not.toThrow();
    // No-data → CsvUploader auto-loads sample data, replacing the uploader-prep block.
    expect(screen.queryByText("데이터 준비")).toBeTruthy();
  });

  it("mounts without throwing with a valid seeded CSV", () => {
    seedWithData();
    let container;
    expect(() => {
      ({ container } = render(<CreativeAnalyzer />));
    }).not.toThrow();
    expect(screen.getByText(/어떤 소재가 성과를 만들었나/)).toBeTruthy();
    expect(screen.getByText(/운영 건강도/)).toBeTruthy();
    expect(screen.getAllByText(/다음에 무엇을 만들까/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/다음 테스트에서 무엇을 확인할까/).length).toBeGreaterThan(0);
    expect(screen.getByText(/누적 집행 위험 구간/)).toBeTruthy();
    expect(screen.getAllByText(/현재 위험 구간/).length).toBeGreaterThan(0);
    // 설명은 전체 폭 문단 대신 ds/HelpTip(details)로 접어 둔다. 예전에는 hover 전용
    // title이라 터치·키보드로는 열 수 없었고, 이 단언도 "툴팁 속성이 있다"를 확인하며
    // 그 상태를 고정하고 있었다 — 이제 실제로 열리는 내용을 본다(product-ssot §6.3).
    const sectionHelp = container.querySelector(".help-tip");
    expect(sectionHelp).toBeTruthy();
    expect(sectionHelp.textContent).toContain("분석 기준 지표");
    // details는 닫혀도 노드가 남는다. 설명이 기본 화면을 차지하지 않는지를 본다.
    expect(sectionHelp.closest("details").open).toBe(false);
    // The combination section remains present even when the seed produces an honest empty state.
    expect(screen.getAllByText(/어떤 요소 조합이 좋았나/).length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText(/다음 검토 약속/));
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toMatch(/cr_/);
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
    expect(useAppStore.getState().decisionRecords[0].toolId).toBe("9-6");
  });

  it("exercises CPA/ROAS decompose render paths without throwing (toggle click)", () => {
    seedWithCpaRoasData();
    let container;
    expect(() => {
      ({ container } = render(<CreativeAnalyzer />));
    }).not.toThrow();
    // CPA/ROAS toggle buttons should be enabled (inputs mapped + decompose computed).
    const btns = [...container.querySelectorAll("button.ab-pill")];
    const cpaBtn = btns.find((b) => b.textContent.trim() === "CPA");
    const roasBtn = btns.find((b) => b.textContent.trim() === "ROAS");
    expect(cpaBtn && !cpaBtn.disabled).toBe(true);
    expect(roasBtn && !roasBtn.disabled).toBe(true);
    // Clicking CPA re-renders §4 with 원-unit fmtVal + reversed-sign color path.
    expect(() => fireEvent.click(cpaBtn)).not.toThrow();
    expect(() => fireEvent.click(roasBtn)).not.toThrow();
  });

  it("uses native buttons to filter the performance table from the concept matrix", () => {
    seedWithData();
    render(<CreativeAnalyzer />);

    const cell = screen.getByRole("button", { name: "question × video 조합 필터" });
    expect(cell.tagName).toBe("BUTTON");
    expect(cell.tabIndex).toBe(0);
    expect(cell.getAttribute("aria-pressed")).toBe("false");

    cell.focus();
    expect(document.activeElement).toBe(cell);
    fireEvent.click(cell);
    expect(cell.getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("heading", { name: /어떤 소재가 성과를 만들었나.*필터됨/ })).toBeTruthy();
  });
});
