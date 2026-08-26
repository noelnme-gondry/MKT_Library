// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
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

  it("assigns a role directly from a keyboard-accessible selector", () => {
    const onChange = vi.fn();
    render(
      <MmmColumnMapper
        headers={["week", "regs"]}
        rows={[{ week: "2025-W01", regs: "100" }]}
        colMap={{ week: { role: "week" } }}
        onChange={onChange}
        locale="en"
      />,
    );

    const selector = screen.getByRole("combobox", { name: "regs role" });
    fireEvent.change(selector, { target: { value: "reg" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ regs: expect.objectContaining({ role: "reg" }) }));
    expect(screen.getByText(/use each chip’s role selector/i)).toBeTruthy();
  });

  it("contains mapper controls at narrow widths and keeps a 44px clear target", () => {
    const onChange = vi.fn();
    render(
      <MmmColumnMapper
        headers={["week", "very_long_channel_spend_header"]}
        rows={[{ week: "2025-W01", very_long_channel_spend_header: "100" }]}
        colMap={{
          week: { role: "week" },
          very_long_channel_spend_header: { role: "channel", kind: "perf", plat: "common" },
        }}
        onChange={onChange}
        locale="en"
      />,
    );

    const role = screen.getByRole("combobox", { name: "very_long_channel_spend_header role" });
    const chip = role.closest(".mmm-mapper-chip");
    expect(chip).toBeTruthy();
    expect(chip.classList.contains("mmm-mapper-chip--mapped")).toBe(true);
    expect(chip.querySelector(".mmm-mapper-chip__controls")).toBeTruthy();
    expect(chip.querySelector(".mmm-mapper-chip__role")).toBeTruthy();
    expect(Array.from(role.options).find((option) => option.value === "channel")?.text).toBe("Channel spend");

    const clear = screen.getByRole("button", { name: "Clear very_long_channel_spend_header mapping" });
    expect(clear.classList.contains("mmm-mapper-chip__clear")).toBe(true);
    expect(clear.style.minWidth).toBe("44px");
    expect(clear.style.minHeight).toBe("44px");
  });

  it("guides mapped continuous controls without presenting them as causal media", () => {
    const { container } = render(
      <MmmColumnMapper
        headers={["week", "revenue", "paid_spend", "market_index"]}
        rows={[{ week: "2025-W01", revenue: "100", paid_spend: "10", market_index: "95" }]}
        colMap={{
          week: { role: "week" },
          revenue: { role: "revenue" },
          paid_spend: { role: "channel" },
          market_index: { role: "external" },
        }}
        onChange={() => {}}
        locale="en"
      />,
    );

    expect(container.querySelector("[data-mmm-control-contract]")).toBeTruthy();
    expect(screen.getByText("Continuous-control input contract")).toBeTruthy();
    expect(container.textContent).toContain("not causal proof");
    expect(container.textContent).toContain("never treated as channel contribution, ROAS, or budget candidates");
  });
});
