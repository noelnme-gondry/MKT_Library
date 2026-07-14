"use client";
import React, { useEffect, useState } from "react";
import { MOCKS } from "./ToolCardMock";

// 라이브 제품 미리보기(랜딩 히어로 시연 슬롯). 여러 도구의 미니 화면을 2.8초마다
// 순서대로 전환(제목도 함께 바뀜) — "이 사이트로 이런 것들을 본다"를 한 프레임에서
// 보여줌. SVG 목업(결정론, Math.random 금지 §3)·전역 store 비침습. 나중에 실제
// mp4가 생기면 videoSrc prop으로 즉시 교체(같은 프레임).
const SCENES_KO = [
  { title: "운영 대시보드", type: "kpiLine", kpi: true },
  { title: "MMM 기여 분석", type: "stacked" },
  { title: "캠페인 포화도", type: "curve" },
  { title: "증분 분석", type: "diverge" },
  { title: "예산 배분", type: "alloc" },
  { title: "소재 분석", type: "scatter" },
];
const SCENES_EN = [
  { title: "Operations dashboard", type: "kpiLine", kpi: true },
  { title: "MMM contribution", type: "stacked" },
  { title: "Campaign saturation", type: "curve" },
  { title: "Incrementality", type: "diverge" },
  { title: "Budget allocation", type: "alloc" },
  { title: "Creative analysis", type: "scatter" },
];
const KPIS = [
  { label: "전환", labelEn: "Conv.", value: "3,412", delta: "+12.4%" },
  { label: "CPA", labelEn: "CPA", value: "₩8,240", delta: "−6.1%" },
  { label: "ROAS", labelEn: "ROAS", value: "214%", delta: "+8.0%" },
];

export default function ProductPreview({ videoSrc = null, poster = null, locale = "ko" }) {
  const tr = (ko, en) => (locale === "en" ? en : ko);
  const scenes = locale === "en" ? SCENES_EN : SCENES_KO;
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    if (videoSrc) return;
    const t = setInterval(() => {
      // 페이드 아웃 → 씬 교체 → 페이드 인
      setShown(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % scenes.length);
        setShown(true);
      }, 260);
    }, 2800);
    return () => clearInterval(t);
  }, [videoSrc, scenes.length]);

  const scene = scenes[idx];
  const Mock = MOCKS[scene.type] || MOCKS.kpiLine;

  return (
    <div style={{ maxWidth: "920px", margin: "0 auto" }}>
      <div
        style={{
          borderRadius: "14px",
          border: "1px solid var(--border)",
          overflow: "hidden",
          boxShadow: "0 24px 60px rgba(0,0,0,0.28)",
          background: "var(--bg-1)",
        }}
      >
        {/* 타이틀바 — 도구 이름이 씬 따라 바뀜 */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 12px", borderBottom: "1px solid var(--border-subtle, var(--border))", background: "var(--surface-container-lowest, rgba(255,255,255,0.02))" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f56" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#27c93f" }} />
          <span style={{ marginLeft: "10px", fontSize: "11px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
            growthoptplaybook.com · <span style={{ color: "var(--text-secondary)", transition: "opacity 0.25s", opacity: shown ? 1 : 0 }}>{scene.title}</span>
          </span>
        </div>

        {videoSrc ? (
          <video src={videoSrc} poster={poster || undefined} autoPlay muted loop playsInline style={{ width: "100%", display: "block" }} />
        ) : (
          <div style={{ padding: "16px", pointerEvents: "none", minHeight: "300px" }}>
            <div style={{ transition: "opacity 0.25s", opacity: shown ? 1 : 0 }}>
              {scene.kpi && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "10px", marginBottom: "12px" }}>
                  {KPIS.map((k, i) => (
                    <div key={i} style={{ background: "var(--surface-container-lowest, rgba(255,255,255,0.03))", border: "1px solid var(--border-subtle, var(--border))", borderRadius: "10px", padding: "10px 12px" }}>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{tr(k.label, k.labelEn)}</div>
                      <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>{k.value}</div>
                      <div style={{ fontSize: "11px", color: "#4ade80", fontWeight: 600 }}>{k.delta}</div>
                    </div>
                  ))}
                </div>
              )}
              <div style={{ background: "var(--surface-container-lowest, rgba(255,255,255,0.03))", border: "1px solid var(--border-subtle, var(--border))", borderRadius: "10px", padding: "14px", height: scene.kpi ? "196px" : "268px" }}>
                <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-secondary)", marginBottom: "8px" }}>{scene.title}</div>
                <div style={{ height: scene.kpi ? "150px" : "220px" }}><Mock /></div>
              </div>
            </div>
          </div>
        )}
      </div>
      {/* 씬 인디케이터 (점) */}
      {!videoSrc && (
        <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginTop: "12px" }}>
          {scenes.map((s, i) => (
            <span key={i} style={{ width: i === idx ? 18 : 6, height: 6, borderRadius: "3px", background: i === idx ? "var(--primary, #adc6ff)" : "var(--border-stronger, var(--border))", transition: "width 0.25s, background 0.25s" }} />
          ))}
        </div>
      )}
    </div>
  );
}
