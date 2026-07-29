import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import RouteErrorRecovery from "@/components/RouteErrorRecovery";

describe("RouteErrorRecovery", () => {
  it("offers a safe Korean retry path without rendering the original error", () => {
    const reset = vi.fn();
    const { container } = render(<RouteErrorRecovery error={{ message: "raw CSV must not appear" }} reset={reset} locale="ko" />);
    expect(container.textContent).toContain("이 분석 화면을 표시하지 못했습니다");
    expect(container.textContent).not.toContain("raw CSV");
    fireEvent.click(Array.from(container.querySelectorAll("button")).find((button) => button.textContent.includes("다시 시도")));
    expect(reset).toHaveBeenCalledTimes(1);
    expect(Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"))).toContain("/tools/marketing-response");
  });

  it("keeps English recovery links within the English route tree", () => {
    const { container } = render(<RouteErrorRecovery error={new Error("test")} reset={() => {}} locale="en" />);
    expect(container.textContent).toContain("This analysis could not be displayed");
    expect(Array.from(container.querySelectorAll("a")).map((link) => link.getAttribute("href"))).toContain("/en/tools/marketing-response");
  });
});
