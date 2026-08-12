// @vitest-environment jsdom
import React, { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import LegacyPillGroupA11y from "@/components/ds/LegacyPillGroupA11y";

function LegacyPills() {
  const [value, setValue] = useState("week");
  return <>
    <LegacyPillGroupA11y />
    <div className="ab-pillgroup">
      <span className="ab-pillgroup-label">Window</span>
      {[["day", "Day"], ["week", "Week"], ["month", "Month"]].map(([key, label]) => (
        <button key={key} type="button" className={`ab-pill ${value === key ? "active" : ""}`} onClick={() => setValue(key)}>{label}</button>
      ))}
    </div>
  </>;
}

describe("LegacyPillGroupA11y", () => {
  it("upgrades legacy pills to a labelled radiogroup with roving keyboard selection", () => {
    render(<LegacyPills />);
    const group = screen.getByRole("radiogroup", { name: "Window" });
    const week = screen.getByRole("radio", { name: "Week" });
    expect(group).toBeTruthy();
    expect(week.getAttribute("aria-checked")).toBe("true");
    expect(week.tabIndex).toBe(0);

    fireEvent.keyDown(week, { key: "ArrowRight" });
    const month = screen.getByRole("radio", { name: "Month" });
    expect(document.activeElement).toBe(month);
    expect(month.getAttribute("aria-checked")).toBe("true");
  });
});
