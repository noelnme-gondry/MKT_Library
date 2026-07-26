export const ANALYSIS_STATUS = Object.freeze({
  EMPTY: "EMPTY",
  READY: "READY",
  ANALYZING: "ANALYZING",
  COMPLETE: "COMPLETE",
  STALE: "STALE",
  BLOCKED: "BLOCKED",
  FAILED: "FAILED",
  CANCELED: "CANCELED",
});

export function deriveAnalysisStatus({
  hasData = false,
  hasRequiredMapping = false,
  isAnalyzing = false,
  isAnalyzed = false,
  isStale = false,
  error = null,
  canceled = false,
} = {}) {
  if (isAnalyzing) return ANALYSIS_STATUS.ANALYZING;
  if (error) return ANALYSIS_STATUS.FAILED;
  if (canceled) return ANALYSIS_STATUS.CANCELED;
  if (!hasData) return ANALYSIS_STATUS.EMPTY;
  if (!hasRequiredMapping) return ANALYSIS_STATUS.BLOCKED;
  if (isStale) return ANALYSIS_STATUS.STALE;
  if (isAnalyzed) return ANALYSIS_STATUS.COMPLETE;
  return ANALYSIS_STATUS.READY;
}

export function analysisStatusLabel(status, locale = "ko") {
  const labels = {
    EMPTY: ["데이터 필요", "Data needed"],
    READY: ["분석 가능", "Ready to analyze"],
    ANALYZING: ["분석 중", "Analyzing"],
    COMPLETE: ["분석 완료", "Complete"],
    STALE: ["재분석 필요", "Re-analysis needed"],
    BLOCKED: ["입력 확인 필요", "Input review needed"],
    FAILED: ["분석 실패", "Analysis failed"],
    CANCELED: ["분석 취소됨", "Canceled"],
  };
  return labels[status]?.[locale === "en" ? 1 : 0] || status || "—";
}
