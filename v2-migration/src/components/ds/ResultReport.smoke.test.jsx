import React from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { ChangeBar, ConditionLine, IssueTable, ResultDetails, ResultHeadline, ResultTable, headlineText } from "./ResultReport";

describe("결과 보고서 층 — 공용 부품", () => {
  it("결론 줄: 덩어리 사이 공백은 덩어리 밖, 줄은 의미별", () => {
    const lines = [{ kind: "main", chunks: ["Meta AAP", "일 ₩390만 감액"] }, { kind: "effect", chunks: ["→ CPI −8.9%"] }];
    const { container } = render(<ResultHeadline lines={lines} />);
    const rendered = [...container.querySelectorAll(".result-headline__line")];
    expect(rendered.map((line) => line.className)).toEqual(["result-headline__line is-main", "result-headline__line is-effect"]);
    for (const chunk of container.querySelectorAll(".result-headline__chunk")) expect(chunk.textContent).toBe(chunk.textContent.trim());
    expect(headlineText(lines)).toBe("Meta AAP 일 ₩390만 감액 → CPI −8.9%");
    expect(headlineText([{ chunks: ["A"] }, { chunks: ["B"] }])).toBe("A · B");
  });

  it("증감 막대: 0이 가운데, 길이는 최대 변화 대비(절반이 최대)", () => {
    const { container } = render(<><ChangeBar value={-200} max={200} /><ChangeBar value={50} max={200} tone="good" /></>);
    const bars = [...container.querySelectorAll(".change-bar i")];
    expect(bars[0].className).toBe("is-down is-left");
    expect(bars[0].style.width).toBe("50%");
    expect(bars[1].className).toBe("is-good is-right");
    expect(bars[1].style.width).toBe("12.5%");
  });

  it("자세히 보기는 기본 닫힘 — 안에 무엇이 있는지는 닫힌 채로 말하고, 내용은 열 때 그린다", () => {
    render(<ResultDetails items={["반응 곡선", "검정 통계"]}><p>숨은 근거</p></ResultDetails>);
    const toggle = screen.getByRole("button", { name: /자세히 보기/ });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.getByText("반응 곡선 · 검정 통계")).toBeTruthy();
    expect(screen.queryByText("숨은 근거")).toBeNull();
    fireEvent.click(toggle);
    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("숨은 근거")).toBeTruthy();
    expect(screen.queryByText("반응 곡선 · 검정 통계")).toBeNull();
  });

  it("대상별 표: 넘치면 앞에서 자르고 '전체 보기' 하나, 셀은 열 이름을 라벨로 갖는다", () => {
    let shown = 0;
    const rows = [{ name: "A", v: 1 }, { name: "B", v: 2 }, { name: "C", v: 3 }];
    render(<ResultTable title="대상별" rows={rows} limit={2} onShowAll={() => { shown += 1; }} columns={[{ key: "name", label: "대상" }, { key: "v", label: "값", align: "right" }]} />);
    expect(screen.getAllByRole("row")).toHaveLength(3);
    expect(document.querySelector('td[data-label="값"]')).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "전체 3개 보기" }));
    expect(shown).toBe(1);
  });

  it("확인할 점: 신호가 없으면 아무것도 그리지 않는다", () => {
    const { container, rerender } = render(<IssueTable issues={[]} />);
    expect(container.innerHTML).toBe("");
    rerender(<IssueTable locale="en" issues={[{ kind: "Collinearity", target: "Meta ↔ Google", text: "r 0.94" }]} />);
    expect(screen.getByRole("table", { name: "Check these" })).toBeTruthy();
  });

  it("조건 한 줄: 지금 조건을 말하고, 바꾸기는 이름 있는 창에서", () => {
    render(<ConditionLine summary="최근 14일 · CPI" dialogTitle="분석 조건"><label>기간<input /></label></ConditionLine>);
    expect(screen.getByText("최근 14일 · CPI")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "조건 바꾸기" }));
    expect(screen.getByRole("dialog", { name: "분석 조건" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});
