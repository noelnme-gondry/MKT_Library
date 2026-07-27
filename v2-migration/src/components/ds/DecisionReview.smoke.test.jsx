// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DecisionReview from "@/components/ds/DecisionReview";

describe("DecisionReview", () => {
  it("records a concrete action and lets the user enter its outcome", () => {
    render(<DecisionReview toolId="5-3" />);
    fireEvent.click(screen.getByText(/결정 기록하기/));
    fireEvent.change(screen.getByLabelText("무엇을 바꿀까요?"), { target: { value: "Meta 예산 20% 감액" } });
    fireEvent.change(screen.getByLabelText("검증 지표"), { target: { value: "CPA" } });
    fireEvent.click(screen.getByRole("button", { name: "결정 추가" }));

    expect(screen.getByText("Meta 예산 20% 감액")).toBeTruthy();
    expect(screen.getByText("CPA")).toBeTruthy();
    fireEvent.change(screen.getByPlaceholderText("예: CPA 4,980원"), { target: { value: "CPA 4,980원" } });
    expect(screen.getByText("검토 완료")).toBeTruthy();
  });

  it("renders a fully English decision loop", () => {
    render(<DecisionReview toolId="5-2" locale="en" />);
    fireEvent.click(screen.getByText(/Log a decision/));
    expect(document.body.textContent).not.toMatch(/[가-힣]/);
    expect(screen.getByRole("button", { name: "Add decision" })).toBeTruthy();
  });
});
