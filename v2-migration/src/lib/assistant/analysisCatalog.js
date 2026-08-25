import { ROUTES, isRoutePublished } from "@/lib/routeMap";
import { TOOL_GROUP } from "@/lib/toolGroups";
import { TOOL_DATA_REQUIREMENTS_V2 } from "@/lib/data-import/schema/toolDataRequirements";
import { TOOL_OWNED_MAPPING_ROLES } from "@/lib/data-import/schema/toolDataInventory";
import { TOOL_REQUIRED_FIELDS } from "@/utils/csvConstants";

export const ANALYSIS_RUN_MODES = Object.freeze({
  BASELINE: "baseline",
  CONFIRM_MODEL: "confirm_model",
  CONFIRM_DESIGN: "confirm_design",
  MANUAL: "manual",
});

export const ANALYSIS_EXECUTION_COSTS = Object.freeze({
  LIGHT: "light",
  HEAVY: "heavy",
});

// routeMap과 data contract로부터 파생할 수 없는 제품 판단만 여기에 둔다. 이 표는
// "모든 도구를 실행"하는 목록이 아니라, 자동 실행 경계와 확인 질문의 정본이다.
const DECLARATIONS = Object.freeze({
  "5-2": { runMode: "baseline", executionCost: "light", priority: 10, grains: ["campaign_daily"], decisionQuestion: "현재 성과·페이싱·이상 신호는 무엇인가" },
  "5-21": { runMode: "baseline", executionCost: "light", priority: 20, grains: ["campaign_daily"], decisionQuestion: "최근 성과 변화는 무엇이 만들었는가" },
  "5-22": { runMode: "baseline", executionCost: "light", priority: 30, grains: ["campaign_daily"], decisionQuestion: "한계 효율에 가까운 채널·캠페인은 어디인가" },
  "5-3": { runMode: "baseline", executionCost: "light", priority: 40, grains: ["campaign_daily"], decisionQuestion: "어디에 예산을 증감할 것인가" },
  "5-4": { runMode: "confirm_design", executionCost: "light", priority: 80, grains: ["experiment_aggregate"], decisionQuestion: "실험군과 대조군의 차이를 판독할 수 있는가", confirmationRequirements: ["comparison_arm", "outcome"] },
  "5-18-paid-organic": { runMode: "baseline", executionCost: "light", priority: 25, grains: ["weekly_panel"], decisionQuestion: "유료·오가닉 유입 변화는 어떻게 다른가" },
  "5-18-trend": { runMode: "baseline", executionCost: "light", priority: 15, grains: ["weekly_panel"], decisionQuestion: "주간 성과 추세는 무엇인가" },
  "5-18-cannibal": { runMode: "confirm_model", executionCost: "heavy", priority: 70, grains: ["weekly_panel"], decisionQuestion: "유료 집행과 오가닉 사이의 관측 연관은 있는가", confirmationRequirements: ["outcome"] },
  "5-18-mmm": { runMode: "confirm_model", executionCost: "heavy", priority: 75, grains: ["weekly_panel"], decisionQuestion: "채널 기여 가설을 탐색할 수 있는가", confirmationRequirements: ["outcome", "model_limit"] },
  "5-18-forecast": { runMode: "confirm_model", executionCost: "heavy", priority: 85, grains: ["weekly_panel"], decisionQuestion: "향후 기간의 관측값을 예측할 수 있는가", confirmationRequirements: ["forecast_horizon", "model_limit"] },
  "5-20": { runMode: "confirm_design", executionCost: "heavy", priority: 90, grains: ["user_event"], decisionQuestion: "전환과 관련된 핵심 행동 후보는 무엇인가", confirmationRequirements: ["outcome_binary", "event_window"] },
  "5-23": { runMode: "confirm_design", executionCost: "heavy", priority: 95, grains: ["experiment_aggregate", "interruption_timeseries"], decisionQuestion: "증분 또는 관측 전후 변화를 식별할 설계가 있는가", confirmationRequirements: ["method", "treatment", "outcome", "cutoff", "control"] },
  "5-24": { runMode: "confirm_design", executionCost: "heavy", priority: 100, grains: ["brand_timeseries"], decisionQuestion: "브랜드 집행의 시계열 변화를 기술적으로 점검할 수 있는가", confirmationRequirements: ["intervention_window", "outcome"] },
  "5-25": { runMode: "baseline", executionCost: "light", priority: 35, grains: ["channel_spend_timeseries"], decisionQuestion: "채널 지출이 서로 너무 같이 움직이는가" },
  "5-26": { runMode: "baseline", executionCost: "light", priority: 20, grains: ["asa_keyword_daily"], decisionQuestion: "어떤 검색어를 Exact로 승격하거나 CPT를 조정할 것인가" },
  "5-27": { runMode: "baseline", executionCost: "light", priority: 20, grains: ["store_funnel_daily"], decisionQuestion: "스토어 전환 변화는 구성과 효율 중 무엇 때문인가" },
  // 핵심 액션 생존은 비교 분석이 아니다. 한 행=한 개체의 시간-사건 관측 에피소드로
  // 별도 grain을 둬 compare/증분 도구 후보로 섞이지 않게 한다. 구독은 이 계약의 한 사례다.
  "5-28": { runMode: "baseline", executionCost: "light", priority: 20, grains: ["action_survival_episode"], decisionQuestion: "핵심 액션은 얼마나 유지되고 이탈·종료 위험은 언제 높아지는가" },
  // 구성 변화는 세그먼트 breakdown 행(기간×단위×세그먼트 값)이라 campaign_daily와
  // grain이 다르다. 같은 grain으로 두면 효율 CSV 후보로 섞여 비용이 멤버 수만큼 부푼다.
  // 자동 실행 대상이 아니다. 어떤 컬럼이 세그먼트 축인지와 비교할 두 기간은 사용자가
  // 선언해야 하고(헤더만으로는 확정할 수 없다) 그 선언이 곧 분석 설계다.
  "5-29": { runMode: "confirm_design", executionCost: "light", priority: 45, grains: ["segment_composition_period"], decisionQuestion: "전체 지표가 움직였을 때 어떤 사용자 구성이 바뀌었는가", confirmationRequirements: ["segment_axis", "comparison_periods"] },
  "9-1": { runMode: "confirm_model", executionCost: "heavy", priority: 90, grains: ["content_item"], decisionQuestion: "콘텐츠 요소와 성과의 관측 연관은 무엇인가", confirmationRequirements: ["outcome_numeric", "features"] },
  "9-6": { runMode: "baseline", executionCost: "light", priority: 20, grains: ["creative_daily"], decisionQuestion: "피로한 소재와 교체 후보는 무엇인가" },
});

function explicitFields(required = []) {
  return required.flatMap((item) => typeof item === "string" ? [item] : item?.oneOf || []);
}

function isPublishedAnalysisRoute(route) {
  return isRoutePublished(route) && Boolean(TOOL_GROUP[route.id]) && /^([59])-/.test(route.id);
}

export function publishedAnalysisToolIds() {
  return ROUTES.filter(isPublishedAnalysisRoute).map((route) => route.id);
}

export function validateAnalysisCatalog(declarations = DECLARATIONS) {
  const published = publishedAnalysisToolIds();
  const declared = Object.keys(declarations);
  return {
    missing: published.filter((toolId) => !declarations[toolId]),
    orphaned: declared.filter((toolId) => !published.includes(toolId)),
    duplicateToolIds: declared.filter((toolId, index) => declared.indexOf(toolId) !== index),
  };
}

function catalogEntry(route) {
  const declaration = DECLARATIONS[route.id];
  const v2 = TOOL_DATA_REQUIREMENTS_V2[route.id] || null;
  const legacyRequired = TOOL_REQUIRED_FIELDS[route.id] || [];
  const owned = TOOL_OWNED_MAPPING_ROLES[route.id] || [];
  return Object.freeze({
    toolId: route.id,
    slug: route.slug,
    dataGroup: TOOL_GROUP[route.id],
    runMode: declaration.runMode,
    executionCost: declaration.executionCost,
    priority: declaration.priority,
    supportedGrains: declaration.grains,
    decisionQuestion: declaration.decisionQuestion,
    confirmationRequirements: declaration.confirmationRequirements || [],
    requiredFields: explicitFields(legacyRequired),
    requiredFieldGroups: legacyRequired,
    toolOwnedRoles: owned,
    v2Requirements: v2?.requires || [],
  });
}

export function buildAnalysisCatalog() {
  const validation = validateAnalysisCatalog();
  if (validation.missing.length || validation.orphaned.length || validation.duplicateToolIds.length) {
    throw new Error(`Invalid Dochi analysis catalog: missing=${validation.missing.join(",")}; orphaned=${validation.orphaned.join(",")}; duplicates=${validation.duplicateToolIds.join(",")}`);
  }
  return Object.freeze(ROUTES.filter(isPublishedAnalysisRoute).map(catalogEntry));
}

export const ANALYSIS_CATALOG = buildAnalysisCatalog();

export function analysisCatalogEntry(toolId) {
  return ANALYSIS_CATALOG.find((entry) => entry.toolId === toolId) || null;
}
