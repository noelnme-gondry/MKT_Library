// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import OperationsHomeTrend from "./OperationsHomeTrend";
import { buildOperationsHomePreview } from "@/lib/operations/operationsHomePreview";
import { buildOperationsDemo } from "@/lib/operations/operationsDemo";

const configs = vi.hoisted(() => []);
vi.mock("@/utils/chartGlobals", () => ({ default: class {
  constructor(_, config) { configs.push(config); }
  resize() {}
  draw() {}
  destroy() {}
} }));

describe("home observed trend binding", () => {
  beforeEach(() => { configs.length = 0; });
  it.each(["ko", "en"])("passes actual daily weighted costs and the prior-period reference to the chart (%s)", locale => {
    const sample = buildOperationsHomePreview(locale);
    const source = buildOperationsDemo(locale).raw;
    for (const campaign of sample.campaigns) {
      const rows = campaign.trend.slice(-28);
      const { unmount } = render(<OperationsHomeTrend campaign={campaign} rows={rows} periods={sample.periods} probeDate={rows.at(-1).date} onProbeDate={vi.fn()} isVisible locale={locale} />);
      const config = configs.at(-1);
      expect(config.data.labels).toEqual(rows.map(row => row.date));
      const raw = source.filter(row => row["Campaign name"] === campaign.name);
      const totals = values => values.reduce((sum, row) => ({ cost: sum.cost + row.Cost, installs: sum.installs + row.Installs }), { cost: 0, installs: 0 });
      for (const [index, date] of config.data.labels.entries()) {
        const day = totals(raw.filter(row => row.Date === date));
        expect(config.data.datasets[0].data[index]).toBeCloseTo(day.cost / day.installs, 10);
      }
      const prior = totals(raw.filter(row => row.Date >= sample.periods.previous.start && row.Date <= sample.periods.previous.end));
      expect(config.data.datasets[1].data).toEqual(rows.map(() => prior.cost / prior.installs));
      expect(config.options.scales.y.beginAtZero).toBe(true);
      expect(config.options.responsive).toBe(true);
      expect(config.options.maintainAspectRatio).toBe(false);
      expect(config.data.datasets[0].spanGaps).toBe(false);
      unmount();
    }
  });
  it.each(["ko", "en"])("maps date inspection and chart hover to the same source dates (%s)", locale => {
    const sample = buildOperationsHomePreview(locale), campaign = sample.campaigns[0];
    const rows = campaign.trend.slice(-28), onProbeDate = vi.fn();
    const props = { campaign, rows, periods: sample.periods, probeDate: rows.at(-1).date, onProbeDate, isVisible: true, locale };
    const { getByRole, container, rerender } = render(<OperationsHomeTrend {...props} />);
    fireEvent.change(getByRole("slider"), { target: { value: "3" } });
    expect(onProbeDate).toHaveBeenLastCalledWith(rows[3].date);
    rerender(<OperationsHomeTrend {...props} probeDate={rows[3].date} />);
    expect(container.querySelector("output").dataset.date).toBe(rows[3].date);
    expect(Number(container.querySelector("output").dataset.cpi)).toBe(rows[3].cpr);
    configs.at(-1).options.onHover({}, [{ index: 12, datasetIndex: 0 }]);
    expect(onProbeDate).toHaveBeenLastCalledWith(rows[12].date);
    const full = campaign.trend;
    rerender(<OperationsHomeTrend {...props} rows={full} />);
    expect(configs.at(-1).data.labels).toHaveLength(sample.historyDays);
  });
  it("withholds a graph for an empty daily series", () => {
    const sample = buildOperationsHomePreview();
    const { getByRole } = render(<OperationsHomeTrend campaign={sample.campaigns[0]} rows={[]} periods={sample.periods} probeDate="" onProbeDate={vi.fn()} isVisible locale="ko" />);
    expect(getByRole("status").textContent).toContain("관측이 없습니다");
    expect(configs).toHaveLength(0);
  });
});
