// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render } from "@testing-library/react";

import ToolLongform from "@/components/ToolLongform";

describe("ToolLongform", () => {
  it("keeps guidance content without a competing next-tool CTA", () => {
    const { container } = render(<ToolLongform toolId="5-18" />);
    expect(container.querySelector(".tool-longform")).toBeTruthy();
    expect(container.querySelector(".tool-longform a")).toBeNull();
    expect(container.querySelector(".tool-longform__boundary")).toBeNull();
    const disclosure = container.querySelector(".tool-longform__disclosure");
    expect(disclosure).toBeTruthy();
    expect(disclosure.open).toBe(false);
    expect(disclosure.querySelector(":scope > summary")?.textContent).toContain("필요할 때만 펼쳐보세요");
    expect(container.textContent).toContain("판단 기준과 FAQ");
    expect(container.textContent).toContain("진단 기준과 다음 조치 보기");
    expect(container.textContent).not.toContain("도구 사용 가이드");
  });

  it("removes the duplicate CTA in the English guide too", () => {
    const { container } = render(<ToolLongform toolId="5-3" locale="en" />);
    expect(container.querySelector(".tool-longform a")).toBeNull();
    expect(container.querySelector(".tool-longform__boundary")).toBeNull();
    expect(container.querySelector(".tool-longform__summary")?.textContent).toContain("Open only when you need the methodology");
    expect(container.textContent).toContain("Method and FAQ");
    expect(container.textContent).toContain("See calculation logic and safeguards");
  });

  it("renders unique cannibalization guidance and visible FAQ content", () => {
    const { container } = render(<ToolLongform toolId="5-18-cannibal" />);
    expect(container.textContent).not.toContain("유료 광고가 신규 성과를 만들었는지 기존 수요를 가져왔는지 점검하세요");
    expect(container.textContent).toContain("잠식 신호와 검증 순서 보기");
    expect(container.textContent).toContain("자주 묻는 질문");
    expect(container.textContent).toContain("잠식 의심은 광고를 중단하라는 뜻인가요?");
  });

  it("keeps the English forecast landing semantically distinct", () => {
    const { container } = render(<ToolLongform toolId="5-18-forecast" locale="en" />);
    expect(container.textContent).toContain("Review error on the sealed OOS window");
    expect(container.textContent).toContain("sealed OOS validation window");
    expect(container.textContent?.match(/[가-힣]/)).toBeNull();
  });
});
