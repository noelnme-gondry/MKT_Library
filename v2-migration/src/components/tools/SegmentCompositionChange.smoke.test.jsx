// @vitest-environment jsdom
import React from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import SegmentCompositionChange from "@/components/tools/SegmentCompositionChange";
import { TOOL_GROUP, useAppStore } from "@/store/useDataStore";
import { buildDemoCsv } from "@/utils/demoData";

const DEMO = buildDemoCsv("segment_composition");
const HEADERS = DEMO.headers;
const PERIODS = [...new Set(DEMO.raw.map((row) => row.date))].sort();
const PRE = PERIODS[0];
const POST = PERIODS[PERIODS.length - 1];

// 실제 사용 경로: 역할을 고르고 → 축을 선언하고 → 두 기간을 골라 분석한다.
function declareGenderAxis(locale = "ko") {
  fireEvent.change(screen.getByLabelText(locale === "en" ? "Period (date or week)" : "기간 (날짜·주차)"), { target: { value: "date" } });
  const entityGroup = screen.getByRole("group", { name: locale === "en" ? "Analysis unit (campaign, channel)" : "분석 단위 (캠페인·채널)" });
  fireEvent.click(within(entityGroup).getByLabelText("campaign"));
  const candidate = [...document.querySelectorAll(".segment-candidate-list li")]
    .find((item) => item.textContent.startsWith("gender"));
  fireEvent.click(candidate.querySelector("button"));
  const countSelect = screen.getByLabelText(locale === "en" ? "gender Members" : "gender 멤버");
  fireEvent.change(countSelect, { target: { value: "signups" } });
}

function pickPeriods(locale = "ko") {
  fireEvent.change(screen.getByLabelText(locale === "en" ? "Earlier period" : "이전 기간"), { target: { value: PRE } });
  fireEvent.change(screen.getByLabelText(locale === "en" ? "Later period" : "이후 기간"), { target: { value: POST } });
}

describe("SegmentCompositionChange render smoke", () => {
  it("데이터가 없으면 업로드 안내만 보여 준다", () => {
    const { container } = render(<SegmentCompositionChange rows={[]} headers={[]} />);
    expect(container.querySelector("#segment-composition-result")).toBeNull();
    expect(container.textContent).toContain("데이터를 준비하세요");
  });

  it("분석 게이트 전에는 결과를 그리지 않는다", () => {
    const { container } = render(<SegmentCompositionChange rows={DEMO.raw} headers={HEADERS} analyzed={false} />);
    expect(container.querySelector("#segment-composition-result")).toBeNull();
    expect(container.textContent).toContain("데이터 분석하기");
  });

  it("역할 선언과 기간 선택을 마쳐야 분석 버튼이 열린다", () => {
    render(<SegmentCompositionChange rows={DEMO.raw} headers={HEADERS} analyzed />);
    expect(screen.getByRole("button", { name: "분석하기" }).disabled).toBe(true);
    declareGenderAxis();
    expect(screen.getByRole("button", { name: "분석하기" }).disabled).toBe(true);
    pickPeriods();
    expect(screen.getByRole("button", { name: "분석하기" }).disabled).toBe(false);
  });

  it("분석하면 결론·축 랭킹·분해 표를 그린다", () => {
    const { container } = render(<SegmentCompositionChange rows={DEMO.raw} headers={HEADERS} analyzed />);
    declareGenderAxis();
    pickPeriods();
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    expect(container.querySelector("#segment-composition-result")).toBeTruthy();
    expect(container.querySelector("#segment-composition-ranking")).toBeTruthy();
    const detail = container.querySelector("#segment-composition-detail");
    expect(detail.textContent).toContain("이동인가, 내부 변화인가");
    // 무잔차 항등식을 화면 문구로도 확인한다 — 잔차가 있으면 이 문장 자체가 거짓이 된다.
    expect(detail.textContent).toContain("잔차 없음");
  });

  it("선언을 바꾸면 이전 결과를 그대로 두지 않는다", () => {
    const { container } = render(<SegmentCompositionChange rows={DEMO.raw} headers={HEADERS} analyzed />);
    declareGenderAxis();
    pickPeriods();
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    expect(container.querySelector("#segment-composition-result")).toBeTruthy();
    // 포괄 선언을 뒤집으면 서명이 달라지므로 옛 결과가 남아 있으면 안 된다.
    fireEvent.click(screen.getByLabelText("모든 사람이 어딘가에 속함 (포괄)"));
    expect(container.querySelector("#segment-composition-result")).toBeNull();
  });

  it("운영 지문을 원인이 아니라 가설 좁히기로 표시한다", () => {
    const { container } = render(<SegmentCompositionChange rows={DEMO.raw} headers={HEADERS} analyzed />);
    declareGenderAxis();
    // 비용을 역할로 지정해야 비용 이동 지문이 열린다. OS를 경쟁 범위로 선언하지 않으면
    // 한 칸에 OS별로 다른 비용이 섞여 도구가 정직하게 합산을 거부한다.
    fireEvent.change(screen.getByLabelText("비용"), { target: { value: "cost" } });
    const scopeGroup = screen.getByRole("group", { name: "경쟁 범위 (OS·국가)" });
    fireEvent.click(within(scopeGroup).getByLabelText("platform"));
    pickPeriods();
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    const ops = container.querySelector("#segment-composition-ops");
    expect(ops).toBeTruthy();
    expect(ops.textContent).toContain("원인이 아니라 가설을 좁히는 관측 신호");
    // 사분면이 실제로 그려지고, 경쟁 완화로 단정하지 않는다.
    expect(ops.textContent).toContain("볼륨과 1명당 비용");
    expect(ops.textContent).toContain("이 표만으로는 가릴 수 없습니다");
    // 여러 기간을 훑었다는 사실을 숨기지 않는다.
    expect(ops.textContent).toContain("여러 기간을 전부 훑어");
  });

  it("비용 역할이 없으면 비용 지문을 숫자 대신 사유로 답한다", () => {
    const { container } = render(<SegmentCompositionChange rows={DEMO.raw} headers={HEADERS} analyzed />);
    declareGenderAxis();
    pickPeriods();
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    const ops = container.querySelector("#segment-composition-ops");
    expect(ops.textContent).toContain("비용 컬럼이 없거나 0이라");
  });

  it("한 칸에 서로 다른 비용이 섞이면 합산하지 않고 사유를 말한다", () => {
    // 데모는 OS별로 비용이 다르다. OS를 경쟁 범위로 선언하지 않으면 (일자×캠페인)
    // 한 칸에 두 비용이 들어오는데, 그때 둘 중 하나를 고르거나 더하면 거짓 숫자가 된다.
    const { container } = render(<SegmentCompositionChange rows={DEMO.raw} headers={HEADERS} analyzed />);
    declareGenderAxis();
    fireEvent.change(screen.getByLabelText("비용"), { target: { value: "cost" } });
    pickPeriods();
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    const ops = container.querySelector("#segment-composition-ops");
    expect(ops.textContent).toContain("비용 컬럼이 없거나 0이라");
    expect(container.querySelector("[aria-labelledby='segment-quality-title']").textContent)
      .toContain("멤버마다 비용이 달라");
  });

  it("설계를 선언하기 전에는 인과 확인이 숫자를 내지 않는다", () => {
    const { container } = render(<SegmentCompositionChange rows={DEMO.raw} headers={HEADERS} analyzed />);
    declareGenderAxis();
    pickPeriods();
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    const causal = container.querySelector("#segment-composition-causal");
    expect(causal.textContent).toContain("개입 시점과 대조 범위를 선언했을 때만");
    expect(causal.querySelector(".segment-causal-checks")).toBeNull();
  });

  it("대조군 없이 전후 차이를 효과라고 부르지 않는다", () => {
    const { container } = render(<SegmentCompositionChange rows={DEMO.raw} headers={HEADERS} analyzed />);
    declareGenderAxis();
    const scopeGroup = screen.getByRole("group", { name: "경쟁 범위 (OS·국가)" });
    fireEvent.click(within(scopeGroup).getByLabelText("platform"));
    pickPeriods();
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    // 처리군만 고르고 대조군을 비워 두면 섹션이 열리지 않는다.
    fireEvent.change(screen.getByLabelText("개입 시점"), { target: { value: PERIODS[4] } });
    fireEvent.change(screen.getByLabelText("처리 범위"), { target: { value: "Android" } });
    expect(container.querySelector(".segment-causal-checks")).toBeNull();
    // 대조군까지 선언하면 심사표가 열리고, 통과 여부가 항목별로 보인다.
    fireEvent.change(screen.getByLabelText("대조 범위"), { target: { value: "iOS" } });
    const checks = container.querySelector(".segment-causal-checks");
    expect(checks).toBeTruthy();
    expect(checks.textContent).toContain("대조 범위가 있다");
  });

  it("매개 경로는 식별 불가라고 명시한다", () => {
    const { container } = render(<SegmentCompositionChange rows={DEMO.raw} headers={HEADERS} analyzed />);
    declareGenderAxis();
    const scopeGroup = screen.getByRole("group", { name: "경쟁 범위 (OS·국가)" });
    fireEvent.click(within(scopeGroup).getByLabelText("platform"));
    pickPeriods();
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    fireEvent.change(screen.getByLabelText("개입 시점"), { target: { value: PERIODS[4] } });
    fireEvent.change(screen.getByLabelText("처리 범위"), { target: { value: "Android" } });
    fireEvent.change(screen.getByLabelText("대조 범위"), { target: { value: "iOS" } });
    expect(container.querySelector("#segment-composition-causal").textContent)
      .toContain("매개 경로는 임의의 세그먼트 CSV로 식별할 수 없어");
  });

  it("결과에 인과 한계를 함께 말한다", () => {
    const { container } = render(<SegmentCompositionChange rows={DEMO.raw} headers={HEADERS} analyzed />);
    declareGenderAxis();
    pickPeriods();
    fireEvent.click(screen.getByRole("button", { name: "분석하기" }));
    expect(container.textContent).toContain("이 결과로 말할 수 없는 것");
    expect(container.textContent).toContain("원인");
  });

  it("EN 로케일에서도 같은 흐름이 동작한다", () => {
    const { container } = render(<SegmentCompositionChange rows={DEMO.raw} headers={HEADERS} analyzed locale="en" />);
    declareGenderAxis("en");
    pickPeriods("en");
    fireEvent.click(screen.getByRole("button", { name: "Analyze" }));
    expect(container.querySelector("#segment-composition-result")).toBeTruthy();
    expect(container.textContent).toContain("What this cannot say");
  });

  it("실제 진입 경로에서 그룹 미러가 전용 슬라이스로 스왑된다", () => {
    // 읽기·쓰기 그룹이 어긋나면 방금 올린 CSV가 사라진다(§7). 진입 경로를 직접 밟는다.
    useAppStore.getState().setCurrentRouteId("5-29");
    expect(TOOL_GROUP["5-29"]).toBe("segment_composition");
    expect(useAppStore.getState().activeDataGroup).toBe("segment_composition");
    expect(() => render(<SegmentCompositionChange />)).not.toThrow();
  });
});
