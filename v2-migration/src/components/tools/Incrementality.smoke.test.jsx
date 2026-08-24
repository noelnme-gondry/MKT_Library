// @vitest-environment jsdom
//
// Render-smoke for Incrementality (5-23). Asserts the component MOUNTS without
// throwing in the no-data state and with each method's demo data loaded
// (suppression + pre/post on/off), across method tab switches. Golden covers the
// pure math (incrPrePostMath / incrMath); this catches render-throw (§7).
import { describe, it, expect, beforeEach, vi } from "vitest";
import { act, render, screen, fireEvent, waitFor } from "@testing-library/react";
import Papa from "papaparse";
import { useAppStore } from "@/store/useDataStore";
import Incrementality from "@/components/tools/Incrementality";
import { buildIncrSuppressionDemo, buildIncrPrepostDemo } from "@/utils/demoData";

const EMPTY = { raw: [], headers: [], mapping: {}, fileName: "" };

function seed(slice) {
  useAppStore.setState({
    currentRouteId: "5-23",
    csvGroups: { ...useAppStore.getState().csvGroups, incrementality: slice },
    csvData: slice,
    decisionRecords: [],
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
    expect(eventCalls).toContainEqual(["event", "data_import_success", expect.objectContaining({ tool_id: "5-23", source: "csv", row_count: 1, column_count: 2 })]);
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

  it("mounts with a suppression fixture → 결론 카드 + 다운로드", () => {
    seed(asRealResult(buildIncrSuppressionDemo(), "suppression-result.csv"));
    const { container } = render(<Incrementality />);
    expect(screen.queryByText(/결론 — 광고가 만든 순증분/)).toBeNull();
    expect(screen.getByText("홀드아웃 기간을 먼저 지정하세요")).toBeTruthy();
    const selects = container.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "2024-05-12" } });
    fireEvent.change(selects[1], { target: { value: "2024-06-05" } });
    expect(screen.getByText(/결론 — 광고가 만든 순증분/)).toBeTruthy();
    expect(screen.getAllByText(/결과 받기/).length).toBeGreaterThan(0);
    expect(container.querySelector("#s-incr-method")).toBeTruthy();
    expect(container.querySelector("#s-incr-result")).toBeTruthy();
    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toMatch(/무작위 홀드아웃.*재검증/);
    expect(screen.getByLabelText("현재 기준값 (선택)").value).toMatch(/×$/);

    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
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
    const selects = view.container.querySelectorAll("select");
    fireEvent.change(selects[0], { target: { value: "2024-05-12" } });
    fireEvent.change(selects[1], { target: { value: "2024-06-05" } });

    expect(screen.getByText(/결론 — 광고가 만든 순증분/)).toBeTruthy();
    expect(view.container.querySelector(".decision-review")).toBeNull();
    expect(useAppStore.getState().decisionRecords).toHaveLength(0);
  });

  it("mounts with pre/post demos (on & off) → 탭 전환 후 결론 카드", () => {
    // method 기본값이 suppression이라 prepost 카드를 보려면 탭을 눌러 전환한다.
    seed(buildIncrPrepostDemo("on"));
    const on = render(<Incrementality />);
    fireEvent.click(on.getByText(/신규 켜기 \(전후\)/));
    expect(on.queryByText(/결론 — 신규/)).toBeNull();
    expect(on.getByText("전환 시점을 먼저 지정하세요")).toBeTruthy();
    fireEvent.change(on.container.querySelectorAll("select")[1], { target: { value: "2024-05-16" } });
    expect(on.getByText(/결론 — 신규/)).toBeTruthy();
    on.unmount();
    seed(buildIncrPrepostDemo("off"));
    const off = render(<Incrementality />);
    fireEvent.click(off.getByText(/종료 \(전후\)/));
    fireEvent.change(off.container.querySelectorAll("select")[1], { target: { value: "2024-05-16" } });
    expect(off.getByText(/결론 — 종료/)).toBeTruthy();
  });

  it("clears the explicit cutoff when switching launch → shutdown framing", () => {
    seed(buildIncrPrepostDemo("on"));
    const view = render(<Incrementality />);
    fireEvent.click(view.getByText(/신규 켜기 \(전후\)/));
    fireEvent.change(view.container.querySelectorAll("select")[1], { target: { value: "2024-05-16" } });
    expect(view.getByText(/결론 — 신규/)).toBeTruthy();
    fireEvent.click(view.getByText(/종료 \(전후\)/));
    expect(view.getByText("전환 시점을 먼저 지정하세요")).toBeTruthy();
    expect(view.queryByText(/결론 — 종료/)).toBeNull();
  });

  it("stores an identified DiD as a limited English follow-up, not a causal scale action", () => {
    seed(asRealResult(buildIncrPrepostDemo("on"), "did-result.csv"));
    const view = render(<Incrementality locale="en" />);
    fireEvent.click(view.getByText(/New launch \(pre\/post\)/));
    fireEvent.change(view.container.querySelectorAll("select")[1], { target: { value: "2024-05-16" } });

    expect(screen.getByLabelText("What will change?").value).toMatch(/limited follow-up window/);
    expect(screen.getByLabelText("Current baseline (optional)").value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "Save for next review" }));

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
    fireEvent.click(screen.getByRole("checkbox", { name: /DiD/ }));
    fireEvent.change(view.container.querySelectorAll("select")[1], { target: { value: "2024-05-16" } });

    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toMatch(/대조군.*DiD.*재검증/);
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
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
    fireEvent.change(view.container.querySelectorAll("select")[0], { target: { value: "2024-01-02" } });
    fireEvent.change(view.container.querySelectorAll("select")[1], { target: { value: "2024-01-03" } });

    expect(screen.getByLabelText("무엇을 바꿀까요?").value).toMatch(/확대하지 않고.*재설계/);
    expect(screen.getByLabelText("현재 기준값 (선택)").value).toBe("");
    fireEvent.click(screen.getByRole("button", { name: "다음 검토로 저장" }));
    const saved = useAppStore.getState().decisionRecords.at(-1);
    expect(saved.toolId).toBe("5-23");
    expect(saved.sourcePeriod).toBe("2024-01-02 ~ 2024-01-03");
    expect(saved.conclusion).toMatch(/불균형.*확대 근거로 사용할 수 없습니다/);
    expect(saved.action).toMatch(/재설계/);
  });

  it("does not infer a review action when pre-holdout balance is unavailable", () => {
    seed(buildIncrSuppressionDemo());
    const view = render(<Incrementality />);
    fireEvent.change(view.container.querySelectorAll("select")[0], { target: { value: "2024-05-01" } });
    fireEvent.change(view.container.querySelectorAll("select")[1], { target: { value: "2024-05-02" } });
    expect(screen.getByText(/결론 — 광고가 만든 순증분/)).toBeTruthy();
    expect(screen.queryByText("다음 검토 약속 만들기")).toBeNull();
  });

  it("replaces an incompatible demo dataset when the method changes", () => {
    seed(buildIncrSuppressionDemo());
    const view = render(<Incrementality />);
    fireEvent.click(view.getByText(/신규 켜기 \(전후\)/));
    expect(useAppStore.getState().csvData.fileName).toBe("demo_incr_prepost_on.csv");
    expect(view.getByText("전환 시점을 먼저 지정하세요")).toBeTruthy();
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
    fireEvent.change(view.container.querySelectorAll("select")[1], { target: { value: "2024-01-03" } });
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
    fireEvent.change(view.container.querySelectorAll("select")[1], { target: { value: "2024-01-11" } });
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
    fireEvent.change(view.container.querySelectorAll("select")[1], { target: { value: "2024-05-16" } });
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
    expect(screen.queryByText(/결론 — 광고가 만든 순증분/)).toBeNull();
  });
});
