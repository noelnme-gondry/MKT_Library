import { ANALYSIS_CONTRACTS, evaluateEligibility, formatEligibilityBlocker } from "./evaluateEligibility";
import { buildCanonicalDataset } from "@/lib/data-import/buildCanonicalDataset";

// The same final input check serves direct-route handoff and queued execution.
// Tool-owned grains still require their own design screen; they are never auto-approved.
export function executionPreflight(data, toolId, locale = "ko") {
  if (!ANALYSIS_CONTRACTS[toolId] || ANALYSIS_CONTRACTS[toolId].foreignGrain) {
    return { status: "blocked", scope: "tool_design", blockers: [{ code: "tool_design" }], message: locale === "en"
      ? "Confirm the observation unit and model in the tool before analysis."
      : "도구에서 관측 단위와 모형을 확인한 뒤 분석하세요." };
  }
  const canonicalData = data.canonicalData || buildCanonicalDataset({ raw: data.raw, headers: data.headers, mapping: data.mapping });
  const result = evaluateEligibility({ mapping: data.mapping, canonicalData, toolId, locale });
  return { ...result, scope: "input", message: formatEligibilityBlocker(result, locale) };
}
