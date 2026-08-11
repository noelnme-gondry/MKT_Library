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

  it("uses neutral recovery copy outside analysis routes", () => {
    const { container } = render(<RouteErrorRecovery error={new Error("test")} reset={() => {}} scope="site" />);
    expect(container.textContent).toContain("이 페이지를 표시하지 못했습니다");
    expect(container.textContent).not.toContain("분석 허브로");
  });
});

// 크래시가 콘솔에만 남고 어디에도 전송되지 않아 원인 파악이 불가능했다.
// 오류 메시지·스택에는 원자료가 섞일 수 있으므로 절대 실리면 안 된다.
describe("RouteErrorRecovery 크래시 계측", () => {
  it("app_error를 범주형 값만으로 보낸다 (원자료 미포함)", () => {
    const calls = [];
    window.gtag = (...args) => calls.push(args);
    render(
      <RouteErrorRecovery
        error={{ name: "TypeError", digest: "abc123", message: "채널명 삼성전자 캠페인 매출 12,345" }}
        reset={() => {}}
        locale="ko"
        scope="analysis"
      />,
    );
    const errorEvent = calls.find((call) => call[1] === "app_error");
    expect(errorEvent, JSON.stringify(calls)).toBeTruthy();
    const payload = JSON.stringify(errorEvent[2] || {});
    expect(payload).toContain("TypeError");
    expect(payload).toContain("abc123");
    // 오류 메시지 본문(원자료가 섞일 수 있는 곳)은 절대 전송하지 않는다.
    expect(payload).not.toContain("삼성전자");
    expect(payload).not.toContain("12,345");
    delete window.gtag;
  });
});
