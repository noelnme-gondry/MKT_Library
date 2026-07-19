"use client";
import React, { useEffect, useState } from "react";
import { MOCKS } from "./ToolCardMock";

// 라이브 제품 미리보기(랜딩 히어로 시연 슬롯). 여러 도구의 "미니 앱 화면"을 2.8초마다
// 순서대로 전환 — 그래픽 하나만 딸랑이 아니라 KPI 스트립 + 차트 + 사이드 요약까지
// 실제 도구 화면처럼 구성. SVG 목업(결정론 §3)·전역 store 비침습. 나중에 실제 mp4가
// 생기면 videoSrc prop으로 즉시 교체(같은 프레임).
const SCENES = [
  {
    title: { ko: "운영 대시보드", en: "Operations dashboard" },
    type: "kpiLine",
    kpis: [
      { l: { ko: "전환", en: "Conv." }, v: "3,412", d: "+12.4%", up: true },
      { l: { ko: "CPA", en: "CPA" }, v: "₩8,240", d: "−6.1%", up: true },
      { l: { ko: "ROAS", en: "ROAS" }, v: "214%", d: "+8.0%", up: true },
    ],
    chartLabel: { ko: "전환 추이 (최근 7일)", en: "Conversion trend (7d)" },
  },
  {
    title: { ko: "MMM 기여 분석", en: "MMM contribution" },
    type: "stacked",
    chartLabel: { ko: "주차별 채널 기여", en: "Weekly channel contribution" },
    side: [
      { l: "Google UAC", v: "42%", c: "#adc6ff" },
      { l: "Meta", v: "31%", c: "#a78bfa" },
      { l: "TikTok", v: "18%", c: "#4cd7f6" },
      { l: { ko: "기타", en: "Others" }, v: "9%", c: "#94a3b8" },
    ],
  },
  {
    title: { ko: "캠페인 포화도", en: "Campaign saturation" },
    type: "curve",
    chartLabel: { ko: "지출 대비 반응 곡선", en: "Spend-response curve" },
    chip: { t: { ko: "여유 있음 · 증액 가능", en: "Headroom · can scale" }, tone: "good" },
    side: [
      { l: { ko: "현재 일예산", en: "Daily budget" }, v: "₩1.2M" },
      { l: { ko: "한계 CPA", en: "Marginal CPA" }, v: "₩9,100" },
      { l: { ko: "포화 지수", en: "Sat. index" }, v: "0.71" },
    ],
  },
  {
    title: { ko: "증분 분석", en: "Incrementality" },
    type: "diverge",
    chartLabel: { ko: "노출 vs 홀드아웃", en: "Exposed vs holdout" },
    kpis: [
      { l: { ko: "증분 전환", en: "Incremental" }, v: "+486", d: { ko: "순증", en: "net" }, up: true },
      { l: "iROAS", v: "1.8×", d: { ko: "이득", en: "profit" }, up: true },
    ],
  },
  {
    title: { ko: "예산 배분", en: "Budget allocation" },
    type: "alloc",
    chartLabel: { ko: "채널별 최적 배분", en: "Optimal split by channel" },
    side: [
      { l: "Google", v: "38%", c: "#adc6ff" },
      { l: "Meta", v: "27%", c: "#4cd7f6" },
      { l: "TikTok", v: "21%", c: "#4ade80" },
      { l: "ASA", v: "14%", c: "#fbbf24" },
    ],
  },
  {
    title: { ko: "소재 분석", en: "Creative analysis" },
    type: "scatter",
    chartLabel: { ko: "성과 vs 피로도", en: "Performance vs fatigue" },
    chip: { t: { ko: "교체 임박 2건", en: "2 need refresh" }, tone: "warn" },
    side: [
      { l: { ko: "베스트 CTR", en: "Best CTR" }, v: "4.9%" },
      { l: { ko: "평균 CTR", en: "Avg CTR" }, v: "2.6%" },
      { l: { ko: "분석 소재", en: "Creatives" }, v: "48" },
    ],
  },
];

export default function ProductPreview({ videoSrc = null, poster = null, locale = "ko" }) {
  const tr = (o) => (typeof o === "string" ? o : locale === "en" ? o.en : o.ko);
  const [idx, setIdx] = useState(0);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    if (videoSrc) return;
    const t = setInterval(() => {
      setShown(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % SCENES.length);
        setShown(true);
      }, 260);
    }, 2800);
    return () => clearInterval(t);
  }, [videoSrc]);

  const scene = SCENES[idx];
  const Mock = MOCKS[scene.type] || MOCKS.kpiLine;

  const kpiTile = (k, i) => (
    <div key={i} style={{ flex: 1, background: "var(--surface-container-lowest, rgba(255,255,255,0.03))", border: "1px solid var(--border-subtle, var(--border))", borderRadius: "10px", padding: "9px 12px" }}>
      <div style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>{tr(k.l)}</div>
      <div style={{ fontSize: "17px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace", lineHeight: 1.2 }}>{k.v}</div>
      <div style={{ fontSize: "10.5px", color: k.up ? "#4ade80" : "#f0917e", fontWeight: 600 }}>{tr(k.d)}</div>
    </div>
  );

  return (
    <div style={{ maxWidth: "920px", margin: "0 auto" }}>
      <div style={{ borderRadius: "14px", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.28)", background: "var(--bg-1)" }}>
        {/* 타이틀바 */}
        <div style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 12px", borderBottom: "1px solid var(--border-subtle, var(--border))", background: "var(--surface-container-lowest, rgba(255,255,255,0.02))" }}>
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ff5f56" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#ffbd2e" }} />
          <span style={{ width: 10, height: 10, borderRadius: "50%", background: "#27c93f" }} />
          <span style={{ marginLeft: "10px", fontSize: "11px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>
            growthoptplaybook.com · <span style={{ color: "var(--text-secondary)", transition: "opacity 0.25s", opacity: shown ? 1 : 0 }}>{tr(scene.title)}</span>
          </span>
        </div>

        {videoSrc ? (
          <video src={videoSrc} poster={poster || undefined} autoPlay muted loop playsInline style={{ width: "100%", display: "block" }} />
        ) : (
          <div style={{ padding: "16px", pointerEvents: "none", minHeight: "312px" }}>
            <div style={{ transition: "opacity 0.25s", opacity: shown ? 1 : 0, display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* 필터 바 — 실제 도구의 sticky 컨트롤바 축소판(기간·채널·통화 pill) */}
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                {(locale === "en" ? ["Last 28d · daily", "All channels", "KRW ₩"] : ["최근 28일 · 일별", "전체 채널", "₩ 원화"]).map((p, i) => (
                  <span key={i} style={{ fontSize: "10.5px", fontWeight: 600, padding: "3px 10px", borderRadius: "999px", border: "1px solid var(--border-subtle, var(--border))", color: "var(--text-secondary)", background: "var(--surface-container-lowest, rgba(255,255,255,0.03))" }}>
                    {p} {i < 2 ? "▾" : ""}
                  </span>
                ))}
                <span style={{ flex: 1 }} />
                <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{locale === "en" ? "sample data" : "샘플 데이터"}</span>
              </div>
              {/* 상단 KPI 스트립 */}
              {scene.kpis && (
                <div style={{ display: "flex", gap: "10px" }}>{scene.kpis.map(kpiTile)}</div>
              )}
              {/* 본문: 차트 + (선택) 사이드 요약 */}
              <div style={{ display: "grid", gridTemplateColumns: scene.side ? "1.7fr 1fr" : "1fr", gap: "12px" }}>
                <div style={{ background: "var(--surface-container-lowest, rgba(255,255,255,0.03))", border: "1px solid var(--border-subtle, var(--border))", borderRadius: "10px", padding: "12px", height: scene.kpis ? "196px" : "240px", position: "relative" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <span style={{ fontSize: "11.5px", fontWeight: 700, color: "var(--text-secondary)" }}>{tr(scene.chartLabel)}</span>
                    {scene.chip && (
                      <span style={{ fontSize: "10px", fontWeight: 700, padding: "2px 8px", borderRadius: "999px", color: scene.chip.tone === "good" ? "#166534" : "#92400e", background: scene.chip.tone === "good" ? "#bbf7d0" : "#fde68a" }}>{tr(scene.chip.t)}</span>
                    )}
                  </div>
                  <div style={{ height: scene.kpis ? "150px" : "196px" }}><Mock /></div>
                </div>

                {scene.side && (
                  <div style={{ background: "var(--surface-container-lowest, rgba(255,255,255,0.03))", border: "1px solid var(--border-subtle, var(--border))", borderRadius: "10px", padding: "12px", height: scene.kpis ? "196px" : "240px", display: "flex", flexDirection: "column", gap: "10px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-muted)" }}>{locale === "en" ? "Breakdown" : "요약"}</span>
                    {scene.side.map((s, i) => (
                      <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px" }}>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "7px", fontSize: "12px", color: "var(--text-secondary)", minWidth: 0 }}>
                          {s.c && <span style={{ width: 9, height: 9, borderRadius: "3px", background: s.c, flexShrink: 0 }} />}
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{tr(s.l)}</span>
                        </span>
                        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>{s.v}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
      {/* 씬 인디케이터 */}
      {!videoSrc && (
        <div style={{ display: "flex", gap: "6px", justifyContent: "center", marginTop: "12px" }}>
          {SCENES.map((s, i) => (
            <button key={i} type="button" aria-label={tr(s.title)} onClick={() => { setShown(false); setTimeout(() => { setIdx(i); setShown(true); }, 200); }}
              style={{ width: i === idx ? 20 : 7, height: 7, padding: 0, border: "none", borderRadius: "4px", cursor: "pointer", background: i === idx ? "var(--primary, #adc6ff)" : "var(--border-stronger, var(--border))", transition: "width 0.25s, background 0.25s" }} />
          ))}
        </div>
      )}
    </div>
  );
}
