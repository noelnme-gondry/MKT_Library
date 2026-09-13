import { describe, expect, it } from "vitest";
import { render, screen, within } from "@testing-library/react";
import WeeklyHistoryEvidence from "./WeeklyHistoryEvidence";
import { summarizeBaseline } from "@/lib/weekly-review/significance";

describe("판정 이력 근거", () => {
  it.each(["ko", "en"])("distinguishes identical values from insufficient history in %s", locale => {
    const historySeries = ["2026-08-03", "2026-08-10", "2026-08-17"].map(start => ({ period: { start, end: start }, metrics: { cpa: 12.5 } }));
    const review = { historySeries, routing: { kpi: { baseline: summarizeBaseline([12.5, 12.5, 12.5]) } } };
    const { container } = render(<WeeklyHistoryEvidence review={review} metric="cpa" currency="USD" locale={locale} />);
    expect(container.querySelector("details").open).toBe(false);
    expect(container.textContent).toContain(locale === "en" ? "saved values are identical" : "지표값이 모두 같아");
    expect(container.textContent).not.toMatch(/too few|이력이 짧/);
    expect(screen.getAllByText("12.5 USD")).toHaveLength(3);
  });

  it("lists exactly the recent valid values used by the baseline, without replacing missing metrics with zero", () => {
    const historySeries = Array.from({ length: 12 }, (_, i) => ({ period: { start: `2026-08-${String(i + 1).padStart(2, "0")}`, end: `2026-08-${String(i + 1).padStart(2, "0")}` }, metrics: { cpa: i === 10 ? null : i } }));
    render(<WeeklyHistoryEvidence review={{ historySeries }} metric="cpa" currency="USD" />);
    const table = screen.getByRole("table");
    const rows = within(table).getAllByRole("row");
    expect(rows).toHaveLength(9);
    expect(table.textContent).not.toContain("2026-08-11");
    expect(rows[1].textContent).toContain("2026-08-04");
    expect(rows.at(-1).textContent).toContain("11 USD");
  });
});
