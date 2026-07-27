// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import ToolAssistRail, { getSections } from "@/components/ToolAssistRail";

class Observer {
  observe() {}
  disconnect() {}
}

window.IntersectionObserver = Observer;

describe("ToolAssistRail", () => {
  it("provides a collapsed contextual assistant and opens on request", () => {
    document.body.innerHTML = '<section id="dashboard-tabpanel"></section><section id="dashboard-support-tools"></section>';
    const { getByRole, container } = render(<ToolAssistRail toolId="5-2" />);
    expect(container.querySelector(".tool-assist-rail")).toBeTruthy();
    fireEvent.click(getByRole("button", { name: "분석 도우미 열기" }));
    expect(container.querySelector(".tool-assist-rail").classList.contains("is-open")).toBe(true);
    expect(container.textContent).toContain("현재 탭 결과 읽기");
    expect(container.textContent).toContain("캠페인 성과 변동 탐지");
  });

  it("keeps EN copy and the EN next-tool destination in parity", () => {
    document.body.innerHTML = '<section id="s-sat-summary"></section>';
    const { getByRole, container } = render(<ToolAssistRail toolId="5-22" locale="en" />);
    fireEvent.click(getByRole("button", { name: "Open analysis assistant" }));
    expect(container.textContent).toContain("Prepare saturation inputs");
    expect(container.querySelector('a[href="/en/tools/budget-allocation"]')).toBeTruthy();
  });

  it("maps contextual sections for the dashboard and creative analysis", () => {
    expect(getSections("5-2").map((section) => section.id)).toContain("dashboard-support-tools");
    expect(getSections("9-6").map((section) => section.id)).toContain("s-creative-hero");
  });

  it("tracks a contextual jump", () => {
    document.body.innerHTML = '<section id="s-prep"></section>';
    const scrollIntoView = vi.fn();
    document.getElementById("s-prep").scrollIntoView = scrollIntoView;
    window.gtag = vi.fn();
    const { getByRole } = render(<ToolAssistRail toolId="5-3" />);
    fireEvent.click(getByRole("button", { name: "분석 도우미 열기" }));
    fireEvent.click(getByRole("button", { name: /이 위치로 이동/ }));
    expect(scrollIntoView).toHaveBeenCalled();
    expect(window.gtag).toHaveBeenCalledWith("event", "tool_assist_jump", expect.objectContaining({ tool_id: "5-3", section_id: "s-prep" }));
    delete window.gtag;
  });
});
