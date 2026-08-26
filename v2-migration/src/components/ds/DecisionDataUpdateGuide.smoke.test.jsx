// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DecisionDataUpdateGuide, { shouldShowDecisionDataUpdateGuide } from "@/components/ds/DecisionDataUpdateGuide";

const continuity = (state, maturity = "likely_closed") => ({
  state,
  maturity,
  previous: { dateStart: "2026-08-01", dateEnd: "2026-08-07" },
  current: { dateStart: "2026-08-08", dateEnd: "2026-08-14" },
});

describe("DecisionDataUpdateGuide", () => {
  it("only renders statuses that have one guided next action", () => {
    expect(shouldShowDecisionDataUpdateGuide(continuity("next_period"))).toBe(true);
    expect(shouldShowDecisionDataUpdateGuide({ state: "missing_previous_snapshot" })).toBe(false);
    const { container } = render(<DecisionDataUpdateGuide continuity={{ state: "missing_previous_snapshot" }} />);
    expect(container.innerHTML).toBe("");
  });

  it("sends a duplicate dataset to the existing decision review", () => {
    render(<DecisionDataUpdateGuide continuity={continuity("duplicate", "provisional")} />);
    expect(screen.getByText("최근 기간이라 집계가 더 바뀔 수 있습니다.")).toBeTruthy();
    expect(document.querySelector('a[href="/weekly-review"]')).toBeTruthy();
  });

  it("keeps a partial overlap analyzable and focuses the next analysis instead of blocking it", () => {
    const onContinue = vi.fn();
    render(<DecisionDataUpdateGuide continuity={continuity("partial_overlap")} onContinue={onContinue} locale="en" />);
    fireEvent.click(screen.getByRole("button", { name: /Continue with a new analysis/ }));
    expect(onContinue).toHaveBeenCalledOnce();
    expect(screen.getByText(/do not automatically join conclusions/)).toBeTruthy();
  });
});
