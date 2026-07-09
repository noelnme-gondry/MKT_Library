"use client";
import React from "react";

// 큰 데이터 분석/파싱 중 표시하는 로딩 오버레이. 무거운 계산은 메인 스레드를 잡으므로
// 계산 시작 전 이 오버레이를 먼저 그려(§rAF 디퍼) "멈춤"이 아니라 "분석 중"으로 보이게 함.
export default function AnalyzingOverlay({ show, title = "분석 중…", sub }) {
  if (!show) return null;
  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "14px",
        background: "color-mix(in srgb, var(--bg-1, #0b0d12) 72%, transparent)",
        backdropFilter: "blur(2px)",
      }}
    >
      <div
        style={{
          width: "38px",
          height: "38px",
          border: "3px solid var(--border)",
          borderTopColor: "var(--primary, #adc6ff)",
          borderRadius: "50%",
          animation: "aha-spin 0.8s linear infinite",
        }}
      />
      <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-1)" }}>{title}</div>
      {sub ? <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>{sub}</div> : null}
      <style>{"@keyframes aha-spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}
