// @vitest-environment jsdom
import React from "react";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { mmmControlFitRows } from "@/utils/mmmControlContract";
import MmmControlFitTable from "@/components/tools/MmmControlFitTable";

const panel = {
  externalDefs: [
    { key: "price", label: "Price index" },
    { key: "holiday", label: "Holiday demand" },
    { key: "weather", label: "Weather" },
  ],
};

const run = {
  names: ["industry_price"],
  droppedFeatures: ["industry_holiday"],
  externalTransforms: {
    price: { mode: "log-relative", reference: 101 },
    holiday: { mode: "linear-relative", reference: 1 },
  },
};

describe("MmmControlFitTable", () => {
  it("renders computed included, dropped, and unused rows through the shared table", () => {
    const rows = mmmControlFitRows(panel, run);
    const { container } = render(<MmmControlFitTable rows={rows} locale="ko" />);

    expect(container.querySelector(".ds-data-table")).toBeTruthy();
    expect(screen.getByText("공동 적합에 포함")).toBeTruthy();
    expect(screen.getByText("독립 변화 부족으로 제외")).toBeTruthy();
    expect(screen.getByText("적합에 사용되지 않음")).toBeTruthy();
    expect(screen.getByText("기준 대비 로그 변화")).toBeTruthy();
  });

  it("renders the same computed contract in English", () => {
    render(<MmmControlFitTable rows={mmmControlFitRows(panel, run)} locale="en" />);
    expect(screen.getByRole("region", { name: "Continuous-control model status" })).toBeTruthy();
    expect(screen.getByText("Included in joint fit")).toBeTruthy();
    expect(screen.getByText("Excluded: no independent variation")).toBeTruthy();
    expect(screen.getByText("Not used in fit")).toBeTruthy();
  });
});
