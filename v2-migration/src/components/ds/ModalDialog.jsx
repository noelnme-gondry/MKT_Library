"use client";
import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[contenteditable='true']",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

function getFocusableElements(panel) {
  if (!panel) return [];
  return Array.from(panel.querySelectorAll(FOCUSABLE_SELECTOR)).filter((element) => (
    element.tabIndex >= 0
      && !element.closest("[hidden]")
      && element.getAttribute("aria-hidden") !== "true"
  ));
}

// Shared modal behavior only. Callers keep ownership of visual styling by
// passing their existing overlay/panel classes or inline styles.
export default function ModalDialog({
  open,
  onClose,
  ariaLabel = "Dialog",
  ariaLabelledBy,
  ariaDescribedBy,
  initialFocusRef,
  overlayClassName = "",
  panelClassName = "",
  overlayStyle,
  panelStyle,
  closeOnBackdrop = true,
  closeOnEscape = true,
  children,
}) {
  const [mounted, setMounted] = useState(false);
  const panelRef = useRef(null);
  const previousFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Portals must not touch document during server rendering.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!mounted || !open || typeof document === "undefined") return undefined;

    const panel = panelRef.current;
    previousFocusRef.current = typeof document.activeElement?.focus === "function"
      ? document.activeElement
      : null;

    const preferred = initialFocusRef?.current;
    const firstTarget = preferred && panel?.contains(preferred)
      ? preferred
      : getFocusableElements(panel)[0] || panel;
    firstTarget?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && closeOnEscape) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (event.key !== "Tab") return;

      const focusable = getFocusableElements(panelRef.current);
      if (focusable.length === 0) {
        event.preventDefault();
        panelRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement;
      if (!panelRef.current?.contains(active)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && (active === first || active === panelRef.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      const previous = previousFocusRef.current;
      if (previous?.isConnected && typeof previous.focus === "function") previous.focus();
      previousFocusRef.current = null;
    };
  }, [closeOnEscape, initialFocusRef, mounted, open]);

  if (!mounted || !open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={overlayClassName || undefined}
      style={overlayStyle}
      onClick={(event) => {
        if (closeOnBackdrop && event.target === event.currentTarget) onCloseRef.current?.();
      }}
    >
      <div
        ref={panelRef}
        className={panelClassName || undefined}
        style={panelStyle}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabelledBy ? undefined : ariaLabel}
        aria-labelledby={ariaLabelledBy || undefined}
        aria-describedby={ariaDescribedBy || undefined}
        tabIndex={-1}
      >
        {children}
      </div>
    </div>,
    document.body
  );
}
