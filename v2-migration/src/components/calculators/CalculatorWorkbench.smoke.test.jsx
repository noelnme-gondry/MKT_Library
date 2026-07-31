import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import CalculatorWorkbench from "./CalculatorWorkbench";

describe("CalculatorWorkbench", () => {
  it("renders an immediate LTV:CAC result and updates from inputs", () => {
    render(<CalculatorWorkbench slug="ltv-cac" />);
    expect(screen.getByText("3.00×")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^고객 LTV/), { target: { value: "200000" } });
    expect(screen.getByText("4.00×")).toBeTruthy();
    expect(screen.getByRole("link", { name: /CSV로 채널별 LTV:CAC 분석/ }).getAttribute("href")).toBe("/dashboard");
  });

  it("renders the English experiment calculator with an actionable result", () => {
    render(<CalculatorWorkbench slug="ab-test-sample-size" locale="en" />);
    expect(screen.getByText("Sample per variant")).toBeTruthy();
    expect(screen.getByText(/days/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Continue to experiment design/ }).getAttribute("href")).toBe("/en/tools/experiment-analysis");
  });
});
