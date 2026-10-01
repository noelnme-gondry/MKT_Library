// Shared dashboard controls stay in Zustand. Recipes snapshot these controls only
// at save/apply boundaries; there is no second live filter or tab state.
export const DASHBOARD_CONTROLS = {
  dashboardTab: { values: ['viz', 'scorecard', 'seasonality', 'pacing', 'anomaly', 'ltv', 'cohort', 'funnel', 'segment'], ko: '대시보드 보기', en: 'Dashboard view' },
  dashWindowDays: { values: [7, 14, 28], ko: '비교 관측일 수', en: 'Comparison observation days' },
  selectedCohort: { values: [0, 7, 14, 30, 60, 90], ko: '코호트 시점', en: 'Cohort point' },
};
export const DASHBOARD_BLOCKS = [
  { id: 'conclusion', label: { ko: '주간 결론', en: 'Weekly conclusion' }, locked: true },
  { id: 'kpi', label: { ko: 'KPI·추이', en: 'KPIs and trend' }, locked: true },
  { id: 'recommendations', label: { ko: '추천 분석', en: 'Recommended analyses' } },
  { id: 'supporting', label: { ko: '보조 차트', en: 'Supporting charts' } },
];
export const DASHBOARD_SPEC = {
  toolId: '5-2', maxLevels: 0, metrics: [], periodKinds: [], exportFormats: [], blocks: DASHBOARD_BLOCKS,
  commandExample: { ko: '예: Meta만 분석, 보조 차트 숨기기, PNG 제목만', en: 'e.g. Analyze Meta only, Hide Supporting charts, PNG title only' },
};
export function dashboardControlSteps(state) {
  return Object.entries(DASHBOARD_CONTROLS).filter(([key, spec]) => spec.values.includes(state[key]))
    .map(([key]) => ({ id: `dashboard.${key}`, params: { value: state[key] } }));
}
export function dashboardControlPatch(steps = []) {
  return Object.fromEntries(steps.flatMap(step => {
    const key = step.id?.startsWith('dashboard.') ? step.id.slice(10) : '';
    return DASHBOARD_CONTROLS[key]?.values.includes(step.params?.value) ? [[key, step.params.value]] : [];
  }));
}
export function dashboardPresentationSteps(steps = []) { return steps.filter(step => !step.id?.startsWith('dashboard.')); }
export function dashboardSnapshotSteps(state, steps) { return [...dashboardControlSteps(state), ...dashboardPresentationSteps(steps)]; }
