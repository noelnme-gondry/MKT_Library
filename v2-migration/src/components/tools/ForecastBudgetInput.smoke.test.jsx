import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { CommaNumberInput } from "./marketingResponseModel";
import ForecastBudgetControls from "./ForecastBudgetControls";

describe("원본 통화 예산 입력", () => {
  it.each(["ko", "en"])("passes source amounts to every model constraint without conversion in %s", locale => {
    const onTotal = vi.fn(), onMinimum = vi.fn(), onMaximum = vi.fn();
    const { rerender } = render(<ForecastBudgetControls currency="USD" locale={locale} total={125.75} minimum={0} maximum={null} onTotal={onTotal} onMinimum={onMinimum} onMaximum={onMaximum} />);
    const inputs = screen.getAllByRole("textbox");
    expect(inputs[0].value).toBe("125.75");
    [onTotal, onMinimum, onMaximum].forEach((callback, index) => {
      fireEvent.change(inputs[index], { target: { value: "1,234.56" } });
      expect(callback).toHaveBeenLastCalledWith(1234.56);
    });
    rerender(<ForecastBudgetControls currency="USD" locale={locale} total={1234.56} minimum={1234.56} maximum={1234.56} onTotal={onTotal} onMinimum={onMinimum} onMaximum={onMaximum} />);
    expect(inputs.map(input => input.value)).toEqual(["1,234.56", "1,234.56", "1,234.56"]);
    fireEvent.change(inputs[0], { target: { value: "" } });
    fireEvent.change(inputs[1], { target: { value: "" } });
    fireEvent.change(inputs[2], { target: { value: "" } });
    expect(onTotal).toHaveBeenLastCalledWith(null);
    expect(onMinimum).toHaveBeenLastCalledWith(0);
    expect(onMaximum).toHaveBeenLastCalledWith(null);
  });
  it("preserves decimal source amounts and comma-formatted edits", () => {
    const commit = vi.fn();
    render(<CommaNumberInput value={1234.56789} onCommit={commit} allowDecimals ariaLabel="Source budget" />);
    const input = screen.getByRole("textbox", { name: "Source budget" });
    expect(input.value).toBe("1,234.56789");
    fireEvent.change(input, { target: { value: "2,345.67" } });
    expect(commit).toHaveBeenLastCalledWith(2345.67);
    fireEvent.change(input, { target: { value: "." } });
    expect(commit).toHaveBeenCalledTimes(1);
    fireEvent.change(input, { target: { value: "1.2.3" } });
    expect(commit).toHaveBeenCalledTimes(1);
    fireEvent.change(input, { target: { value: "" } });
    expect(commit).toHaveBeenLastCalledWith(null);
  });
});
