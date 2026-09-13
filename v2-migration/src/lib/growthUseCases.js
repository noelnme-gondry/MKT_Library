import { PUBLISHED_BLOG_TOOL_MAP } from "./contentToolRegistry";
import { BLOG_INSIGHT_PLACEMENTS } from "./blogInsightRegistry";
import { TOOL_GROUP } from "./toolGroups";

// Article-specific copy overrides. Coverage derives from the published registry.
const CASES = {
  "ad-performance-diagnosis": {
    ko: "CPA가 오른 캠페인의 비용·전환 변화를 확인하고, 다음 조치를 기록하세요.",
    en: "Check spend and action changes in campaigns with rising CPA, then record the next action.",
  },
  "performance-marketing-analysis-order": {
    ko: "두 기간의 성과를 비교하고, 팀 공유 요약과 다음 검토일을 준비하세요.",
    en: "Compare two periods, prepare a team summary and set the next review date.",
  },
  "budget-scaling-limit": {
    ko: "현재 CPA 변화부터 확인하고, 증액 판단은 관측 기간과 지출 변동이 충분한지 점검한 뒤 진행하세요.",
    en: "Check the current CPA change first. Assess scaling only after checking observation length and spend variation.",
  },
};

export function growthUseCase(slug, locale = "ko") {
  const toolId = PUBLISHED_BLOG_TOOL_MAP[slug];
  if (!toolId) return null;
  const practice = BLOG_INSIGHT_PLACEMENTS[slug];
  const canReview = Boolean(practice && TOOL_GROUP[practice.toolId] === "efficiency" && TOOL_GROUP[toolId] === "efficiency");
  return {
    hasPractice: Boolean(practice),
    practiceToolId: practice?.toolId || null,
    canReview,
    description: CASES[slug]?.[locale === "en" ? "en" : "ko"] || (locale === "en"
      ? "Check the required columns and prepare your data for the related analysis."
      : "필요한 컬럼을 확인하고, 관련 분석에 사용할 데이터를 준비하세요."),
  };
}
