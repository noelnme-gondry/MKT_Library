import { afterEach, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ResultChange from "./ResultChange";

afterEach(() => vi.restoreAllMocks());

it("shows the actual new result immediately, animates only on change and keeps its accessible name", () => {
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: false });
  const cancel = vi.fn(), animate = vi.fn(() => ({ cancel }));
  const { rerender, unmount } = render(<ResultChange as="section" value={100} aria-label="선택한 결과">100</ResultChange>);
  const result = screen.getByRole("region", { name: "선택한 결과" });
  result.animate = animate;
  rerender(<ResultChange as="section" value={100} aria-label="선택한 결과">100</ResultChange>);
  expect(animate).not.toHaveBeenCalled();
  rerender(<ResultChange as="section" value={80} aria-label="선택한 결과">80</ResultChange>);
  expect(result.textContent).toBe("80");
  expect(animate).toHaveBeenCalledOnce();
  unmount();
  expect(cancel).toHaveBeenCalledOnce();
});

it.each(["reduced-motion", "off-screen"])("updates without motion for %s", reason => {
  vi.spyOn(window, "matchMedia").mockReturnValue({ matches: reason === "reduced-motion" });
  const { rerender } = render(<ResultChange value={1}>1</ResultChange>);
  const result = screen.getByText("1"), animate = vi.fn();
  result.animate = animate;
  if (reason === "off-screen") vi.spyOn(result, "getBoundingClientRect").mockReturnValue({ top: -100, bottom: -50 });
  rerender(<ResultChange value={2}>2</ResultChange>);
  expect(result.textContent).toBe("2");
  expect(animate).not.toHaveBeenCalled();
});
