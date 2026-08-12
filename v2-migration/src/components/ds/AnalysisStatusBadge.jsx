"use client";
import React from "react";
import { analysisStatusLabel } from "@/lib/analysis-router/analysisStatus";

// 전부 semantic 토큰으로 통일한다. ANALYZING·COMPLETE·STALE만 raw hex를 써서
// 라이트 모드에서 다크용 색이 그대로 나왔다 — 한 파일 안에서 규칙이 갈렸고,
// ds/는 다른 도구가 베끼는 기준이라 전파 위험이 있었다(감사 P1-13).
const tone = (token, mix) => ({ color: `var(${token})`, background: `color-mix(in srgb, var(${token}) ${mix}%, transparent)` });

const TONE = {
  EMPTY: tone("--text-muted", 12),
  READY: tone("--primary", 14),
  ANALYZING: tone("--warning", 16),
  COMPLETE: tone("--success", 16),
  STALE: tone("--warning", 16),
  BLOCKED: tone("--danger", 14),
  FAILED: tone("--danger", 14),
  CANCELED: tone("--text-muted", 12),
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
