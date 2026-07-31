// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";

import ToolTemplateAction from "@/components/ds/ToolTemplateAction";

describe("ToolTemplateAction", () => {
  it("keeps the compact KR action to one contextual download utility", () => {
    const { container } = render(
      <ToolTemplateAction toolId="5-2" compact reason="이 단계의 입력 형식" />,
    );

    expect(container.querySelector(".tool-template-action.is-compact")).not.toBeNull();
    expect(screen.getByText("이 단계의 입력 형식")).not.toBeNull();
    expect(screen.getByRole("button", { name: "매핑 CSV 받기 ↓" })).not.toBeNull();
    expect(screen.queryByRole("link", { name: /전체 템플릿/ })).toBeNull();
  });

  it("keeps the full EN utility localized without promoting it to a primary CTA", () => {
    render(<ToolTemplateAction toolId="5-2" locale="en" />);

    expect(screen.getByRole("button", { name: "Download mapping CSV ↓" })).not.toBeNull();
    expect(screen.getByRole("link", { name: "All templates →" })).not.toBeNull();
  });
});
