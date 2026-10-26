// @vitest-environment jsdom
import { confirmReviewSave } from "@/test/reviewSaveBoundary";
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
import { openResultDetails } from "@/test/resultDetails";
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

// 설계 선언은 결과 위 조건 줄의 "조건 바꾸기" 창 안에 있다 — 사람이 하듯 열고, 선언하고, 닫는다.
function confirmDesign(locale = "ko", share = "50") {
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Change settings" : "조건 바꾸기" }));
  fireEvent.change(screen.getByLabelText(locale === "en" ? "Planned Control share (%)" : "계획 Control 배정 비율 (%)"), { target: { value: share } });
  fireEvent.click(screen.getByRole("checkbox", { name: locale === "en" ? /distinct assigned units/ : /중복 없는 배정 단위/ }));
  fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Close" : "닫기" }));
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
    // 결과 파일을 들고 들어오면 판독 탭이 먼저다 — 설계 탭은 직접 눌러 연다.
    expect(() => render(<AbTestHoldout />)).not.toThrow();
    fireEvent.click(screen.getByRole("tab", { name: /실험 설계|설계/ }));
    expect(document.body.textContent.length).toBeGreaterThan(0);
    expect(screen.getByText("중간 판독 계획 · O’Brien–Fleming")).toBeTruthy();
    expect(screen.getByText(/계획 밖의 수시 확인에는 이 표를 적용하지 않습니다/)).toBeTruthy();
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
    confirmDesign();
    fireEvent.click(screen.getByText(/다음 마케팅 프로젝트로 만들기/));

    expect(screen.getByText("Test 전환율이 Control보다 유의하게 높았습니다")).toBeTruthy();
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toContain("제한적으로 롤아웃");
    // 도구의 구체적 라벨은 살아 있고, 판정 키는 5-4가 선언한 첫 목표(CVR)다.
    expect(screen.getByLabelText("목표 (성공의 정의)").value).toBe("cvr");
    expect(screen.getByLabelText("현재 기준값 (선택)").value).toBe("5.00% (Control 전환율)");
    expect(screen.getByLabelText("검토일에 답할 질문").value).toContain("Control 기준 5.00%");

    fireEvent.click(screen.getByRole("button", { name: "이대로 만들기" }));
    confirmReviewSave();
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
    confirmDesign();
    fireEvent.click(screen.getByText(/다음 마케팅 프로젝트로 만들기/));

    expect(screen.getByText(conclusion)).toBeTruthy();
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toBe(action);
    expect(screen.getByLabelText("현재 기준값 (선택)").value).toBe("5.00% (Control 전환율)");
  });

  it("provides the same explicit decision prefill in English", () => {
    seedWithData({ variantBNumerator: 500, includeVariantC: false });
    render(<AbTestHoldout locale="en" />);
    fireEvent.click(screen.getByText("② A/B readout · Which side won?"));
    confirmDesign("en");
    fireEvent.click(screen.getByText(/Make it my next marketing project/));

    expect(screen.getByText("The current sample cannot distinguish the Test and Control conversion rates")).toBeTruthy();
    expect(screen.getByLabelText("What will change?").value).toContain("pre-planned sample size");
    expect(screen.getByLabelText("Goal (what counts as success)").value).toBe("cvr");
    expect(screen.getByLabelText("Current baseline (optional)").value).toBe("5.00% (Control conversion rate)");
  });

  it("does not turn an aggregate of multiple variants into a fictitious Test action", () => {
    seedWithData();
    render(<AbTestHoldout />);
    fireEvent.click(screen.getByText("② A/B 판독 · 어느 쪽이 이겼나?"));

    // 결론은 합산 Test가 아니라 Holm 보정 arm별 판정에서 온다.
    const headline = document.querySelector(".result-action-card__headline").textContent;
    expect(headline).toMatch(/variant_c/);
    expect(headline).toMatch(/Holm 보정/);
    expect(screen.queryByText("대량 검정 (arm_id별)")).toBeNull();
    openResultDetails();
    expect(screen.getByText("대량 검정 (arm_id별)")).toBeTruthy();
    expect(screen.getByText(/전체 변형 합산/)).toBeTruthy();
    expect(screen.queryByText(/다음 마케팅 프로젝트로 만들기/)).toBeNull();
  });

  it.each(["ko", "en"])("reads out as an executive report: conclusion with 95%% interval, three figures, arm table, details closed (%s)", (locale) => {
    seedWithData({ variantBNumerator: 590, includeVariantC: false });
    const { container } = render(<AbTestHoldout locale={locale} />);
    const en = locale === "en";
    fireEvent.click(screen.getByRole("tab", { name: en ? /A\/B readout/ : /A\/B 판독/ }));
    const card = container.querySelector(".result-action-card");
    const headline = card.querySelector(".result-action-card__headline").textContent;
    // 배정 비율을 선언하기 전에는 채택 권고가 아니라 개선 후보다.
    expect(headline).toMatch(en ? /variant_b improvement candidate/ : /variant_b 개선 후보/);
    expect(headline).toMatch(/\+0\.90%p \(95% \+0\.\d{2} ~ \+1\.\d{2}%p\)/);
    expect(card.querySelectorAll(".result-action-card__stats > div")).toHaveLength(3);
    expect(card.querySelector(".tool-core-figure .result-effect")).toBeTruthy();
    const table = card.querySelector(".result-table");
    expect(table.textContent).toMatch(en ? /Results by arm/ : /실험군별 결과/);
    expect(table.querySelectorAll("tbody tr")).toHaveLength(2);
    const toggle = card.querySelector("[data-result-details-toggle]");
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("#ab-bar")).toBeNull();
    confirmDesign(locale);
    expect(card.querySelector(".result-action-card__headline").textContent).toMatch(en ? /Adopt variant_b/ : /variant_b 채택 권고/);
  });

  it("holds with the extra sample the engine requires when the interval includes zero", () => {
    seedWithData({ variantBNumerator: 520, includeVariantC: false });
    render(<AbTestHoldout />);
    fireEvent.click(screen.getByText("② A/B 판독 · 어느 쪽이 이겼나?"));
    const headline = document.querySelector(".result-action-card__headline").textContent;
    expect(headline).toMatch(/^판단 보류 — 차이 \+0\.20%p \(95% −0\.\d{2} ~ \+0\.\d{2}%p\)/);
    expect(headline).toMatch(/관측 차이 기준 그룹당 약 [\d,]+명 더 필요/);
    expect(headline).not.toMatch(/효과 없음$/);
  });

  it.each(["ko", "en"])("withholds the action when observed allocation contradicts the plan (%s)", (locale) => {
    seedWithData({ variantBNumerator: 590, includeVariantC: false });
    render(<AbTestHoldout locale={locale} />);
    fireEvent.click(screen.getByRole("tab", { name: locale === "en" ? /A\/B readout/ : /A\/B 판독/ }));
    expect(screen.queryByText(locale === "en" ? /Make it my next marketing project/ : /다음 마케팅 프로젝트로 만들기/)).toBeNull();
    confirmDesign(locale, "80");
    expect(screen.getAllByText(locale === "en" ? /Allocation mismatch/ : /배정 비율 이상/).length).toBeGreaterThan(0);
    expect(screen.queryByText(locale === "en" ? /Make it my next marketing project/ : /다음 마케팅 프로젝트로 만들기/)).toBeNull();
  });
});
