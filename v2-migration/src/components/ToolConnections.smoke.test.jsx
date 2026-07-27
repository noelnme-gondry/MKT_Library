// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import ToolConnections from "@/components/ToolConnections";

describe("ToolConnections", () => {
  it("renders three KR next steps with data-continuity labels", () => {
    const { container } = render(<ToolConnections toolId="5-2" />);
    expect(container.querySelectorAll(".tool-connection-card")).toHaveLength(3);
    expect(container.querySelectorAll(".is-same-data")).toHaveLength(3);
    expect(container.textContent).toContain("같은 CSV로 이어보기");
  });

  it("renders equivalent EN copy and routes", () => {
    const { container } = render(<ToolConnections toolId="5-22" locale="en" />);
    const links = [...container.querySelectorAll(".tool-connection-card")];
    expect(links).toHaveLength(3);
    expect(links.every((link) => link.getAttribute("href").startsWith("/en/"))).toBe(true);
    expect(container.textContent).toContain("What should you check after this analysis?");
    expect(container.textContent).toContain("Prepare a new dataset");
  });
});
