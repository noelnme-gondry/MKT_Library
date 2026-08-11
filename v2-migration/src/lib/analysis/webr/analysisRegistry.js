export const WEBR_ANALYSIS_IDS = Object.freeze({
  BINARY_LOGISTIC_REGRESSION: "binary_logistic_regression",
});

export const WEBR_ANALYSES = Object.freeze({
  [WEBR_ANALYSIS_IDS.BINARY_LOGISTIC_REGRESSION]: Object.freeze({
    id: WEBR_ANALYSIS_IDS.BINARY_LOGISTIC_REGRESSION,
    engine: "webr",
    kind: "advanced",
    packages: Object.freeze(["sandwich"]),
    minMinorityOutcomesPerParameter: 10,
    resultKind: "logistic-regression",
  }),
});

export function getWebRAnalysisDefinition(analysisId) {
  return WEBR_ANALYSES[analysisId] || null;
}
