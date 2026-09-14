// @vitest-environment jsdom
import React, { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
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
  afterEach(() => vi.unstubAllGlobals());
  it("settles multi-select synchronization without scheduling itself again", () => {
    const Recorder = MutationObserver;
    let sync;
    vi.stubGlobal("MutationObserver", class {
      constructor(callback) { sync = callback; }
      observe() {}
      disconnect() {}
    });
    const { container } = render(<>
      <LegacyPillGroupA11y />
      <div className="ab-pillgroup" data-pillgroup="multi" role="group" aria-label="Methods">
        <button className="ab-pill active">Curve</button>
        <button className="ab-pill active">Observed</button>
      </div>
    </>);
    const recorder = new Recorder(() => {});
    recorder.observe(container, { subtree: true, attributes: true, attributeFilter: ["class", "disabled", "aria-pressed"] });
    try {
      sync();
      expect(recorder.takeRecords()).toHaveLength(0);
      const curve = screen.getByRole("button", { name: "Curve" });
      curve.classList.remove("active");
      recorder.takeRecords();
      sync();
      expect(curve.getAttribute("aria-pressed")).toBe("false");
      expect(recorder.takeRecords()).toHaveLength(1);
      sync();
      expect(recorder.takeRecords()).toHaveLength(0);
    } finally { recorder.disconnect(); }
  });
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

  // 다중선택 그룹에 radiogroup을 씌우면 "여럿 켜져 있는데 하나만 선택됨"으로 읽힌다.
  // ARIA가 틀리게 붙는 것은 안 붙는 것보다 나쁘다(D-05).
  it("marks a multi-select group as toggles, not radios", () => {
    document.body.innerHTML = `
      <div class="ab-pillgroup" data-pillgroup="multi" role="group" aria-label="표시 방법">
        <span class="ab-pillgroup-label">표시 방법</span>
        <button class="ab-pill active">곡선</button>
        <button class="ab-pill active">실측</button>
      </div>`;
    render(<LegacyPillGroupA11y />);
    const group = document.querySelector(".ab-pillgroup");
    expect(group.getAttribute("role"), "다중선택인데 radiogroup으로 바뀌었다").toBe("group");
    const buttons = [...group.querySelectorAll("button")];
    expect(buttons.map((b) => b.getAttribute("role"))).toEqual([null, null]);
    // 둘 다 켜져 있다는 사실이 그대로 전달돼야 한다.
    expect(buttons.map((b) => b.getAttribute("aria-pressed"))).toEqual(["true", "true"]);
  });
});
