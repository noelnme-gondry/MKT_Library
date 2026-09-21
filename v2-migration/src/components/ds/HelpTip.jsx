"use client";

import InfoPopover from "./InfoPopover";

export default function HelpTip({ label, children, className = "", compact = false }) {
  const classes = ["help-tip", className, compact ? "data-confidence-hint" : ""].filter(Boolean).join(" ");
  return <InfoPopover label={label} className={classes}>{children}</InfoPopover>;
}
