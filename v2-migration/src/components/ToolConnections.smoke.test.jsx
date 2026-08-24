// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";

import ToolConnections from "@/components/ToolConnections";
import { getNextTools, NEXT_TOOL_IDS } from "@/lib/toolConnections";
import { hasToolTemplate } from "@/components/ds/csvTemplate";

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
    expect(container.textContent).not.toContain("Current stage");
    expect(container.textContent).not.toContain("CONNECTED TOOLS");
    expect(container.textContent).toContain("Prepare a new dataset");
  });

  it("puts a mapping template ahead of a second re-upload route when no top path shares the CSV", () => {
    const { container } = render(<ToolConnections toolId="5-27" />);
    const cards = [...container.querySelectorAll(".tool-connection-card")];
    expect(cards).toHaveLength(2);
    expect(cards[0].classList.contains("tool-connection-card--prepare")).toBe(true);
    expect(cards[0].textContent).toContain("ASA 키워드 발굴용 매핑 템플릿");
    expect(cards[0].textContent).toContain("매핑 CSV 받기");
    expect(cards.filter((card) => card.tagName === "A")).toHaveLength(1);
  });

  it("never leaves two re-upload routes at the top when a template can prepare the first one", () => {
    const noSharedTop = Object.keys(NEXT_TOOL_IDS).filter((toolId) => (
      getNextTools(toolId).slice(0, 2).every((tool) => !tool.isSameData)
    ));
    expect(noSharedTop.length).toBeGreaterThan(0);

    noSharedTop.forEach((toolId) => {
      const firstTarget = getNextTools(toolId)[0];
      expect(hasToolTemplate(firstTarget.id), toolId).toBe(true);
      const view = render(<ToolConnections toolId={toolId} />);
      expect(view.container.querySelector(".tool-connection-card--prepare"), toolId).toBeTruthy();
      expect(view.container.querySelectorAll(".tool-connection-card[href]"), toolId).toHaveLength(1);
      view.unmount();
    });
  });

  it("does not recommend MMM before the VIF verdict is known", () => {
    const { container } = render(<ToolConnections toolId="5-25" />);
    expect(container.querySelector(".tool-connection-card.is-recommended")).toBeNull();
    expect(container.textContent).toContain("판정 후 선택");
    expect(container.textContent).not.toContain("일반적인 다음 단계");
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
