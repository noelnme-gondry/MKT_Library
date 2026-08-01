// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ToolPageShell from "@/components/ToolPageShell";

describe("ToolPageShell instrument header contract", () => {
  it("keeps title, status, scope, summary, and contents in one Korean shell", () => {
    const { container } = render(
      <ToolPageShell
        title="예산 배분"
        toolId="5-3"
        chips={<span>분석 가능</span>}
        stickyFilter={<button type="button">최근 30일</button>}
        summary={<p>다음 예산 이동을 확인하세요.</p>}
        toc={[{ id: "evidence", title: "근거" }]}
      >
        <section id="evidence">근거 본문</section>
      </ToolPageShell>,
    );

    expect(screen.getByRole("heading", { level: 1, name: "예산 배분" })).toBeTruthy();
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
});
