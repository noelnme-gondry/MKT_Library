"use client";
import React, { useEffect, useRef } from "react";
import Chart from "chart.js/auto";

// 라이브 제품 미리보기(랜딩 히어로 "시연" 슬롯, 옵션 2). 브라우저 창 프레임 안에
// 실제 Chart.js 차트를 결정론 데모 데이터로 렌더 → 정지 이미지 아닌 "움직이는 제품".
// 전역 store 비침습(자체 데이터). 나중에 실제 mp4가 생기면 videoSrc prop으로 즉시
// 교체(같은 프레임). pointer-events:none으로 미리보기 오작동 방지.
const TREND = [42, 55, 49, 63, 58, 72, 68, 85, 79, 94, 88, 103];
const CH_LABELS = ["Google", "Meta", "TikTok", "Apple"];
const CH_COST = [92, 74, 51, 33];
const KPIS = [
  { label: "전환", value: "3,412", delta: "+12.4%", up: true },
  { label: "CPA", value: "₩8,240", delta: "−6.1%", up: true },
  { label: "ROAS", value: "214%", delta: "+8.0%", up: true },
];

export default function ProductPreview({ videoSrc = null, poster = null, caption, locale = "ko" }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const lineRef = useRef(null);
  const barRef = useRef(null);
  const lineInst = useRef(null);
  const barInst = useRef(null);

  useEffect(() => {
    if (videoSrc) return; // 비디오 모드면 차트 안 그림
    if (lineRef.current) {
      if (lineInst.current) lineInst.current.destroy();
      lineInst.current = new Chart(lineRef.current.getContext("2d"), {
        type: "line",
        data: {
          labels: TREND.map((_, i) => `${i + 1}`),
          datasets: [{
            data: TREND,
            borderColor: "#adc6ff",
            backgroundColor: "rgba(173,198,255,0.12)",
            fill: true,
            tension: 0.35,
            pointRadius: 0,
            borderWidth: 2.5,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 900 },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: { x: { display: false }, y: { display: false, beginAtZero: true } },
        },
      });
      requestAnimationFrame(() => lineInst.current && lineInst.current.resize());
    }
    if (barRef.current) {
      if (barInst.current) barInst.current.destroy();
      barInst.current = new Chart(barRef.current.getContext("2d"), {
        type: "bar",
        data: {
          labels: CH_LABELS,
          datasets: [{
            data: CH_COST,
            backgroundColor: ["#adc6ff", "#4cd7f6", "#4ade80", "#fbbf24"],
            borderRadius: 4,
          }],
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: { duration: 900 },
          plugins: { legend: { display: false }, tooltip: { enabled: false } },
          scales: {
            x: { grid: { display: false }, ticks: { color: "#9CA3AF", font: { size: 10 } } },
            y: { display: false, beginAtZero: true },
          },
        },
      });
      requestAnimationFrame(() => barInst.current && barInst.current.resize());
    }
    return () => {
      if (lineInst.current) { lineInst.current.destroy(); lineInst.current = null; }
      if (barInst.current) { barInst.current.destroy(); barInst.current = null; }
    };
  }, [videoSrc]);

  return (
    <div style={{ maxWidth: "920px", margin: "0 auto" }}>
      {/* 브라우저 창 프레임 */}
      <div
        style={{
          borderRadius: "14px",
          border: "1px solid var(--border)",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
          background: "var(--bg-1)",
        }}
      >
        {/* 타이틀바 */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 12px", borderBottom: "1px solid var(--border-subtle, var(--border))", background: "var(--surface-container-lowest, rgba(255,255,255,0.02))" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f56" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#27c93f" }} />
          <span style={{ marginLeft: "10px", fontSize: "11px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
            growthoptplaybook.com · {tr("운영 대시보드", "Operations Dashboard")}
          </span>
        </div>

        {/* 본문 — 비디오 있으면 비디오, 없으면 라이브 차트 목업 */}
        {videoSrc ? (
          <video src={videoSrc} poster={poster || undefined} autoPlay muted loop playsInline style={{ width: "100%", display: "block" }} />
        ) : (
          <div style={{ padding: "16px", pointerEvents: "none" }}>
            {/* KPI 타일 */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "12px" }}>
              {KPIS.map((k, i) => (
                <div key={i} style={{ background: "var(--surface-container-lowest, rgba(255,255,255,0.03))", border: "1px solid var(--border-subtle, var(--border))", borderRadius: "10px", padding: "10px 12px" }}>
                  <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{k.label}</div>
                  <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>{k.value}</div>
                  <div style={{ fontSize: "11px", color: k.up ? "#4ade80" : "#f0917e", fontWeight: 600 }}>{k.delta}</div>
                </div>
              ))}
            </div>
            {/* 차트 2개 */}
            <div style={{ display: "grid", gridTemplateColumns: "1.6fr 1fr", gap: "12px" }}>
              <div style={{ background: "var(--surface-container-lowest, rgba(255,255,255,0.03))", border: "1px solid var(--border-subtle, var(--border))", borderRadius: "10px", padding: "12px", height: "180px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "6px" }}>{tr("전환 추이", "Conversion trend")}</div>
                <div style={{ height: "140px", position: "relative" }}><canvas ref={lineRef}></canvas></div>
              </div>
              <div style={{ background: "var(--surface-container-lowest, rgba(255,255,255,0.03))", border: "1px solid var(--border-subtle, var(--border))", borderRadius: "10px", padding: "12px", height: "180px" }}>
                <div style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "6px" }}>{tr("채널별 지출", "Spend by channel")}</div>
                <div style={{ height: "140px", position: "relative" }}><canvas ref={barRef}></canvas></div>
              </div>
            </div>
          </div>
        )}
      </div>
      {caption && (
        <p style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)", marginTop: "10px" }}>{caption}</p>
      )}
    </div>
  );
}
