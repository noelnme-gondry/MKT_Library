// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

  // 결과 카드 머리 표시: 문제가 없으면 아무것도 없고, 있으면 빨간 "!" — 누르면(키보드·터치 포함)
  // 어느 지점이 문제인지 목록으로 보인다(2026-09-24).
  it("shows nothing in the result header when the data has no issue", () => {
    const { canonicalData, mappedRows } = dataWithDays();
    const { container } = render(<AnalysisBasisBar canonicalData={canonicalData} mappedRows={mappedRows} mapping={{ Date: "date", Cost: "cost", Installs: "installs" }} toolId="5-2" locale="en" variant="tooltip" />);
    expect(container.innerHTML).toBe("");
  });

  it("shows a red mark that lists where the data needs checking", () => {
    const { canonicalData, mappedRows } = dataWithDays();
    canonicalData.records.push({ date: null, dimensions: { channel: "Meta" }, metrics: { cost: 100, installs: 10 } });
    render(<AnalysisBasisBar canonicalData={canonicalData} mappedRows={mappedRows} mapping={{ Date: "date", Cost: "cost", Installs: "installs" }} toolId="5-2" locale="en" variant="tooltip" />);
    const mark = screen.getByRole("button", { name: /to check/ });
    expect(mark.textContent).toBe("!");
    fireEvent.click(mark);
    expect(screen.getByRole("dialog").textContent).toMatch(/Some rows have no date.*\(1 rows\)/);
  });

  it("shows an undated survival dataset as usable without a fabricated period count", () => {
    const canonicalData = {
      summary: {},
      records: [
        { date: null, dimensions: {}, metrics: { tenure_periods: 1, event_observed: 1 } },
        { date: null, dimensions: {}, metrics: { tenure_periods: 2, event_observed: 0 } },
      ],
    };
    render(<AnalysisBasisBar
      canonicalData={canonicalData}
      mappedRows={[{ tenure_periods: "1", event_observed: "1" }, { tenure_periods: "2", event_observed: "0" }]}
      mapping={{ Duration: "tenure_periods", Event: "event_observed" }}
      toolId="5-28"
      locale="en"
    />);

    expect(screen.getByText("Core checks passed")).toBeTruthy();
    expect(screen.getByText(/2 rows/).textContent).not.toContain("periods");
    expect(document.body.textContent).not.toContain("Some rows have no date");
  });
});
