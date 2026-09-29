import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn(), trackProductEventOnce: vi.fn(), productEventKey: (...parts) => parts.join("|") }));

import { trackProductEvent } from "@/lib/analytics";
import CalculatorWorkbench from "./CalculatorWorkbench";

describe("CalculatorWorkbench", () => {
  it("renders an immediate LTV:CAC result and updates from inputs", () => {
    render(<CalculatorWorkbench slug="ltv-cac" />);
    expect(screen.getByText("3.00×")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/^고객 LTV/), { target: { value: "200000" } });
    expect(screen.getByText("4.00×")).toBeTruthy();
    expect(screen.getByRole("link", { name: /CSV로 채널별 LTV:CAC 분석/ }).getAttribute("href")).toBe("/dashboard");
  });

  it("tags the tool hand-off with the calculator so downstream results can be attributed", () => {
    render(<CalculatorWorkbench slug="cpa-roas-converter" />);
    fireEvent.click(screen.getByRole("link", { name: /예산 배분/ }));
    expect(trackProductEvent).toHaveBeenCalledWith("blog_tool_cta_clicked", expect.objectContaining({ tool_id: "5-3", content_slug: "cpa-roas-converter", content_type: "calculator", placement: "calculator_result", locale: "ko" }));
  });

  it("renders the English experiment calculator with an actionable result", () => {
    render(<CalculatorWorkbench slug="ab-test-sample-size" locale="en" />);
    expect(screen.getByText("Sample per variant")).toBeTruthy();
    expect(screen.getByText(/days/)).toBeTruthy();
    expect(screen.getByRole("link", { name: /Continue to experiment design/ }).getAttribute("href")).toBe("/en/tools/experiment-analysis");
  });
});
