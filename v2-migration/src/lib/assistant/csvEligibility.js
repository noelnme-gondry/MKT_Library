import { ANALYSIS_CATALOG } from "@/lib/assistant/analysisCatalog";
import { evaluateAnalysisEligibility, rankRecommendedAnalyses } from "@/lib/assistant/evaluateAnalysisEligibility";
import { buildMappingContract } from "@/lib/data-import/mappingContract";
import { inferMappedDateCadence } from "@/lib/data-import/inferDateCadence";
import { buildResponseAdapterColMap } from "@/lib/assistant/responseAnalysisAdapters";

/**
 * "이 CSV로 지금 어떤 분석이 되는가" — 한 곳에서만 판정한다.
 *
 * 예전에는 `AssistantWorkspace` 안의 지역 함수였다. 그래서 업로드 화면을 떠나
 * 도구로 들어가는 순간 같은 판정을 다시 할 방법이 없었고, "이 데이터로 뭘 더
 * 할 수 있나"가 화면에서 사라졌다. 판정을 컴포넌트 밖에 두면 어느 화면에서든
 * 같은 답을 쓸 수 있다(§7 — 두 곳에 나열하지 말고 파생).
 *
 * 무겁다: 카탈로그 19개에 대해 매핑 계약을 만든다. 행을 재구성하지는 않지만
 * 부르는 쪽이 분석 게이트 뒤에서만 부르도록 할 것(§4.4).
 */
export function mappedKeys(mapping = {}) {
  return new Set(Object.values(mapping).filter((value) => value && value !== "__ignore__"));
}

function detectedGrain(entry, fields, cadence) {
  const has = (key) => fields.has(key);
  if (has("tenure_periods") && has("event_observed")) return "subscription_episode";
  if (has("search_term")) return "asa_keyword_daily";
  if (has("creative_id") && has("impressions")) {
    // A creative dimension does not invalidate additive campaign metrics.
    // Keep creative-only spend schemas separate; efficiency requires its cost key.
    if (has("date") && has("cost")) {
      if (entry.supportedGrains.includes("campaign_daily")) return "campaign_daily";
      if (entry.supportedGrains.includes("channel_spend_timeseries") && (has("channel") || has("campaign_name"))) return "channel_spend_timeseries";
    }
    return "creative_daily";
  }
  if (has("store_source") && has("product_page_views")) return "store_funnel_daily";
  if (entry.supportedGrains.includes("weekly_panel")
    && (has("week") || has("date") || has("iso_week_start"))
    && ["daily", "weekly", "monthly"].includes(cadence)) return "weekly_panel";
  if (has("iso_week_start") || has("mmm_reg") || [...fields].some((key) => key.startsWith("ch_"))) return "weekly_panel";
  if (has("is_control") || has("arm_id")) return "experiment_aggregate";
  if (entry.toolId === "5-25" && has("date") && has("cost") && (has("channel") || has("campaign_name"))) return "channel_spend_timeseries";
  if (has("date") && (has("cost") || has("spend"))) return "campaign_daily";
  return "unknown";
}

export function profileFor(entry, { raw = [], headers = [], mapping = {} } = {}) {
  const fields = mappedKeys(mapping);
  const cadence = inferMappedDateCadence({ raw, headers, mapping });
  const headerFor = (field) => headers.find((header) => mapping[header] === field);
  const tenureHeader = headerFor("tenure_periods");
  const periodCount = entry.supportedGrains.includes("weekly_panel") && cadence.cadence === "daily"
    ? cadence.weeklyPeriodCount
    : cadence.periodCount;
  return {
    rowCount: raw.length,
    periodCount,
    cadence: cadence.cadence,
    grain: detectedGrain(entry, fields, cadence.cadence),
    validEpisodeCount: entry.toolId === "5-28"
      ? raw.filter((row) => Number.isFinite(Number(row?.[tenureHeader]))).length
      : undefined,
  };
}

export function mergedToolMapping(mappingContract, globalMapping = {}) {
  const mapping = { ...(mappingContract?.mapping || {}) };
  Object.entries(globalMapping).forEach(([header, field]) => {
    if (field && field !== "__ignore__") mapping[header] = field;
  });
  return mapping;
}


/** 카탈로그 전체 자격 판정. 추천 순으로 정렬된 결과 배열. */
export function computeCsvEligibility({ raw = [], headers = [], mapping = {}, mappingBindingsV2 = [], fileName = "", locale = "ko", mappingContracts = null } = {}) {
  if (!raw.length || !headers.length) return [];
  const responseColMap = buildResponseAdapterColMap({ raw, headers, mapping, mappingBindingsV2 });
  return rankRecommendedAnalyses(ANALYSIS_CATALOG.map((entry) => {
    const mappingContract = mappingContracts?.[entry.toolId] || buildMappingContract({ toolId: entry.toolId, headers, rows: raw, source: fileName || "dataset" });
    const toolMapping = mergedToolMapping(mappingContract, mapping);
    return evaluateAnalysisEligibility({
      toolId: entry.toolId,
      locale,
      mapping: toolMapping,
      mappingContract,
      responseColMap,
      profile: profileFor(entry, { raw, headers, mapping: toolMapping }),
    });
  }));
}

/** 자격 통과한 도구 id만. 화면이 "되는 것"을 고를 때 쓴다. */
export function eligibleToolIds(results = []) {
  return results.filter((result) => result.status !== "blocked").map((result) => result.toolId);
}
