// @vitest-environment jsdom
import { useState } from "react";
import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import InlineCardEditor from "./InlineCardEditor";

function Harness({ locale }) {
  const [config, setConfig] = useState({ order: [], hidden: [] });
  return <><InlineCardEditor locale={locale} editMode config={config}
    items={[{ key: "a", label: "Alpha", node: <p>Alpha</p> }, { key: "b", label: "Beta", node: <p>Beta</p> }]}
    onPatch={patch => setConfig(previous => ({ ...previous, ...patch }))} />
    <div data-testid="order">{config.order.join(",")}</div></>;
}
describe("card keyboard reordering", () => {
  it.each(["ko", "en"])("moves with arrows, retains focus, and announces position (%s)", locale => {
    render(<Harness locale={locale} />);
    const handle = screen.getByRole("button", { name: /Alpha:/ });
    handle.focus();
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(screen.getByTestId("order").textContent).toBe("b,a");
    expect(document.activeElement).toBe(handle);
    expect(screen.getByRole("status").textContent).toMatch(/2/);
    fireEvent.keyDown(handle, { key: "ArrowRight" });
    expect(screen.getByTestId("order").textContent).toBe("b,a");
    fireEvent.keyDown(handle, { key: "ArrowLeft" });
    expect(screen.getByTestId("order").textContent).toBe("a,b");
  });
});
