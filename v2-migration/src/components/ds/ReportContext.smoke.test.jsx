// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import ReportContext from "./ReportContext";

describe("ReportContext", () => {
  it.each(["ko", "en"])("reads the result scope in one line and opens the same controls in a dialog (%s)", (locale) => {
    const en = locale === "en";
    render(<ReportContext locale={locale} parts={[{ text: "Sample data · 2,250 rows" }, { text: "" }, { text: "CPI", emphasis: true }]}>
      <label htmlFor="probe">probe</label><input id="probe" />
    </ReportContext>);
    // 빈 조각은 버리고 구분점은 조각 사이에만 둔다.
    expect(document.querySelector(".report-context__line").textContent).toBe("Sample data · 2,250 rows · CPI");
    expect(document.querySelector(".report-context__line strong").textContent).toBe("CPI");
    // 결과 위에는 컨트롤이 없다 — 창을 열어야 나온다.
    expect(screen.queryByLabelText("probe")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: en ? "Change settings" : "조건 바꾸기" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByLabelText("probe")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: en ? "Close" : "닫기" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("does not offer a change button when there is nothing to change", () => {
    render(<ReportContext parts={[{ text: "예시 데이터" }]} />);
    expect(screen.queryByRole("button")).toBeNull();
  });
});
