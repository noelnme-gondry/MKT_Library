// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render } from "@testing-library/react";
import MmmColumnMapper from "./MmmColumnMapper";

describe("MmmColumnMapper interaction", () => {
  it("places a clicked column into a clicked role zone without requiring drag and drop", () => {
    const onChange = vi.fn();
    const { container } = render(
      <MmmColumnMapper
        headers={["week", "regs"]}
        rows={[{ week: "2025-W01", regs: "100" }]}
        colMap={{ week: { role: "week" } }}
        onChange={onChange}
      />,
    );

    const regsChip = Array.from(container.querySelectorAll("strong")).find((node) => node.textContent === "regs");
    expect(regsChip).toBeTruthy();
    fireEvent.click(regsChip);
    expect(container.textContent).toContain("“regs” 선택됨");

    const regsZone = container.querySelector('[data-mmm-role-zone="reg"]');
    expect(regsZone).toBeTruthy();
    fireEvent.click(regsZone);
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ regs: expect.objectContaining({ role: "reg" }) }));
  });
});
