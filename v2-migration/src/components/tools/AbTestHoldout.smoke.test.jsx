// @vitest-environment jsdom
//
// Render-smoke for AbTestHoldout (5-4, experiment group). Regression net for
// the CampaignPvm-class crashes: a route component that throws during render or
// a mount effect. Golden tests (src/utils/*.test.js) cover the pure math; this
// asserts the component MOUNTS without throwing in both the no-data and
// with-data states, and across the three tabs it exposes.
//
// AbTestHoldout reads the CSV RAW columns directly (row.is_control,
// row.numerator, row.denominator, row.holdout_group, ...) — it does NOT go
// through getMappedRows — so the seeded slice carries those raw headers. A
// pass-through mapping keeps the store slice shape identical to real uploads.
import { describe, it, expect, beforeEach } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";
import AbTestHoldout from "@/components/tools/AbTestHoldout";

// Empty CSV slice = the "no data yet, show uploader" state.
const EMPTY_CSV = { raw: [], headers: [], mapping: {}, fileName: "" };

function seedNoData() {
  useAppStore.setState({
    currentRouteId: "5-4",
    csvGroups: { ...useAppStore.getState().csvGroups, experiment: EMPTY_CSV },
    csvData: EMPTY_CSV,
    decisionRecords: [],
  });
}

// A minimal but VALID experiment CSV: readout (is_control/numerator/denominator
// + arm_id for the mass-readout table) AND holdout (holdout_group/numerator/
// denominator + spend/revenue_d7) columns coexist so BOTH the "readout" and
// "holdout" tabs have real data to aggregate. Deterministic — NO Math.random.
function seedWithData({ variantBNumerator = 560, variantCNumerator = 590, includeVariantC = true } = {}) {
  const headers = [
    "arm_id", "is_control", "holdout_group",
    "numerator", "denominator", "spend", "revenue_d7",
  ];
  // pass-through mapping (component reads raw keys; mapping mirrors real uploads)
  const mapping = {
    arm_id: "arm_id", is_control: "is_control", holdout_group: "holdout_group",
    numerator: "numerator", denominator: "denominator",
    spend: "spend", revenue_d7: "revenue_d7",
  };
  const raw = [
    // Control arm (also the holdout/control group)
    { arm_id: "control", is_control: "1", holdout_group: "control",
      numerator: 500, denominator: 10000, spend: 0, revenue_d7: 0 },
    // Variant B arm (exposed/test group)
    { arm_id: "variant_b", is_control: "0", holdout_group: "test",
      numerator: variantBNumerator, denominator: 10000, spend: 2000000, revenue_d7: 3200000 },
  ];
  if (includeVariantC) raw.push(
    // Variant C arm (also test/exposed) — gives mass-readout >=2 non-control arms
    { arm_id: "variant_c", is_control: "0", holdout_group: "test",
      numerator: variantCNumerator, denominator: 10000, spend: 1800000, revenue_d7: 3400000 },
  );
  const slice = { raw, headers, mapping, fileName: "experiment.csv" };
  useAppStore.setState({
    currentRouteId: "5-4",
    csvGroups: { ...useAppStore.getState().csvGroups, experiment: slice },
    csvData: slice,
  });
}

describe("AbTestHoldout render smoke", () => {
  beforeEach(() => {
    seedNoData();
  });

  it("mounts without throwing in the no-data state", () => {
    expect(() => render(<AbTestHoldout />)).not.toThrow();
    // The three top-level tabs render regardless of data (question-framed labels).
    expect(screen.getByText("② A/B 판독 · 어느 쪽이 이겼나?")).toBeTruthy();
  });

  it("exposes keyboard-operable primary tabs", () => {
    render(<AbTestHoldout />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(2);
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(tabs[1].id);
  });

  it("mounts without throwing with a valid seeded CSV (design + charts)", () => {
    seedWithData();
    // Default tab is "design" — exercises plan compute, threshold matrix, power curve chart.
    expect(() => render(<AbTestHoldout />)).not.toThrow();
    expect(document.body.textContent.length).toBeGreaterThan(0);
  });

  it("describes continuous readout with the same Student-t contract used by the engine", () => {
    const { container } = render(<AbTestHoldout />);
    fireEvent.click(screen.getByText("수동 결과 판독"));
    fireEvent.click(screen.getByText("평균값 (CPR·ARPPU·매출)"));
    const inputs = container.querySelectorAll("#s-body input");
    fireEvent.change(inputs[0], { target: { value: "2" } });
    fireEvent.change(inputs[3], { target: { value: "2" } });

    expect(screen.getByText("Welch t 검정 · 평균 비교")).toBeTruthy();
    expect(screen.getByText(/Student-t 분포로 계산했지만/)).toBeTruthy();
    expect(screen.queryByText(/t-분포 기반 검정을 권장/)).toBeNull();
  });

  it("blocks an impossible CSV readout instead of producing a significance verdict", () => {
    seedWithData();
    const current = useAppStore.getState().csvData;
    const invalid = { ...current, raw: [{ arm_id: "control", is_control: "1", numerator: 101, denominator: 100 }], fileName: "invalid.csv" };
    useAppStore.setState({ csvGroups: { ...useAppStore.getState().csvGroups, experiment: invalid }, csvData: invalid });
    render(<AbTestHoldout />);
    fireEvent.click(screen.getByText("② A/B 판독 · 어느 쪽이 이겼나?"));
    expect(screen.getByText("판독할 수 없는 행이 있습니다")).toBeTruthy();
    expect(screen.queryByText("유의성 검정 (Control vs Test)")).toBeNull();
  });

  it("prefills and stores a significant-improvement review under tool 5-4", () => {
    seedWithData({ variantBNumerator: 590, includeVariantC: false });
    render(<AbTestHoldout />);
    fireEvent.click(screen.getByText("② A/B 판독 · 어느 쪽이 이겼나?"));
    fireEvent.click(screen.getByText(/다음 검토 약속 만들기/));

    expect(screen.getByText("Test 전환율이 Control보다 유의하게 높았습니다")).toBeTruthy();
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toContain("제한적으로 롤아웃");
    expect(screen.getByLabelText("검증 지표").value).toBe("Control 대비 Test 전환율");
    expect(screen.getByLabelText("현재 기준값 (선택)").value).toBe("5.00% (Control 전환율)");
    expect(screen.getByLabelText("검토일에 답할 질문").value).toContain("Control 기준 5.00%");

    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
    expect(useAppStore.getState().decisionRecords[0]).toMatchObject({
      toolId: "5-4",
      action: "Test를 제한적으로 롤아웃하고 Control을 유지해 전환율을 계속 비교한다",
      baseline: "5.00% (Control 전환율)",
      hypothesis: "",
      sourcePeriod: "",
    });
  });

  it.each([
    {
      label: "significant decline",
      numerators: { variantBNumerator: 400, includeVariantC: false },
      conclusion: "Test 전환율이 Control보다 유의하게 낮았습니다",
      action: "Test 출시를 보류하고 Control을 유지한다",
    },
    {
      label: "non-significant result",
      numerators: { variantBNumerator: 500, includeVariantC: false },
      conclusion: "현재 표본에서는 Test와 Control 전환율 차이를 판정할 수 없습니다",
      action: "사전 계획한 표본 수에 도달할 때까지 Control과 Test를 유지하고 판정을 보류한다",
    },
  ])("uses the explicit $label action", ({ numerators, conclusion, action }) => {
    seedWithData(numerators);
    render(<AbTestHoldout />);
    fireEvent.click(screen.getByText("② A/B 판독 · 어느 쪽이 이겼나?"));
    fireEvent.click(screen.getByText(/다음 검토 약속 만들기/));

    expect(screen.getByText(conclusion)).toBeTruthy();
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toBe(action);
    expect(screen.getByLabelText("현재 기준값 (선택)").value).toBe("5.00% (Control 전환율)");
  });

  it("provides the same explicit decision prefill in English", () => {
    seedWithData({ variantBNumerator: 500, includeVariantC: false });
    render(<AbTestHoldout locale="en" />);
    fireEvent.click(screen.getByText("② A/B readout · Which side won?"));
    fireEvent.click(screen.getByText(/Schedule the next review/));

    expect(screen.getByText("The current sample cannot distinguish the Test and Control conversion rates")).toBeTruthy();
    expect(screen.getByLabelText("What will change?").value).toContain("pre-planned sample size");
    expect(screen.getByLabelText("Metric to review").value).toBe("Test conversion rate vs Control");
    expect(screen.getByLabelText("Current baseline (optional)").value).toBe("5.00% (Control conversion rate)");
  });

  it("does not turn an aggregate of multiple variants into a fictitious Test action", () => {
    seedWithData();
    render(<AbTestHoldout />);
    fireEvent.click(screen.getByText("② A/B 판독 · 어느 쪽이 이겼나?"));

    expect(screen.getByText("대량 검정 (arm_id별)")).toBeTruthy();
    expect(screen.getByText(/2개 variant를 합친 참고값/)).toBeTruthy();
    expect(screen.queryByText(/다음 검토 약속 만들기/)).toBeNull();
  });
});
