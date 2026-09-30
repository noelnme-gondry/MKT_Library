// @vitest-environment jsdom
//
// Render-smoke for MarketingEfficiency / Saturation (5-22). Regression net for
// render/mount-effect crashes. Golden tests cover satMath/ALLOC_MATH; this
// asserts the component MOUNTS without throwing in the no-data and with-data
// states (including the response-curve chart effect once >=1 fittable entity).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, act, fireEvent, waitFor, within } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import MarketingEfficiency from "@/components/tools/MarketingEfficiency";
import { SAT_MATH } from "@/utils/satMath";

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
    useAppStore.setState({ analyzedByGroup: useAppStore.getInitialState().analyzedByGroup });
    useAppStore.setState({ denomBasis: "installs" });
  });

  it.each(["ko", "en"])("abstains when every channel is too sparse (%s)", (locale) => {
    seedWithData();
    const data = useAppStore.getState().csvData;
    const raw = data.raw.map((row, index) => ({ ...row, Channel: `Channel-${index}` }));
    useAppStore.getState().setCsvData({ ...data, raw });
    useAppStore.getState().setGroupAnalyzed("5-22");
    expect(useAppStore.getState().isGroupAnalyzed("5-22")).toBe(true);
    render(<MarketingEfficiency locale={locale} />);
    expect(screen.getAllByText(locale === "en" ? "Abstain — no analyzable items" : "판단 보류 — 분석 가능한 항목 없음").length).toBeGreaterThan(0);
    expect(screen.queryByText(/Mostly in the steady zone|대부분 적정 구간/)).toBeNull();
  });

  it.each(["ko", "en"])("runs period sensitivity from the actual tool (%s)", async (locale) => {
    seedWithData();
    useAppStore.getState().setGroupAnalyzed("5-22");
    render(<MarketingEfficiency locale={locale} />);
    fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Check period sensitivity" : "기간 민감도 확인" }));
    await waitFor(() => expect(screen.getByText(locale === "en" ? "Google: Not comparable" : "Google: 비교 불가")).toBeTruthy());
    expect(screen.getByRole("button", { name: locale === "en" ? "Download period evidence CSV" : "기간 근거 CSV 받기" })).toBeTruthy();
  });

  it("mounts without throwing in the no-data state (upload screen)", () => {
    expect(() => render(<MarketingEfficiency />)).not.toThrow();
    // 데모 자동로드를 없앴으므로 no-data는 업로드 대기 상태가 정상이다.
    expect(screen.queryByRole("region", { name: "데이터 준비" })).toBeTruthy();
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
    expect(document.querySelector("#s-sat-summary .result-action-card")).toBeNull();
    // Set the group gate (as CsvUploader's analyze button would).
    act(() => useAppStore.getState().setGroupAnalyzed("5-22"));
    rerender(<MarketingEfficiency />);
    // After analyze: §0 summary + §1 ranking render.
    expect(document.querySelector("#s-sat-summary .result-action-card")).toBeTruthy();
    // "포화도 순위" now appears twice (section heading + right-side TOC link
    // added via ToolPageShell) — assert at least one match rather than a
    // single unique node.
    expect(screen.getAllByText(/포화도 순위/).length).toBeGreaterThan(0);
    expect(screen.getByText("채널별 증액·감액 우선순위")).toBeTruthy();
    expect(screen.getByRole("img", { name: /채널 Cost와 CPI 의사결정 지도/ })).toBeTruthy();
    expect(screen.getByText("평균 효율 vs 다음 예산 투입 시 한계효율")).toBeTruthy();
    expect(screen.queryByText(/다음 1원/)).toBeNull();
    fireEvent.click(document.querySelector(".decision-review-launch"));
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).not.toBe("");
    fireEvent.click(document.querySelector(".decision-review-launch"));
    expect(screen.getByLabelText("목표 (성공의 정의)").value).toBe("cpi");
    // Currency toggle lives ONLY in Header now (design-system: single global
    // toggle, no per-tool duplicates) — not asserted here.
  });

  it("does not fit before analysis or refit for display-only changes", () => {
    const fit = vi.spyOn(SAT_MATH, "analyzeEntity");
    try {
      seedWithData();
      render(<MarketingEfficiency />);
      expect(fit).not.toHaveBeenCalled();
      act(() => useAppStore.getState().setGroupAnalyzed("5-22"));
      expect(fit).toHaveBeenCalledTimes(2);
      fireEvent.click(screen.getByRole("button", { name: "ROAS (높을수록 좋음)" }));
      fireEvent.click(screen.getByRole("button", { name: "Meta 응답곡선 보기" }));
      expect(fit).toHaveBeenCalledTimes(2);
    } finally { fit.mockRestore(); }
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

  it("keeps average and marginal values visible beside their plot with individual bottom scales", () => {
    seedWithData();
    useAppStore.getState().setGroupAnalyzed("5-22");
    const { container } = render(<MarketingEfficiency />);

    const rows = container.querySelectorAll(".marginal-gap__row");
    expect(rows.length).toBeGreaterThan(0);
    rows.forEach((row) => {
      expect(row.querySelector(".marginal-gap__label.is-average").textContent).toMatch(/평균.+/);
      expect(row.querySelector(".marginal-gap__label.is-marginal").textContent).toMatch(/한계.+/);
      expect(row.querySelectorAll(".marginal-gap__axis span").length).toBe(3);
    });
    expect(container.querySelector(".marginal-gap__tip")).toBeNull();
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

    fireEvent.click(document.querySelector(".decision-review-launch"));
    expect(screen.getByLabelText("목표 (성공의 정의)").value).toBe("cpi");
    act(() => useAppStore.getState().setDenomBasis("actions"));
    fireEvent.click(document.querySelector(".decision-review-launch"));
    expect(screen.getByLabelText("목표 (성공의 정의)").value).toBe("cpa");
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


// 사용자 진입 → 게이트 → 명령 입력 → 공유 필터/레시피 경로를 함께 검증한다.
describe("Saturation result autonomy", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    useAppStore.setState({ ...useAppStore.getInitialState(), savedSetupApplied: 0, savedSetupAppliedTool: null, savedSetupAppliedInputs: {}, savedSetupAppliedProject: null });
    useAppStore.getState().setCurrentRouteId("5-22");
    seedWithData();
    useAppStore.getState().setGroupAnalyzed("5-22");
    expect(useAppStore.getState().isGroupAnalyzed("5-22")).toBe(true);
  });
  const choose = (query, label, locale = "ko") => {
    const input = screen.getByRole("combobox", { name: locale === "en" ? "Analysis setup" : "분석 설정" });
    fireEvent.change(input, { target: { value: query } });
    const option = screen.getAllByRole("option").find((item) => within(item).queryByText(label, { exact: true }));
    expect(option).toBeTruthy();
    fireEvent.mouseDown(option);
  };

  it.each(["ko", "en"])("applies axis and view steps without refitting for display/export settings (%s)", (locale) => {
    const fit = vi.spyOn(SAT_MATH, "analyzeEntity");
    const { container } = render(<MarketingEfficiency locale={locale} />);
    expect(fit).toHaveBeenCalledTimes(2);
    choose("PNG", locale === "en" ? "PNG without header" : "PNG에 머리글 넣지 않기", locale);
    choose("top5", locale === "en" ? "Show top 5" : "상위 5개만 보기", locale);
    choose("Google", locale === "en" ? "Show Google only" : "Google만 보기", locale);
    expect(container.querySelectorAll("#s-sat tbody tr")).toHaveLength(1);
    expect(container.querySelector("#s-sat tbody").textContent).toContain("Google");
    expect(screen.getByText(locale === "en" ? /1 ranking row.*hidden/ : /순위표 1개 행을 가렸습니다/)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "ROAS (higher is better)" : "ROAS (높을수록 좋음)" }));
    expect(fit).toHaveBeenCalledTimes(2);
    choose("OS", locale === "en" ? "By OS" : "OS별", locale);
    expect(fit).toHaveBeenCalledTimes(3);
    expect(within(container.querySelector("#s-sat")).getByRole("columnheader", { name: "OS" })).toBeTruthy();
    expect(container.querySelector("#s-sat-curve h2").textContent).toContain("iOS");
    expect(screen.getByText(locale === "en" ? /does not match the ranking axis/ : /현재 순위표의 축이 아니어서/)).toBeTruthy();
    const saved = useAppStore.getState().viewConfig["analysis-inputs:5-22"].recipeSteps;
    expect(saved).toContainEqual({ id: "level.field", params: { field: "platform" } });
    fit.mockRestore();
  });

  it.each(["ko", "en"])("routes scope commands through shared filters and rejects an empty scope (%s)", (locale) => {
    const { container } = render(<MarketingEfficiency locale={locale} />);
    choose("Meta", locale === "en" ? "Analyze Meta only" : "Meta만 분석", locale);
    expect([...useAppStore.getState().dashboardFilter.channels]).toEqual(["Meta"]);
    expect(container.querySelectorAll("#s-sat tbody tr")).toHaveLength(1);
    choose("Meta", locale === "en" ? "Analyze without Meta" : "Meta 제외하고 분석", locale);
    expect(screen.getByText(locale === "en" ? /no values would remain/ : /분석할 값이 남지 않아/)).toBeTruthy();
    expect([...useAppStore.getState().dashboardFilter.channels]).toEqual(["Meta"]);
    fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Remove Channel: Meta" : "채널: Meta 빼기" }));
    expect(container.querySelectorAll("#s-sat tbody tr")).toHaveLength(2);
  });

  it.each(["ko", "en"])("hides and restores optional figures while keeping evidence (%s)", (locale) => {
    const { container } = render(<MarketingEfficiency locale={locale} />);
    const hide = locale === "en" ? "Hide Response curve" : "응답곡선 숨기기";
    choose(hide, hide, locale);
    expect(container.querySelector("#s-sat-curve")).toBeNull();
    expect(container.querySelector('a[href="#s-sat-curve"]')).toBeNull();
    expect(container.querySelector("#s-marginal-gap")).toBeTruthy();
    expect(container.querySelector("#s-sat-summary")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: locale === "en" ? `Remove ${hide}` : `${hide} 빼기` }));
    expect(container.querySelector("#s-sat-curve canvas")).toBeTruthy();
  });

  it.each(["ko", "en"])("starts without a channel and migrates older saved setups after mounting (%s)", (locale) => {
    const original = useAppStore.getState().csvData;
    const mapping = { ...original.mapping, Channel: "__ignore__", Campaign: "__ignore__" };
    useAppStore.getState().setCsvData({ ...original, mapping });
    useAppStore.getState().setGroupAnalyzed("5-22");
    const { container } = render(<MarketingEfficiency locale={locale} />);
    expect(container.querySelector("#s-sat tbody").textContent).toContain("iOS");
    expect(within(container.querySelector("#s-sat")).getByRole("columnheader", { name: "OS" })).toBeTruthy();
    expect(screen.queryByText(locale === "en" ? /Compare with prior week/ : /직전주와 비교/)).toBeNull();
    act(() => {
      useAppStore.getState().setCsvData(original);
      useAppStore.getState().setGroupAnalyzed("5-22");
      useAppStore.setState({ savedSetupAppliedTool: "5-22", savedSetupAppliedInputs: { satState: { grain: "campaign", metric: "roas", selected: "Google Brand" } }, savedSetupApplied: 1 });
    });
    expect(container.querySelector("#s-sat tbody").textContent).toContain("Meta Brand");
    expect(container.querySelector("#s-sat-curve h2").textContent).toContain("Google Brand");
    expect(within(container.querySelector("#s-sat")).getByRole("columnheader", { name: locale === "en" ? "Avg ROAS" : "평균 ROAS" })).toBeTruthy();
    expect(useAppStore.getState().viewConfig["analysis-inputs:5-22"].recipeSteps).toContainEqual({ id: "metric.saturation.roas", params: {} });
  });

  it.each(["ko", "en"])("keeps a saved raw axis visible as rejected when the next CSV lacks its column (%s)", (locale) => {
    const original = useAppStore.getState().csvData;
    const csv = { ...original, headers: [...original.headers, "Region"], raw: original.raw.map((row) => ({ ...row, Region: row.Channel === "Google" ? "East" : "West" })) };
    useAppStore.getState().setCsvData(csv);
    useAppStore.getState().setGroupAnalyzed("5-22");
    const { container } = render(<MarketingEfficiency locale={locale} />);
    choose("Region", locale === "en" ? "By Region" : "Region별", locale);
    expect(container.querySelector("#s-sat tbody").textContent).toContain("East");
    act(() => {
      useAppStore.getState().setCsvData(original);
      useAppStore.getState().setGroupAnalyzed("5-22");
    });
    expect(screen.getByRole("button", { name: locale === "en" ? /Remove By Region/ : /Region별 빼기/ })).toBeTruthy();
    expect(container.querySelector("#s-sat tbody").textContent).toContain("Google");
    expect(container.querySelector(".recipe-command").textContent).toMatch(locale === "en" ? /missing|Missing/ : /컬럼/);
    act(() => {
      useAppStore.getState().setCsvData(csv);
      useAppStore.getState().setGroupAnalyzed("5-22");
    });
    expect(container.querySelector("#s-sat tbody").textContent).toContain("East");
  });
});
