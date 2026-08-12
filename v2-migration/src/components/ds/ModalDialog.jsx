"use client";
import React, { useRef } from "react";
import { Dialog } from "radix-ui";

// Shared dialog behavior comes from Radix: body portal, focus containment,
// focus restoration, Escape handling, and scroll locking. Callers continue to
// own the existing visual classes and styles.
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
  const previousFocusRef = useRef(null);
  const handleOpenChange = (nextOpen) => {
    if (!nextOpen) onClose?.();
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={overlayClassName || undefined}
          style={overlayStyle}
          onPointerDown={(event) => {
            if (closeOnBackdrop && event.target === event.currentTarget) onClose?.();
          }}
        >
          <Dialog.Content
            className={panelClassName || undefined}
            style={panelStyle}
            aria-label={ariaLabelledBy ? undefined : ariaLabel}
            aria-labelledby={ariaLabelledBy || undefined}
            aria-describedby={ariaDescribedBy || undefined}
            onOpenAutoFocus={(event) => {
              previousFocusRef.current = document.activeElement;
              const initialFocus = initialFocusRef?.current;
              if (!initialFocus) return;
              event.preventDefault();
              initialFocus.focus();
            }}
            onCloseAutoFocus={(event) => {
              const previousFocus = previousFocusRef.current;
              if (!previousFocus?.isConnected || typeof previousFocus.focus !== "function") return;
              event.preventDefault();
              previousFocus.focus();
              previousFocusRef.current = null;
            }}
            onEscapeKeyDown={(event) => {
              if (!closeOnEscape) event.preventDefault();
            }}
            onPointerDownOutside={(event) => {
              if (!closeOnBackdrop) event.preventDefault();
            }}
          >
            <Dialog.Title className="sr-only">{ariaLabel}</Dialog.Title>
            {children}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
