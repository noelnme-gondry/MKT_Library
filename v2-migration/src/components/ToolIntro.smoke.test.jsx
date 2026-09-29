// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ToolIntro from "@/components/ToolIntro";
import { toolIndexEntry } from "@/lib/toolIndex";
import { publishedToolIds } from "@/lib/routeMap";

// 제목은 목록·경로와 같은 레지스트리 이름이다(2026-09-29 결정 A). 이름을 여기 적지 않고
// 레지스트리에서 읽는다 — 적으면 리네임 때 테스트가 옛 이름을 지킨다.
const nameOf = (id, locale = "ko") => toolIndexEntry(id, locale).name;

describe("ToolIntro heading and locale contract", () => {
  it("shows the Korean tool name as the visible page heading", () => {
    const { container } = render(<ToolIntro toolId="5-4" />);
    expect(screen.getByRole("heading", { level: 1, name: nameOf("5-4") })).toBeTruthy();
    expect(container.querySelector("h1")?.classList.contains("sr-only")).toBe(false);
    expect(container.textContent).toContain("두 안의 차이가 우연인지");
    expect(container.querySelector(".tool-instrument-header")?.getAttribute("data-tool-id")).toBe("5-4");
    expect(container.textContent).not.toContain("브라우저 내 분석");
    expect(container.textContent).not.toContain("의사결정 도구");
  });

  it("keeps the heading and explanation equivalent in English", () => {
    const { container } = render(<ToolIntro toolId="5-4" locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: nameOf("5-4", "en") })).toBeTruthy();
    expect(container.textContent).toContain("whether the difference is more than chance");
    expect(container.textContent).not.toContain("BROWSER-ONLY ANALYSIS");
    expect(container.textContent).not.toContain("DECISION TOOL");
    expect(container.textContent?.match(/[가-힣]/)).toBeNull();
  });

  it("renders an SSR-ready budget heading instead of leaving it to the dynamic tool", () => {
    const { container } = render(<ToolIntro toolId="5-3" />);
    expect(screen.getByRole("heading", { level: 1, name: nameOf("5-3") })).toBeTruthy();
    // 검색어형 이름은 지우지 않고 제목 밑 한 줄로 남는다.
    expect(container.querySelector(".tool-instrument-header__alias")?.textContent).toBe("무료 마케팅 예산 배분 시뮬레이터");
    expect(container.querySelector(".tool-instrument-header__next")).toBeNull();
  });

  it("keeps the ASO route's sole h1 in the shared intro", () => {
    const { rerender } = render(<ToolIntro toolId="5-27" />);
    expect(screen.getByRole("heading", { level: 1, name: nameOf("5-27") })).toBeTruthy();

    rerender(<ToolIntro toolId="5-27" locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: nameOf("5-27", "en") })).toBeTruthy();
  });

  it("gives every response subtool a unique Korean and English heading", () => {
    const { rerender } = render(<ToolIntro toolId="5-18-cannibal" />);
    expect(screen.getByRole("heading", { level: 1, name: nameOf("5-18-cannibal") })).toBeTruthy();

    rerender(<ToolIntro toolId="5-18-cannibal" locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: nameOf("5-18-cannibal", "en") })).toBeTruthy();
  });

  it("renders the action-survival route introduction instead of returning null", () => {
    const { rerender } = render(<ToolIntro toolId="5-28" />);
    expect(screen.getByRole("heading", { level: 1, name: nameOf("5-28") })).toBeTruthy();

    rerender(<ToolIntro toolId="5-28" locale="en" />);
    expect(screen.getByRole("heading", { level: 1, name: nameOf("5-28", "en") })).toBeTruthy();
  });

  it("uses the registry name as the h1 for every published tool it introduces", () => {
    let checked = 0;
    for (const id of publishedToolIds()) {
      for (const locale of ["ko", "en"]) {
        const { container, unmount } = render(<ToolIntro toolId={id} locale={locale} />);
        const h1 = container.querySelector("h1");
        if (h1) {
          expect(h1.textContent, `${id} ${locale}`).toBe(nameOf(id, locale));
          const alias = container.querySelector(".tool-instrument-header__alias");
          if (alias) expect(alias.textContent.replace(/\s+/g, "")).not.toBe(nameOf(id, locale).replace(/\s+/g, ""));
          checked += 1;
        }
        unmount();
      }
    }
    // ToolIntro가 여는 도구가 몇 개인지 세지 않으면 이 검사는 0건으로 조용히 통과한다.
    expect(checked).toBeGreaterThan(20);
  });
});
