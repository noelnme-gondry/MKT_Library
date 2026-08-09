// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import GrowthFunnelReport from "./GrowthFunnelReport";

describe("GrowthFunnelReport", () => {
  afterEach(cleanup);

  it("loads a deterministic local-only sample in Korean", () => {
    const { container } = render(<GrowthFunnelReport />);
    fireEvent.click(screen.getByRole("button", { name: "예시 데이터로 보기" }));
    expect(container.querySelectorAll(".growth-funnel-stages article")).toHaveLength(5);
    expect(container.textContent).toContain("비데모 분석 완료");
    expect(container.textContent).toContain("62");
    expect(container.textContent).toContain("결정→재검토 이벤트량 비율");
    expect(container.textContent).toContain("38.1%");
  });

  it("renders equivalent English guidance", () => {
    render(<GrowthFunnelReport locale="en" />);
    expect(screen.getByRole("heading", { name: "Acquisition → analysis → review funnel" })).toBeTruthy();
    expect(screen.getByText(/Required: Event name/)).toBeTruthy();
  });
});
