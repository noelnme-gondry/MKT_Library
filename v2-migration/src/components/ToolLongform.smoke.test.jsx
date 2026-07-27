// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import ToolLongform from "@/components/ToolLongform";

describe("ToolLongform", () => {
  it("keeps guidance content without a competing next-tool CTA", () => {
    const { container } = render(<ToolLongform toolId="5-18" />);
    expect(container.querySelector(".tool-longform")).toBeTruthy();
    expect(container.querySelector(".tool-longform a")).toBeNull();
    expect(container.textContent).toContain("진단 기준과 다음 조치 보기");
  });

  it("removes the duplicate CTA in the English guide too", () => {
    const { container } = render(<ToolLongform toolId="5-3" locale="en" />);
    expect(container.querySelector(".tool-longform a")).toBeNull();
    expect(container.textContent).toContain("See calculation logic and safeguards");
  });
});
