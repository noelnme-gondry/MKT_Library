// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CsvGuide from "@/components/ds/CsvGuide";

describe("CsvGuide", () => {
  it.each(["ko", "en"])("does not imply a zero-column contract before inspecting router input (%s)", locale => {
    const { container } = render(<CsvGuide toolId="start-gate" locale={locale} />);
    // 필수 컬럼이 없는 입구는 개수 줄을 아예 그리지 않는다 — "0개"도, 뜻 없는 안내 줄도 없다.
    expect(container.querySelector(".csv-guide-effort")).toBeNull();
    expect(container.textContent).not.toMatch(/필수 컬럼 0개|0 required columns/);
    // 페이지 설명문·진행 막대와 같은 말을 반복하지 않는다.
    expect(container.querySelector(".csv-guide-when")).toBeNull();
    expect(container.querySelector(".csv-guide-outcomes")).toBeNull();
  });
  beforeEach(() => {
    window.gtag = vi.fn();
  });

  it("opens an accessible portalled guide and preserves the explicit close action", async () => {
    render(<CsvGuide toolId="5-2" />);
    const trigger = screen.getByRole("button", { name: "어떤 데이터가 왜 필요한가요?" });
    trigger.focus();
    fireEvent.click(trigger);

    expect(screen.getByRole("dialog", { name: "이 도구에 올릴 데이터 안내" })).toBeTruthy();
    const close = screen.getByRole("button", { name: "이 도구에 올릴 데이터 안내: 닫기" });
    expect(close.classList.contains("csv-guide-close")).toBe(true);
    expect(close.getAttribute("style")).toBeNull();
    expect(document.activeElement).toBe(close);
    fireEvent.click(close);

    expect(screen.queryByRole("dialog", { name: "이 도구에 올릴 데이터 안내" })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("keeps the English guide copy and table labels", () => {
    render(<CsvGuide toolId="5-2" locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "What data is needed and why?" }));

    expect(screen.getByRole("dialog", { name: "Data guide for this tool" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "Which columns are needed and why?" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "A file shaped like this works (example)" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Data guide for this tool: Close" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "OK" }).classList.contains("is-primary")).toBe(true);
  });

  it("shows the required column count and runs the example without a download round trip", () => {
    const onTryExample = vi.fn();
    render(<CsvGuide toolId="5-18" onTryExample={onTryExample} />);
    // 소요 시간("5–10분")은 확인할 수 없는 숫자라 뺐다 — 필수 컬럼 수만 남긴다(§8).
    expect(document.body.textContent).toMatch(/필수 컬럼 \d+개/);
    expect(document.body.textContent).not.toMatch(/\d+분/);
    fireEvent.click(screen.getByRole("button", { name: /예시 데이터로 결과 바로 보기/ }));
    expect(onTryExample).toHaveBeenCalledTimes(1);
    expect(window.gtag).toHaveBeenCalledWith("event", "example_run_started", {
      tool_id: "5-18",
      interaction_source: "csv_guide",
      placement: "before_upload",
      locale: "ko",
    });
  });
});
