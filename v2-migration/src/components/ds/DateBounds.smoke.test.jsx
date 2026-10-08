// @vitest-environment jsdom
import React from "react";
import { beforeEach, describe, it, expect, vi } from "vitest";
import { cleanup, render, fireEvent, screen } from "@testing-library/react";
import ResultPeriodPicker from "./ResultPeriodPicker";
import DateRangePicker from "./DateRangePicker";
import IsoDateInput from "./IsoDateInput";

const bounds = { minDate: "2026-02-01", maxDate: "2026-02-28" };
beforeEach(cleanup);
describe("CSV observation-date boundaries", () => {
  it.each(["ko", "en"])("rejects an out-of-file result period and preserves the applied range (%s)", locale => {
    const en = locale === "en", onApply = vi.fn();
    render(<ResultPeriodPicker {...bounds} locale={locale} label="Period" range={{ start: "2026-02-05", end: "2026-02-25" }} onApply={onApply} />);
    fireEvent.click(screen.getByRole("button", { name: /^Period/ }));
    const start = screen.getByLabelText(en ? "Start date" : "시작일"), end = screen.getByLabelText(en ? "End date" : "종료일");
    expect(start.min).toBe(bounds.minDate); expect(end.max).toBe(bounds.maxDate);
    fireEvent.change(start, { target: { value: "2026-01-31" } });
    fireEvent.click(screen.getByRole("button", { name: en ? "Apply" : "적용" }));
    expect(onApply).not.toHaveBeenCalled(); expect(screen.getByRole("alert").textContent).toContain(bounds.minDate);
    fireEvent.change(start, { target: { value: bounds.minDate } });
    fireEvent.change(end, { target: { value: "2026-03-01" } });
    fireEvent.click(screen.getByRole("button", { name: en ? "Apply" : "적용" }));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.change(end, { target: { value: bounds.maxDate } });
    fireEvent.click(screen.getByRole("button", { name: en ? "Apply" : "적용" }));
    expect(onApply).toHaveBeenCalledWith({ start: bounds.minDate, end: bounds.maxDate });
  });
  it.each(["ko", "en"])("checks directly typed dates in the regular picker, including comparison dates (%s)", locale => {
    const en = locale === "en", onApply = vi.fn();
    render(<DateRangePicker {...bounds} locale={locale} dateStart="2026-02-15" dateEnd="2026-02-20" onApply={onApply} />);
    fireEvent.click(screen.getByRole("button", { name: en ? "Date range" : "날짜 범위" }));
    fireEvent.change(screen.getByLabelText(en ? "End date" : "종료일"), { target: { value: "2026-03-01" } });
    fireEvent.click(screen.getByRole("button", { name: en ? "Apply" : "적용" }));
    expect(onApply).not.toHaveBeenCalled(); expect(screen.getByRole("alert").textContent).toContain(bounds.maxDate);
    fireEvent.change(screen.getByLabelText(en ? "End date" : "종료일"), { target: { value: "2026-02-20" } });
    fireEvent.click(screen.getByRole("switch", { name: en ? "Compare" : "비교" }));
    fireEvent.click(screen.getByRole("button", { name: en ? "Custom period" : "맞춤 기간" }));
    fireEvent.change(screen.getAllByLabelText(en ? "Start date" : "시작일")[1], { target: { value: "2026-01-31" } });
    fireEvent.click(screen.getByRole("button", { name: en ? "Apply" : "적용" }));
    expect(onApply).not.toHaveBeenCalled();
    fireEvent.change(screen.getAllByLabelText(en ? "Start date" : "시작일")[1], { target: { value: bounds.minDate } });
    fireEvent.click(screen.getByRole("button", { name: en ? "Apply" : "적용" }));
    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({ dateStart: "2026-02-15", dateEnd: "2026-02-20", comparisonStart: bounds.minDate }));
  });
  it("guards both ISO text and native-calendar commits", () => {
    const onChange = vi.fn();
    render(<IsoDateInput min={bounds.minDate} max={bounds.maxDate} value="2026-02-15" aria-label="Install start" onChange={onChange} />);
    const text = screen.getByRole("textbox", { name: "Install start" }), calendar = screen.getByLabelText("Install start 달력");
    fireEvent.change(text, { target: { value: "2026-01-31" } }); fireEvent.keyDown(text, { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.change(calendar, { target: { value: "2026-03-01" } });
    expect(onChange).not.toHaveBeenCalled(); expect(screen.getByRole("alert").textContent).toContain(bounds.maxDate);
    fireEvent.change(calendar, { target: { value: bounds.minDate } });
    expect(onChange).toHaveBeenCalledWith({ target: { value: bounds.minDate } });
  });
});
