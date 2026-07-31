import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import DiagnoseRouter from "./DiagnoseRouter";

describe("DiagnoseRouter", () => {
  it("turns the organic symptom into a causal-safe check order", () => {
    render(<DiagnoseRouter />);
    fireEvent.click(screen.getByLabelText("광고를 늘렸더니 오가닉이 줄었어요"));
    fireEvent.click(screen.getByLabelText("유료·오가닉 주간 데이터"));
    fireEvent.click(screen.getByLabelText("광고의 순수 효과 검증하기"));
    expect(screen.getByText("마케팅 반응 분석")).toBeTruthy();
    expect(screen.getByText("증분 효과 분석")).toBeTruthy();
    expect(screen.getByText(/인과 판단은 통제 실험/)).toBeTruthy();
  });

  it("keeps English tool links localized", () => {
    render(<DiagnoseRouter locale="en" />);
    fireEvent.click(screen.getByLabelText("Creative-level performance"));
    expect(screen.getByRole("link", { name: "Creative fatigue open" }).getAttribute("href")).toBe("/en/content/freshness");
  });
});
