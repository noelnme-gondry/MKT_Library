"use client";
import { useEffect, useRef, useState } from "react";
import { Popover } from "radix-ui";

export default function InfoPopover({ label, children, className = "", glyph = "ⓘ" }) {
  const [open, setOpen] = useState(false);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  const enter = () => { clearTimeout(timer.current); setOpen(true); };
  const leave = () => { clearTimeout(timer.current); timer.current = setTimeout(() => setOpen(false), 180); };
  return <Popover.Root open={open} onOpenChange={setOpen}>
    <Popover.Trigger className={`info-popover-trigger ${className}`} aria-label={label} onPointerEnter={event => { if (event.pointerType === "mouse") enter(); }} onPointerLeave={leave}><span aria-hidden="true">{glyph}</span></Popover.Trigger>
    <Popover.Portal><Popover.Content className="info-popover-content" sideOffset={8} collisionPadding={16} aria-label={label} onOpenAutoFocus={event => event.preventDefault()} onPointerEnter={enter} onPointerLeave={leave}>
      <strong>{label}</strong><div>{children}</div><Popover.Close className="info-popover-close" aria-label="Close / 닫기">×</Popover.Close>
    </Popover.Content></Popover.Portal>
  </Popover.Root>;
}
