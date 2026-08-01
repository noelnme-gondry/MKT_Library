// @vitest-environment jsdom
import React, { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import AhaColumnMapper from "@/components/tools/AhaColumnMapper";

const HEADERS = ["user_id", "retained_d7", "signup_d1", "platform"];
const ROWS = [
  { user_id: "u1", retained_d7: 1, signup_d1: 1, platform: "ios" },
  { user_id: "u2", retained_d7: 0, signup_d1: 0, platform: "android" },
];

function Harness({ locale = "ko" }) {
  const [colMap, setColMap] = useState({
    user_id: { role: "id" },
    retained_d7: { role: "target" },
    signup_d1: { role: "feature", action: "signup", window: 1 },
    platform: { role: "segment" },
  });
  return <AhaColumnMapper headers={HEADERS} rows={ROWS} colMap={colMap} onChange={setColMap} locale={locale} />;
}

describe("AhaColumnMapper keyboard alternative", () => {
  it("changes a mapping with the role selector without dragging", () => {
    render(<Harness />);
    const role = screen.getByRole("combobox", { name: "platform 역할" });
    fireEvent.change(role, { target: { value: "feature" } });
    expect(screen.getByRole("combobox", { name: "platform 역할" }).value).toBe("feature");
    expect(screen.getByRole("textbox", { name: "platform 액션명" })).toBeTruthy();
  });

  it("provides the same explicit role control in English", () => {
    render(<Harness locale="en" />);
    expect(screen.getByRole("combobox", { name: "signup_d1 role" })).toBeTruthy();
    expect(screen.getByText(/use each chip’s role selector/i)).toBeTruthy();
  });

  it("keeps feature and simple chips contained and gives clear buttons a 44px target", () => {
    render(<Harness locale="en" />);

    const featureChip = screen.getByRole("combobox", { name: "signup_d1 role" }).closest(".aha-mapper-chip--feature");
    const simpleChip = screen.getByRole("combobox", { name: "platform role" }).closest(".aha-mapper-chip--simple");
    expect(featureChip).toBeTruthy();
    expect(simpleChip).toBeTruthy();
    for (const chip of [featureChip, simpleChip]) {
      expect(chip.style.flexWrap).toBe("wrap");
      expect(chip.style.width).toBe("fit-content");
      expect(chip.style.maxWidth).toBe("100%");
      expect(chip.style.minWidth).toBe("0px");
    }

    const clear = screen.getByRole("button", { name: "Clear signup_d1 mapping" });
    expect(clear.classList.contains("aha-mapper-chip__clear")).toBe(true);
    expect(clear.style.minWidth).toBe("44px");
    expect(clear.style.minHeight).toBe("44px");
  });
});
