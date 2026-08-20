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
    expect(container.querySelector(".tool-instrument-header")?.getAttribute("data-tool-id")).toBe("5-4");
    expect(container.textContent).not.toContain("브라우저 내 분석");
    expect(container.textContent).not.toContain("의사결정 도구");
  });

  it("keeps the heading and explanation equivalent in English", () => {
    const { container } = render(<ToolIntro toolId="5-4" locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: "Experiment analysis" })).toBeTruthy();
    expect(container.textContent).toContain("whether the difference is more than chance");
    expect(container.textContent).not.toContain("BROWSER-ONLY ANALYSIS");
    expect(container.textContent).not.toContain("DECISION TOOL");
    expect(container.textContent?.match(/[가-힣]/)).toBeNull();
  });

  it("renders an SSR-ready budget heading instead of leaving it to the dynamic tool", () => {
    const { container } = render(<ToolIntro toolId="5-3" />);
    expect(screen.getByRole("heading", { level: 1, name: "무료 마케팅 예산 배분 시뮬레이터" })).toBeTruthy();
    expect(container.querySelector(".tool-instrument-header__next")).toBeNull();
  });

  it("keeps the ASO route's sole h1 in the shared intro", () => {
    const { rerender } = render(<ToolIntro toolId="5-27" />);
    expect(screen.getByRole("heading", { level: 1, name: "ASO 스토어 전환 분석" })).toBeTruthy();

    rerender(<ToolIntro toolId="5-27" locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: "ASO store conversion analysis" })).toBeTruthy();
  });

  it("gives every response subtool a unique Korean and English heading", () => {
    const { rerender } = render(<ToolIntro toolId="5-18-cannibal" />);
    expect(screen.getByRole("heading", { level: 1, name: "광고 카니발라이제이션 진단" })).toBeTruthy();

    rerender(<ToolIntro toolId="5-18-cannibal" locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: "Ad cannibalization diagnosis" })).toBeTruthy();
  });
});
