// @vitest-environment jsdom
import React from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import DownloadHub from "@/components/ds/DownloadHub";

vi.mock("@/lib/analytics", () => ({ trackProductEvent: vi.fn() }));

describe("DownloadHub", () => {
  it("portals the menu, supports keyboard navigation, and runs the selected download", () => {
    const onSelect = vi.fn();
    render(<DownloadHub label="Export" items={[{ label: "CSV", onSelect }]} />);

    const trigger = screen.getByRole("button", { name: "Export" });
    fireEvent.pointerDown(trigger, { button: 0, ctrlKey: false });

    const menuItem = screen.getByRole("menuitem", { name: "CSV" });
    expect(menuItem.parentElement?.parentElement?.parentElement).toBe(document.body);
    const menu = screen.getByRole("menu");
    expect(document.activeElement).toBe(menu);
    fireEvent.keyDown(menu, { key: "ArrowDown" });
    expect(document.activeElement).toBe(menuItem);

    fireEvent.keyDown(menuItem, { key: "Enter" });
    expect(onSelect).toHaveBeenCalledOnce();
    expect(screen.queryByRole("menuitem", { name: "CSV" })).toBeNull();
  });
});
