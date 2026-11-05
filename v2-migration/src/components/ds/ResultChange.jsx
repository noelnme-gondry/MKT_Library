"use client";
import { useEffect, useRef } from "react";

/** Animate only a changed, visible result. Never count through invented intermediate values. */
export default function ResultChange({ value, children, className = "", as: Tag = "span", ...attributes }) {
  const ref = useRef(null), previous = useRef(value);
  useEffect(() => {
    const changed = previous.current !== value;
    previous.current = value;
    const node = ref.current;
    if (!changed || !node?.animate || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const box = node.getBoundingClientRect();
    if (box.bottom < 0 || box.top > window.innerHeight) return;
    const motion = node.animate([{ opacity: .55, transform: "translateY(4px)" }, { opacity: 1, transform: "translateY(0)" }], { duration: 210, easing: "ease-out" });
    return () => motion.cancel();
  }, [value]);
  return <Tag {...attributes} ref={ref} className={`result-change ${className}`}>{children}</Tag>;
}
