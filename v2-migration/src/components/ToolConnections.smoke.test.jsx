// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import ToolConnections from "@/components/ToolConnections";

describe("ToolConnections", () => {
  it("keeps the rail to two immediate KR next steps with the full journey tucked away", () => {
    const { container } = render(<ToolConnections toolId="5-2" />);
    expect(container.querySelectorAll(".tool-connection-card")).toHaveLength(2);
    expect(container.querySelectorAll(".is-same-data")).toHaveLength(2);
    expect(container.textContent).toContain("같은 CSV로 이어보기");
    expect(container.textContent).toContain("전체 여정");
  });

  it("renders equivalent EN copy and routes", () => {
    const { container } = render(<ToolConnections toolId="5-22" locale="en" />);
    const links = [...container.querySelectorAll(".tool-connection-card")];
    expect(links).toHaveLength(2);
    expect(links.every((link) => link.getAttribute("href").startsWith("/en/"))).toBe(true);
    expect(container.textContent).toContain("Current stage");
    expect(container.textContent).toContain("Prepare a new dataset");
  });

  it("tracks the target, source, rank, locale, and data continuity", () => {
    const gtag = vi.fn();
    window.gtag = gtag;
    const { container } = render(<ToolConnections toolId="5-22" locale="en" />);
    const link = container.querySelector(".tool-connection-card");
    link.addEventListener("click", (event) => event.preventDefault());
    fireEvent.click(link);
    expect(gtag).toHaveBeenCalledWith("event", "tool_connection_pick", {
      tool_id: "5-3",
      source_tool_id: "5-22",
      source: "analysis_tool",
      placement: "next_decision",
      data_continuity: "same_csv",
      rank: 1,
      locale: "en",
    });
    delete window.gtag;
  });
});
