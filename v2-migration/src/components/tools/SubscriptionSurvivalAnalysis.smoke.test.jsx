// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import SubscriptionSurvivalAnalysis, { buildSegmentCurveChartData, scheduleSubscriptionChartResize } from "@/components/tools/SubscriptionSurvivalAnalysis";
import { TOOL_GROUP, computeAnalyzeSig, useAppStore } from "@/store/useDataStore";

const ROWS = [
  { tenure_periods: "1", event_observed: "1", channel: "Paid" },
  { tenure_periods: "2", event_observed: "1", channel: "Paid" },
  { tenure_periods: "3", event_observed: "0", channel: "Organic" },
  { tenure_periods: "3", event_observed: "1", channel: "Organic" },
  { tenure_periods: "4", event_observed: "0", channel: "Organic" },
];

const READY_ROWS = Array.from({ length: 12 }, (_, index) => ({
  tenure_periods: String(index < 4 ? 1 : index < 5 ? 2 : 3),
  event_observed: index < 5 ? "1" : "0",
  channel: index < 6 ? "Paid" : "Organic",
  cac: "75",
}));

const DATE_ROWS = [
  { action_start_date: "2026-01-01", action_exit_date: "2026-02-01", channel: "Paid" },
  { action_start_date: "2026-01-01", action_observation_end_date: "2026-03-01", channel: "Organic" },
  { action_start_date: "2026-01-01", action_exit_date: "2026-02-15", channel: "Organic" },
];

function confirmEventDefinition(locale = "ko") {
  fireEvent.change(screen.getByLabelText(locale === "en" ? "Dropout or exit event definition" : "이탈·종료 이벤트 정의"), {
    target: { value: locale === "en" ? "Access ended" : "접근 종료" },
  });
}

describe("SubscriptionSurvivalAnalysis render smoke", () => {
  it("uses the shared local-control filter appearance", () => {
    const { container } = render(<SubscriptionSurvivalAnalysis rows={ROWS} analyzed />);
    expect(container.querySelector(".analysis-local-controls__inner")).toBeTruthy();
    expect(container.querySelector(".form-row")).toBeNull();
    expect(container.querySelectorAll(".mon-filter-item")).toHaveLength(9);
  });

  it("keeps the result behind an explicit analysis action and renders survival evidence", () => {
    const { container } = render(<SubscriptionSurvivalAnalysis rows={ROWS} analyzed />);
    expect(container.querySelector("#subscription-survival-result")).toBeNull();
    confirmEventDefinition();
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    expect(container.querySelector("#subscription-survival-result")).toBeTruthy();
    expect(container.querySelector("#subscription-survival-curve canvas")).toBeTruthy();
    expect(container.querySelector("#subscription-hazard canvas")).toBeTruthy();
    expect(container.querySelector("#subscription-risk-table table")).toBeTruthy();
  });

  it("does not render a fake zero or infinity median when no event is observed", () => {
    const censored = ROWS.map((row) => ({ ...row, event_observed: "0" }));
    const { container } = render(<SubscriptionSurvivalAnalysis rows={censored} analyzed locale="en" />);
    confirmEventDefinition("en");
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect(container.textContent).toContain("No dropout or exit event was observed");
    expect(container.textContent).toContain("Median survival was not reached");
    expect(container.textContent).not.toContain("Infinity");
    expect(container.textContent).not.toContain("NaN");
  });

  it("withholds CAC economics and the decision handoff when evidence or CAC coverage is incomplete", () => {
    render(<SubscriptionSurvivalAnalysis rows={ROWS} analyzed />);
    confirmEventDefinition();
    fireEvent.change(screen.getByLabelText("기간당 반복 가치 (선택)"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("매출총이익률 % (선택)"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    expect(screen.queryByText("다음 검토 약속 만들기")).toBeNull();
  });

  it("marks a changed horizon as stale until the user re-runs it", () => {
    const { container } = render(<SubscriptionSurvivalAnalysis rows={ROWS} analyzed />);
    confirmEventDefinition();
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    const horizon = screen.getByLabelText("관측 horizon");
    fireEvent.change(horizon, { target: { value: "2" } });
    expect(container.textContent).toContain("현재 결과는 최신 설정과 다를 수 있습니다");
    expect(container.querySelector("#subscription-survival-result")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "다시 분석" }));
    expect(container.querySelector("#subscription-survival-result")).toBeTruthy();
  });

  it("offers aggregated risk-set and segment CSVs without exporting source rows", () => {
    render(<SubscriptionSurvivalAnalysis rows={ROWS} analyzed />);
    confirmEventDefinition();
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "결과 받기" }), { button: 0, ctrlKey: false });
    expect(screen.getByText("생존곡선 CSV")).toBeTruthy();
    expect(screen.getByText("위험집합 CSV")).toBeTruthy();
    fireEvent.pointerDown(document.body, { button: 0 });

    const segment = screen.getByLabelText("세그먼트");
    fireEvent.change(segment, { target: { value: "channel" } });
    fireEvent.click(screen.getByRole("button", { name: "다시 분석" }));
    fireEvent.pointerDown(screen.getByRole("button", { name: "결과 받기" }), { button: 0, ctrlKey: false });
    expect(screen.getByText("세그먼트 요약 CSV")).toBeTruthy();
  });

  it("creates a review handoff only for an adequate observed risk signal", () => {
    const csvData = { raw: READY_ROWS, headers: Object.keys(READY_ROWS[0]), mapping: {}, fileName: "uploaded_subscription_survival.csv", mappedRows: READY_ROWS };
    const state = useAppStore.getState();
    const group = TOOL_GROUP["5-28"];
    useAppStore.setState({
      currentRouteId: "5-28",
      activeDataGroup: group,
      csvData,
      csvGroups: { ...state.csvGroups, [group]: csvData },
      analyzedByGroup: { ...state.analyzedByGroup, [group]: computeAnalyzeSig(csvData) },
      decisionRecords: [],
    });
    render(<SubscriptionSurvivalAnalysis rows={READY_ROWS} analyzed />);
    confirmEventDefinition();
    fireEvent.change(screen.getByLabelText("기간당 반복 가치 (선택)"), { target: { value: "100" } });
    fireEvent.change(screen.getByLabelText("매출총이익률 % (선택)"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    expect(screen.getByText("관측기간 내 비용 회수는 2기간에 도달했습니다.")).toBeTruthy();
    expect(screen.getByText("다음 검토 약속 만들기")).toBeTruthy();
  });

  it("requires date-mode metadata, derives dated episodes, and exposes the definition in the result", () => {
    const { container } = render(<SubscriptionSurvivalAnalysis rows={DATE_ROWS} analyzed />);
    fireEvent.change(screen.getByLabelText("입력 방식"), { target: { value: "dates" } });
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    expect(screen.getByRole("alert").textContent).toContain("관측 종료일");
    fireEvent.change(screen.getByLabelText("관측 종료일"), { target: { value: "2026-03-31" } });
    confirmEventDefinition();
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    expect(container.querySelector("#subscription-survival-result")).toBeTruthy();
    expect(container.textContent).toContain("이탈·종료 이벤트 정의는 “접근 종료”으로 기록했습니다.");
  });

  it("renders an accessible segment curve only for a bounded segment comparison", () => {
    const { container } = render(<SubscriptionSurvivalAnalysis rows={ROWS} analyzed />);
    confirmEventDefinition();
    fireEvent.change(screen.getByLabelText("세그먼트"), { target: { value: "channel" } });
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    expect(screen.getByRole("img", { name: "세그먼트별 핵심 액션 생존곡선" })).toBeTruthy();
    expect(container.querySelector("#subscription-segment-curves-note")).toBeTruthy();
  });

  it("withholds high-cardinality segment curves instead of compressing them into unreadable lines", () => {
    const manySegments = Array.from({ length: 7 }, (_, index) => ({
      tenure_periods: String(index + 1), event_observed: "1", channel: `channel-${index}`,
    }));
    const { container } = render(<SubscriptionSurvivalAnalysis rows={manySegments} analyzed />);
    confirmEventDefinition();
    fireEvent.change(screen.getByLabelText("세그먼트"), { target: { value: "channel" } });
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    expect(container.textContent).toContain("세그먼트가 6개를 넘어 비교를 보류했습니다");
    expect(container.querySelector("#subscription-segment-curves")).toBeNull();
  });

  it("stops segment data at each group’s observed support and cancels pending chart work", () => {
    const chartData = buildSegmentCurveChartData([
      { name: "A", maxObserved: 1, table: [{ time: 1, survival: 0.5 }] },
      { name: "B", maxObserved: 3, table: [{ time: 1, survival: 0.8 }, { time: 3, survival: 0.6 }] },
    ]);
    expect(chartData.labels).toEqual([1, 3]);
    expect(chartData.datasets[0].data).toEqual([50, null]);

    const resize = vi.fn();
    const canvas = document.createElement("canvas");
    document.body.appendChild(canvas);
    let callback;
    const cancel = vi.fn();
    vi.stubGlobal("requestAnimationFrame", vi.fn((next) => { callback = next; return 7; }));
    vi.stubGlobal("cancelAnimationFrame", cancel);
    const stop = scheduleSubscriptionChartResize({ canvas, resize });
    canvas.remove();
    callback();
    stop();
    expect(resize).not.toHaveBeenCalled();
    expect(cancel).toHaveBeenCalledWith(7);
    vi.unstubAllGlobals();
  });
});
