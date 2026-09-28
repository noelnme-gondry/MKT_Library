// 대상 필드 → 대시보드 필터의 Set 키.
const DRILL_DOWN_FILTER_KEY = { channel: "channels" };

// 결과가 실제로 계산한 범위. 작업대는 필터 없이 전체 행으로 계산하므로(어댑터 options에 filterState가
// 없다) 기본은 빈 필터이고, drill-down이면 결과가 지목한 대상 하나만 건다. 비교 창은 주간 점검(5-2)만 읽는다.
export function resultScope(result, targetToolId, drillDown = null) {
  const key = drillDown ? DRILL_DOWN_FILTER_KEY[drillDown.field] : null;
  const filterState = { ...(result?.manifest?.comparison?.filterState || {}), ...(key ? { [key]: [drillDown.value] } : {}) };
  const windowDays = Number(result?.manifest?.windowDays ?? result?.manifest?.periodDays);
  // drill-down 버튼은 "일별 추이"를 약속하므로 일별 차트가 있는 첫 탭으로 연다(다른 탭에 머물러 있을 수 있다).
  return {
    filterState,
    ...(targetToolId === "5-2" && Number.isFinite(windowDays) ? { windowDays } : {}),
    ...(targetToolId === "5-2" && key ? { dashboardTab: "viz" } : {}),
  };
}
