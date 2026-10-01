// 포화도는 시점 간 악화/개선이 아닌 현재 관측 범위의 포화/증액 여유를 판정한다.
export const SATURATION_WORDS = [
  ...[
    ["cpa", { ko: "비용 효율 기준(CPA/CPI)", en: "By cost efficiency (CPA/CPI)" }],
    ["roas", { ko: "ROAS 기준", en: "By ROAS" }],
  ].map(([metric, label]) => ({
    id: `metric.saturation.${metric}`, kind: "metric", slot: "metric", label,
    // 매출 컬럼 계약은 도구의 satAvailableFields → spec.metrics에서 파생한다.
    expand: (context) => context.toolSpec?.metrics.includes(metric) ? [{}] : [],
    apply: (state) => { state.data.metric = metric; return state; },
  })),
  ...[
    ["worse", { ko: "포화만 보기", en: "Show saturated only" }],
    ["better", { ko: "증액 여유만 보기", en: "Show headroom only" }],
  ].map(([only, label]) => ({
    id: `view.saturation.${only}`, kind: "view", slot: "view.only", label,
    apply: (state) => { state.view.only = only; return state; },
  })),
];
