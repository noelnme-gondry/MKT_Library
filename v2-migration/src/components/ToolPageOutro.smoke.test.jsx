// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import ToolPageOutro from "@/components/ToolPageOutro";

const LINKS = [
  { type: "post", href: "/blog/guide-one", title: "운영 가이드 1" },
  { type: "term", href: "/glossary/adstock", title: "애드스톡" },
];

describe("ToolPageOutro", () => {
  it("closes the analysis with one boundary and wraps every follow-up block in a single box", () => {
    const { container } = render(<ToolPageOutro toolId="5-2" evidenceLinks={LINKS} withConnections />);
    const outro = container.querySelector(".tool-outro");
    expect(outro).toBeTruthy();
    expect(outro.querySelector(".tool-outro__boundary")?.textContent).toContain("분석 결과는 여기까지");

    // 다음 단계 · 참고 자료 · 관련 글이 모두 하나의 마감 박스 안에 있어야 한다.
    const sections = outro.querySelectorAll(":scope > .tool-outro__section");
    expect(sections).toHaveLength(3);
    expect(outro.querySelector(".tool-connections")).toBeTruthy();
    expect(outro.querySelector(".tool-longform")).toBeTruthy();
    expect(outro.querySelector(".tool-evidence")).toBeTruthy();
    // 경계선은 마감 박스가 단독으로 소유한다(자식이 중복으로 그리지 않음).
    expect(outro.querySelectorAll(".tool-outro__boundary")).toHaveLength(1);
    // 보조기술이 통째로 건너뛸 수 있게 이름 붙은 landmark여야 한다.
    expect(screen.getByRole("region", { name: "분석 결과는 여기까지" })).toBe(outro);
  });

  it("keeps reference material collapsed so the result stays the last thing read", () => {
    const { container } = render(<ToolPageOutro toolId="5-2" evidenceLinks={LINKS} withConnections />);
    expect(container.querySelector(".tool-longform__disclosure").open).toBe(false);
    expect(container.querySelector(".tool-connections__more").open).toBe(false);
  });

  it("mirrors the same structure and copy in English", () => {
    const { container } = render(<ToolPageOutro toolId="5-2" locale="en" evidenceLinks={LINKS.map((item) => ({ ...item, title: "Item" }))} withConnections />);
    const outro = container.querySelector(".tool-outro");
    expect(outro.querySelector(".tool-outro__boundary")?.textContent).toContain("End of analysis");
    expect(outro.querySelectorAll(":scope > .tool-outro__section")).toHaveLength(3);
    expect(outro.querySelector(".tool-outro__boundary").textContent).not.toMatch(/[가-힣]/);
  });

  it("calls the boundary a reference section when the page above is not an analysis", () => {
    const { container } = render(<ToolPageOutro toolId="1-1" evidenceLinks={LINKS} />);
    expect(container.querySelector(".tool-outro__boundary")?.textContent).toContain("여기부터는 참고 영역");
    expect(container.querySelector(".tool-connections")).toBeNull();
  });

  it("renders nothing when there is no follow-up content to box", () => {
    const { container } = render(<ToolPageOutro toolId="1-1" evidenceLinks={[]} />);
    expect(container.querySelector(".tool-outro")).toBeNull();
  });
});
