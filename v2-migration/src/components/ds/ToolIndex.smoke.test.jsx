// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ToolIndex from "@/components/ds/ToolIndex";
import { allToolIndexEntries, PUBLISHED_TOOL_IDS } from "@/lib/toolIndex";
import { TOOL_JOURNEY } from "@/lib/toolConnections";

describe("ToolIndex", () => {
  it("발행 도구를 하나도 빠뜨리지 않고 그린다", () => {
    // 목록에 없는 도구는 사용자가 존재를 알 방법이 없다 — 이 검사가 그 구멍을 막는다.
    const { container } = render(<ToolIndex />);
    const links = [...container.querySelectorAll(".tool-index__link")];
    expect(links).toHaveLength(PUBLISHED_TOOL_IDS.length);
    for (const entry of allToolIndexEntries()) {
      expect(container.textContent, entry.id).toContain(entry.name);
      expect(container.textContent, entry.id).toContain(entry.question);
    }
  });

  it("모든 링크가 실제 경로를 가리킨다", () => {
    const { container } = render(<ToolIndex />);
    for (const link of container.querySelectorAll(".tool-index__link")) {
      expect(link.getAttribute("href")).toMatch(/^\/[a-z]/);
    }
  });

  it("compact는 필요 데이터를 접고 full은 편다", () => {
    const compact = render(<ToolIndex density="compact" />);
    expect(compact.container.querySelector(".tool-index__needs")).toBeNull();
    compact.unmount();
    const full = render(<ToolIndex density="full" />);
    expect(full.container.querySelector(".tool-index__needs")).toBeTruthy();
  });

  it("지금 못 쓰는 도구는 숨기지 않고 흐리게 둔다", () => {
    // 숨기면 "무엇이 있는지" 자체를 못 본다 — 지금 문제가 정확히 그것이다.
    const { container } = render(<ToolIndex eligibleIds={["5-2"]} />);
    expect(container.querySelectorAll(".tool-index__link")).toHaveLength(PUBLISHED_TOOL_IDS.length);
    expect(container.querySelectorAll(".tool-index__item.is-dim").length).toBe(PUBLISHED_TOOL_IDS.length - 1);
  });

  it("EN은 한글 없이 그린다", () => {
    const { container } = render(<ToolIndex locale="en" />);
    expect(container.textContent).not.toMatch(/[가-힣]/);
    expect(container.querySelector(".tool-index__link").getAttribute("href")).toMatch(/^\/en\//);
  });

  it("스테이지 번호를 여정 순서대로 빠짐없이 낸다", () => {
    // 번호를 손으로 적으면 갈래가 늘 때 이 줄만 고치게 된다 — 레지스트리에서 파생한다.
    const { container } = render(<ToolIndex />);
    const numbers = [...container.querySelectorAll(".tool-index__stage-no")].map((n) => n.textContent);
    expect(numbers).toEqual(TOOL_JOURNEY.map((_, index) => String(index + 1).padStart(2, "0")));
  });

  it("갈래를 접지 않는다 — 펼 때마다 위치가 달라지면 방금 본 도구를 다시 찾게 된다", () => {
    const { container } = render(<ToolIndex />);
    expect(container.querySelector("details")).toBeNull();
    expect(container.querySelectorAll(".tool-index__stage")).toHaveLength(TOOL_JOURNEY.length);
  });
});
