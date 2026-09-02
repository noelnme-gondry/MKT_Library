import { OG_CARD_PATH } from "./routeMap";

// 도구별 기능 목록(JSON-LD featureList) SSOT. 카드 그림에는 더 이상 쓰지 않는다.
export const TOOL_OG_CONFIG = {
  "5-2": { metrics: { ko: ["비용", "설치", "CPI", "ROAS"], en: ["SPEND", "INSTALLS", "CPI", "ROAS"] } },
  "5-21": { metrics: { ko: ["물량", "효율", "믹스"], en: ["VOLUME", "RATE", "MIX"] } },
  "5-22": { metrics: { ko: ["한계 CPA", "포화", "여유"], en: ["MARGINAL CPA", "SATURATED", "HEADROOM"] } },
  "5-18": { metrics: { ko: ["추세", "잠식", "기여", "예측"], en: ["TREND", "CANNIBAL", "CONTRIBUTION", "FORECAST"] } },
  "5-18-trend": { metrics: { ko: ["기준선", "계절성", "이상 주차"], en: ["BASELINE", "SEASONALITY", "ANOMALY"] } },
  "5-18-paid-organic": { metrics: { ko: ["ORGANIC WOW", "PAID WOW", "최근 궤적"], en: ["ORGANIC WOW", "PAID WOW", "RECENT PATH"] } },
  "5-18-cannibal": { metrics: { ko: ["유료", "오가닉", "잠식 신호"], en: ["PAID", "ORGANIC", "DISPLACEMENT"] } },
  "5-18-mmm": { metrics: { ko: ["채널", "기본 수요", "기여도"], en: ["CHANNEL", "BASE DEMAND", "CONTRIBUTION"] } },
  "5-18-forecast": { metrics: { ko: ["예측", "OOS", "불확실성"], en: ["FORECAST", "OOS", "UNCERTAINTY"] } },
  "5-3": { metrics: { ko: ["늘릴 곳", "줄일 곳", "제약"], en: ["INCREASE", "DECREASE", "CONSTRAINTS"] } },
  "5-4": { metrics: { ko: ["표본수", "LIFT", "검정력"], en: ["SAMPLE", "LIFT", "POWER"] } },
  "5-20": { metrics: { ko: ["행동", "리프트", "지지도"], en: ["ACTION", "LIFT", "SUPPORT"] } },
  "5-23": { metrics: { ko: ["통제군", "증분", "신뢰구간"], en: ["HOLDOUT", "INCREMENT", "INTERVAL"] } },
  "5-24": { metrics: { ko: ["브랜드 검색", "ITS", "증가분"], en: ["BRAND SEARCH", "ITS", "LIFT"] } },
  "9-1": { metrics: { ko: ["요소", "효과", "신뢰구간"], en: ["ELEMENT", "EFFECT", "INTERVAL"] } },
  "9-6": { metrics: { ko: ["교체", "피로", "다음 제작"], en: ["REPLACE", "FATIGUE", "NEXT BRIEF"] } },
  // 5-25·5-26은 배포된 뒤로도 여기 없어서 SoftwareApplication JSON-LD의
  // featureList가 빈 배열이었다(감사 P1-9). 커버리지 테스트가 하드코딩 배열을 돌아
  // 누락을 못 잡았다 — 이제 ROUTES에서 파생한다.
  "5-25": { metrics: { ko: ["VIF", "상관", "분리 가능성"], en: ["VIF", "CORRELATION", "SEPARABILITY"] } },
  "5-27": { metrics: { ko: ["스토어 전환", "소스 믹스", "페이지 효율"], en: ["STORE CVR", "SOURCE MIX", "PAGE EFFICIENCY"] } },
  "5-26": { metrics: { ko: ["검색어", "Exact 승격", "CPT 조정"], en: ["SEARCH TERM", "EXACT PROMOTION", "CPT BID"] } },
  "5-28": { metrics: { ko: ["생존율", "이탈·종료 위험", "관측 반복 가치"], en: ["SURVIVAL", "DROP-OFF RISK", "OBSERVED VALUE"] } },
  "5-29": { metrics: { ko: ["구성 이동 크기", "단위 간 이동", "단위 내부 변화"], en: ["SHIFT SIZE", "MIX", "RATE"] } },
};

// 도구별 카드를 따로 그리지 않는다 — 전 페이지가 같은 정적 카드를 쓴다(routeMap 주석).
// 인자를 남겨 두는 이유: 호출부가 라우트 id·로케일을 그대로 넘기고 있고, 나중에
// 카드를 다시 갈래별로 나눌 때 호출부를 다시 고치지 않기 위해서다.
export function getToolOgImageUrl(siteUrl) {
  return `${siteUrl}${OG_CARD_PATH}`;
}

export function getToolFeatureList(toolId, locale = "ko") {
  const config = TOOL_OG_CONFIG[toolId];
  if (!config) return [];
  const metrics = config.metrics[locale] || config.metrics.ko;
  return [
    ...metrics,
    locale === "en" ? "Client-side CSV analysis" : "브라우저 내 CSV 분석",
    locale === "en" ? "No server upload" : "서버 업로드 없음",
  ];
}
