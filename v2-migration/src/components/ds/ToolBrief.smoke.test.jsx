// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ToolBrief from "@/components/ds/ToolBrief";
import { toolIndexEntry } from "@/lib/toolIndex";
import { PUBLISHED_TOOL_IDS } from "@/lib/toolIndex";

describe("ToolBrief", () => {
  it.each(PUBLISHED_TOOL_IDS)("%s 는 질문·답·필요 데이터를 세 줄로 낸다", (toolId) => {
    const { container } = render(<ToolBrief toolId={toolId} />);
    const entry = toolIndexEntry(toolId);
    expect(container.querySelector(".tool-brief__q").textContent).toBe(entry.question);
    expect(container.querySelector(".tool-brief__a").textContent).toBe(entry.answer);
    // 필수 필드가 없는 도구(커스텀 매퍼)는 그 줄을 아예 안 그린다 — 조건부 단언이
    // 되지 않도록 양쪽 다 검사한다(§7).
    const needsLine = container.querySelector(".tool-brief__needs");
    if (entry.needs.length === 0) expect(needsLine).toBeNull();
    else expect(needsLine.textContent).toContain(entry.needs[0]);
  });

  it("목록과 도구 화면이 같은 문장을 쓴다", () => {
    // 다르면 "내가 고른 게 이거 맞나"를 다시 확인하게 된다.
    const { container } = render(<ToolBrief toolId="5-27" />);
    expect(container.textContent).toContain(toolIndexEntry("5-27").question);
  });

  it("등록되지 않은 도구에서는 아무것도 그리지 않는다", () => {
    const { container } = render(<ToolBrief toolId="9-2" />);
    expect(container.firstChild).toBeNull();
  });

  it("EN도 한글 없이 낸다", () => {
    const { container } = render(<ToolBrief toolId="5-27" locale="en" />);
    expect(container.textContent).not.toMatch(/[가-힣]/);
  });
});
