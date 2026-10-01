// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { useAppStore } from "@/store/useDataStore";

import ToolPageOutro from "@/components/ToolPageOutro";

const LINKS = [
  { type: "post", href: "/blog/guide-one", title: "운영 가이드 1" },
  { type: "term", href: "/glossary/adstock", title: "애드스톡" },
];

describe("ToolPageOutro", () => {
  it.each(["ko", "en"])("keeps evidence reachable without repeating it below the result (%s)", locale => {
    useAppStore.setState(useAppStore.getInitialState(), true);
    useAppStore.getState().setGroupAnalyzed("5-4", true);
    const { container } = render(<ToolPageOutro toolId="5-4" locale={locale} evidenceLinks={LINKS} withConnections />);
    expect(container.querySelector(".tool-next-step-panel")).toBeTruthy();
    expect(container.querySelector(".tool-longform, .tool-evidence, .project-handoff")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Continue in a project" : "프로젝트로 이어가기" }));
    expect(screen.getByRole("dialog").querySelector(".project-handoff")).toBeTruthy();
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button",{name:locale === "en" ? "Close" : "닫기"}));
    fireEvent.click(screen.getByRole("button", { name: locale === "en" ? "Method and references" : "분석 방법과 참고 자료" }));
    expect(screen.getByRole("dialog").querySelector(".tool-longform__faq")).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByRole("link",{name:/운영 가이드 1/})).toBeTruthy();
  });

  it("calls the boundary a reference section when the page above is not an analysis", () => {
    const { container } = render(<ToolPageOutro toolId="1-1" evidenceLinks={LINKS} />);
    expect(container.querySelector(".tool-outro__boundary")?.textContent).toContain("관련 자료");
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
  const { container } = render(<ToolPageOutro toolId="5-4" evidenceLinks={LINKS} withConnections />);
  expect(container.querySelector(".project-handoff")).toBeNull();
  expect(screen.queryByRole("button",{name:"프로젝트로 이어가기"})).toBeNull();
  expect(screen.getByRole("button",{name:"분석 방법과 참고 자료"})).toBeTruthy();
});

for (const locale of ["ko", "en"]) for (const toolId of ["5-21", "5-22", "5-3", "5-2"]) {
  it(`keeps ${toolId} next step short and opens references on demand (${locale})`, () => {
    useAppStore.setState(useAppStore.getInitialState(), true);
    const { container } = render(<ToolPageOutro toolId={toolId} locale={locale} evidenceLinks={LINKS} withConnections />);
    expect(container.querySelectorAll(".tool-connection-card")).toHaveLength(2);
    expect(container.querySelector(".tool-connections__more, .tool-continuity, .tool-longform, .tool-evidence")).toBeNull();
    const title = locale === "en" ? "Method and references" : "분석 방법과 참고 자료";
    fireEvent.click(screen.getByRole("button", { name: title }));
    const dialog = screen.getByRole("dialog", { name: title });
    expect(dialog.querySelector(".tool-longform__faq")).toBeTruthy();
    expect(within(dialog).getByRole("link", { name: /운영 가이드 1/ }).getAttribute("href")).toBe("/blog/guide-one");
    fireEvent.click(within(dialog).getByRole("button", { name: locale === "en" ? "Close" : "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
}
