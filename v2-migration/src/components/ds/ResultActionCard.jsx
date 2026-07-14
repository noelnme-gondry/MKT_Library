"use client";
import React from "react";

// 표준 결론·액션 카드 — "결론 먼저, 근거는 접어서"(claude-ux §0)의 1층.
// 5-3 예산배분의 alloc-verdict-card 패턴을 디자인시스템 공용으로 승격한 것.
// 전 분석 도구가 결과 최상단에 이 카드를 두어 ① 한 줄 결론 ② 핵심 수치
// ③ 다음 액션 ④ 결과 받기(다운로드)를 한 곳에서 제공한다.
//
// props:
//   tone     : "good" | "bad" | "neutral"  (좌측 보더·아이콘 색)
//   title    : 카드 제목(기본 "결론")
//   headline : 한 줄 평어 결론(string | node)  — 통계용어 없이
//   points   : [{ text, cls? }]  다음 액션/설명 불릿 (cls: "bad"|"good"|"muted")
//   stats    : [{ label, value }]  핵심 수치 스트립
//   download : node (DownloadHub 등)  — 우상단 배치
//   children : 카드 하단 추가 콘텐츠(선택)
const TONE = {
  good: { border: "#5ad19a", icon: "✅" },
  bad: { border: "#f0917e", icon: "⚠️" },
  neutral: { border: "var(--primary, #adc6ff)", icon: "📌" },
};

const LINE_COLOR = {
  bad: "#f0917e",
  good: "#5ad19a",
  muted: "var(--text-muted)",
};

export default function ResultActionCard({
  tone = "neutral",
  title = "결론",
  headline,
  points = [],
  stats = [],
  download = null,
  controls = null,
  children,
  style,
}) {
  const t = TONE[tone] || TONE.neutral;
  return (
    <div
      className={`result-action-card ${tone}`}
      style={{
        background: "var(--bg-1)",
        border: "1px solid var(--border)",
        borderLeft: `3px solid ${t.border}`,
        borderRadius: "var(--radius, 12px)",
        padding: "16px 18px",
        marginBottom: "1rem",
        ...style,
      }}
    >
      <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: "14px", marginBottom: "6px" }}>
            {t.icon} {title}
          </div>
          {headline && (
            <div style={{ fontSize: "14px", lineHeight: 1.6, color: "var(--text-primary)", fontWeight: 600 }}>
              {headline}
            </div>
          )}
        </div>
        {(controls || download) && (
          <div style={{ flexShrink: 0, display: "flex", alignItems: "center", gap: "8px" }}>
            {controls}
            {download}
          </div>
        )}
      </div>

      {points.length > 0 && (
        <ul style={{ margin: "10px 0 0", paddingLeft: "18px", fontSize: "13px", lineHeight: 1.6 }}>
          {points.map((p, i) => (
            <li key={i} style={{ color: LINE_COLOR[p.cls] || "var(--text-secondary)" }}>
              {p.text}
            </li>
          ))}
        </ul>
      )}

      {stats.length > 0 && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "18px",
            marginTop: "12px",
            paddingTop: "10px",
            borderTop: "1px dashed var(--border-subtle, var(--border))",
            fontSize: "12px",
            color: "var(--text-muted)",
          }}
        >
          {stats.map((s, i) => (
            <div key={i}>
              {s.label}{" "}
              <strong style={{ color: "var(--text-primary)" }}>{s.value}</strong>
            </div>
          ))}
        </div>
      )}

      {children}
    </div>
  );
}
