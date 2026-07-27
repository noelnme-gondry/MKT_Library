// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import AnalysisBasisBar from "@/components/data-import/AnalysisBasisBar";

function dataWithDays(days = 14) {
  const mappedRows = Array.from({ length: days }, (_, index) => ({
    date: `2026-07-${String(index + 1).padStart(2, "0")}`,
    cost: String(100 + index * 10),
    installs: String(10 + index),
  }));
  return {
    mappedRows,
    canonicalData: {
      summary: {},
      records: mappedRows.map((row) => ({
        date: row.date,
        dimensions: { channel: "Meta" },
        metrics: { cost: Number(row.cost), installs: Number(row.installs) },
      })),
    },
  };
}

describe("AnalysisBasisBar", () => {
  it("shows a compact English data basis and latest-period comparison", () => {
    const { canonicalData, mappedRows } = dataWithDays();
    render(<AnalysisBasisBar canonicalData={canonicalData} mappedRows={mappedRows} mapping={{ Date: "date", Cost: "cost", Installs: "installs" }} toolId="5-2" locale="en" />);

    expect(screen.getByText("Data basis")).toBeTruthy();
    expect(screen.getByText(/Recent comparison/)).toBeTruthy();
    expect(document.body.textContent).not.toMatch(/[가-힣]/);
  });

  it("gives an actionable explanation for a data-health issue", () => {
    const { canonicalData, mappedRows } = dataWithDays();
    canonicalData.records.push({ date: null, dimensions: { channel: "Meta" }, metrics: { cost: 100, installs: 10 } });
    render(<AnalysisBasisBar canonicalData={canonicalData} mappedRows={mappedRows} mapping={{ Date: "date", Cost: "cost", Installs: "installs" }} toolId="5-2" locale="en" />);

    expect(screen.getByText(/Some rows have no date/)).toBeTruthy();
  });
});
