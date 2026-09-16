// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";

import ToolPageOutro from "@/components/ToolPageOutro";

const LINKS = [
  { type: "post", href: "/blog/guide-one", title: "운영 가이드 1" },
  { type: "term", href: "/glossary/adstock", title: "애드스톡" },
];

describe("ToolPageOutro", () => {
  it("closes the analysis with one boundary and wraps every follow-up block in a single box", () => {
    // 프로젝트 이어가기는 넘길 결과가 있을 때만 뜬다 — 게이트를 먼저 연다.
    useAppStore.getState().setGroupAnalyzed("5-2", true);
    const { container } = render(<ToolPageOutro toolId="5-2" evidenceLinks={LINKS} withConnections />);
    const outro = container.querySelector(".tool-outro");
    expect(outro).toBeTruthy();
    expect(outro.querySelector(".tool-outro__boundary")?.textContent).toContain("분석 결과는 여기까지");

    // 프로젝트 이어가기 · 다음 단계 · 참고 자료 · 관련 글이 모두 하나의 마감 박스 안에.
    const sections = outro.querySelectorAll(":scope > .tool-outro__section");
    expect(sections).toHaveLength(4);
    // 행이 없으면 이어서 볼 것도 없다 — 빈 구획을 남기지 않는다(PR #885).
    expect(outro.querySelector(".tool-continuity")).toBeNull();
    // 프로젝트 화면이 못 돌리는 분석은 자기 화면에서 프로젝트로 넘어간다 —
    // 그 경로를 화면에 적어 두지 않으면 사용자는 없는 경로를 찾아 헤맨다.
    expect(outro.querySelector(".project-handoff")).toBeTruthy();
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
    expect(outro.querySelectorAll(":scope > .tool-outro__section")).toHaveLength(4);

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

it("분석 전에는 프로젝트 이어가기 칸을 자리까지 비운다", () => {
  // 자식만 null을 돌려주고 래퍼가 남으면 **빈 박스**가 생긴다. 조건을 래퍼가
  // 소유해야 구조적으로 안 생긴다(§7 "쓸 수 없는 기능은 조건이 갖춰졌을 때만").
  useAppStore.setState(useAppStore.getInitialState(), true);
  const { container } = render(<ToolPageOutro toolId="5-2" evidenceLinks={LINKS} withConnections />);
  const outro = container.querySelector(".tool-outro");
  expect(outro.querySelector(".tool-outro__section--handoff")).toBeNull();
  expect(outro.querySelectorAll(":scope > .tool-outro__section")).toHaveLength(3);
});
