// @vitest-environment jsdom
//
// Render-smoke for MarketingEfficiency / Saturation (5-22). Regression net for
// render/mount-effect crashes. Golden tests cover satMath/ALLOC_MATH; this
// asserts the component MOUNTS without throwing in the no-data and with-data
// states (including the response-curve chart effect once >=1 fittable entity).
import { describe, it, expect, beforeEach } from "vitest";
import { render, screen, act, fireEvent } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import MarketingEfficiency from "@/components/tools/MarketingEfficiency";

const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "5-22",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: EMPTY_CSV },
    csvData: EMPTY_CSV,
  });
}

// A minimal VALID efficiency CSV for saturation: channel/cost/installs/date.
// Each channel needs >= SAT_CONFIG.minPoints (4) daily observations with
// cost>0 & result>0 to fit a response curve, so span 12 days × 2 channels.
// mapping = { origHeader: standardKey }.
function seedWithData() {
  const headers = ["Date", "Country", "Platform", "Channel", "Campaign", "Spend", "Installs", "Actions", "Revenue D7"];
  const mapping = {
    Date: "date",
    Country: "country",
    Platform: "platform",
    Channel: "channel",
    Campaign: "campaign_name",
    Spend: "cost",
    Installs: "installs",
    Actions: "actions",
    "Revenue D7": "revenue_d7",
  };
  const raw = [];
  const channels = ["Google", "Meta"];
  for (let d = 1; d <= 12; d++) {
    const date = `2026-01-${String(d).padStart(2, "0")}`;
    for (const ch of channels) {
      const cost = ch === "Google" ? 100000 + d * 6000 : 80000 + d * 5000;
      // deterministic diminishing returns (result grows sub-linearly with cost) — §8, no Math.random
      const installs = Math.round(Math.pow(cost, 0.85) / (ch === "Google" ? 40 : 34));
      const actions = Math.max(1, Math.round(installs * 0.35));
      raw.push({
        Date: date,
        Country: "KR",
        Platform: "iOS",
        Channel: ch,
        Campaign: `${ch} Brand`,
        Spend: cost,
        Installs: installs,
        Actions: actions,
        "Revenue D7": actions * (ch === "Google" ? 12000 : 8000),
      });
    }
  }
  const slice = { raw, headers, mapping, fileName: "sat.csv" };
  useAppStore.setState({
    currentRouteId: "5-22",
    csvGroups: { ...useAppStore.getState().csvGroups, efficiency: slice },
    csvData: slice,
  });
}

describe("MarketingEfficiency render smoke", () => {
  beforeEach(() => {
    seedNoData();
    useAppStore.setState({ denomBasis: "installs" });
  });

  it("mounts without throwing in the no-data state (upload screen)", () => {
    expect(() => render(<MarketingEfficiency />)).not.toThrow();
    // 데모 자동로드를 없앴으므로 no-data는 업로드 대기 상태가 정상이다.
    expect(screen.queryByText(/CSV 업로드 대기/)).toBeTruthy();
  });

  it("mounts without throwing with a valid seeded CSV", () => {
    seedWithData();
    expect(() => render(<MarketingEfficiency />)).not.toThrow();
    // With-data branch renders the saturation diagnosis hero.
    expect(screen.getByText(/마케팅 효율 진단/)).toBeTruthy();
  });

  // Analysis gate: results hidden until analyzed; visible after. The tool's own
  // ▶ 분석하기 button was removed in #5 dedup — CsvUploader now owns the single
  // gate button which sets the store group signature. So we drive the gate via
  // the store (setGroupAnalyzed) and re-render to verify the gated content.
  it("gates results behind the 분석하기 button", () => {
    seedWithData();
    const { rerender } = render(<MarketingEfficiency />);
    // Before analyze: gate placeholder shown, no §0 summary section yet.
    expect(screen.getByText(/분석 대기 중/)).toBeTruthy();
    expect(screen.queryByText(/한눈에 보기/)).toBeNull();
    // Set the group gate (as CsvUploader's analyze button would).
    act(() => useAppStore.getState().setGroupAnalyzed("5-22"));
    rerender(<MarketingEfficiency />);
    // After analyze: §0 summary + §1 ranking render.
    expect(screen.getByText(/한눈에 보기/)).toBeTruthy();
    // "포화도 순위" now appears twice (section heading + right-side TOC link
    // added via ToolPageShell) — assert at least one match rather than a
    // single unique node.
    expect(screen.getAllByText(/포화도 순위/).length).toBeGreaterThan(0);
    expect(screen.getByText("채널별 증액·감액 우선순위")).toBeTruthy();
    expect(screen.getByRole("img", { name: /채널 Cost와 CPA 의사결정 지도/ })).toBeTruthy();
    expect(screen.getByText("평균 효율 vs 다음 예산 투입 시 한계효율")).toBeTruthy();
    expect(screen.queryByText(/다음 1원/)).toBeNull();
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).not.toBe("");
    expect(screen.getByLabelText("검증 지표").value).toBe("CPI");
    // Currency toggle lives ONLY in Header now (design-system: single global
    // toggle, no per-tool duplicates) — not asserted here.
  });

  it("switches the decision map between channel/campaign and CPA/ROAS contracts", () => {
    seedWithData();
    useAppStore.getState().setGroupAnalyzed("5-22");
    render(<MarketingEfficiency />);

    fireEvent.click(screen.getByRole("button", { name: "캠페인" }));
    fireEvent.click(screen.getByRole("button", { name: "ROAS (높을수록 좋음)" }));
    expect(screen.getByText("캠페인별 증액·감액 우선순위")).toBeTruthy();
    expect(screen.getByRole("img", { name: /캠페인 Cost와 ROAS 의사결정 지도/ })).toBeTruthy();
    expect(screen.getByRole("list", { name: "캠페인별 평균·한계효율 차이" })).toBeTruthy();
    expect(screen.queryByText("종료 검토")).toBeNull();
    expect(screen.getAllByText("관찰·개선").length).toBeGreaterThan(0);
  });

  it("uses a marginal-gap row to select the matching response curve", () => {
    seedWithData();
    useAppStore.getState().setGroupAnalyzed("5-22");
    render(<MarketingEfficiency />);

    fireEvent.click(screen.getByRole("button", { name: "Meta" }));
    expect(screen.getByRole("button", { name: "Meta 응답곡선 보기" }).getAttribute("aria-pressed")).toBe("true");
    expect(screen.getByRole("button", { name: "Meta" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("shows the average-to-marginal values as a hover tip on each marginal-gap row", () => {
    seedWithData();
    useAppStore.getState().setGroupAnalyzed("5-22");
    const { container } = render(<MarketingEfficiency />);

    const tips = container.querySelectorAll(".marginal-gap__tip");
    expect(tips.length).toBeGreaterThan(0);
    tips.forEach((tip) => {
      expect(tip.textContent).toMatch(/평균 .+ → 한계 .+ · /);
      expect(["left", "right"]).toContain(tip.getAttribute("data-side"));
    });
  });

  it("uses a locale-safe English title without a one-dollar expression", () => {
    seedWithData();
    useAppStore.getState().setGroupAnalyzed("5-22");
    render(<MarketingEfficiency locale="en" />);

    expect(screen.getByText("Average efficiency vs. marginal efficiency on the next budget increase")).toBeTruthy();
    expect(screen.queryByText(/next dollar/i)).toBeNull();
  });

  it("follows the shared install/signup basis after it has already mounted", () => {
    seedWithData();
    useAppStore.getState().setGroupAnalyzed("5-22");
    render(<MarketingEfficiency />);

    expect(screen.getByLabelText("검증 지표").value).toBe("CPI");
    act(() => useAppStore.getState().setDenomBasis("actions"));
    expect(screen.getByLabelText("검증 지표").value).toBe("CPA");
  });

  it("uses native buttons to select a response curve from the ranking table", () => {
    seedWithData();
    useAppStore.getState().setGroupAnalyzed("5-22");
    render(<MarketingEfficiency />);

    const google = screen.getByRole("button", { name: "Google 응답곡선 보기" });
    const meta = screen.getByRole("button", { name: "Meta 응답곡선 보기" });
    expect(google.tagName).toBe("BUTTON");
    expect(google.tabIndex).toBe(0);
    const initiallySelected = [google, meta].filter((button) => button.getAttribute("aria-pressed") === "true");
    expect(initiallySelected).toHaveLength(1);
    const next = initiallySelected[0] === google ? meta : google;

    next.focus();
    expect(document.activeElement).toBe(next);
    fireEvent.click(next);
    expect(next.getAttribute("aria-pressed")).toBe("true");
    expect(initiallySelected[0].getAttribute("aria-pressed")).toBe("false");
  });
});
