import { ANALYSIS_CONTRACTS, evaluateEligibility, formatEligibilityBlocker } from "./evaluateEligibility";
import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";
import { buildResponseAdapterColMap } from "@/lib/assistant/responseAnalysisAdapters";
import { colMapMissing } from "@/components/tools/MmmColumnMapper";
import { inferMappedDateCadence } from "@/lib/data-import/inferDateCadence";

// The same final input check serves direct-route handoff and queued execution.
// Tool-owned grains still require their own design screen; they are never auto-approved.
export function executionPreflight(data, toolId, locale = "ko") {
  if (toolId.startsWith("5-18-")) {
    // These tools use open-ended channel roles, not the legacy company channel
    // keys. Their adapters perform numeric/panel validation before returning a result.
    const missing = colMapMissing(data.headers || [], buildResponseAdapterColMap(data), locale);
    const cadence = inferMappedDateCadence(data);
    const periods = cadence.cadence === "daily" ? cadence.weeklyPeriodCount : cadence.periodCount;
    const contract = ANALYSIS_CONTRACTS[toolId];
    const enough = contract && (data.raw?.length || 0) >= contract.minRows && (periods || 0) >= contract.minPeriods;
    const blockers = [...missing.map(field => ({ code: "missing_role", field })), ...(!enough ? [{ code: "insufficient_periods" }] : [])];
    return { status: blockers.length ? "blocked" : "ready", scope: "tool_input", blockers, reasonDetails: [], message: missing.length ? missing.join(" · ") : !enough ? (locale === "en" ? "More observation periods are needed." : "관측 기간이 더 필요합니다.") : "" };
  }
  if (!ANALYSIS_CONTRACTS[toolId] || ANALYSIS_CONTRACTS[toolId].foreignGrain) {
    return { status: "blocked", scope: "tool_design", blockers: [{ code: "tool_design" }], message: locale === "en"
      ? "Confirm the observation unit and model in the tool before analysis."
      : "도구에서 관측 단위와 모형을 확인한 뒤 분석하세요." };
  }
  const canonicalData = data.canonicalData || buildCanonicalDataset({ raw: data.raw, headers: data.headers, mapping: data.mapping });
  const result = evaluateEligibility({ mapping: data.mapping, canonicalData, toolId, locale });
  return { ...result, scope: "input", message: formatEligibilityBlocker(result, locale) };
}
