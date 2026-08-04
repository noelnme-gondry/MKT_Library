"use client";
import { useEffect } from "react";
import { productEventKey, trackProductEventOnce } from "@/lib/analytics";

// 분석 버튼이 숨겨지거나 비활성화되는 상태를 익명 집계한다. signature는 브라우저
// 메모리에서 중복 방지 해시를 만드는 데만 쓰이며 GA payload에는 포함되지 않는다.
export default function AnalysisBlockedTelemetry({
  toolId,
  source = "csv",
  state,
  signature = "",
  rowCount = 0,
  mappedCount = 0,
  conflictCount = 0,
  missingCount = 0,
  analysisType = null,
  locale = "ko",
}) {
  useEffect(() => {
    if (!toolId || !state) return;
    trackProductEventOnce("analysis_blocked", productEventKey(toolId, signature, state, locale), {
      tool_id: toolId,
      source,
      row_count: rowCount,
      mapped_count: mappedCount,
      conflict_count: conflictCount,
      missing_required_count: missingCount,
      analysis_type: analysisType,
      state,
      locale,
    });
  }, [analysisType, conflictCount, locale, mappedCount, missingCount, rowCount, signature, source, state, toolId]);
  return null;
}
