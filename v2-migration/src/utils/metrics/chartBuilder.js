// ─────────────────────────────────────────────────────────────────────────────
// CHART BUILDER — 커스텀 차트용 순수 집계 (Phase C, 유저 정의 차트)
// ─────────────────────────────────────────────────────────────────────────────
// 유저가 "차트 모양 + 행(차원) + 값(지표)"을 골라 만든 차트의 데이터층.
// 차원(dim) 값별로 base 필드를 합산 → group agg. 값 계산(지표 compute)은 호출부가
// registry/custom 지표로 적용(여기선 순수 집계까지만 — 결정론·테스트 용이).
//
// 지원 차트 모양: scorecard(단일값)·bar(세로막대)·hbar(가로막대)·line(선)·
// pie·doughnut — 렌더는 VizTab/CustomChartsSection.

export const CHART_TYPES = [
  { id: "scorecard", label: "스코어카드", icon: "▣" },
  { id: "bar", label: "세로 막대", icon: "▮" },
  { id: "hbar", label: "가로 막대", icon: "▬" },
  { id: "line", label: "선", icon: "📈" },
  { id: "pie", label: "파이", icon: "◔" },
  { id: "doughnut", label: "도넛", icon: "◍" },
];

const num = (v) => {
  const n = Number(v);
  return isFinite(n) ? n : 0;
};

// rows(표준키 매핑된 행) → 차원값별 base 합계 agg 배열.
// agg = { cost, impressions, clicks, installs, actions, revenue, purchases, denom }
// revenue/purchases는 선택 코호트(Dn), denom은 분모기준(설치/가입)으로 해석(§12.18).
export function groupAggByDim(rows, dim, cohort = 7, denomBasis = "installs") {
  const revKey = `revenue_d${cohort}`;
  const puKey = `pu_d${cohort}`;
  const basis = denomBasis === "actions" ? "actions" : "installs";
  const map = new Map();
  for (const r of rows || []) {
    const key = String((r && r[dim]) != null ? r[dim] : "").trim() || "(없음)";
    if (!map.has(key)) {
      map.set(key, { cost: 0, impressions: 0, clicks: 0, installs: 0, actions: 0, revenue: 0, purchases: 0 });
    }
    const a = map.get(key);
    a.cost += num(r.cost);
    a.impressions += num(r.impressions);
    a.clicks += num(r.clicks);
    a.installs += num(r.installs);
    a.actions += num(r.actions);
    a.revenue += num(r[revKey]);
    a.purchases += num(r[puKey]);
  }
  return Array.from(map.entries()).map(([key, a]) => ({ key, agg: { ...a, denom: a[basis] } }));
}

// group agg 배열 + 지표 compute → { labels, values } (값 null/비유한 제외, 내림차순, 상위 N).
export function buildChartSeries(groups, computeFn, { topN = 20, sortDesc = true } = {}) {
  let data = (groups || [])
    .map((g) => ({ key: g.key, val: typeof computeFn === "function" ? computeFn(g.agg) : null }))
    .filter((d) => d.val != null && isFinite(d.val));
  if (sortDesc) data.sort((a, b) => b.val - a.val);
  if (topN) data = data.slice(0, topN);
  return { labels: data.map((d) => d.key), values: data.map((d) => d.val) };
}
