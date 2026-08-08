// route id → client-side CSV slice. Similar-grain tools share one slice;
// different grains stay isolated so navigating between tools never overwrites
// an unrelated dataset.
export const TOOL_GROUP = {
  "5-2": "efficiency", "5-21": "efficiency", "5-22": "efficiency", "5-3": "efficiency",
  // /start는 도구가 아니지만 효율 슬라이스에 CSV를 "쓰는" 라우트다. 여기 없으면
  // setCurrentRouteId가 activeDataGroup을 이전 도구 그룹으로 유지하는 반면
  // setCsvData는 efficiency에 쓰기 때문에, 업로드 직후 재진입 시 미러가 빈
  // 슬라이스를 가리켜 방금 올린 CSV가 사라진다(읽기·쓰기 그룹 불일치).
  "start-gate": "efficiency",
  // 5-6 is a defensive alias: 9-6 is the published route, while the creative
  // uploader still uses 5-6 for its demo/guide contract.
  "5-6": "creative",
  "5-4": "experiment", "5-7": "experiment", "5-15": "experiment",
  "5-18": "response", "5-18-paid-organic": "response", "5-18-trend": "response", "5-18-cannibal": "response", "5-18-mmm": "response", "5-18-forecast": "response",
  "5-20": "aha",
  "5-23": "incrementality",
  "5-24": "brand_incrementality",
  "5-25": "collinearity",
  "5-26": "asa_keyword",
  "9-1": "content_attr",
  "9-2": "content_aha",
  "9-3": "content_traffic",
  "9-6": "creative",
  "9-7": "content_dashboard",
};

// Home and guide routes never consume csvData; the efficiency fallback keeps
// the store mirror valid for those routes without creating an unused slice.
export const FALLBACK_DATA_GROUP = "efficiency";
export const groupForRoute = (id) => TOOL_GROUP[id] || FALLBACK_DATA_GROUP;

// 존재하는 모든 데이터 그룹 = TOOL_GROUP 값의 집합. 스토어의 그룹별 맵
// (csvGroups·analyzedByGroup·dashboardFilterGroups)은 이 목록에서 **파생**한다.
// 손으로 나열하면 반드시 어긋난다 — 실제로 csvGroups엔 brand_incrementality가
// 빠져 도구가 죽었고(PR #608), dashboardFilterGroups엔 아직 빠져 있었으며,
// 세 맵 모두 어떤 라우트도 가리키지 않는 content_freshness를 들고 있었다.
export const DATA_GROUPS = [...new Set([FALLBACK_DATA_GROUP, ...Object.values(TOOL_GROUP)])];

// 그룹별 맵 빌더 — 값은 매번 새로 만든다(Set·객체 공유 방지).
export const buildGroupMap = (makeValue) => Object.fromEntries(DATA_GROUPS.map((group) => [group, makeValue()]));
