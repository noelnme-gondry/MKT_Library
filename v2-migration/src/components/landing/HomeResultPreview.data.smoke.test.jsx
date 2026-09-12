import { expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import { buildDemoCsv } from "@/utils/demoData";
import { compareSamplePerformance } from "@/utils/sampleSpendPreview";
import HomeResultPreview from "./HomeResultPreview";

it.each(["ko", "en"])("shows actual sample evidence and launches the sample (%s)", locale => {
  const result = compareSamplePerformance(buildDemoCsv("efficiency").raw);
  const lead = result.channels[0];
  const launch = vi.fn();
  const view = render(<HomeResultPreview locale={locale} onTrySample={launch} />);
  expect(view.container.querySelectorAll(".preview-cost-row")).toHaveLength(2);
  expect(view.container.textContent).toContain(lead.channel);
  for (const [index, key] of ["costChange", "actionChange", "cpaChange"].entries()) {
    const value = lead[key];
    expect(view.container.querySelectorAll("dd")[index].textContent).toBe(`${value >= 0 ? "+" : ""}${(value * 100).toFixed(1)}%`);
  }
  for (const period of ["prior", "recent"]) {
    expect(view.container.querySelector(`.is-${period} b`).textContent).toContain(Math.round(lead[period].cpa).toLocaleString(locale === "en" ? "en-US" : "ko-KR"));
  }
  expect(view.container.textContent).toContain(result.dates[0]);
  expect(view.container.textContent).toContain(result.dates.at(-1));
  fireEvent.click(view.getByRole("button"));
  expect(launch).toHaveBeenCalledOnce();
  view.unmount();
});
