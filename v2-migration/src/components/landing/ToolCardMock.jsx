"use client";
import React from "react";

// 랜딩 캐러셀 카드용 "제품 스크린샷" 목업 — 실제 스크린샷 에셋 없이 CSS/SVG로
// 각 도구 성격을 표현(Semrush 히어로 카드 참조). 흰 앱 프레임 안에 제목 + 미니
// 차트. 결정론(고정값, Math.random 금지 §3). 브랜드 팔레트 사용.
// 리얼리즘 리디자인: 축 눈금·수치 라벨·범례·판정 마커까지 실제 도구 화면의 밀도로.
// SVG 안 텍스트는 KR/EN 공용 카드라 언어 중립 표기만(채널명·W1·D7·%·지표 약어).
const C = {
  blue: "#adc6ff",
  cyan: "#4cd7f6",
  green: "#4ade80",
  amber: "#fbbf24",
  pink: "#f472b6",
  violet: "#a78bfa",
  red: "#f0917e",
  grid: "rgba(120,130,160,0.16)",
  axis: "rgba(120,130,160,0.38)",
  txt: "rgba(120,130,160,0.85)",
  txtDim: "rgba(120,130,160,0.6)",
};
const MONO = "JetBrains Mono, monospace";

// 공용 마이크로 텍스트(축 라벨·범례) — 8px 모노스페이스.
function Txt({ x, y, children, anchor = "middle", size = 8, fill = C.txt, weight = 500 }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fontFamily={MONO} fill={fill} fontWeight={weight}>
      {children}
    </text>
  );
}

// 범례 도트+라벨 한 항목.
function LegendItem({ x, y, color, label, dashed = false }) {
  return (
    <g>
      {dashed ? (
        <line x1={x - 4} y1={y - 3} x2={x + 6} y2={y - 3} stroke={color} strokeWidth="2" strokeDasharray="3 2" />
      ) : (
        <rect x={x - 3} y={y - 6} width="7" height="7" rx="2" fill={color} />
      )}
      <Txt x={x + 10} y={y} anchor="start" fill={C.txtDim}>{label}</Txt>
    </g>
  );
}

// Y축 눈금 3개 + 그리드(수치 라벨 포함) — 차트마다 재사용.
function YGrid({ ticks, x0 = 30, x1 = 310, yOf, fmt = (v) => v }) {
  return (
    <g>
      {ticks.map((v) => (
        <g key={v}>
          <line x1={x0} y1={yOf(v)} x2={x1} y2={yOf(v)} stroke={C.grid} strokeWidth="1" />
          <Txt x={x0 - 4} y={yOf(v) + 2.5} anchor="end" fill={C.txtDim}>{fmt(v)}</Txt>
        </g>
      ))}
    </g>
  );
}

// ── 개별 차트 목업(viewBox 320×150) ────────────────────────────────
function KpiLine() {
  // 운영 대시보드(5-2) — 일별 전환 추이: 점 마커 + 7일 평균 점선 + 마지막 값 배지.
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const vals = [2860, 2540, 3010, 2760, 3320, 3080, 3412]; // 결정론 고정
  const x = (i) => 34 + i * 45;
  const y = (v) => 128 - ((v - 2200) / 1400) * 96; // 2200~3600 → 128~32
  const pts = vals.map((v, i) => `${x(i)} ${y(v)}`).join(" L ");
  const avg = 2997;
  return (
    <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <YGrid ticks={[2400, 2800, 3200]} yOf={y} fmt={(v) => `${(v / 1000).toFixed(1)}k`} />
      <line x1="30" y1="128" x2="310" y2="128" stroke={C.axis} strokeWidth="1" />
      {/* 7일 평균 점선 */}
      <line x1="30" y1={y(avg)} x2="310" y2={y(avg)} stroke={C.amber} strokeWidth="1" strokeDasharray="4 3" opacity="0.7" />
      <Txt x={308} y={y(avg) - 3} anchor="end" fill={C.amber}>avg</Txt>
      {/* 면적 + 라인 + 점 */}
      <path d={`M ${pts} L ${x(6)} 128 L ${x(0)} 128 Z`} fill={C.blue} opacity="0.1" />
      <path d={`M ${pts}`} fill="none" stroke={C.blue} strokeWidth="2.2" />
      {vals.map((v, i) => (
        <circle key={i} cx={x(i)} cy={y(v)} r={i === 6 ? 4 : 2.5} fill={i === 6 ? C.green : C.blue} stroke="#fff" strokeWidth={i === 6 ? 1.5 : 0} />
      ))}
      {/* 마지막 값 배지 */}
      <rect x={x(6) - 34} y={y(vals[6]) - 22} width="40" height="13" rx="6.5" fill={C.green} opacity="0.9" />
      <Txt x={x(6) - 14} y={y(vals[6]) - 12.5} fill="#0b3d1f" weight={700}>3,412</Txt>
      {/* X 라벨 */}
      {days.map((d, i) => <Txt key={d} x={x(i)} y={141} fill={C.txtDim}>{d}</Txt>)}
    </svg>
  );
}

function BarsCluster() {
  // 성과 변동(5-21) — 주차별 채널 묶음 막대 + 범례 + 최근 주 하이라이트/델타.
  const groups = [[52, 68, 38], [44, 60, 34], [62, 78, 46], [70, 94, 58]];
  const cols = [C.blue, C.violet, C.cyan];
  const names = ["Google", "Meta", "TikTok"];
  const bw = 13, gapIn = 2, gw = cols.length * (bw + gapIn);
  const gx = (gi) => 42 + gi * (gw + 22);
  const y = (v) => 126 - v;
  return (
    <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <YGrid ticks={[30, 60, 90]} yOf={y} fmt={(v) => `${v}0`} />
      <line x1="30" y1="126" x2="310" y2="126" stroke={C.axis} strokeWidth="1" />
      {/* 범례 */}
      {names.map((n, i) => <LegendItem key={n} x={196 + i * 42} y={14} color={cols[i]} label={n} />)}
      {/* 최근 주 하이라이트 배경 */}
      <rect x={gx(3) - 6} y="22" width={gw + 10} height="104" rx="6" fill={C.green} opacity="0.07" />
      {groups.map((g, gi) => g.map((v, i) => (
        <rect key={`${gi}-${i}`} x={gx(gi) + i * (bw + gapIn)} y={y(v)} width={bw} height={v} rx="2.5" fill={cols[i]} opacity={gi === 3 ? 1 : 0.75} />
      )))}
      {/* 델타 배지 */}
      <Txt x={gx(3) + gw / 2} y={y(94) - 6} fill={C.green} weight={700}>+18%</Txt>
      {["W1", "W2", "W3", "W4"].map((w, i) => <Txt key={w} x={gx(i) + gw / 2} y={139} fill={C.txtDim}>{w}</Txt>)}
    </svg>
  );
}

function ResponseCurve() {
  // 포화도(5-22) — 관측 산점 + 적합 곡선 + 현재 지출점 + 한계 기울기 + 여유 음영.
  const obs = [[36, 122], [58, 112], [76, 100], [96, 88], [118, 76], [142, 68], [166, 60], [188, 56], [214, 52], [238, 50]];
  return (
    <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <line x1="30" y1="128" x2="310" y2="128" stroke={C.axis} strokeWidth="1" />
      <line x1="30" y1="24" x2="30" y2="128" stroke={C.axis} strokeWidth="1" />
      <Txt x={310} y={140} anchor="end" fill={C.txtDim}>Spend</Txt>
      <Txt x={26} y={20} anchor="end" fill={C.txtDim}>Conv</Txt>
      {/* 현재점 이후 여유 구간 음영 */}
      <rect x="180" y="24" width="130" height="104" fill={C.green} opacity="0.06" />
      {/* 적합 곡선 + 신뢰 밴드 */}
      <path d="M30 126 C 90 116, 120 74, 180 56 S 280 42, 308 40" fill="none" stroke={C.blue} strokeWidth="2.4" />
      <path d="M30 126 C 90 112, 120 66, 180 48 S 280 34, 308 32 L 308 48 C 280 50, 220 52, 180 64 C 120 82, 90 120, 30 126 Z" fill={C.blue} opacity="0.08" />
      {/* 관측점 */}
      {obs.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="2.5" fill={C.blue} opacity="0.55" />)}
      {/* 현재 지출점 + 한계 기울기(접선) */}
      <line x1="180" y1="56" x2="180" y2="128" stroke={C.amber} strokeWidth="1" strokeDasharray="3 3" />
      <line x1="156" y1="63" x2="212" y2="49" stroke={C.amber} strokeWidth="1.6" />
      <circle cx="180" cy="56" r="5" fill={C.amber} stroke="#fff" strokeWidth="1.5" />
      <Txt x={183} y={140} fill={C.amber} weight={700}>now</Txt>
      <Txt x={244} y={36} fill={C.green} weight={700}>headroom</Txt>
    </svg>
  );
}

function ScatterBubbles() {
  // 소재 분석(5-6/9-6) — CTR×빈도 사분면: 중앙값 십자 + 판정 색 + 소재 라벨.
  const pts = [
    // [x, y, r, color, label]  좌상=신선·고성과(green) / 우하=피로(red)
    [70, 52, 13, C.green, "A"], [104, 66, 10, C.green, "B"], [150, 80, 11, C.blue, "C"],
    [196, 96, 9, C.blue, "D"], [238, 64, 12, C.amber, "E"], [266, 104, 11, C.red, "F"],
  ];
  return (
    <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <line x1="30" y1="128" x2="310" y2="128" stroke={C.axis} strokeWidth="1" />
      <line x1="30" y1="20" x2="30" y2="128" stroke={C.axis} strokeWidth="1" />
      <Txt x={310} y={140} anchor="end" fill={C.txtDim}>Freq</Txt>
      <Txt x={26} y={16} anchor="end" fill={C.txtDim}>CTR</Txt>
      {/* 중앙값 십자(사분면) */}
      <line x1="170" y1="20" x2="170" y2="128" stroke={C.axis} strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
      <line x1="30" y1="76" x2="310" y2="76" stroke={C.axis} strokeWidth="1" strokeDasharray="4 3" opacity="0.6" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p[0]} cy={p[1]} r={p[2]} fill={p[3]} opacity="0.4" stroke={p[3]} strokeWidth="1.6" />
          <Txt x={p[0]} y={p[1] + 3} fill={C.txt} weight={700}>{p[4]}</Txt>
        </g>
      ))}
      {/* 피로 소재 경고 링 */}
      <circle cx="266" cy="104" r="16" fill="none" stroke={C.red} strokeWidth="1.2" strokeDasharray="3 3" />
      <Txt x={266} y={132} fill={C.red} weight={700}>refresh</Txt>
    </svg>
  );
}

function DivergingLines() {
  // 증분(5-23) — 노출 vs 홀드아웃: 개입 시점 마커 + 증분 음영 + 순증 수치.
  const y = (v) => 128 - v;
  return (
    <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <YGrid ticks={[30, 60, 90]} yOf={y} fmt={() => ""} x0={30} x1={310} />
      <line x1="30" y1="128" x2="310" y2="128" stroke={C.axis} strokeWidth="1" />
      {/* 범례 */}
      <LegendItem x={200} y={14} color={C.green} label="test" />
      <LegendItem x={252} y={14} color={C.axis} label="holdout" dashed />
      {/* 개입 시점 */}
      <line x1="150" y1="20" x2="150" y2="128" stroke={C.amber} strokeWidth="1" strokeDasharray="3 3" />
      <Txt x={150} y={140} fill={C.amber} weight={700}>ads on</Txt>
      {/* 증분 음영 + 두 선 */}
      <path d="M150 58 L 210 40 L 270 30 L 308 24 L 308 45 L 270 46 L 210 48 L 150 50 Z" fill={C.green} opacity="0.12" />
      <path d="M30 62 L 90 58 L 150 58 L 210 40 L 270 30 L 308 24" fill="none" stroke={C.green} strokeWidth="2.4" />
      <path d="M30 64 L 90 60 L 150 50 L 210 48 L 270 46 L 308 45" fill="none" stroke={C.axis} strokeWidth="2.2" strokeDasharray="5 4" />
      {/* 순증 배지 */}
      <rect x="242" y="52" width="52" height="14" rx="7" fill={C.green} opacity="0.9" />
      <Txt x={268} y={62} fill="#0b3d1f" weight={700}>+486</Txt>
      {["D-14", "D-7", "D0", "D+7", "D+14"].map((d, i) => <Txt key={d} x={30 + i * 69.5} y={140} fill={C.txtDim}>{i === 2 ? "" : d}</Txt>)}
    </svg>
  );
}

function AllocBars() {
  // 예산 배분(5-3) — 채널 라벨 + 현재(점선 마커) vs 최적(채움) + % 수치.
  const rows = [
    ["Google", 38, 31, C.blue], ["Meta", 27, 33, C.cyan], ["TikTok", 21, 16, C.green], ["ASA", 14, 20, C.amber],
  ]; // [라벨, 최적%, 현재%, 색]
  const x0 = 66, xw = 190;
  const w = (v) => (v / 45) * xw;
  return (
    <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {rows.map((r, i) => {
        const yy = 20 + i * 31;
        const delta = r[1] - r[2];
        return (
          <g key={r[0]}>
            <Txt x={x0 - 8} y={yy + 12} anchor="end" fill={C.txt}>{r[0]}</Txt>
            <rect x={x0} y={yy} width={xw} height="16" rx="5" fill={C.grid} />
            <rect x={x0} y={yy} width={w(r[1])} height="16" rx="5" fill={r[3]} />
            {/* 현재 배분 마커(점선 세로) */}
            <line x1={x0 + w(r[2])} y1={yy - 3} x2={x0 + w(r[2])} y2={yy + 19} stroke={C.axis} strokeWidth="1.4" strokeDasharray="2 2" />
            <Txt x={x0 + xw + 10} y={yy + 8} anchor="start" fill={C.txt} weight={700}>{r[1]}%</Txt>
            <Txt x={x0 + xw + 10} y={yy + 17} anchor="start" size={7.5} fill={delta >= 0 ? C.green : C.red} weight={700}>
              {delta >= 0 ? `▲${delta}p` : `▼${-delta}p`}
            </Txt>
          </g>
        );
      })}
      <Txt x={x0} y={146} anchor="start" size={7.5} fill={C.txtDim}>┆ current → bar: optimal</Txt>
    </svg>
  );
}

function StackedContribution() {
  // MMM(5-18) — 베이스라인 층 + 채널 기여 누적 + 범례 + 주차 라벨.
  const stacks = [[26, 18, 22, 12], [28, 22, 18, 16], [26, 16, 30, 12], [30, 24, 20, 18], [28, 20, 26, 22]];
  const cols = ["rgba(120,130,160,0.35)", C.blue, C.violet, C.cyan];
  const names = ["base", "Google", "Meta", "TikTok"];
  return (
    <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      <line x1="30" y1="126" x2="310" y2="126" stroke={C.axis} strokeWidth="1" />
      {[40, 80].map((v) => <line key={v} x1="30" y1={126 - v} x2="310" y2={126 - v} stroke={C.grid} strokeWidth="1" />)}
      {names.map((n, i) => <LegendItem key={n} x={44 + i * 68} y={14} color={cols[i]} label={n} />)}
      {stacks.map((s, si) => {
        let yy = 126;
        return (
          <g key={si}>
            {s.map((v, i) => {
              yy -= v;
              return <rect key={i} x={46 + si * 52} y={yy} width="32" height={v - 1.5} rx="2" fill={cols[i]} />;
            })}
          </g>
        );
      })}
      {["W1", "W2", "W3", "W4", "W5"].map((wl, i) => <Txt key={wl} x={62 + i * 52} y={139} fill={C.txtDim}>{wl}</Txt>)}
    </svg>
  );
}

function HeatGrid() {
  // Aha(5-20) — 윈도우(D)×횟수(x) 그리드 탐색 히트맵 + 최적 셀 링.
  const vals = [
    [0.18, 0.34, 0.52, 0.41], [0.29, 0.55, 0.81, 0.57], [0.44, 0.68, 0.62, 0.38], [0.31, 0.46, 0.35, 0.2],
  ];
  const rows = ["1x", "2x", "3x", "4x"], cols = ["D1", "D3", "D7", "D14"];
  const cx = (c) => 84 + c * 50, cy = (r) => 22 + r * 27;
  return (
    <svg viewBox="0 0 320 150" width="100%" height="100%" preserveAspectRatio="xMidYMid meet">
      {cols.map((c, i) => <Txt key={c} x={cx(i) + 21} y={16} fill={C.txtDim}>{c}</Txt>)}
      {rows.map((r, i) => <Txt key={r} x={76} y={cy(i) + 16} anchor="end" fill={C.txtDim}>{r}</Txt>)}
      {vals.map((row, r) => row.map((v, c) => (
        <g key={`${r}-${c}`}>
          <rect x={cx(c)} y={cy(r)} width="42" height="23" rx="4" fill={C.green} opacity={0.12 + v * 0.75} />
          <Txt x={cx(c) + 21} y={cy(r) + 15} size={7.5} fill={v > 0.6 ? "#0b3d1f" : C.txtDim} weight={v > 0.6 ? 700 : 500}>{v.toFixed(2)}</Txt>
        </g>
      )))}
      {/* 최적 셀(2x·D7) 링 + 라벨 */}
      <rect x={cx(2) - 2.5} y={cy(1) - 2.5} width="47" height="28" rx="6" fill="none" stroke={C.green} strokeWidth="2" />
      <Txt x={cx(2) + 21} y={146} fill={C.green} weight={700}>best F1</Txt>
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
