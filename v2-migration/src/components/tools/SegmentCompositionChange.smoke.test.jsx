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

const mount = (props = {}) => render(
  <SegmentCompositionChange rows={DEMO.raw} headers={HEADERS} analyzed {...props} />,
);

describe("SegmentCompositionChange render smoke", () => {
  it("데이터가 없으면 업로드 화면만 보여 주고 같은 설명을 반복하지 않는다", () => {
    const { container } = render(<SegmentCompositionChange rows={[]} headers={[]} />);
    expect(container.querySelector("#segment-composition-result")).toBeNull();
    // 도구가 자체 빈 상태 문구를 다시 쓰면 업로드 화면에 같은 말이 세 번 나온다.
    expect(container.textContent).not.toContain("데이터를 준비하세요");
  });

  it("분석 게이트 전에는 결과를 그리지 않는다", () => {
    const { container } = mount({ analyzed: false });
    expect(container.querySelector("#segment-composition-result")).toBeNull();
    expect(container.textContent).toContain("데이터 분석하기");
  });

  it("매핑을 손대지 않아도 파일을 읽고 바로 분석한다", () => {
    // 마케터가 세그먼트를 보러 와서 매핑을 먼저 공부해야 하면 그 화면은 못 쓴다.
    const { container } = mount();
    expect(container.querySelector("#segment-composition-result")).toBeTruthy();
    expect(container.querySelector("#segment-composition-ranking")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "분석하기" })).toBeNull();
  });

  it("무엇을 무엇으로 읽었는지 한 줄로 말한다", () => {
    const { container } = mount();
    const summary = container.querySelector("[aria-labelledby='segment-composition-mapping']");
    expect(summary.textContent).toContain("기간은 date");
    expect(summary.textContent).toContain("인원수는 signups");
    expect(summary.textContent).toContain("gender");
    expect(summary.textContent).toContain("age_band");
  });

  it("축을 하나만 보여 주지 않고 함께 확인한 축을 전부 랭킹한다", () => {
    const { container } = mount();
    const ranking = container.querySelector("#segment-composition-ranking");
    expect(ranking.textContent).toContain("gender");
    expect(ranking.textContent).toContain("age_band");
    expect(container.querySelector("#segment-composition-result").textContent).toContain("축 2개를 함께 확인했습니다");
  });

  it("기본 비교는 최근 기간과 직전 기간이다", () => {
    mount();
    expect(screen.getByLabelText("이전 기간").value).toBe(PERIODS[PERIODS.length - 2]);
    expect(screen.getByLabelText("이후 기간").value).toBe(PERIODS[PERIODS.length - 1]);
  });

  it("기간을 바꾸면 결과가 따라 바뀐다", () => {
    const { container } = mount();
    const before = container.querySelector("#segment-composition-result").textContent;
    fireEvent.change(screen.getByLabelText("이전 기간"), { target: { value: PERIODS[0] } });
    expect(container.querySelector("#segment-composition-result").textContent).not.toBe(before);
  });

  it("매핑을 고치는 경로는 접어 두되 사라지지 않는다", () => {
    const { container } = mount();
    const editor = container.querySelector(".segment-mapping-edit");
    expect(editor.tagName).toBe("DETAILS");
    expect(editor.textContent).toContain("고치기");
    // 열면 역할 선택기가 그대로 있다.
    expect(within(editor).getByLabelText("기간 (날짜·주차)")).toBeTruthy();
  });

  it("사용자가 매핑을 손대면 자동 선언이 멈춘다", () => {
    const { container } = mount();
    fireEvent.change(within(container.querySelector(".segment-mapping-edit")).getByLabelText("전체 모수"), { target: { value: "signups" } });
    expect(container.querySelector("[aria-labelledby='segment-composition-mapping']").textContent)
      .toContain("직접 지정한 매핑을 씁니다");
  });

  it("운영 지문을 원인이 아니라 가설 좁히기로 표시한다", () => {
    const { container } = mount();
    const ops = container.querySelector("#segment-composition-ops");
    expect(ops.textContent).toContain("원인이 아니라 가설을 좁히는 관측 신호");
    expect(ops.textContent).toContain("이 표만으로는 가릴 수 없습니다");
    expect(ops.textContent).toContain("여러 기간을 전부 훑어");
  });

  it("설계를 선언하기 전에는 인과 확인이 숫자를 내지 않는다", () => {
    const { container } = mount();
    const causal = container.querySelector("#segment-composition-causal");
    expect(causal.textContent).toContain("개입 시점과 대조 범위를 선언했을 때만");
    expect(causal.querySelector(".segment-causal-checks")).toBeNull();
  });

  it("대조군까지 선언해야 인과 심사표가 열린다", () => {
    const { container } = mount();
    fireEvent.change(screen.getByLabelText("개입 시점"), { target: { value: PERIODS[4] } });
    fireEvent.change(screen.getByLabelText("처리 범위"), { target: { value: "Android" } });
    expect(container.querySelector(".segment-causal-checks")).toBeNull();
    fireEvent.change(screen.getByLabelText("대조 범위"), { target: { value: "iOS" } });
    const checks = container.querySelector(".segment-causal-checks");
    expect(checks.textContent).toContain("대조 범위가 있다");
    expect(container.querySelector("#segment-composition-causal").textContent)
      .toContain("매개 경로는 임의의 세그먼트 CSV로 식별할 수 없어");
  });

  it("결과에 인과 한계를 함께 말한다", () => {
    const { container } = mount();
    expect(container.textContent).toContain("이 결과로 말할 수 없는 것");
    expect(container.textContent).toContain("원인");
  });

  it("EN 로케일에서도 같은 흐름이 동작한다", () => {
    const { container } = mount({ locale: "en" });
    expect(container.querySelector("#segment-composition-result")).toBeTruthy();
    expect(container.textContent).toContain("How this file was read");
    expect(container.textContent).toContain("What this cannot say");
  });

  it("실제 진입 경로에서 그룹 미러가 전용 슬라이스로 스왑된다", () => {
    useAppStore.getState().setCurrentRouteId("5-29");
    expect(TOOL_GROUP["5-29"]).toBe("segment_composition");
    expect(useAppStore.getState().activeDataGroup).toBe("segment_composition");
    expect(() => render(<SegmentCompositionChange />)).not.toThrow();
  });
});
