// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import CsvGuide from "@/components/ds/CsvGuide";

describe("CsvGuide", () => {
  beforeEach(() => {
    window.gtag = vi.fn();
  });

  it("opens an accessible portalled guide and preserves the explicit close action", () => {
    render(<CsvGuide toolId="5-2" />);
    const trigger = screen.getByRole("button", { name: "📖 어떤 데이터가 왜 필요한가요?" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "이 도구에 올릴 데이터 안내" })).toBeTruthy();
    const close = screen.getByRole("button", { name: "이 도구에 올릴 데이터 안내: 닫기" });
    expect(close.classList.contains("csv-guide-close")).toBe(true);
    expect(close.getAttribute("style")).toBeNull();
    expect(document.activeElement).toBe(close);
    fireEvent.click(close);

    expect(screen.queryByRole("dialog", { name: "이 도구에 올릴 데이터 안내" })).toBeNull();
    expect(document.activeElement).toBe(trigger);
  });

  it("keeps the English guide copy and table labels", () => {
    render(<CsvGuide toolId="5-2" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "📖 What data is needed and why?" }));

    expect(screen.getByRole("dialog", { name: "Data guide for this tool" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Which columns are needed and why?" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "A file shaped like this works (example)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Data guide for this tool: Close" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "OK" }).classList.contains("is-primary")).toBe(true);
  });

  it("shows required effort and runs the example without a download round trip", () => {
    const onTryExample = vi.fn();
    render(<CsvGuide toolId="5-18" onTryExample={onTryExample} />);
    expect(document.body.textContent).toContain("화면 작업 예상 5–10분");
    fireEvent.click(screen.getByRole("button", { name: /예시 데이터로 결과 바로 보기/ }));
    expect(onTryExample).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith("event", "example_run_started", {
      tool_id: "5-18",
      source: "csv_guide",
      placement: "before_upload",
      locale: "ko",
    });
  });
});
