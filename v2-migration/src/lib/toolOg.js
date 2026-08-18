import { getRouteSeo } from "./routeSeo";

export const TOOL_OG_CONFIG = {
  "5-2": { accent: "#68a8ff", glyph: "MONITOR", metrics: { ko: ["비용", "설치", "CPI", "ROAS"], en: ["SPEND", "INSTALLS", "CPI", "ROAS"] } },
  "5-21": { accent: "#a78bfa", glyph: "EXPLAIN", metrics: { ko: ["물량", "효율", "믹스"], en: ["VOLUME", "RATE", "MIX"] } },
  "5-22": { accent: "#fb7185", glyph: "SCALE", metrics: { ko: ["한계 CPA", "포화", "여유"], en: ["MARGINAL CPA", "SATURATED", "HEADROOM"] } },
  "5-18": { accent: "#f59e0b", glyph: "MODEL", metrics: { ko: ["추세", "잠식", "기여", "예측"], en: ["TREND", "CANNIBAL", "CONTRIBUTION", "FORECAST"] } },
  "5-18-trend": { accent: "#38bdf8", glyph: "TREND", metrics: { ko: ["기준선", "계절성", "이상 주차"], en: ["BASELINE", "SEASONALITY", "ANOMALY"] } },
  "5-18-paid-organic": { accent: "#7aa2f7", glyph: "P/O MAP", metrics: { ko: ["ORGANIC WOW", "PAID WOW", "최근 궤적"], en: ["ORGANIC WOW", "PAID WOW", "RECENT PATH"] } },
  "5-18-cannibal": { accent: "#fb7185", glyph: "CANNIBAL", metrics: { ko: ["유료", "오가닉", "잠식 신호"], en: ["PAID", "ORGANIC", "DISPLACEMENT"] } },
  "5-18-mmm": { accent: "#a78bfa", glyph: "MMM", metrics: { ko: ["채널", "기본 수요", "기여도"], en: ["CHANNEL", "BASE DEMAND", "CONTRIBUTION"] } },
  "5-18-forecast": { accent: "#4ade80", glyph: "FORECAST", metrics: { ko: ["예측", "OOS", "불확실성"], en: ["FORECAST", "OOS", "UNCERTAINTY"] } },
  "5-3": { accent: "#5eead4", glyph: "ALLOCATE", metrics: { ko: ["늘릴 곳", "줄일 곳", "제약"], en: ["INCREASE", "DECREASE", "CONSTRAINTS"] } },
  "5-4": { accent: "#facc15", glyph: "PROVE", metrics: { ko: ["표본수", "LIFT", "검정력"], en: ["SAMPLE", "LIFT", "POWER"] } },
  "5-20": { accent: "#c084fc", glyph: "LEARN", metrics: { ko: ["행동", "리프트", "지지도"], en: ["ACTION", "LIFT", "SUPPORT"] } },
  "5-23": { accent: "#4ade80", glyph: "INCREMENT", metrics: { ko: ["통제군", "증분", "신뢰구간"], en: ["HOLDOUT", "INCREMENT", "INTERVAL"] } },
  "5-24": { accent: "#f472b6", glyph: "BRAND LIFT", metrics: { ko: ["브랜드 검색", "ITS", "증가분"], en: ["BRAND SEARCH", "ITS", "LIFT"] } },
  "9-1": { accent: "#38bdf8", glyph: "ELEMENTS", metrics: { ko: ["요소", "효과", "신뢰구간"], en: ["ELEMENT", "EFFECT", "INTERVAL"] } },
  "9-6": { accent: "#f97316", glyph: "CREATIVE", metrics: { ko: ["교체", "피로", "다음 제작"], en: ["REPLACE", "FATIGUE", "NEXT BRIEF"] } },
  // 5-25·5-26은 배포된 뒤로도 여기 없어서 generic /og-card.png를 쓰고 있었고,
  // SoftwareApplication JSON-LD의 featureList가 빈 배열이었다(감사 P1-9).
  // 커버리지 테스트가 하드코딩 배열을 돌아 누락을 못 잡았다 — 이제 ROUTES에서 파생한다.
  "5-25": { accent: "#818cf8", glyph: "COLLINEAR", metrics: { ko: ["VIF", "상관", "분리 가능성"], en: ["VIF", "CORRELATION", "SEPARABILITY"] } },
  "5-27": { accent: "#2dd4bf", glyph: "STORE", metrics: { ko: ["스토어 전환", "소스 믹스", "페이지 효율"], en: ["STORE CVR", "SOURCE MIX", "PAGE EFFICIENCY"] } },
  "5-26": { accent: "#2dd4bf", glyph: "ASA", metrics: { ko: ["검색어", "Exact 승격", "CPT 조정"], en: ["SEARCH TERM", "EXACT PROMOTION", "CPT BID"] } },
};

export function getToolOgData(toolId, locale = "ko") {
  const config = TOOL_OG_CONFIG[toolId];
  const seo = getRouteSeo(toolId, locale);
  if (!config || !seo) return null;
  return {
    toolId,
    locale,
    title: seo.title,
    description: seo.description,
    accent: config.accent,
    glyph: config.glyph,
    metrics: config.metrics[locale] || config.metrics.ko,
  };
}

export function getToolOgImageUrl(siteUrl, toolId, locale = "ko") {
  if (!TOOL_OG_CONFIG[toolId]) return `${siteUrl}/og-card.png`;
  return `${siteUrl}/og/tool/${encodeURIComponent(toolId)}${locale === "en" ? "?lang=en" : ""}`;
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
