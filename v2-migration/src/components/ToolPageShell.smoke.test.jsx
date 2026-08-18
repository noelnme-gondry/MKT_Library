// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ToolPageShell from "@/components/ToolPageShell";
import { toolIndexEntry } from "@/lib/toolIndex";

// 도구 이름의 SSOT는 스토어 IA다. toolId가 있으면 셸이 레지스트리 이름을 쓰므로
// 넘긴 title은 무시된다 — 이름이 두 곳에 살지 않게 하려는 계약이다.

describe("ToolPageShell instrument header contract", () => {
  it("keeps title, status, scope, summary, and contents in one Korean shell", () => {
    const { container } = render(
      <ToolPageShell
        title="넘겨도 무시되는 제목"
        toolId="5-3"
        chips={<span>분석 가능</span>}
        stickyFilter={<button type="button">최근 30일</button>}
        summary={<p>다음 예산 이동을 확인하세요.</p>}
        toc={[{ id: "evidence", title: "근거" }]}
      >
        <section id="evidence">근거 본문</section>
      </ToolPageShell>,
    );

    expect(screen.getByRole("heading", { level: 1, name: toolIndexEntry("5-3").name })).toBeTruthy();
    expect(container.textContent).not.toContain("넘겨도 무시되는 제목");
    expect(container.querySelector("header.page-sticky-bar.tool-instrument-header--sticky")).toBeTruthy();
    expect(container.textContent).toContain("의사결정 작업대");
    expect(container.querySelector(".tool-instrument-header__status")?.textContent).toContain("분석 가능");
    expect(container.querySelector(".tool-instrument-header__controls")?.textContent).toContain("최근 30일");
    expect(screen.getByRole("complementary", { name: "목차" })).toBeTruthy();
  });

  it("keeps the same structure and copy contract in English", () => {
    const { container } = render(
      <ToolPageShell title="Budget allocation" locale="en" summary={<p>Review the next move.</p>}>
        <div>Workspace</div>
      </ToolPageShell>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "Budget allocation" })).toBeTruthy();
    expect(container.textContent).toContain("DECISION WORKSPACE");
    expect(container.textContent).toContain("Summary");
    expect(container.textContent?.match(/[가-힣]/)).toBeNull();
  });

  it("can demote its dynamic title when a static SEO heading owns the page h1", () => {
    render(<ToolPageShell title="예산 배분 시뮬레이터" titleLevel={2}><div>본문</div></ToolPageShell>);
    expect(screen.getByRole("heading", { level: 2, name: "예산 배분 시뮬레이터" })).toBeTruthy();
    expect(screen.queryByRole("heading", { level: 1 })).toBeNull();
  });

  it("can omit a repeated workspace title when a static SEO heading already names the tool", () => {
    const { container } = render(<ToolPageShell title="ASA 키워드 발굴 · CPT 조정" titleLevel={0} summary={<p>요약</p>}><div>본문</div></ToolPageShell>);
    expect(container.querySelector(".tool-instrument-header")).toBeNull();
    expect(container.querySelectorAll("h1, h2")).toHaveLength(0);
    expect(container.textContent).toContain("요약");
  });
});
