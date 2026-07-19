"use client";
import React from "react";
import { MOCKS } from "./ToolCardMock";

// 홈의 샘플은 전시용 UI가 아니라 실제 주간 운영 리포트처럼 읽혀야 한다.
// 한 장의 고정된 시나리오로 "무슨 일이 있었고, 오늘 뭘 할지"를 보여 준다.
const SCENES = [
  {
    title: { ko: "W29 운영 리포트", en: "W29 operating review" },
    type: "kpiLine",
    kpis: [
      { l: { ko: "전환", en: "Conv." }, v: "3,412", d: "+12.4%", up: true },
      { l: { ko: "CPA", en: "CPA" }, v: "₩8,240", d: "−6.1%", up: true },
      { l: { ko: "ROAS", en: "ROAS" }, v: "214%", d: "+8.0%", up: true },
    ],
    chartLabel: { ko: "최근 7일 전환 추이", en: "Conversion trend · last 7 days" },
    side: [
      { l: { ko: "가장 큰 변화", en: "Largest change" }, v: "Meta · CPA −₩540", c: "#4ade80" },
      { l: { ko: "오늘 확인", en: "Check today" }, v: { ko: "소재 교체 2건", en: "2 creative swaps" }, c: "#fbbf24" },
      { l: { ko: "다음 조치", en: "Next action" }, v: { ko: "Google +₩300k 검토", en: "Review Google +₩300k" }, c: "#adc6ff" },
    ],
  },
];

export default function ProductPreview({ videoSrc = null, poster = null, locale = "ko" }) {
  const tr = (o) => (typeof o === "string" ? o : locale === "en" ? o.en : o.ko);
  const scene = SCENES[0];
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
      <div style={{ borderRadius: "8px", border: "1px solid var(--border)", overflow: "hidden", boxShadow: "0 24px 60px rgba(0,0,0,0.22)", background: "var(--bg-1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", padding: "10px 14px", borderBottom: "1px solid var(--border-subtle, var(--border))", background: "var(--surface-container-lowest, rgba(255,255,255,0.02))" }}>
          <span style={{ fontSize: "11px", fontWeight: 800, letterSpacing: "0.08em", color: "var(--text-secondary)", fontFamily: "JetBrains Mono, monospace" }}>{tr(scene.title)}</span>
          <span style={{ fontSize: "10px", color: "var(--text-muted)", fontFamily: "JetBrains Mono, monospace" }}>{locale === "en" ? "REFRESHED 09:00 KST" : "09:00 KST 기준"}</span>
        </div>

        {videoSrc ? (
          <video src={videoSrc} poster={poster || undefined} autoPlay muted loop playsInline style={{ width: "100%", display: "block" }} />
        ) : (
          <div style={{ padding: "16px", pointerEvents: "none", minHeight: "312px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
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
                        <span style={{ fontSize: "12.5px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "JetBrains Mono, monospace" }}>{tr(s.v)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
