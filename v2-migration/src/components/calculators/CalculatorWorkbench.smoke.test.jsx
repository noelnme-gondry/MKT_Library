import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn(), trackProductEventOnce: vi.fn(), productEventKey: (...parts) => parts.join("|") }));

import { trackProductEvent, trackProductEventOnce } from "@/lib/analytics";
import CalculatorWorkbench from "./CalculatorWorkbench";

describe("CalculatorWorkbench", () => {
  beforeEach(() => vi.clearAllMocks());

  it.each([
    ["ko", /^대조군 전환 인원/, "3.0%p", "8.0%p", /계산 불가: 대조군 전환율 0%/, /전체 인원은 1명 이상/, /관측 차이이며/, "/tools/incrementality"],
    ["en", /^Control converters/, "3.0 pp", "8.0 pp", /Unavailable: control conversion rate is 0%/, /Enter whole numbers/, /These are observed differences/, "/en/tools/incrementality"],
  ])("calculates uplift honestly through the %s input flow", (locale, controlLabel, initial, absoluteOnly, unavailable, invalid, limitation, href) => {
    render(<CalculatorWorkbench slug="uplift" locale={locale} />);
    expect(screen.getByText(initial)).toBeTruthy();
    expect(screen.getByText("60.0%")).toBeTruthy();
    expect(screen.getByText(limitation)).toBeTruthy();
    expect(screen.getByRole("link").getAttribute("href")).toBe(href);
    expect(trackProductEventOnce.mock.calls.filter(([name]) => name === "calculator_used")).toHaveLength(0);

    fireEvent.change(screen.getByLabelText(controlLabel), { target: { value: "" } });
    expect(screen.getByText(invalid)).toBeTruthy();
    expect(screen.queryByText(initial)).toBeNull();
    expect(trackProductEventOnce.mock.calls.filter(([name]) => name === "calculator_used")).toHaveLength(0);

    fireEvent.change(screen.getByLabelText(controlLabel), { target: { value: "0" } });
    expect(screen.getByText(absoluteOnly)).toBeTruthy();
    expect(screen.getByText(unavailable)).toBeTruthy();
    expect(screen.queryByText("0.0%")).toBeNull();
    expect(trackProductEventOnce).toHaveBeenCalledWith("calculator_used", `uplift|${locale}`, {
      tool_id: "5-23", content_slug: "uplift", content_type: "calculator", placement: "calculator_input", locale, state: "calculated",
    });

    fireEvent.change(screen.getByLabelText(controlLabel), { target: { value: "1001" } });
    expect(screen.getByText(invalid)).toBeTruthy();
    expect(screen.queryByRole("link")).toBeNull();
    expect(trackProductEventOnce.mock.calls.filter(([name]) => name === "calculator_used")).toHaveLength(1);
  });

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
