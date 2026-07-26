"use client";
import React from "react";
import { analysisStatusLabel } from "@/lib/analysis-router/analysisStatus";

const TONE = {
  EMPTY: { color: "var(--text-muted)", background: "color-mix(in srgb, var(--text-muted) 12%, transparent)" },
  READY: { color: "var(--primary, #adc6ff)", background: "color-mix(in srgb, var(--primary, #adc6ff) 14%, transparent)" },
  ANALYZING: { color: "#e0af68", background: "color-mix(in srgb, #e0af68 16%, transparent)" },
  COMPLETE: { color: "#5ad19a", background: "color-mix(in srgb, #5ad19a 16%, transparent)" },
  STALE: { color: "#e0af68", background: "color-mix(in srgb, #e0af68 16%, transparent)" },
  BLOCKED: { color: "var(--danger, #f0917e)", background: "color-mix(in srgb, var(--danger, #f0917e) 14%, transparent)" },
  FAILED: { color: "var(--danger, #f0917e)", background: "color-mix(in srgb, var(--danger, #f0917e) 14%, transparent)" },
  CANCELED: { color: "var(--text-muted)", background: "color-mix(in srgb, var(--text-muted) 12%, transparent)" },
};

export default function AnalysisStatusBadge({ status, locale = "ko", compact = false }) {
  if (!status) return null;
  const tone = TONE[status] || TONE.EMPTY;
  return (
    <span
      className="analysis-status-badge"
      data-analysis-status={status}
      aria-label={analysisStatusLabel(status, locale)}
      style={{
        display: "inline-flex",
        alignItems: "center",
        minHeight: "22px",
        padding: compact ? "2px 7px" : "3px 8px",
        borderRadius: "999px",
        color: tone.color,
        background: tone.background,
        fontSize: "11px",
        fontWeight: 600,
        lineHeight: 1.2,
        whiteSpace: "nowrap",
      }}
    >
      {analysisStatusLabel(status, locale)}
    </span>
  );
}
