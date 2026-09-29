// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ToolPageShell from "@/components/ToolPageShell";
import { toolIndexEntry } from "@/lib/toolIndex";

// 도구 이름의 SSOT는 스토어 IA다. toolId가 있으면 셸이 레지스트리 이름을 h1로 쓰고,
// 넘긴 title이 다르면 제목 밑 한 줄(검색어형 이름)로만 남는다(2026-09-29 결정 A).

describe("ToolPageShell instrument header contract", () => {
  it("keeps title, status, scope, summary, and contents in one Korean shell", () => {
    const { container } = render(
      <ToolPageShell
        title="검색어형 이름"
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
    expect(screen.queryByRole("heading", { name: "검색어형 이름" })).toBeNull();
    expect(container.querySelector(".tool-instrument-header__alias")?.textContent).toBe("검색어형 이름");
    expect(container.querySelector("header.page-sticky-bar.tool-instrument-header--sticky")).toBeTruthy();
    // 제목 위에 붙은 작은 라벨은 폰에서 읽히지 않고 제목과 경쟁한다(2026-09-24) — 두지 않는다.
    expect(container.textContent).not.toContain("의사결정 작업대");
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
    expect(container.textContent).not.toContain("DECISION WORKSPACE");
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
