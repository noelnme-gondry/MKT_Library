"use client";
import React, { useId } from "react";

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
  good: { icon: "↗" },
  bad: { icon: "!" },
  neutral: { icon: "→" },
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
  const headingId = useId();
  return (
    <section className={`result-action-card ${tone}`} style={style} aria-labelledby={headline ? headingId : undefined} aria-label={!headline && typeof title === "string" ? title : undefined}>
      <div className="result-action-card__head">
        <span className="result-action-card__signal" aria-hidden>{t.icon}</span>
        <div className="result-action-card__copy">
          <div className="result-action-card__label">
            {title}
          </div>
          {headline && (
            <h2 id={headingId} className="result-action-card__headline">
              {headline}
            </h2>
          )}
        </div>
        {(controls || download) && (
          <div className="result-action-card__controls">
            {controls}
            {download}
          </div>
        )}
      </div>

      {points.length > 0 && (
        <ul className="result-action-card__points">
          {points.map((p, i) => (
            <li key={i} className={p.cls || ""}>
              {p.text}
            </li>
          ))}
        </ul>
      )}

      {stats.length > 0 && (
        <div className="result-action-card__stats">
          {stats.map((s, i) => (
            <div key={i}>
              {s.label}{" "}
              <strong>{s.value}</strong>
            </div>
          ))}
        </div>
      )}

      {children}
    </section>
  );
}
