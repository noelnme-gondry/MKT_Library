// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ToolIntro from "@/components/ToolIntro";

describe("ToolIntro heading and locale contract", () => {
  it("shows the Korean tool name as the visible page heading", () => {
    const { container } = render(<ToolIntro toolId="5-4" />);
    expect(screen.getByRole("heading", { level: 1, name: "실험 분석" })).toBeTruthy();
    expect(container.querySelector("h1")?.classList.contains("sr-only")).toBe(false);
    expect(container.textContent).toContain("두 안의 차이가 우연인지");
  });

  it("keeps the heading and explanation equivalent in English", () => {
    const { container } = render(<ToolIntro toolId="5-4" locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: "Experiment analysis" })).toBeTruthy();
    expect(container.textContent).toContain("whether the difference is more than chance");
    expect(container.textContent?.match(/[가-힣]/)).toBeNull();
  });
});
