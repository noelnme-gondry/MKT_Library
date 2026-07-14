"use client";
import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

// 옵션 4 샘플 — 실제 Chart.js로 그린 미니 차트(결정론 고정 데이터). ToolCardMock의
// SVG 목업과 비교용으로 카드 1개에만 사용. 자체완결(전역 store 비침습).
const DATA = [62, 48, 75, 58, 90, 72, 104];
const LABELS = ["월", "화", "수", "목", "금", "토", "일"];

export default function LiveMiniChart({ title }) {
  const ref = useRef(null);
  const inst = useRef(null);
  useEffect(() => {
    if (!ref.current) return;
    if (inst.current) inst.current.destroy();
    inst.current = new Chart(ref.current.getContext("2d"), {
      type: "bar",
      data: {
        labels: LABELS,
        datasets: [{
          data: DATA,
          backgroundColor: DATA.map((_, i) => (i === DATA.length - 1 ? "#4ade80" : "#adc6ff")),
          borderRadius: 3,
        }],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 600 },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { grid: { display: false }, ticks: { color: "#9CA3AF", font: { size: 9 } } },
          y: { display: false, beginAtZero: true },
        },
      },
    });
    requestAnimationFrame(() => inst.current && inst.current.resize());
    return () => { if (inst.current) { inst.current.destroy(); inst.current = null; } };
  }, []);
  return (
    <div
      style={{
        background: "var(--surface-base, #fff)",
        border: "1px solid var(--border)",
        borderRadius: "12px",
        boxShadow: "0 8px 24px rgba(0,0,0,0.12)",
        padding: "12px 14px",
        height: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
      }}
    >
      {title && <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>}
      <div style={{ flex: 1, minHeight: 0, position: "relative" }}>
        <canvas ref={ref}></canvas>
      </div>
    </div>
  );
}
