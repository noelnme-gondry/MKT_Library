import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DiagnoseRouter from "./DiagnoseRouter";

describe("DiagnoseRouter", () => {
  it("turns the organic symptom into a causal-safe check order", () => {
    render(<DiagnoseRouter />);
    expect(screen.queryByText("이 분석부터 시작하세요")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "광고를 늘렸더니 오가닉이 줄었어요" }));
    fireEvent.click(screen.getByRole("radio", { name: "유료·오가닉 주간 데이터" }));
    fireEvent.click(screen.getByRole("radio", { name: "광고의 순수 효과 검증하기" }));
    expect(screen.getByText("이 분석부터 시작하세요")).toBeTruthy();
    expect(screen.getByText("잠식 진단")).toBeTruthy();
    expect(screen.getByText("증분 효과 분석")).toBeTruthy();
    expect(screen.getByText(/인과 판단은 통제 실험/)).toBeTruthy();
  });

  it("keeps English tool links localized", () => {
    render(<DiagnoseRouter locale="en" />);
    fireEvent.click(screen.getByRole("radio", { name: "CPI or CPA suddenly increased" }));
    fireEvent.click(screen.getByRole("radio", { name: "Creative-level performance" }));
    fireEvent.click(screen.getByRole("radio", { name: "Find the cause first" }));
    expect(screen.getByRole("link", { name: /Start this analysis/ }).getAttribute("href")).toBe("/en/content/freshness");
  });

  it("shows one question at a time and lets the user edit an earlier answer", () => {
    render(<DiagnoseRouter />);
    expect(screen.getByText("지금 가장 가까운 증상은?")).toBeTruthy();
    expect(screen.queryByText("어떤 데이터가 있나요?")).toBeNull();
    fireEvent.click(screen.getByRole("radio", { name: "CPI·CPA가 갑자기 올랐어요" }));
    expect(screen.getByText("어떤 데이터가 있나요?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /CPI·CPA가 갑자기 올랐어요/ }));
    expect(screen.getByText("지금 가장 가까운 증상은?")).toBeTruthy();
    fireEvent.click(screen.getByRole("radio", { name: "CPI·CPA가 갑자기 올랐어요" }));
    expect(screen.getByText("어떤 데이터가 있나요?")).toBeTruthy();
  });
});
