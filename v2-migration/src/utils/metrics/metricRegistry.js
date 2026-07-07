// ─────────────────────────────────────────────────────────────────────────────
// METRIC REGISTRY — 모든 파생 지표의 단일 정의소(SSOT)
// ─────────────────────────────────────────────────────────────────────────────
// 목적(§ custom-metrics-data-config-spec.md Phase A): 지표를 "코드(하드코딩)"에서
// "데이터(서술자)"로 옮긴다. 지금까지 calculateKPIs 안에 흩어져 있던 파생식
// (ctr·cpc·roas…)을 여기 한 곳에 서술자로 모아, 표·차트·카드 등 모든 소비처가
// 같은 정의를 읽게 한다. 유저가 만든 커스텀 지표도 이 레지스트리에 병합되어
// (getMetricRegistry) 어디서든 1급 시민으로 흐른다.
//
// 핵심 계약(반드시 유지):
//  1) compute(agg)는 순수함수 — 집계객체(agg)만 받아 number|null 반환. 사이드이펙트 X.
//     같은 입력 → byte-identical(§8.3 결정론, 골든이 오라클).
//  2) 분모 falsy(0/NaN) → null. "계산 불가"를 null로 정직히 표현(거짓 숫자 금지 §8.6).
//  3) 여기 식은 index.html/calculateKPIs 원본과 verbatim 동일 — tolerance·수학 변경 0.
//
// agg 계약(정규화된 집계객체) — 소비처가 base 필드를 합산해 만들어 넘긴다:
//   { cost, impressions, clicks, installs, actions, revenue, purchases, denom }
//   · denom = 전역 분모 기준(설치 or 액션)으로 소비처가 이미 해석한 값(§12.18).
//   · revenue/purchases = 선택 코호트(Dn)의 매출/결제 합(소비처가 cohort 해석).

// 분모가 falsy(0/NaN/undefined)면 null. mult로 CPM(×1000) 등 스케일.
// calculateKPIs의 `den ? num/den : null` 가드와 byte-identical.
export const ratio = (num, den, mult = 1) => (den ? (num / den) * mult : null);

// ── base 필드(집계 차원) — agg를 구성하는 원자 합계. 파생지표의 deps가 이 키를 참조. ──
export const BASE_FIELDS = [
  { id: "cost", label: "비용", unit: "currency", category: "spend" },
  { id: "impressions", label: "노출수", unit: "count", category: "funnel" },
  { id: "clicks", label: "클릭수", unit: "count", category: "funnel" },
  { id: "installs", label: "설치수", unit: "count", category: "outcome" },
  { id: "actions", label: "액션/가입", unit: "count", category: "outcome" },
  { id: "revenue", label: "매출", unit: "currency", category: "value" },
  { id: "purchases", label: "결제건수", unit: "count", category: "value" },
  // denom은 파생 base(설치 or 액션) — deps 참조용으로 노출(집계는 소비처가 해석).
  { id: "denom", label: "분모(설치/가입)", unit: "count", category: "outcome" },
];

// ── 파생 지표 서술자 ──────────────────────────────────────────────────────────
// { id, label, unit, category, deps:[agg키], compute:(agg)=>num|null,
//   higherIsBetter, source:"derived" }
// deps: 이 지표가 유효하려면 필요한 agg 키(= 매핑돼야 하는 표준필드). Phase B에서
//       "필요한 컬럼이 없으면 지표 숨김/비활성" 판정에 사용. Phase A는 메타로만 보유.
// unit: "currency" | "count" | "ratio"(0~1, %표시) | "cpm_currency"(천노출당) — 표시층 힌트.
// higherIsBetter: 색상 코드(초록/빨강) 방향. 비용류=false, 효율/매출류=true.
export const DERIVED_METRICS = [
  {
    id: "cpm", label: "CPM", unit: "currency", category: "efficiency",
    deps: ["cost", "impressions"], higherIsBetter: false, source: "derived",
    desc: "1,000 노출당 비용",
    compute: (a) => ratio(a.cost, a.impressions, 1000),
  },
  {
    id: "ctr", label: "CTR", unit: "ratio", category: "funnel",
    deps: ["clicks", "impressions"], higherIsBetter: true, source: "derived",
    desc: "클릭수 ÷ 노출수",
    compute: (a) => ratio(a.clicks, a.impressions),
  },
  {
    id: "cpc", label: "CPC", unit: "currency", category: "efficiency",
    deps: ["cost", "clicks"], higherIsBetter: false, source: "derived",
    desc: "클릭당 비용",
    compute: (a) => ratio(a.cost, a.clicks),
  },
  {
    id: "cpi", label: "CPI/CPA", unit: "currency", category: "efficiency",
    deps: ["cost", "denom"], higherIsBetter: false, source: "derived",
    desc: "설치(또는 가입)당 비용 — 분모 기준 전환(§12.18)",
    compute: (a) => ratio(a.cost, a.denom),
  },
  {
    id: "cvr", label: "CVR", unit: "ratio", category: "funnel",
    deps: ["denom", "clicks"], higherIsBetter: true, source: "derived",
    desc: "분모(설치/가입) ÷ 클릭수",
    compute: (a) => ratio(a.denom, a.clicks),
  },
  {
    id: "purchaseRate", label: "구매율", unit: "ratio", category: "value",
    deps: ["purchases", "denom"], higherIsBetter: true, source: "derived",
    desc: "결제건수 ÷ 분모(설치/가입)",
    compute: (a) => ratio(a.purchases, a.denom),
  },
  {
    id: "roas", label: "ROAS", unit: "ratio", category: "value",
    deps: ["revenue", "cost"], higherIsBetter: true, source: "derived",
    desc: "매출 ÷ 비용",
    compute: (a) => ratio(a.revenue, a.cost),
  },
  {
    id: "cpp", label: "CPP", unit: "currency", category: "efficiency",
    deps: ["cost", "purchases"], higherIsBetter: false, source: "derived",
    desc: "결제 1건당 비용",
    compute: (a) => ratio(a.cost, a.purchases),
  },
  {
    id: "cpa", label: "CPA(결제)", unit: "currency", category: "efficiency",
    deps: ["cost", "purchases"], higherIsBetter: false, source: "derived",
    desc: "결제 1건당 비용(cpp와 동일 식, 별도 표기)",
    compute: (a) => ratio(a.cost, a.purchases),
  },
  {
    id: "arpu", label: "ARPU", unit: "currency", category: "value",
    deps: ["revenue", "denom"], higherIsBetter: true, source: "derived",
    desc: "분모(설치/가입)당 매출",
    compute: (a) => ratio(a.revenue, a.denom),
  },
  {
    id: "arppu", label: "ARPPU", unit: "currency", category: "value",
    deps: ["revenue", "purchases"], higherIsBetter: true, source: "derived",
    desc: "결제자 1인당 매출",
    compute: (a) => ratio(a.revenue, a.purchases),
  },
  // ── 프리셋(Phase C) — 기본 노출 아님, 유저가 켜서 쓰는 큐레이션 지표 ──────────
  {
    id: "profit", label: "이익", unit: "currency", category: "value",
    deps: ["revenue", "cost"], higherIsBetter: true, source: "preset",
    desc: "매출 − 비용",
    compute: (a) => a.revenue - a.cost,
  },
  {
    id: "profitMargin", label: "이익률", unit: "ratio", category: "value",
    deps: ["revenue", "cost"], higherIsBetter: true, source: "preset",
    desc: "(매출 − 비용) ÷ 매출",
    compute: (a) => ratio(a.revenue - a.cost, a.revenue),
  },
];

// id → 서술자 빠른 조회(base+derived). 커스텀은 getMetricRegistry에서 병합.
export const METRIC_BY_ID = Object.fromEntries(
  [...BASE_FIELDS.map((f) => ({ ...f, source: "base", compute: (a) => a[f.id] ?? null })),
   ...DERIVED_METRICS].map((m) => [m.id, m]),
);

/**
 * 전체 지표 레지스트리 = base + derived + 유저 커스텀 지표(병합).
 * 커스텀 지표가 어디서든 1급 시민으로 흐르게 하는 병합 지점.
 * @param {Array<Object>} customMetrics - {id,label,compute,deps,...} 서술자 배열
 *   (Phase D formulaEngine이 유저 수식→compute로 만들어 넘김). 같은 id는 커스텀이 우선.
 * @returns {Array<Object>} 순서 = base → derived → custom (기본 표시 순서의 seed)
 */
export function getMetricRegistry(customMetrics = []) {
  const base = BASE_FIELDS.map((f) => ({
    ...f, source: "base", compute: (a) => a[f.id] ?? null,
  }));
  const custom = (customMetrics || []).map((m) => ({ ...m, source: "custom" }));
  const merged = [...base, ...DERIVED_METRICS, ...custom];
  // 같은 id 중복 시 뒤(커스텀)가 우선 — Map으로 마지막 승자 유지하되 순서 보존.
  const seen = new Map();
  for (const m of merged) seen.set(m.id, m);
  return Array.from(seen.values());
}

/**
 * agg에서 주어진 지표 목록을 계산해 {id: value|null} 반환.
 * calculateKPIs 등 소비처가 이 결과를 스프레드해 사용.
 * @param {Object} agg 정규화 집계객체
 * @param {Array<Object>} metrics 서술자 배열(compute 보유)
 */
export function computeMetrics(agg, metrics) {
  const out = {};
  for (const m of metrics) {
    if (typeof m.compute !== "function") continue;
    let v = null;
    try { v = m.compute(agg); } catch { v = null; } // 커스텀 수식 방어(거짓 숫자 대신 null)
    out[m.id] = v == null || (typeof v === "number" && !isFinite(v)) ? null : v;
  }
  return out;
}
