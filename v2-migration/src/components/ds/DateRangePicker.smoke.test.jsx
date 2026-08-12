// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DateRangePicker, { buildComparisonRange, buildDatePreset } from "@/components/ds/DateRangePicker";

const BASE_PROPS = {
  minDate: "2026-07-01",
  maxDate: "2026-08-12",
  dateStart: null,
  dateEnd: null,
  onApply: vi.fn(),
};

describe("DateRangePicker", () => {
  it("builds the reduced business presets and equal-length previous comparison", () => {
    expect(buildDatePreset("thisWeek", "2026-08-12", BASE_PROPS.minDate, BASE_PROPS.maxDate)).toEqual({ start: "2026-08-10", end: "2026-08-12" });
    expect(buildDatePreset("last14", "2026-08-12", BASE_PROPS.minDate, BASE_PROPS.maxDate)).toEqual({ start: "2026-07-30", end: "2026-08-12" });
    expect(buildDatePreset("lastMonth", "2026-08-12", BASE_PROPS.minDate, BASE_PROPS.maxDate)).toEqual({ start: "2026-07-01", end: "2026-07-31" });
    expect(buildComparisonRange("2026-07-30", "2026-08-12", "previous", BASE_PROPS.minDate, BASE_PROPS.maxDate)).toEqual({ start: "2026-07-16", end: "2026-07-29" });
  });

  it("applies a preset together with the comparison toggle", () => {
    const onApply = vi.fn();
    render(<DateRangePicker {...BASE_PROPS} onApply={onApply} />);

    fireEvent.click(screen.getByRole("button", { name: "날짜 범위" }));
    fireEvent.click(screen.getByRole("button", { name: "최근 2주" }));
    fireEvent.click(screen.getByRole("switch", { name: "비교" }));
    fireEvent.click(screen.getByRole("button", { name: "적용" }));

    expect(onApply).toHaveBeenCalledWith({
      dateStart: "2026-07-30",
      dateEnd: "2026-08-12",
      compareEnabled: true,
      comparisonStart: "2026-07-16",
      comparisonEnd: "2026-07-29",
      comparisonPreset: "previous",
    });
  });

  it("selects a custom range directly from the calendar", () => {
    const onApply = vi.fn();
    render(<DateRangePicker {...BASE_PROPS} onApply={onApply} />);

    fireEvent.click(screen.getByRole("button", { name: "날짜 범위" }));
    fireEvent.click(screen.getByRole("button", { name: "2026-08-05" }));
    fireEvent.click(screen.getByRole("button", { name: "2026-08-10" }));
    fireEvent.click(screen.getByRole("button", { name: "적용" }));

    expect(onApply).toHaveBeenCalledWith(expect.objectContaining({
      dateStart: "2026-08-05",
      dateEnd: "2026-08-10",
    }));
  });

  it("renders the streamlined preset list without Korean copy in English", () => {
    render(<DateRangePicker {...BASE_PROPS} locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: "Date range" }));

    expect(screen.getByRole("button", { name: "This week" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "Last 2 weeks" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Today" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Yesterday" })).toBeNull();
    expect(Array.from(new Set(document.body.textContent.match(/[가-힣]+/g) || []))).toEqual([]);
  });
});
