// @vitest-environment jsdom
import React, { useState } from "react";
import { describe, expect, it } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ModalDialog from "@/components/ds/ModalDialog";

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Open dialog</button>
      <ModalDialog open={open} onClose={() => setOpen(false)} ariaLabel="Keyboard contract">
        <button type="button">First action</button>
        <button type="button">Last action</button>
      </ModalDialog>
    </>
  );
}

describe("ModalDialog", () => {
  it("portals, names, focuses, locks scroll, closes with Escape, and returns focus", async () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    trigger.focus();
    fireEvent.click(trigger);

    const dialog = screen.getByRole("dialog", { name: "Keyboard contract" });
    const first = screen.getByRole("button", { name: "First action" });
    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(document.activeElement).toBe(first);
    expect(document.body.dataset.scrollLocked).toBe("1");

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog", { name: "Keyboard contract" })).toBeNull();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("closes only when the backdrop itself is clicked", () => {
    render(<DialogHarness />);
    const trigger = screen.getByRole("button", { name: "Open dialog" });
    fireEvent.click(trigger);
    const dialog = screen.getByRole("dialog", { name: "Keyboard contract" });

    fireEvent.click(dialog);
    expect(screen.getByRole("dialog", { name: "Keyboard contract" })).toBeTruthy();

    fireEvent.pointerDown(dialog.parentElement, { button: 0 });
    expect(screen.queryByRole("dialog", { name: "Keyboard contract" })).toBeNull();
  });
});
