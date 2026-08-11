// @vitest-environment jsdom
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import React, { useState } from "react";

import UiSemantics from "@/components/ds/UiSemantics";

function Fixture() {
  const [active, setActive] = useState(false);
  return <main id="main-content">
    <section><h2>실제와 모델 비교</h2><canvas /></section>
    <section><h2>채널 성과</h2><table><thead><tr><th>채널</th></tr></thead><tbody><tr><th>검색</th></tr></tbody></table></section>
    <button type="button" className={`ab-pill ${active ? "active" : ""}`} onClick={() => setActive((value) => !value)}>기준선 포함</button>
    <UiSemantics />
  </main>;
}

describe("UiSemantics", () => {
  it("names legacy charts and tables and keeps toggle state in sync", async () => {
    render(<Fixture />);
    expect(await screen.findByRole("img", { name: "실제와 모델 비교 차트" })).toBeTruthy();
    expect(screen.getByRole("table", { name: "채널 성과 데이터 표" })).toBeTruthy();
    expect(screen.getByRole("columnheader", { name: "채널" }).getAttribute("scope")).toBe("col");
    expect(screen.getByRole("rowheader", { name: "검색" }).getAttribute("scope")).toBe("row");
    const toggle = screen.getByRole("button", { name: "기준선 포함" });
    expect(toggle.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(toggle);
    await waitFor(() => expect(toggle.getAttribute("aria-pressed")).toBe("true"));
  });
});
