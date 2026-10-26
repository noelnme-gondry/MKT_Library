// @vitest-environment jsdom
import { confirmReviewSave } from "@/test/reviewSaveBoundary";
//
// Render-smoke for Incrementality (5-23). Asserts the component MOUNTS without
// throwing in the no-data state and with each method's demo data loaded
// (suppression + pre/post on/off), across method tab switches. Golden covers the
// pure math (incrPrePostMath / incrMath); this catches render-throw (§7).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import Papa from "papaparse";
import { useAppStore } from "@/store/useDataStore";
import Incrementality from "@/components/tools/Incrementality";
import { buildIncrSuppressionDemo, buildIncrPrepostDemo } from "@/utils/demoData";
import { openResultDetails } from "@/test/resultDetails";

// 설계 선언·대조군 설정은 결과 위 조건 줄의 "조건 바꾸기" 창 안에 있다 — 사람이 하듯 열고 닫는다.
// 결정 기록 창이 열려 있으면 바깥이 보조기술에서 숨겨지므로(역할 조회 불가) 조건 줄의 버튼은 이름 글자로 찾는다.
function openConditions(locale = "ko") {
  fireEvent.click(screen.getByText(locale === "en" ? "Change settings" : "조건 바꾸기", { selector: "button" }));
}
function closeConditions(locale = "ko") {
  const dialog = document.querySelector(".condition-dialog");
  fireEvent.click(within(dialog).getByText(locale === "en" ? "Close" : "닫기", { selector: "button" }));
}

function declareDesign(locale = "ko") {
  const en = locale === "en";
  openConditions(locale);
  for (const [label, value] of [
    [en ? "What did you compare?" : "비교한 대상은 무엇인가요?", "person"],
    [en ? "How were the two groups split?" : "두 그룹은 어떻게 나눴나요?", "randomized"],
    [en ? "Did you fix the dates before seeing results?" : "결과를 보기 전에 기간을 정했나요?", "planned"],
    [en ? "Did a promotion, season or tracking change happen in the same period?" : "같은 기간에 프로모션·시즌·추적 방식이 바뀐 적이 있나요?", "none"],
  ]) fireEvent.change(screen.getByLabelText(label), { target: { value } });
  const counts = screen.queryByLabelText(en ? "Is each person counted once over the whole period?" : "기간 전체에서 한 대상을 한 번씩만 셌나요?");
  if (counts) fireEvent.change(counts, { target: { value: "unique" } });
  closeConditions(locale);
}

const EMPTY = { raw: [], headers: [], mapping: {}, fileName: "" };

function seed(slice) {
  useAppStore.setState({
    currentRouteId: "5-23",
    csvGroups: { ...useAppStore.getState().csvGroups, incrementality: slice },
    csvData: slice,
    decisionRecords: [],
    projectsReady: true,
    projectSwitching: false,
  });
}

function asRealResult(slice, fileName = "incrementality-real.csv") {
  return { ...slice, fileName };
}

describe("Incrementality render smoke", () => {
  beforeEach(() => seed(EMPTY));

  it("mounts in no-data state", () => {
    expect(() => render(<Incrementality />)).not.toThrow();
  });

  it("waits for project restoration before accepting an upload", () => {
    useAppStore.setState({ projectsReady: false, projectSwitching: true, decisionPersistenceEnabled: true });
    const view = render(<Incrementality />);
    const input = view.container.querySelector('input[type="file"]');
    expect(input.disabled).toBe(true);
    act(() => useAppStore.setState({ projectsReady: true, projectSwitching: false }));
    expect(input.disabled).toBe(false);
  });

  it("tracks only aggregate CSV import outcomes", async () => {
    useAppStore.setState({ demoDisabled: true });
    window.gtag = vi.fn();
    const queued = [];
    vi.spyOn(Papa, "parse").mockImplementation((file, options) => {
      queued.push({ file, options });
      return undefined;
    });
    let view = render(<Incrementality />);
    const upload = () => view.container.querySelector('input[type="file"]');

    fireEvent.change(upload(), { target: { files: [new File(["private_group,secret_metric"], "confidential-holdout.csv", { type: "text/csv" })] } });
    await waitFor(() => expect(queued).toHaveLength(1));
    await act(async () => queued[0].options.complete({
      data: [{ private_group: "classified", secret_metric: "777" }],
      errors: [],
      meta: { fields: ["private_group", "secret_metric"] },
    }));

    view.unmount();
    seed(EMPTY);
    useAppStore.setState({ demoDisabled: true });
    view = render(<Incrementality />);
    fireEvent.change(upload(), { target: { files: [new File(["broken"], "broken-secret.csv", { type: "text/csv" })] } });
    await waitFor(() => expect(queued).toHaveLength(2));
    await act(async () => queued[1].options.complete({
      data: [{ private_group: "classified", secret_metric: "777" }],
      errors: [{ type: "Quotes", code: "MissingQuotes", row: 0 }],
      meta: { fields: ["private_group", "secret_metric"] },
    }));

    const eventCalls = window.gtag.mock.calls.filter(([kind]) => kind === "event");
    expect(eventCalls).toContainEqual(["event", "data_import_success", expect.objectContaining({ tool_id: "5-23", interaction_source: "csv", row_count: 1, column_count: 2 })]);
    expect(eventCalls).toContainEqual(["event", "data_import_failed", expect.objectContaining({ tool_id: "5-23", state: "parse_error" })]);
    expect(JSON.stringify(eventCalls)).not.toMatch(/confidential-holdout|private_group|classified|secret_metric|777/);
    delete window.gtag;
  });

  it("exposes keyboard-operable method tabs", () => {
    render(<Incrementality />);
    const tabs = screen.getAllByRole("tab");
    expect(tabs).toHaveLength(3);
    expect(tabs[0].getAttribute("aria-selected")).toBe("true");
    fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
    expect(tabs[1].getAttribute("aria-selected")).toBe("true");
    expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(tabs[1].id);
  });

  it.each(["ko", "en"])("withholds undeclared and contaminated designs, and resets declarations when the window changes (%s)", (locale) => {
    seed(asRealResult(buildIncrSuppressionDemo(), "design-result.csv"));
    render(<Incrementality locale={locale} />);
    const en = locale === "en";
    fireEvent.change(screen.getByLabelText(en ? "Holdout start date" : "홀드아웃 시작일"), { target: { value: "2024-05-12" } });
    fireEvent.change(screen.getByLabelText(en ? "Holdout end date" : "홀드아웃 종료일"), { target: { value: "2024-06-05" } });
    // 결정 #3: 설계 미선언이어도 추정치와 95% 구간을 보이고 "탐색용"을 붙인다 — 권고 단어는 없다.
    const headline = document.querySelector(".result-action-card__headline").textContent;
    expect(headline).toMatch(en ? /^Incremental conversions \+[\d,]+ \(95% \+[\d,]+ ~ \+[\d,]+\)/ : /^증분 전환 \+[\d,]+건 \(95% \+[\d,]+ ~ \+[\d,]+건\)/);
    expect(headline).toMatch(en ? /Exploratory — a verdict needs confirmed random assignment/ : /탐색용 — 무작위 배정이 확인되면 판정합니다/);
    expect(headline).not.toMatch(en ? /Keep the ads|Adopt/ : /권고|채택/);
    expect(screen.queryByLabelText(en ? "What will change?" : "무엇을 바꿀까요?")).toBeNull();
    const figure = document.querySelector(".result-action-card .tool-core-figure .result-effect");
    expect(figure).toBeTruthy();
    expect(figure.querySelector("li").dataset.tone).toBe("flat");
    declareDesign(locale);
    expect(figure.querySelector("li").dataset.tone).toBe("better");
    expect(document.querySelector(".result-action-card__headline").textContent).toMatch(en ? /^Keep the ads:/ : /^광고 유지 권고:/);
    fireEvent.click(document.querySelector(".decision-review-launch"));
    expect(screen.getByLabelText(en ? "What will change?" : "무엇을 바꿀까요?")).toBeTruthy();
    openConditions(locale);
    fireEvent.change(screen.getByLabelText(en ? "Did you fix the dates before seeing results?" : "결과를 보기 전에 기간을 정했나요?"), { target: { value: "changed" } });
    closeConditions(locale);
    expect(screen.queryByLabelText(en ? "What will change?" : "무엇을 바꿀까요?")).toBeNull();
    declareDesign(locale);
    fireEvent.change(screen.getByLabelText(en ? "Holdout end date" : "홀드아웃 종료일"), { target: { value: "2024-06-04" } });
    openConditions(locale);
    expect(screen.getByLabelText(en ? "How were the two groups split?" : "두 그룹은 어떻게 나눴나요?").value).toBe("");
    closeConditions(locale);
    expect(screen.queryByLabelText(en ? "What will change?" : "무엇을 바꿀까요?")).toBeNull();
  });

  it("mounts with a suppression fixture → 결론 카드 + 다운로드", () => {
    seed(asRealResult(buildIncrSuppressionDemo(), "suppression-result.csv"));
    const { container } = render(<Incrementality />);
    expect(screen.queryByText(/결론 — 홀드아웃 대비 추정 차이/)).toBeNull();
    expect(screen.getByText("홀드아웃 기간을 먼저 지정하세요")).toBeTruthy();
    const selects = container.querySelectorAll("select.map-select");
    fireEvent.change(selects[0], { target: { value: "2024-05-12" } });
    fireEvent.change(selects[1], { target: { value: "2024-06-05" } });
    expect(screen.getByText(/결론 — 홀드아웃 대비 추정 차이/)).toBeTruthy();
    expect(screen.getAllByText(/결과 받기/).length).toBeGreaterThan(0);
    // 핵심 그림: 증분 전환과 95% 구간 — 결론 줄·수치와 같은 값이다(전환율 차이 구간 × 노출 인원).
    const effect = container.querySelector(".tool-core-figure .result-effect");
    expect(effect).toBeTruthy();
    expect(effect.textContent).toMatch(/[+−][\d,]+ · 95% 구간 [+−][\d,]+ ~ [+−][\d,]+/);
    const card = container.querySelector(".result-action-card");
    expect(card.querySelectorAll(".result-action-card__stats > div")).toHaveLength(3);
    expect(card.querySelector(".result-table").textContent).toMatch(/그룹별 결과/);
    expect(card.querySelector("[data-result-details-toggle]").getAttribute("aria-expanded")).toBe("false");
    expect(container.querySelector("#incr-suppression-chart")).toBeNull();
    expect(container.querySelector(".alloc-card")).toBeNull();
    expect(container.querySelector("#s-incr-method")).toBeTruthy();
    expect(container.querySelector("#s-incr-result")).toBeTruthy();
    declareDesign();
    fireEvent.click(document.querySelector(".decision-review-launch"));
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toMatch(/무작위 홀드아웃.*재검증/);
    expect(screen.getByLabelText("현재 기준값 (선택)").value).toMatch(/×$/);

    fireEvent.click(screen.getByRole("button", { name: "이대로 만들기" }));
    confirmReviewSave();
    const saved = useAppStore.getState().decisionRecords.at(-1);
    expect(saved.toolId).toBe("5-23");
    expect(saved.sourcePeriod).toBe("2024-05-12 ~ 2024-06-05");
    expect(saved.action).toMatch(/제한적으로 반복.*재검증/);
    expect(saved.conclusion).toMatch(/관측.*인과효과로 확정하지 않습니다/);
    expect(saved.baseline).toMatch(/×$/);
    expect(saved.raw).toBeUndefined();
    expect(saved.fileName).toBeUndefined();
    expect(JSON.stringify(saved)).not.toContain("demo_incr_suppression.csv");
  });

  it("shows a demo result without offering to save a review promise", () => {
    seed(buildIncrSuppressionDemo());
    const view = render(<Incrementality />);
    // 예시는 계획된 차단 기간을 함께 싣는다 — 기간을 고르기 전에 이미 결론이다.
    expect(screen.getByText(/결론 — 홀드아웃 대비 추정 차이/)).toBeTruthy();
    const selects = view.container.querySelectorAll("select.map-select");
    fireEvent.change(selects[0], { target: { value: "2024-05-12" } });
    fireEvent.change(selects[1], { target: { value: "2024-06-05" } });

    expect(screen.getByText(/결론 — 홀드아웃 대비 추정 차이/)).toBeTruthy();
    expect(view.container.querySelector(".decision-review")).toBeNull();
    expect(useAppStore.getState().decisionRecords).toHaveLength(0);
  });

  it.each(["ko", "en"])("keeps supporting holdout explanations conditional (%s)", (locale) => {
    seed(buildIncrSuppressionDemo());
    const { container } = render(<Incrementality locale={locale} />);
    openResultDetails();
    const text = container.textContent;
    expect(text).not.toMatch(/\(이득\)|\(profitable\)|균형\)했다는 증거|evidence the two groups were comparable/);
    expect(text).toContain(locale === "en" ? "does not establish profitability" : "이익 여부를 뜻하지 않습니다");
    expect(text).toContain(locale === "en" ? "does not establish comparability" : "비교 가능성을 입증하지는 않습니다");
  });

  it("preserves article sample data and provenance on entry", () => {
    const articleSample = { ...buildIncrSuppressionDemo(), fileName: "article-holdout.csv", importSource: "demo" };
    seed(articleSample);
    render(<Incrementality />);
    expect(useAppStore.getState().csvData).toBe(articleSample);
    fireEvent.click(screen.getByRole("tab", { name: /통제군/ }));
    expect(useAppStore.getState().csvData).toBe(articleSample);
    expect(screen.getByText(/결론 — 홀드아웃 대비 추정 차이/)).toBeTruthy();
  });

  it("mounts with pre/post demos (on & off) → 탭 전환 후 결론 카드", () => {
    // method 기본값이 suppression이라 prepost 카드를 보려면 탭을 눌러 전환한다.
    seed(buildIncrPrepostDemo("on"));
    const on = render(<Incrementality />);
    fireEvent.click(on.getByText(/신규 켜기 \(전후\)/));
    // 예시 데이터는 켠 시점을 함께 싣는다 — 누르자마자 결론이다(2026-09-24).
    expect(on.queryByText("전환 시점을 먼저 지정하세요")).toBeNull();
    expect(on.getByText(/결론 — 신규/)).toBeTruthy();
    // 구간 그림은 창 안이 아니라 결론 바로 아래 핵심 그림이다.
    expect(on.container.querySelector(".result-action-card .tool-core-figure .result-effect")).toBeTruthy();
    on.unmount();
    seed(buildIncrPrepostDemo("off"));
    const off = render(<Incrementality />);
    fireEvent.click(off.getByText(/종료 \(전후\)/));
    fireEvent.change(off.container.querySelectorAll("select.map-select")[1], { target: { value: "2024-05-16" } });
    expect(off.getByText(/결론 — 종료/)).toBeTruthy();
  });

  it.each(["ko", "en"])("keeps pre/post figures once and opens detailed evidence on demand (%s)", async (locale) => {
    seed(buildIncrPrepostDemo("off"));
    const view = render(<Incrementality locale={locale} />);
    const en = locale === "en";
    fireEvent.click(screen.getByRole("tab", { name: en ? /Shutdown/ : /종료/ }));
    await act(async () => new Promise(resolve => requestAnimationFrame(resolve)));
    const result = view.container.querySelector(".incr-prepost-result");
    expect(result.querySelectorAll(".result-action-card__stats")).toHaveLength(1);
    expect(result.querySelectorAll(".result-action-card__stats > div")).toHaveLength(3);
    expect(result.querySelector(".alloc-card")).toBeNull();
    const headline = result.querySelector(".result-action-card__headline").textContent;
    expect(headline).toMatch(/\(95% [+−][\d,.]+ ~ [+−][\d,.]+\)/);
    expect(headline).toMatch(en ? /Exploratory|Hold —/ : /탐색용|판단 보류 —/);
    expect(result.querySelector(".tool-core-figure .result-effect")).toBeTruthy();
    expect(result.querySelector(".result-table").textContent).toMatch(en ? /Daily average by period/ : /기간별 일평균/);
    // 자세히 보기는 기본 닫힘: 날짜별 차트·사전추세 근거는 열어야 보인다.
    expect(result.querySelector("#incr-prepost-chart")).toBeNull();
    expect(within(result).queryByText(en ? /No pretrend violation was detected/ : /사전추세 위반은 발견되지/)).toBeNull();
    openResultDetails(result);
    expect(within(result).getByText(en ? /No pretrend violation was detected/ : /사전추세 위반은 발견되지/)).toBeTruthy();
    const chart = result.querySelector("#incr-prepost-chart");
    const actions = result.querySelector(".result-action-card__utilities");
    expect(chart.compareDocumentPosition(actions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("clears the explicit cutoff when switching launch → shutdown framing", () => {
    // 내 데이터는 전환 시점을 직접 지정해야 한다(예시만 시점을 함께 싣는다).
    seed(asRealResult(buildIncrPrepostDemo("on"), "prepost-real.csv"));
    const view = render(<Incrementality />);
    fireEvent.click(view.getByText(/신규 켜기 \(전후\)/));
    fireEvent.change(view.container.querySelectorAll("select.map-select")[1], { target: { value: "2024-05-16" } });
    expect(view.getByText(/결론 — 신규/)).toBeTruthy();
    fireEvent.click(view.getByText(/종료 \(전후\)/));
    expect(view.getByText("전환 시점을 먼저 지정하세요")).toBeTruthy();
    expect(view.queryByText(/결론 — 종료/)).toBeNull();
  });

  it("stores an identified DiD as a limited English follow-up, not a causal scale action", () => {
    seed(asRealResult(buildIncrPrepostDemo("on"), "did-result.csv"));
    const view = render(<Incrementality locale="en" />);
    fireEvent.click(view.getByText(/New launch \(pre\/post\)/));
    fireEvent.change(view.container.querySelectorAll("select.map-select")[1], { target: { value: "2024-05-16" } });

    declareDesign("en");
    fireEvent.click(document.querySelector(".decision-review-launch"));
    expect(screen.getByLabelText("What will change?").value).toMatch(/limited follow-up window/);
    expect(screen.getByLabelText("Current baseline (optional)").value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Create it" }));
    confirmReviewSave();

    const saved = useAppStore.getState().decisionRecords.at(-1);
    expect(saved.toolId).toBe("5-23");
    expect(saved.locale).toBe("en");
    expect(saved.sourcePeriod).toBe("2024-04-01 ~ 2024-06-29 · cutoff 2024-05-16");
    expect(saved.conclusion).toMatch(/observed.*not a confirmed causal effect/i);
    expect(saved.action).toMatch(/revalidate DiD/i);
    expect(saved.action).not.toMatch(/scale|increase budget/i);
    expect(saved.baseline).toBe("");
  });

  it("turns a simple pre/post result only into a control-group DiD revalidation", () => {
    seed(asRealResult(buildIncrPrepostDemo("on"), "prepost-result.csv"));
    const view = render(<Incrementality />);
    fireEvent.click(view.getByText(/신규 켜기 \(전후\)/));
    openConditions();
    fireEvent.click(screen.getByRole("checkbox", { name: /DiD/ }));
    closeConditions();
    fireEvent.change(view.container.querySelectorAll("select.map-select")[1], { target: { value: "2024-05-16" } });

    declareDesign();
    fireEvent.click(document.querySelector(".decision-review-launch"));
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toMatch(/대조군.*DiD.*재검증/);
    fireEvent.click(screen.getByRole("button", { name: "이대로 만들기" }));
    confirmReviewSave();
    const saved = useAppStore.getState().decisionRecords.at(-1);
    expect(saved.toolId).toBe("5-23");
    expect(saved.sourcePeriod).toBe("2024-04-01 ~ 2024-06-29 · 전환 시점 2024-05-16");
    expect(saved.conclusion).toMatch(/대조군이 없어 인과효과로 해석할 수 없습니다/);
    expect(saved.action).toBe("변경하지 않은 대조군을 추가하고 같은 전환 시점으로 DiD를 재검증한다");
    expect(saved.baseline).toBe("");
  });

  it("prefills experiment redesign instead of scaling when holdout balance fails", () => {
    seed({
      raw: [
        { date: "2024-01-01", holdout_group: "exposed", numerator: 80, denominator: 1000 },
        { date: "2024-01-01", holdout_group: "holdout", numerator: 20, denominator: 1000 },
        { date: "2024-01-02", holdout_group: "exposed", numerator: 70, denominator: 1000 },
        { date: "2024-01-02", holdout_group: "holdout", numerator: 40, denominator: 1000 },
        { date: "2024-01-03", holdout_group: "exposed", numerator: 72, denominator: 1000 },
        { date: "2024-01-03", holdout_group: "holdout", numerator: 42, denominator: 1000 },
      ],
      headers: ["date", "holdout_group", "numerator", "denominator"],
      mapping: { date: "date", holdout_group: "holdout_group", numerator: "numerator", denominator: "denominator" },
      fileName: "imbalanced-holdout.csv",
    });
    const view = render(<Incrementality />);
    fireEvent.change(view.container.querySelectorAll("select.map-select")[0], { target: { value: "2024-01-02" } });
    fireEvent.change(view.container.querySelectorAll("select.map-select")[1], { target: { value: "2024-01-03" } });

    declareDesign();
    fireEvent.click(document.querySelector(".decision-review-launch"));
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toMatch(/확대하지 않고.*재설계/);
    expect(screen.getByLabelText("현재 기준값 (선택)").value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "이대로 만들기" }));
    confirmReviewSave();
    const saved = useAppStore.getState().decisionRecords.at(-1);
    expect(saved.toolId).toBe("5-23");
    expect(saved.sourcePeriod).toBe("2024-01-02 ~ 2024-01-03");
    expect(saved.conclusion).toMatch(/불균형.*확대 근거로 사용할 수 없습니다/);
    expect(saved.action).toMatch(/재설계/);
  });

  it("does not infer a review action when pre-holdout balance is unavailable", () => {
    seed(buildIncrSuppressionDemo());
    const view = render(<Incrementality />);
    fireEvent.change(view.container.querySelectorAll("select.map-select")[0], { target: { value: "2024-05-01" } });
    fireEvent.change(view.container.querySelectorAll("select.map-select")[1], { target: { value: "2024-05-02" } });
    expect(screen.getByText(/결론 — 홀드아웃 대비 추정 차이/)).toBeTruthy();
    expect(screen.queryByText("다음 마케팅 프로젝트로 만들기")).toBeNull();
  });

  it("replaces an incompatible demo dataset when the method changes", () => {
    seed(buildIncrSuppressionDemo());
    const view = render(<Incrementality />);
    fireEvent.click(view.getByText(/신규 켜기 \(전후\)/));
    expect(useAppStore.getState().csvData.fileName).toBe("demo_incr_prepost_on.csv");
    expect(view.getByText(/결론 — 신규/)).toBeTruthy();
  });

  it("blocks DiD when treatment and control have no common pre-period date", () => {
    seed({
      raw: [
        { date: "2024-01-01", group: "treatment", conversions: 10 },
        { date: "2024-01-02", group: "control", conversions: 9 },
        { date: "2024-01-03", group: "treatment", conversions: 20 },
        { date: "2024-01-03", group: "control", conversions: 11 },
      ],
      headers: ["date", "group", "conversions"],
      mapping: {},
      fileName: "missing-common-date.csv",
    });
    const view = render(<Incrementality />);
    fireEvent.click(view.getByText(/신규 켜기 \(전후\)/));
    fireEvent.change(view.container.querySelectorAll("select.map-select")[1], { target: { value: "2024-01-03" } });
    expect(view.getByText(/DiD를 추정할 수 없습니다/)).toBeTruthy();
    expect(view.queryByText(/결론 — 신규/)).toBeNull();
  });

  it("marks a continuing pretrend NOT_IDENTIFIED and withholds every output", () => {
    const raw = [];
    for (let day = 1; day <= 20; day += 1) {
      const date = `2024-01-${String(day).padStart(2, "0")}`;
      const gap = (day - 1) * 10;
      raw.push({ date, group: "treatment", conversions: 100 + gap });
      raw.push({ date, group: "control", conversions: 100 });
    }
    seed({ raw, headers: ["date", "group", "conversions"], mapping: {}, fileName: "continuing-pretrend.csv" });
    const view = render(<Incrementality />);
    fireEvent.click(view.getByText(/신규 켜기 \(전후\)/));
    fireEvent.change(view.container.querySelectorAll("select.map-select")[1], { target: { value: "2024-01-11" } });
    expect(view.getByText(/NOT_IDENTIFIED/)).toBeTruthy();
    expect(view.getByText(/평행추세 가정이 깨져/)).toBeTruthy();
    expect(view.queryByText(/결론 — 신규/)).toBeNull();
    expect(view.queryByText(/결과 받기/)).toBeNull();
    expect(view.container.querySelector("#incr-prepost-chart")).toBeNull();
  });

  it("reports invalid selected dates and metrics instead of silently skipping them", () => {
    const base = buildIncrPrepostDemo("on");
    seed({
      ...base,
      raw: [
        ...base.raw,
        { date: "2024-02-30", group: "treatment", conversions: 100 },
        { date: "2024-04-03", group: "control", conversions: "not-a-number" },
      ],
      fileName: "invalid-selected-rows.csv",
    });
    const view = render(<Incrementality />);
    fireEvent.click(view.getByText(/신규 켜기 \(전후\)/));
    fireEvent.change(view.container.querySelectorAll("select.map-select")[1], { target: { value: "2024-05-16" } });
    expect(view.getByText("선택한 데이터에 사용할 수 없는 행이 있어 분석을 중단했습니다")).toBeTruthy();
    expect(view.getByText(/잘못된 날짜 1행 · 비어 있거나 숫자가 아닌 지표 1행/)).toBeTruthy();
    expect(view.queryByText(/결론 — 신규/)).toBeNull();
    expect(view.queryByText(/결과 받기/)).toBeNull();
    expect(view.container.querySelector("#incr-prepost-chart")).toBeNull();
  });

  it("withholds a suppression conclusion for impossible rows", () => {
    seed({
      raw: [{ date: "2026-02-30", holdout_group: "exposed", numerator: 101, denominator: 100 }],
      headers: ["date", "holdout_group", "numerator", "denominator"],
      mapping: { date: "date", holdout_group: "holdout_group", numerator: "numerator", denominator: "denominator" },
      fileName: "invalid-holdout.csv",
    });
    render(<Incrementality />);
    expect(screen.getByText("증분을 계산할 수 없는 행이 있습니다")).toBeTruthy();
    expect(screen.queryByText(/결론 — 홀드아웃 대비 추정 차이/)).toBeNull();
  });
});
