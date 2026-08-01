"use client";
import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";
import { CHART_THEME, chartCommonOpts } from "@/utils/chartUtils";

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
    const common = chartCommonOpts();
    inst.current = new Chart(ref.current.getContext("2d"), {
      type: "bar",
      data: {
        labels: LABELS,
        datasets: [{
          data: DATA,
          backgroundColor: DATA.map((_, i) => (i === DATA.length - 1 ? CHART_THEME.secondary : CHART_THEME.primary)),
          borderRadius: 3,
        }],
      },
      options: {
        ...common,
        layout: { padding: 0 },
        plugins: { legend: { display: false }, tooltip: { enabled: false } },
        scales: {
          x: { ...common.scales.x, ticks: { ...common.scales.x.ticks, font: { ...common.scales.x.ticks.font, size: 9 } } },
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
        boxShadow: "var(--shadow-sm)",
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
