// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import DataTable from "@/components/ds/DataTable";

describe("DataTable semantic contract", () => {
  it("exposes stable table, sticky-header, numeric, and consumer class hooks", () => {
    const { container } = render(
      <DataTable
        ariaLabel="Campaign evidence"
        caption="Campaign evidence caption"
        stickyHeader
        wrapperClassName="campaign-table-wrap"
        className="campaign-table"
        columns={[
          { key: "campaign", label: "Campaign", cellClassName: "campaign-name" },
          { key: "cost", label: "Cost", align: "right", headClassName: "cost-heading" },
        ]}
        rows={[{ campaign: "Brand", cost: 1200 }]}
      />,
    );

    expect(screen.getByRole("table", { name: "Campaign evidence" }).classList.contains("data-table")).toBe(true);
    expect(container.querySelector(".data-table-wrap.campaign-table-wrap")).toBeTruthy();
    expect(container.querySelector("thead.data-table__head.is-sticky")).toBeTruthy();
    expect(container.querySelector("th.cost-heading[data-numeric='true']")).toBeTruthy();
    expect(container.querySelector("td.campaign-name")).toBeTruthy();
    expect(container.querySelector("td.tnum[data-numeric='true']")?.textContent).toBe("1200");
  });

  it("uses the shared empty-state cell instead of inline presentation", () => {
    const { container } = render(
      <DataTable columns={[{ key: "name", label: "Name" }]} rows={[]} emptyText="No rows" />,
    );

    const empty = screen.getByText("No rows");
    expect(empty.classList.contains("data-table__empty")).toBe(true);
    expect(empty.classList.contains("ds-data-table__empty")).toBe(true);
    expect(empty.getAttribute("style")).toBeNull();
    expect(container.querySelector("tr.is-empty")).toBeTruthy();
  });
});
