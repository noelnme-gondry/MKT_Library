// @vitest-environment jsdom
import React, { useState } from "react";
import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import CustomChartBuilder from "@/components/ds/CustomChartBuilder";
import CustomMetricBuilder from "@/components/ds/CustomMetricBuilder";
import MetricConfigPanel from "@/components/ds/MetricConfigPanel";

function ChartHarness() {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)}>Open chart builder</button><CustomChartBuilder open={open} onClose={() => setOpen(false)} dims={[{ key: "channel", label: "Channel" }]} metrics={[{ key: "cost", label: "Cost" }]} existing={[{ id: "spend", name: "Spend by channel", type: "bar", dim: "channel", metric: "cost" }]} locale="en" /></>;
}

function MetricHarness() {
  const [open, setOpen] = useState(false);
  return <><button type="button" onClick={() => setOpen(true)}>Open metric builder</button><CustomMetricBuilder open={open} onClose={() => setOpen(false)} fields={[{ key: "cost", label: "Cost" }]} agg={{ cost: 10 }} existing={[{ id: "profit", name: "Profit", terms: [{ type: "field", value: "cost" }] }]} locale="en" /></>;
}

function expectTouchTarget(element) {
  expect(element.style.minWidth).toBe("44px");
  expect(element.style.minHeight).toBe("44px");
}

describe("design-system modal consumers", () => {
  it.each([
    ["Open chart builder", "Build a custom chart"],
    ["Open metric builder", "Build a custom metric"],
  ])("uses the shared keyboard and focus contract for %s", async (triggerName, dialogName) => {
    const Harness = triggerName.includes("chart") ? ChartHarness : MetricHarness;
    render(<Harness />);
    const trigger = screen.getByRole("button", { name: triggerName });
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: dialogName })).toBeTruthy();
    expectTouchTarget(screen.getByRole("button", { name: `${dialogName}: Close` }));
    if (triggerName.includes("chart")) expectTouchTarget(screen.getByRole("button", { name: "Delete: Spend by channel" }));
    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: dialogName })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("reorders visible metrics without drag and saves the same order", () => {
    const onSave = vi.fn();
    render(<MetricConfigPanel open onClose={() => {}} title="지표 편집" items={[{ key: "cost", label: "비용" }, { key: "roas", label: "ROAS" }]} config={{ hidden: [], order: ["cost", "roas"] }} onSave={onSave} />);
    const moveUp = screen.getByRole("button", { name: "ROAS 위로" });
    expectTouchTarget(screen.getByRole("button", { name: "지표 편집: 닫기" }));
    expectTouchTarget(screen.getAllByTitle("드래그해서 순서 변경")[0]);
    expectTouchTarget(moveUp);
    expectTouchTarget(screen.getByRole("button", { name: "비용 아래로" }));
    fireEvent.click(moveUp);
    fireEvent.click(screen.getByRole("button", { name: "적용" }));
    expect(onSave).toHaveBeenCalledWith({ hidden: [], order: ["roas", "cost"] });
  });

  it("keeps icon-only metric actions large enough for touch and explicitly named", () => {
    render(<MetricHarness />);
    fireEvent.click(screen.getByRole("button", { name: "Open metric builder" }));

    expectTouchTarget(screen.getByRole("button", { name: "Edit: Profit" }));
    expectTouchTarget(screen.getByRole("button", { name: "Delete: Profit" }));
    fireEvent.click(screen.getByRole("button", { name: "＋ Add term" }));
    expectTouchTarget(screen.getByRole("button", { name: "Delete this term 2" }));
  });
});
