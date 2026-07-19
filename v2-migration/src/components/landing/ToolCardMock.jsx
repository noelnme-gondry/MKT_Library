"use client";
import React from "react";

// 랜딩 캐러셀 카드용 "제품 스크린샷" 목업 — 실제 스크린샷 에셋 없이 CSS/SVG로
// 각 도구 성격을 표현(Semrush 히어로 카드 참조). 흰 앱 프레임 안에 제목 + 미니
// 차트. 결정론(고정값, Math.random 금지 §3). 브랜드 팔레트 사용.
const C = {
  blue: "#adc6ff",
  cyan: "#4cd7f6",
  green: "#4ade80",
  amber: "#fbbf24",
  pink: "#f472b6",
  violet: "#a78bfa",
  grid: "rgba(120,130,160,0.18)",
  axis: "rgba(120,130,160,0.35)",
};

// ── 개별 차트 목업(viewBox 320×150) ────────────────────────────────
function BarsCluster() {
  // 채널별 묶음 막대(5-2/5-18 기여) — 3계열 × 4그룹
  const groups = [
    [70, 95, 55], [40, 60, 30], [90, 110, 70], [60, 80, 45],
  ];
  const cols = [C.blue, C.cyan, C.green];
  const bw = 12, gap = 10, gw = cols.length * bw + gap;
  return (
    <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <line x1="24" y1="128" x2="308" y2="128" stroke={C.axis} strokeWidth="1" />
      {[40, 80, 120].map((y) => <line key={y} x1="24" y1={128 - y * 0.7} x2="308" y2={128 - y * 0.7} stroke={C.grid} strokeWidth="1" />)}
      {groups.map((g, gi) => g.map((v, i) => (
        <rect key={`${gi}-${i}`} x={40 + gi * (gw + 18) + i * bw} y={128 - v * 0.7} width={bw - 2} height={v * 0.7} rx="2" fill={cols[i]} />
      )))}
    </svg>
  );
}

function ResponseCurve() {
  // 수확체감 반응곡선(5-22 포화) — 곡선 + 현재점 + 여유 음영
  return (
    <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <line x1="24" y1="128" x2="308" y2="128" stroke={C.axis} strokeWidth="1" />
      <path d="M24 126 C 90 120, 130 70, 180 55 S 280 40, 306 38" fill="none" stroke={C.blue} strokeWidth="2.5" />
      <path d="M24 126 C 90 120, 130 70, 180 55 S 280 40, 306 38 L 306 128 L 24 128 Z" fill={C.blue} opacity="0.08" />
      <circle cx="180" cy="55" r="5" fill={C.amber} stroke="#fff" strokeWidth="1.5" />
      <line x1="180" y1="55" x2="180" y2="128" stroke={C.amber} strokeWidth="1" strokeDasharray="3 3" />
    </svg>
  );
}

function ScatterBubbles() {
  // 산점/버블(5-6 소재, 5-4 실험) — 성과 vs 비용
  const pts = [
    [70, 90, 14, C.blue], [120, 60, 22, C.green], [180, 100, 12, C.cyan],
    [220, 45, 18, C.pink], [260, 78, 16, C.violet], [95, 55, 10, C.amber],
  ];
  return (
    <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <line x1="24" y1="128" x2="308" y2="128" stroke={C.axis} strokeWidth="1" />
      <line x1="24" y1="20" x2="24" y2="128" stroke={C.axis} strokeWidth="1" />
      {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r={p[2]} fill={p[3]} opacity="0.55" stroke={p[3]} strokeWidth="1.5" />)}
    </svg>
  );
}

function DivergingLines() {
  // 증분(5-23) — 노출 vs 홀드아웃 두 선이 벌어짐
  return (
    <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <line x1="24" y1="128" x2="308" y2="128" stroke={C.axis} strokeWidth="1" />
      <path d="M24 90 L 90 86 L 150 70 L 210 48 L 270 34 L 306 26" fill="none" stroke={C.green} strokeWidth="2.5" />
      <path d="M24 92 L 90 90 L 150 88 L 210 86 L 270 84 L 306 83" fill="none" stroke={C.axis} strokeWidth="2.5" strokeDasharray="5 4" />
      <path d="M150 70 L 306 26 L 306 83 L 150 88 Z" fill={C.green} opacity="0.1" />
      <line x1="150" y1="20" x2="150" y2="128" stroke={C.amber} strokeWidth="1" strokeDasharray="3 3" />
    </svg>
  );
}

function AllocBars() {
  // 예산 배분(5-3) — 가로 막대 + 재배분 화살표 느낌
  const rows = [["", 82, C.blue], ["", 64, C.cyan], ["", 48, C.green], ["", 30, C.amber]];
  return (
    <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {rows.map((r, i) => (
        <g key={i}>
          <rect x="24" y={22 + i * 28} width="260" height="16" rx="4" fill={C.grid} />
          <rect x="24" y={22 + i * 28} width={r[1] * 2.6} height="16" rx="4" fill={r[2]} />
        </g>
      ))}
    </svg>
  );
}

function StackedContribution() {
  // MMM 기여 분해(5-18) — 누적 막대
  const stacks = [[30, 40, 25], [45, 30, 35], [25, 55, 20], [50, 35, 30], [35, 45, 40]];
  const cols = [C.blue, C.violet, C.cyan];
  return (
    <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <line x1="24" y1="128" x2="308" y2="128" stroke={C.axis} strokeWidth="1" />
      {stacks.map((s, si) => {
        let y = 128;
        return s.map((v, i) => {
          y -= v * 0.9;
          return <rect key={`${si}-${i}`} x={40 + si * 52} y={y} width="30" height={v * 0.9 - 2} rx="2" fill={cols[i]} />;
        });
      })}
    </svg>
  );
}

function HeatGrid() {
  // Aha 그리드(5-20) — 윈도우×횟수 히트맵
  const vals = [
    [0.2, 0.4, 0.7, 0.5], [0.3, 0.6, 0.9, 0.6], [0.5, 0.8, 0.7, 0.4], [0.3, 0.5, 0.4, 0.2],
  ];
  return (
    <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {vals.map((row, r) => row.map((v, c) => (
        <rect key={`${r}-${c}`} x={70 + c * 46} y={16 + r * 30} width="42" height="26" rx="4" fill={C.green} opacity={0.15 + v * 0.7} />
      )))}
    </svg>
  );
}

function KpiLine() {
  // 운영 대시보드(5-2) — KPI 타일 + 라인
  return (
    <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {[0, 1, 2].map((i) => (
        <g key={i}>
          <rect x={22 + i * 98} y="14" width="88" height="34" rx="6" fill={C.grid} />
          <rect x={30 + i * 98} y="22" width="40" height="6" rx="3" fill={[C.blue, C.green, C.amber][i]} />
          <rect x={30 + i * 98} y="34" width="60" height="8" rx="3" fill={C.axis} opacity="0.5" />
        </g>
      ))}
      <path d="M24 120 L 70 108 L 116 114 L 162 92 L 208 100 L 254 74 L 306 82" fill="none" stroke={C.blue} strokeWidth="2.5" />
      <path d="M24 120 L 70 108 L 116 114 L 162 92 L 208 100 L 254 74 L 306 82 L 306 132 L 24 132 Z" fill={C.blue} opacity="0.08" />
    </svg>
  );
}

export const MOCKS = {
  kpiLine: KpiLine,
  bars: BarsCluster,
  curve: ResponseCurve,
  scatter: ScatterBubbles,
  diverge: DivergingLines,
  alloc: AllocBars,
  stacked: StackedContribution,
  heat: HeatGrid,
};

// 도구 id → 목업 타입
export const TOOL_MOCK_TYPE = {
  "5-2": "kpiLine",
  "5-21": "bars",
  "5-22": "curve",
  "5-3": "alloc",
  "5-6": "scatter",
  "5-4": "scatter",
  "5-23": "diverge",
  "5-18": "stacked",
  "5-20": "heat",
  // 콘텐츠 분석(9-x) — 퍼포먼스 엔진 리라벨(§12.23)이라 차트 성격 동일 매핑.
  "9-1": "scatter",
  "9-2": "heat",
  "9-3": "bars",
  "9-6": "scatter",
  "9-7": "kpiLine",
};

// 흰 앱 프레임 + 제목 + 미니 차트(참조 이미지의 카드 안 스크린샷 느낌).
export default function ToolCardMock({ type = "kpiLine", title }) {
  const Mock = MOCKS[type] || KpiLine;
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
      {title && (
        <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>
      )}
      <div style={{ flex: 1, minHeight: 0 }}>
        <Mock />
      </div>
    </div>
  );
}
